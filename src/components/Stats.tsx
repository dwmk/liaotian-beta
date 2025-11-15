// src/components/Stats.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users, FileText, MessageSquare, Heart, Loader2, Database, AlertTriangle,
  Clock, TrendingUp, UserPlus, Activity
} from 'lucide-react';

// --- CONFIGURATION CONSTANTS ---

// Define the exact launch timestamp for the platform (UTC time)
const PLATFORM_LAUNCH_DATE = '2025-11-07T12:51:03.751Z';

// Define the tables you want to get entry counts for.
const TABLE_COUNT_STATS = [
  { key: 'profiles', icon: Users, description: 'Total User Accounts', type: 'count' as const, table: 'profiles' },
  { key: 'posts', icon: FileText, description: 'Total Content Posts', type: 'count' as const, table: 'posts' },
  { key: 'messages', icon: MessageSquare, description: '(Your) Total Messages', type: 'count' as const, table: 'messages' },
  { key: 'likes', icon: Heart, description: 'Total Likes/Reactions', type: 'count' as const, table: 'likes' },
  { key: 'comments', icon: MessageSquare, description: 'Total Comments', type: 'count' as const, table: 'comments' },
];

// Time constants for calculating past dates and activity checks
const USER_ACTIVITY_STATS = [
  { key: 'online_now', icon: Clock, description: 'Currently Online (Last 5 min)', type: 'activity' as const, minutes: 5 },
  { key: 'online_24h', icon: Clock, description: 'Online in last 24 hours', type: 'activity' as const, minutes: 24 * 60 },
  { key: 'online_7d', icon: Clock, description: 'Online in last 7 days', type: 'activity' as const, minutes: 7 * 24 * 60 },
  { key: 'online_30d', icon: Clock, description: 'Online in last 30 days', type: 'activity' as const, minutes: 30 * 24 * 60 },
  { key: 'online_1y', icon: Clock, description: 'Online in last year', type: 'activity' as const, minutes: 365 * 24 * 60 },
];

const RECENT_LIMIT = 5; // Number of users to fetch for recent panels

// --- TYPE DEFINITIONS ---

type StatType = 'count' | 'activity' | 'highest_follower' | 'recent_users' | 'recent_online' | 'time_since_launch';

// Profile type for lists
type ProfileListItem = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count?: number;
  created_at?: string; // For recently joined
  last_seen?: string; // For recently online
};

// Generic type for a fetched statistic
type Statistic = {
  key: string;
  label: string;
  icon: React.ElementType;
  value: number | string | { profile: ProfileListItem } | { list: ProfileListItem[] } | 'Error';
  error: boolean;
  errorMessage?: string;
  type: StatType;
};

// --- HELPER FUNCTIONS ---

// Calculates the timestamp string N minutes ago
const getNMinutesAgo = (minutes: number): string => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
};

// Helper function to calculate time difference and format it as requested
const calculateTimeSinceLaunch = (launchDate: string): string => {
    const start = new Date(launchDate).getTime();
    const now = new Date().getTime();
    let diffMs = now - start;

    if (diffMs < 0) return 'Platform launching soon!';

    const msInHour = 1000 * 60 * 60;
    const msInDay = msInHour * 24;

    let remainingMs = diffMs;
    const parts = [];

    // Approximation for Years (365.25 days)
    const years = Math.floor(remainingMs / (msInDay * 365.25));
    if (years > 0) {
        parts.push(`${years} year(s)`);
        remainingMs %= (msInDay * 365.25);
    }

    // Approximation for Months (30.44 days)
    const months = Math.floor(remainingMs / (msInDay * 30.44));
    if (months > 0) {
        parts.push(`${months} month(s)`);
        remainingMs %= (msInDay * 30.44);
    }

    // Exact Days and Hours from remaining milliseconds
    const days = Math.floor(remainingMs / msInDay);
    remainingMs %= msInDay;

    const hours = Math.floor(remainingMs / msInHour);

    if (years > 0 || months > 0) {
        // Maximum format: YY years MM months DD days HH hours
        if (days > 0) parts.push(`${days} day(s)`);
        if (hours > 0) parts.push(`${hours} hour(s)`);
        return parts.join(' ');
    } else {
        // Minimum format: DD days and HH hours
        return `${days} day(s) and ${hours} hour(s)`;
    }
};

