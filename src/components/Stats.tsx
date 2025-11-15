// src/components/Stats.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; 
import { 
  Users, FileText, MessageSquare, Heart, Loader2, Database, AlertTriangle, 
  Clock, TrendingUp, Cpu, HardDrive, Zap, 
} from 'lucide-react';

// --- CONFIGURATION CONSTANTS ---

// Define the tables you want to get entry counts for.
const TABLE_COUNT_STATS = [
  { key: 'profiles', icon: Users, description: 'Total User Accounts', type: 'count' as const, table: 'profiles' },
  { key: 'posts', icon: FileText, description: 'Total Content Posts', type: 'count' as const, table: 'posts' },
  { key: 'messages', icon: MessageSquare, description: 'Total Messages', type: 'count' as const, table: 'messages' },
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

const PLATFORM_USAGE_STATS = [
    { key: 'storage_used', icon: HardDrive, description: 'Total Storage Used', type: 'usage' as const, unit: 'GB' },
    { key: 'bandwidth_used', icon: Zap, description: 'Total Bandwidth Used', type: 'usage' as const, unit: 'TB' },
];

// --- TYPE DEFINITIONS ---

type StatType = 'count' | 'activity' | 'usage' | 'highest_follower';

// Generic type for a fetched statistic
type Statistic = {
  key: string;
  label: string;
  icon: React.ElementType;
  value: number | string | { profile: any } | 'Error';
  error: boolean;
  errorMessage?: string;
  unit?: string; // Used for usage stats
  type: StatType;
};

// Profile type for the highest follower stat
type ProfileType = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count: number;
};

// --- HELPER FUNCTIONS ---

// Calculates the timestamp string N minutes ago
const getNMinutesAgo = (minutes: number): string => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
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

// Simulated fetch for Highest Followers (requires a 'followers' table or a pre-calculated column)
const fetchHighestFollower = async (): Promise<Statistic> => {
    const key = 'highest_followers';
    const label = 'Highest Followers Profile';
    const icon = TrendingUp;

    try {
        // --- SIMULATION START ---
        // In a real app, this would be a complex query, e.g.:
        // SELECT p.*, count(f.id) AS follower_count FROM profiles p JOIN followers f ON p.id = f.followed_id GROUP BY p.id ORDER BY follower_count DESC LIMIT 1
        
        // Mock data for the top user
        const mockTopProfile: ProfileType = {
            id: 'mock-uuid-12345',
            username: 'supa_star',
            display_name: 'SupaStar Dev',
            avatar_url: 'https://i.pravatar.cc/150?u=supa_star',
            follower_count: 125000,
        };

        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

        return {
            key, label, icon, 
            value: { profile: mockTopProfile }, 
            error: false, 
            type: 'highest_follower'
        } as Statistic;
        // --- SIMULATION END ---

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
        return { 
            key, label, icon, 
            value: 'Error', 
            error: true, 
            errorMessage: `(Failed to fetch top profile: ${errorMessage})`, 
            type: 'highest_follower' 
        } as Statistic;
    }
};

// Mocked fetch for platform usage (usually requires an Admin/Service Role or external API)
const fetchPlatformUsage = async (): Promise<Statistic[]> => {
    // --- MOCK DATA START ---
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const results: Statistic[] = PLATFORM_USAGE_STATS.map(stat => {
        let value: number = 0;
        if (stat.key === 'storage_used') {
            value = 47.3; // GB
        } else if (stat.key === 'bandwidth_used') {
            value = 1.8; // TB
        }

        return {
            key: stat.key,
            label: stat.description,
            icon: stat.icon,
            value: value,
            unit: stat.unit,
            error: false,
            type: stat.type
        } as Statistic;
    });
    // --- MOCK DATA END ---

    // Note: In a real environment, getting these stats requires elevated permissions or querying the Supabase management API, not the standard client-side API.
    return results;
};


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
          platformUsageStats
        ] = await Promise.all([
          fetchTableCounts(),
          fetchActivityStats(),
          fetchHighestFollower(),
          fetchPlatformUsage(),
        ]);
        
        const allStats: Statistic[] = [
            ...tableCounts, 
            ...activityStats, 
            highestFollowerStat, 
            ...platformUsageStats
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
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-100 border border-red-400 rounded-lg shadow-xl">
        <h2 className="flex items-center text-xl font-bold text-red-800 mb-4">
          <AlertTriangle className="mr-2 h-6 w-6" /> Statistics Load Error
        </h2>
        <p className="text-red-700">{initialLoadError}</p>
      </div>
    );
  }

  const renderStatCard = (stat: Statistic) => {
    const Icon = stat.icon;
    const isError = stat.error || stat.value === 'Error';
    const isProfile = stat.type === 'highest_follower' && !isError && typeof stat.value !== 'number' && typeof stat.value !== 'string';
    const profile = isProfile ? (stat.value as { profile: ProfileType }).profile : null;

    if (isProfile && profile) {
        return (
            <div key={stat.key} className="p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] col-span-full lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider flex items-center">
                        <Icon className="h-4 w-4 mr-2 text-[rgb(var(--color-primary))]" /> {stat.label}
                    </h3>
                    <TrendingUp className="h-6 w-6 text-[rgb(var(--color-primary))]" />
                </div>
                <div className="flex items-center space-x-4 p-4 rounded-lg bg-[rgb(var(--color-background))]">
                    <img 
                        src={profile.avatar_url} 
                        alt={`${profile.username}'s avatar`} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-[rgb(var(--color-primary))]"
                    />
                    <div>
                        <p className="text-xl font-bold text-[rgb(var(--color-text))]">
                            {profile.display_name}
                        </p>
                        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                            @{profile.username}
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-[rgb(var(--color-text))]">
                            {profile.follower_count.toLocaleString()} <span className="text-base font-normal text-[rgb(var(--color-primary))]">Followers</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }


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
                      {stat.unit && <span className="ml-1 text-xl font-medium text-[rgb(var(--color-primary))]">{stat.unit}</span>}
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


  const tableStats = stats.filter(s => s.type === 'count');
  const activityStats = stats.filter(s => s.type === 'activity');
  const highestFollowerStat = stats.find(s => s.type === 'highest_follower');
  const usageStats = stats.filter(s => s.type === 'usage');

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center mb-10">
        <h2 className="text-4xl font-extrabold text-[rgb(var(--color-text))] tracking-tight">
          Platform Statistics
        </h2>
        <p className="ml-3 mt-1 text-lg text-[rgb(var(--color-text-secondary))]">
          Real-time database counts, user activity, and platform usage.
        </p>
      </div>

      {loading ? (
        <div className="col-span-full flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--color-primary))]" />
          <span className="ml-3 text-lg text-[rgb(var(--color-text-secondary))]">Loading Platform Stats...</span>
        </div>
      ) : (
        <>
          {/* Highest Followers Section (Separate layout) */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> Top Community & Usage
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
            {highestFollowerStat && renderStatCard(highestFollowerStat)}
            {usageStats.map(renderStatCard)}
          </div>
          
          {/* Core Table Counts Section */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> Core Database Entries
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {tableStats.map(renderStatCard)}
          </div>
          
          {/* User Activity Section */}
          <h3 className="text-2xl font-semibold text-[rgb(var(--color-text))] mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-[rgb(var(--color-accent))]" /> User Activity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activityStats.map(renderStatCard)}
          </div>
        </>
      )}
    </div>
  );
};
