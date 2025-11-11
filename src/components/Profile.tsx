// src/components/Profile.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase, Profile as ProfileType, Post, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BadgeCheck, Edit2, Check, MessageCircle, X, UserMinus, Paperclip, FileText, Settings as SettingsIcon } from 'lucide-react';

export const Profile = ({ userId, onMessage, onSettings }: { userId?: string; onMessage?: (profile: ProfileType) => void; onSettings?: () => void }) => {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<ProfileType[]>([]);
  const [followingList, setFollowingList] = useState<ProfileType[]>([]);

  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  const avatarFileInput = useRef<HTMLInputElement>(null);
  const bannerFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (targetUserId) {
      loadProfile();
      loadPosts();
      loadFollowStats();
      if (!isOwnProfile && user) checkFollowing();
    }
  }, [targetUserId, user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();
    setProfile(data);
    if (data) {
      setDisplayName(data.display_name);
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
      setBannerUrl(data.banner_url || '');
    }
  };

  const loadPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const loadFollowStats = async () => {
    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    const { count: followingC } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUserId);

    setFollowerCount(followers || 0);
    setFollowingCount(followingC || 0);
  };

  const checkFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const loadFollowers = async () => {
    const { data } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(*)')
      .eq('following_id', targetUserId);
    setFollowersList(data?.map((f: any) => f.follower) || []);
  };

  const loadFollowing = async () => {
    const { data } = await supabase
      .from('follows')
      .select('following:profiles!following_id(*)')
      .eq('follower_id', targetUserId);
    setFollowingList(data?.map((f: any) => f.following) || []);
  };

  const openFollowers = async () => {
    await loadFollowers();
    setShowFollowers(true);
    setShowFollowing(false);
  };

  const openFollowing = async () => {
    await loadFollowing();
    setShowFollowing(true);
    setShowFollowers(false);
  };

  const closeModal = () => {
    setShowFollowers(false);
    setShowFollowing(false);
  };

  const toggleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId });
    }
    setIsFollowing(!isFollowing);
    loadFollowStats();
  };

  const toggleFollowUser = async (targetId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .maybeSingle();

    if (existing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    }

    if (showFollowers) await loadFollowers();
    if (showFollowing) await loadFollowing();
    loadFollowStats();
  };

  // FIXED: Now actually removes + updates UI
  const removeFollower = async (followerId: string) => {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user!.id);

    if (!error) {
      setFollowersList(prev => prev.filter(p => p.id !== followerId));
      setFollowerCount(prev => prev - 1);
    }
  };

  const updateProfile = async () => {
    await supabase
      .from('profiles')
      .update({ display_name: displayName, bio, avatar_url: avatarUrl, banner_url: bannerUrl })
      .eq('id', user!.id);
    setIsEditing(false);
    loadProfile();
  };

  const goToProfile = async (profileId: string) => {
    closeModal();
    const { data } = await supabase.from('profiles').select('username').eq('id', profileId).single();
    if (data) {
      window.history.replaceState({}, '', `/?${data.username}`);
      window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
    }
  };

  if (!profile) return <div className="text-center p-8 text-[rgb(var(--color-text))]">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[rgb(var(--color-surface))]">
        <div className="relative h-48 bg-[rgb(var(--color-border))]">
          {profile.banner_url ? (
            <img src={profile.banner_url} className="w-full h-full object-cover" alt="Banner" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[rgba(var(--color-accent),1)] to-[rgba(var(--color-primary),1)]" />
          )}
        </div>

        <div className="relative px-4 pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-16">
            <button onClick={() => !isOwnProfile && goToProfile(profile.id)}>
              <img
                src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
                className="w-32 h-32 rounded-full border-4 border-[rgb(var(--color-surface))] shadow-lg ring-4 ring-[rgb(var(--color-surface))] hover:opacity-90 transition"
                alt="Avatar"
              />
            </button>

            <div className="mt-4 sm:mt-0 flex gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => (isEditing ? updateProfile() : setIsEditing(true))}
                    className="px-5 py-2.5 border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] rounded-full font-semibold hover:bg-[rgb(var(--color-surface-hover))] flex items-center gap-2 transition"
                  >
                    {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
                    {isEditing ? 'Save' : 'Edit Profile'}
                  </button>
                  {onSettings && (
                    <button
                      onClick={onSettings}
                      className="px-5 py-2.5 border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] rounded-full font-semibold hover:bg-[rgb(var(--color-surface-hover))] flex items-center gap-2 transition"
                    >
                      <SettingsIcon size={18} />
                      Settings
                    </button>
                  )}
                </>
              ) : (
                <>
                 <button
  onClick={() => {
    if (!profile?.username) return;

    // 1. Set URL
    window.history.replaceState({}, '', `/?${profile.username}`);

    // 2. Trigger BOTH: App.tsx handler + direct open in Messages
    onMessage?.(profile);
    window.dispatchEvent(new CustomEvent('openDirectMessage', { detail: profile }));
  }}
  className="flex items-center gap-2 px-5 py-2.5 bg-[rgb(var(--color-accent))] text-[rgb(var(--color-text-on-primary))] rounded-full hover:bg-[rgb(var(--color-primary))] transition font-medium"
>
  <MessageCircle size={18} />
  Message
</button>
                  <button
                    onClick={toggleFollow}
                    className={`px-6 py-2.5 rounded-full font-semibold transition ${
                      isFollowing ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-hover))]' : 'bg-[rgb(var(--color-text))] text-[rgb(var(--color-background))] hover:bg-[rgb(var(--color-surface))]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="mt-6 space-y-3">
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display Name" className="w-full px-4 py-2.5 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))]" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} className="w-full px-4 py-2.5 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] resize-none bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))]" />
              <div className="flex items-center gap-2">
                <input 
                  type="url" 
                  value={avatarUrl} 
                  onChange={(e) => setAvatarUrl(e.target.value)} 
                  placeholder="Avatar URL" 
                  className="flex-1 px-4 py-2.5 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))]" 
                />
                <button 
                  type="button" 
                  onClick={() => avatarFileInput.current?.click()} 
                  className="px-4 py-2 bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border))] transition flex items-center gap-2"
                >
                  <Paperclip size={16} />
                </button>
                <input 
                  ref={avatarFileInput} 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const result = await uploadMedia(file, 'profiles');
                    if (result) setAvatarUrl(result.url);
                  }} 
                  className="hidden" 
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="url" 
                  value={bannerUrl} 
                  onChange={(e) => setBannerUrl(e.target.value)} 
                  placeholder="Banner URL" 
                  className="flex-1 px-4 py-2.5 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))]" 
                />
                <button 
                  type="button" 
                  onClick={() => bannerFileInput.current?.click()} 
                  className="px-4 py-2 bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border))] transition flex items-center gap-2"
                >
                  <Paperclip size={16} />
                </button>
                <input 
                  ref={bannerFileInput} 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const result = await uploadMedia(file, 'profiles');
                    if (result) setBannerUrl(result.url);
                  }} 
                  className="hidden" 
                />
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <button onClick={() => !isOwnProfile && goToProfile(profile.id)} className="font-bold text-2xl text-[rgb(var(--color-text))] hover:underline">
                  {profile.display_name}
                </button>
                {profile.verified && <BadgeCheck size={22} className="text-[rgb(var(--color-accent))]" />}
              </div>
              <p className="text-[rgb(var(--color-text-secondary))]">@{profile.username}</p>
              {profile.bio && <p className="mt-3 text-[rgb(var(--color-text))]">{profile.bio}</p>}
              <div className="mt-4 flex gap-8 text-sm">
                <button onClick={openFollowing} className="hover:underline text-[rgb(var(--color-text))]">
                  <strong className="text-lg">{followingCount}</strong> <span className="text-[rgb(var(--color-text-secondary))]">Following</span>
                </button>
                <button onClick={openFollowers} className="hover:underline text-[rgb(var(--color-text))]">
                  <strong className="text-lg">{followerCount}</strong> <span className="text-[rgb(var(--color-text-secondary))]">Followers</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        {posts.map((post) => (
  <div key={post.id} className="border-b border-[rgb(var(--color-border))] p-4 hover:bg-[rgb(var(--color-surface-hover))] transition bg-[rgb(var(--color-surface))]">
    <div className="flex gap-4 items-start">
      <button onClick={() => goToProfile(post.user_id)} className="flex-shrink-0">
        <img
          src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`}
          className="w-12 h-12 rounded-full hover:opacity-80 transition"
          alt="Avatar"
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => goToProfile(post.user_id)} className="font-bold text-[rgb(var(--color-text))] hover:underline">
            {post.profiles?.display_name}
          </button>
          {post.profiles?.verified && <BadgeCheck size={16} className="text-[rgb(var(--color-accent))]" />}
          <span className="text-[rgb(var(--color-text-secondary))] text-sm">@{post.profiles?.username}</span>
          <span className="text-[rgb(var(--color-text-secondary))] text-sm">
            · {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[rgb(var(--color-text))]">{post.content}</p>
        {post.media_url && (
                  <div className="mt-3">
                    {post.media_type === 'image' && (
                      <img src={post.media_url} className="rounded-2xl max-h-96 object-cover w-full" alt="Post" />
                    )}
                    {post.media_type === 'video' && (
                      <video controls className="rounded-2xl max-h-96 w-full">
                        <source src={post.media_url} />
                        Your browser does not support the video tag.
                      </video>
                    )}
                    {post.media_type === 'document' && (
                      <a
                        href={post.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))] transition inline-block"
                      >
                        <FileText size={20} /> Download File
                      </a>
                    )}
                  </div>
                )}
      </div>
    </div>
  </div>
))}
      </div>

      {(showFollowers || showFollowing) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--color-border))]">
              <h3 className="font-bold text-lg text-[rgb(var(--color-text))]">{showFollowers ? 'Followers' : 'Following'}</h3>
              <button onClick={closeModal} className="p-2 text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-hover))] rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {(showFollowers ? followersList : followingList).map((p) => {
                const isFollowingThisUser = followingList.some(f => f.id === p.id);
                const isMe = p.id === user?.id;

                return (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-[rgb(var(--color-surface-hover))] border-b border-[rgb(var(--color-border))]">
                    <button onClick={() => goToProfile(p.id)} className="flex items-center gap-3 flex-1 text-left">
                      <img
                        src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`}
                        className="w-10 h-10 rounded-full"
                        alt=""
                      />
                      <div>
                        <div className="font-semibold text-[rgb(var(--color-text))]">{p.display_name}</div>
                        <div className="text-sm text-[rgb(var(--color-text-secondary))]">@{p.username}</div>
                      </div>
                    </button>

                    {isOwnProfile && !isMe && (
                      <div className="flex gap-2">
                        {showFollowers && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFollower(p.id);
                            }}
                            className="px-3 py-1.5 text-sm font-medium rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition"
                          >
                            <UserMinus size={16} className="inline mr-1" />
                            Remove
                          </button>
                        )}
                        {showFollowing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollowUser(p.id);
                            }}
                            className={`px-4 py-1.5 text-sm font-medium rounded-full border transition ${
                              isFollowingThisUser ? 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-hover))]' : 'bg-[rgb(var(--color-text))] text-[rgb(var(--color-background))] hover:bg-[rgb(var(--color-surface))]'
                            }`}
                          >
                            {isFollowingThisUser ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