// --- FETCH LOGIC ---

// Fetches counts for standard tables
const fetchTableCounts = async (): Promise<Statistic[]> => {
  const fetchPromises = TABLE_COUNT_STATS.map(async (stat) => {
    try {
      const { count, error } = await supabase
        .from(stat.table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        const errorMessage = error.code === '42P01' ? `(Table "${stat.table}" not found)` : `(DB Error: ${error.message})`;
        return {
            key: stat.key,
            label: stat.description,
            icon: stat.icon,
            value: 'Error',
            error: true,
            errorMessage,
            type: stat.type
        } as Statistic;
      }
      return {
          key: stat.key,
          label: stat.description,
          icon: stat.icon,
          value: count || 0,
          error: false,
          type: stat.type
      } as Statistic;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
      return {
          key: stat.key,
          label: stat.description,
          icon: stat.icon,
          value: 'Error',
          error: true,
          errorMessage: `(${errorMessage})`,
          type: stat.type
      } as Statistic;
    }
  });
  return Promise.all(fetchPromises);
};

// Fetches user activity counts based on last_seen column
const fetchActivityStats = async (): Promise<Statistic[]> => {
  const fetchPromises = USER_ACTIVITY_STATS.map(async (stat) => {
    try {
      const cutoffTime = getNMinutesAgo(stat.minutes);

      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', cutoffTime); // Greater than or Equal to cutoff time

      if (error) {
        const errorMessage = `(DB Error: ${error.message})`;
        return {
            key: stat.key,
            label: stat.description,
            icon: stat.icon,
            value: 'Error',
            error: true,
            errorMessage,
            type: stat.type
        } as Statistic;
      }
      return {
          key: stat.key,
          label: stat.description,
          icon: stat.icon,
          value: count || 0,
          error: false,
          type: stat.type
      } as Statistic;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
      return {
          key: stat.key,
          label: stat.description,
          icon: stat.icon,
          value: 'Error',
          error: true,
          errorMessage: `(${errorMessage})`,
          type: stat.type
      } as Statistic;
    }
  });
  return Promise.all(fetchPromises);
};

// Finds the profile with the most followers by querying the 'follows' table and manually aggregating
const fetchHighestFollower = async (): Promise<Statistic> => {
    const key = 'highest_followers';
    const label = 'Highest Followers';
    const icon = TrendingUp;

    try {
        // 1. Fetch all profiles
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url');

        if (profilesError) throw profilesError;

        // 2. Fetch all follows
        // NOTE: This relies on Row Level Security (RLS) allowing a bulk read of the 'follows' table.
        const { data: followsData, error: followsError } = await supabase
            .from('follows')
            .select('following_id'); // 'following_id' is the ID of the user being followed

        if (followsError) throw followsError;

        // 3. Aggregate followers count
        const followerCounts: { [key: string]: number } = {};
        for (const follow of followsData) {
            const followedId = follow.following_id;
            followerCounts[followedId] = (followerCounts[followedId] || 0) + 1;
        }

        // 4. Find the profile with the highest count
        let topProfileId: string | null = null;
        let maxFollowers = -1;

        for (const [id, count] of Object.entries(followerCounts)) {
            if (count > maxFollowers) {
                maxFollowers = count;
                topProfileId = id;
            }
        }

        // 5. Find the full profile data for the top ID
        const topProfileData = profilesData.find(p => p.id === topProfileId);

        let finalProfile: ProfileListItem;

        if (topProfileData && topProfileId) {
             finalProfile = {
                id: topProfileId,
                username: topProfileData.username,
                display_name: topProfileData.display_name,
                avatar_url: topProfileData.avatar_url,
                follower_count: maxFollowers,
            };
        } else {
            // Fallback for when no follows exist (maxFollowers = -1) or no profile is found
             finalProfile = {
                id: 'N/A',
                username: 'system',
                display_name: 'No Followers Yet',
                avatar_url: 'https://placehold.co/64x64/60A5FA/FFFFFF?text=NA',
                follower_count: 0,
            };
        }

        return {
            key, label, icon,
            value: { profile: finalProfile },
            error: false,
            type: 'highest_follower'
        } as Statistic;

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
        return {
            key, label, icon,
            value: 'Error',
            error: true,
            errorMessage: `(Failed to calculate top profile: ${errorMessage})`,
            type: 'highest_follower'
        } as Statistic;
    }
};

// Fetches the calculated time since launch
const fetchTimeSinceLaunch = async (): Promise<Statistic> => {
    const key = 'time_since_launch';
    const label = 'Time Since Launch';
    const icon = Clock;

    try {
        const timeString = calculateTimeSinceLaunch(PLATFORM_LAUNCH_DATE);
        return {
            key, label, icon,
            value: timeString,
            error: false,
            type: 'time_since_launch'
        } as Statistic;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
        return {
            key, label, icon,
            value: 'Error',
            error: true,
            errorMessage: `(Failed to calculate time: ${errorMessage})`,
            type: 'time_since_launch'
        } as Statistic;
    }
};

// Fetches the 5 most recently joined users by 'created_at'
const fetchRecentlyJoinedUsers = async (): Promise<Statistic> => {
    const key = 'recently_joined';
    const label = '5 Most Recently Joined Users';
    const icon = UserPlus;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, created_at')
            .order('created_at', { ascending: false })
            .limit(RECENT_LIMIT);

        if (error) throw error;

        return {
            key, label, icon,
            value: { list: data as ProfileListItem[] },
            error: false,
            type: 'recent_users'
        } as Statistic;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
        return {
            key, label, icon,
            value: 'Error',
            error: true,
            errorMessage: `(Failed to fetch recent users: ${errorMessage})`,
            type: 'recent_users'
        } as Statistic;
    }
}

// Fetches the 5 most recently online users by 'last_seen'
const fetchRecentlyOnlineUsers = async (): Promise<Statistic> => {
    const key = 'recently_online';
    const label = '5 Most Recently Online Users';
    const icon = Activity;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, last_seen')
            .not('last_seen', 'is', null) // Only consider users who have a last_seen timestamp
            .order('last_seen', { ascending: false })
            .limit(RECENT_LIMIT);

        if (error) throw error;

        return {
            key, label, icon,
            value: { list: data as ProfileListItem[] },
            error: false,
            type: 'recent_online'
        } as Statistic;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
        return {
            key, label, icon,
            value: 'Error',
            error: true,
            errorMessage: `(Failed to fetch recent online users: ${errorMessage})`,
            type: 'recent_online'
        } as Statistic;
    }
}


// --- MAIN COMPONENT ---

export const Stats: React.FC = () => {
  const [stats, setStats] = useState<Statistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      setInitialLoadError(null);

      try {
        const [
          tableCounts,
          activityStats,
          highestFollowerStat,
          timeSinceLaunchStat,
          recentlyJoinedUsersStat,
          recentlyOnlineUsersStat,
        ] = await Promise.all([
          fetchTableCounts(),
          fetchActivityStats(),
          fetchHighestFollower(),
          fetchTimeSinceLaunch(), // Fetch new stat
          fetchRecentlyJoinedUsers(),
          fetchRecentlyOnlineUsers(),
        ]);

        const allStats: Statistic[] = [
            ...tableCounts,
            ...activityStats,
            highestFollowerStat,
            timeSinceLaunchStat, // Add to allStats
            recentlyJoinedUsersStat,
            recentlyOnlineUsersStat,
        ];

        setStats(allStats);

      } catch (e) {
        setInitialLoadError('Failed to fetch statistics due to a critical, unexpected error.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllStats();
  }, []);

  if (initialLoadError) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-100 border border-red-400 rounded-xl shadow-xl">
        <h2 className="flex items-center text-xl font-bold text-red-800 mb-4">
          <AlertTriangle className="mr-2 h-6 w-6" /> Statistics Load Error
        </h2>
        <p className="text-red-700">{initialLoadError}</p>
      </div>
    );
  }

  // Renders a single statistic value card (e.g., Total Users, Online Now)
  const renderStatCard = (stat: Statistic) => {
    const Icon = stat.icon;
    const isError = stat.error || stat.value === 'Error';

    return (
        <div
            key={stat.key}
            className={`p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl
              ${isError ? 'bg-red-50 border border-red-200' : 'bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]'}
            `}
        >
            <div className="flex items-start justify-between">
                <div
                    className={`p-3 rounded-full ${isError ? 'bg-red-500' : 'bg-[rgba(var(--color-primary),0.1)]'}`}
                >
                    <Icon
                      className={`h-6 w-6 ${isError ? 'text-white' : 'text-[rgb(var(--color-primary))]'}`}
                    />
                </div>
            </div>
            <div className="mt-4">
                <p className="text-sm font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
                    {stat.label}
                </p>
                {isError ? (
                    <div className="flex items-center mt-1 text-2xl font-bold text-red-600">
                      <AlertTriangle className="h-5 w-5 mr-1" />
                      ERROR
                    </div>
                ) : (
                    <p className="mt-1 text-4xl font-extrabold text-[rgb(var(--color-text))]">
                      {(stat.value as number).toLocaleString()}
                    </p>
                )}
                {isError && (
                  <p className="text-xs text-red-500 mt-1">
                      {stat.errorMessage}
                  </p>
                )}
            </div>
        </div>
    );
  };

  // Renders a list of profiles (e.g., Recently Joined/Online)
  const renderProfileListCard = (stat: Statistic) => {
    const Icon = stat.icon;
    const isError = stat.error || stat.value === 'Error';
    const list = !isError && typeof stat.value !== 'number' && typeof stat.value !== 'string' && 'list' in stat.value ? stat.value.list : [];
    const isRecentlyOnline = stat.key === 'recently_online';


    return (
        <div key={stat.key} className="p-6 rounded-xl shadow-lg bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] h-full">
            <h3 className="text-sm font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider flex items-center mb-4 border-b pb-2 border-[rgb(var(--color-border))]">
                <Icon className="h-4 w-4 mr-2 text-[rgb(var(--color-primary))]" /> {stat.label}
            </h3>
            {isError ? (
                <div className="text-red-500 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" /> {stat.errorMessage || 'Error fetching list.'}
                </div>
            ) : list.length === 0 ? (
                <p className="text-[rgb(var(--color-text-secondary))]">No users found.</p>
            ) : (
                <ul className="space-y-3">
                    {list.map((profile, index) => (
                        <li key={profile.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <img
                                    src={profile.avatar_url || `https://placehold.co/40x40/60A5FA/FFFFFF?text=${profile.display_name.charAt(0)}`}
                                    alt={`${profile.username}'s avatar`}
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).onerror = null;
                                        (e.target as HTMLImageElement).src = `https://placehold.co/40x40/60A5FA/FFFFFF?text=${profile.display_name.charAt(0)}`;
                                    }}
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[rgb(var(--color-text))] truncate">{profile.display_name}</p>
                                    <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">@{profile.username}</p>
                                </div>
                            </div>
                            <p className="text-xs font-semibold text-[rgb(var(--color-primary))] flex-shrink-0 ml-2">
                                {isRecentlyOnline ? formatTimeAgo(profile.last_seen) : formatTimeAgo(profile.created_at)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
  };

  // Renders the Highest Followers Profile card
  const renderHighestFollowerCard = (stat: Statistic) => {
    const Icon = stat.icon;
    const isError = stat.error || stat.value === 'Error';
    const isProfile = !isError && typeof stat.value !== 'number' && typeof stat.value !== 'string' && 'profile' in stat.value;
    const profile = isProfile ? (stat.value as { profile: ProfileListItem }).profile : null;

    if (isError) {
        return (
             <div key={stat.key} className="p-6 rounded-xl shadow-lg bg-red-50 border border-red-200">
                <h3 className="text-sm font-medium text-red-800 uppercase tracking-wider flex items-center mb-4">
                    <AlertTriangle className="h-4 w-4 mr-2" /> {stat.label}
                </h3>
                <p className="text-red-600">{stat.errorMessage || 'Failed to fetch top profile.'}</p>
             </div>
        )
    }

    if (profile) {
        return (
            <div key={stat.key} className="p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider flex items-center">
                        <Icon className="h-4 w-4 mr-2 text-[rgb(var(--color-primary))]" /> {stat.label}
                    </h3>
                    <TrendingUp className="h-6 w-6 text-[rgb(var(--color-primary))]" />
                </div>
                <div className="flex items-center space-x-6 p-4 rounded-lg bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))]">
                    <img
                        src={profile.avatar_url}
                        alt={`${profile.username}'s avatar`}
                        className="w-16 h-16 rounded-full object-cover border-4 border-[rgb(var(--color-accent))]"
                        onError={(e) => {
                            (e.target as HTMLImageElement).onerror = null;
                            (e.target as HTMLImageElement).src = `https://placehold.co/64x64/60A5FA/FFFFFF?text=${profile.display_name.charAt(0)}`;
                        }}
                    />
                    <div>
                        <p className="text-xl font-bold text-[rgb(var(--color-text))]">
                            {profile.display_name}
                        </p>
                        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                            @{profile.username}
                        </p>
                        <p className="mt-1 text-3xl font-extrabold text-[rgb(var(--color-text))]">
                            {profile.follower_count ? profile.follower_count.toLocaleString() : 'N/A'}
                            <span className="ml-2 text-base font-normal text-[rgb(var(--color-primary))]">Followers</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    return null;
  };

  // Renders the Time Since Launch card
  const renderTimeSinceLaunchCard = (stat: Statistic) => {
      const Icon = stat.icon;
      const isError = stat.error || stat.value === 'Error';

      if (isError) {
          return (
               <div key={stat.key} className="p-4 rounded-xl shadow-md bg-red-50 border border-red-200 h-full">
                  <h4 className="text-xs font-medium text-red-800 uppercase tracking-wider flex items-center mb-1">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {stat.label}
                  </h4>
                  <p className="text-red-600 text-sm">{stat.errorMessage || 'Failed to fetch time.'}</p>
               </div>
          );
      }

      return (
          <div key={stat.key} className="p-4 rounded-xl shadow-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] h-full flex flex-col justify-center">
              <h4 className="text-xs font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider flex items-center mb-1">
                  <Icon className="h-4 w-4 mr-2 text-[rgb(var(--color-primary))]" /> {stat.label}
              </h4>
              <p className="text-base font-bold text-[rgb(var(--color-text))] break-words">
                  {stat.value as string}
              </p>
          </div>
      );
  };


  const tableStats = stats.filter(s => s.type === 'count');
  const activityStats = stats.filter(s => s.type === 'activity');
  const highestFollowerStat = stats.find(s => s.type === 'highest_follower');
  const timeSinceLaunchStat = stats.find(s => s.type === 'time_since_launch');
  const recentlyJoinedUsersStat = stats.find(s => s.type === 'recent_users');
  const recentlyOnlineUsersStat = stats.find(s => s.type === 'recent_online');


  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center mb-10">
        <h2 className="text-4xl font-extrabold text-[rgb(var(--color-text))] tracking-tight">
          Platform Statistics
        </h2>
        <p className="ml-3 mt-1 text-lg text-[rgb(var(--color-text-secondary))]">
          Database counts and user activity.
        </p>
      </div>

      {loading ? (
        <div className="col-span-full flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--color-primary))]" />
          <span className="ml-3 text-lg text-[rgb(var(--color-text-secondary))]">Loading Platform Stats...</span>
        </div>
      ) : (
        <>
          {/* Top Community & Recent Activity Section - Replaces Usage Stats */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> Community & Recent Activity
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Column 1: Highest Follower Profile & Time Since Launch */}
            <div className="lg:col-span-1 flex flex-col gap-6">
                {highestFollowerStat && (
                    renderHighestFollowerCard(highestFollowerStat)
                )}
                {timeSinceLaunchStat && (
                    renderTimeSinceLaunchCard(timeSinceLaunchStat)
                )}
            </div>
            {/* Column 2: Recently Joined Users */}
            {recentlyJoinedUsersStat && (
                <div className="lg:col-span-1">
                    {renderProfileListCard(recentlyJoinedUsersStat)}
                </div>
            )}
            {/* Column 3: Recently Online Users */}
            {recentlyOnlineUsersStat && (
                 <div className="lg:col-span-1">
                    {renderProfileListCard(recentlyOnlineUsersStat)}
                </div>
            )}
          </div>

          {/* User Activity Counts Section */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> User Activity Counts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
            {activityStats.map(renderStatCard)}
          </div>

          {/* Core Table Counts Section */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> Core Database Entries
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {tableStats.map(renderStatCard)}
          </div>
        </>
      )}
    </div>
  );
};
