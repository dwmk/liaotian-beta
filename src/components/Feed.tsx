// Feed.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase, Post, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, BadgeCheck, Edit3, Image, FileText, X, Paperclip, Link } from 'lucide-react';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

export const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxMediaUrl, setLightboxMediaUrl] = useState('');
  const [lightboxMediaType, setLightboxMediaType] = useState<'image' | 'video' | null>(null);

  const openLightbox = (url: string, type: 'image' | 'video') => {
    setLightboxMediaUrl(url);
    setLightboxMediaType(type);
    setShowLightbox(true);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOnline = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return false;
    const now = new Date().getTime();
    const lastSeenTime = new Date(lastSeen).getTime();
    const diff = now - lastSeenTime;
    return diff < 300000; // 5 minutes
  };

  const loadPosts = async () => {
    let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false });
    if (FOLLOW_ONLY_FEED && user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];
      const allowedIds = [...followingIds, user.id];

      query = query.in('user_id', allowedIds);
    }
    const { data } = await query;
    setPosts(data || []);
  };

  useEffect(() => {
    loadPosts();

    const channel = supabase.channel('public:posts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      if (FOLLOW_ONLY_FEED && user) {
        if (payload.new.user_id === user.id) {
          const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).single();
          if (data) setPosts(current => [data, ...current]);
          return;
        }

        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .eq('following_id', payload.new.user_id);

        if (!followData?.length) return;
      }
      const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).single();
      if (data) setPosts(current => [data, ...current]);
    }).subscribe();

    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      if (scrolled && isExpanded) setIsExpanded(false);
      setHasScrolled(scrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user, isExpanded]);

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file && !remoteUrl.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);

    let media_url = null;
    let media_type = null;

    if (file) {
      const result = await uploadMedia(file, 'posts', (percent) => {
        setUploadProgress(percent);
      });
      if (!result) {
        setIsUploading(false);
        return;
      }
      media_url = result.url;
      media_type = result.type;
    } else if (remoteUrl.trim()) {
      media_url = remoteUrl.trim();
      if (remoteUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        media_type = 'image';
      } else if (remoteUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
        media_type = 'video';
      } else {
        media_type = 'document';
      }
    }

    await supabase
      .from('posts')
      .insert({ 
        user_id: user!.id, 
        content, 
        media_url,
        media_type 
      });

    setContent('');
    setFile(null);
    setRemoteUrl('');
    setIsExpanded(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const goToProfile = async (profileId: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('id', profileId).single();
    if (data) {
      window.history.replaceState({}, '', `/?${data.username}`);
      window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
    }
  };

  const getPreview = () => {
    if (file) {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        return <img src={url} className="max-h-48 rounded-lg object-cover" alt="Preview" />;
      }
      if (file.type.startsWith('video/')) {
        return <video src={url} className="max-h-48 rounded-lg" controls />;
      }
      return (
        <div className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg">
          <FileText size={20} className="text-[rgb(var(--color-text-secondary))]" />
          <span className="text-sm text-[rgb(var(--color-text))]" >{file.name}</span>
        </div>
      );
    }
    if (remoteUrl) {
      if (remoteUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        return <img src={remoteUrl} className="max-h-48 rounded-lg object-cover" alt="Remote preview" />;
      }
      if (remoteUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
        return <video src={remoteUrl} className="max-h-48 rounded-lg" controls />;
      }
      return (
        <div className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg">
          <Link size={20} className="text-[rgb(var(--color-text-secondary))]" />
          <span className="text-sm truncate max-w-[200px] text-[rgb(var(--color-text))]">{remoteUrl}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div ref={scrollRef} className="sticky top-0 z-40 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] shadow-sm">
        {isExpanded ? (
          <form onSubmit={createPost} className="p-4 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              rows={3}
              className="w-full px-4 py-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-2xl focus:outline-none focus:border-[rgb(var(--color-accent))] resize-none text-[rgb(var(--color-text))]"
              autoFocus
            />
            
            {(file || remoteUrl) && (
              <div className="flex items-center justify-between p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg">
                <div className="flex-1">
                  {getPreview()}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setRemoteUrl('');
                  }}
                  className="ml-2 p-1 hover:bg-[rgb(var(--color-border))] rounded-full transition"
                >
                  <X size={18} className="text-[rgb(var(--color-text-secondary))]" />
                </button>
              </div>
            )}

            {isUploading && (
              <div className="w-full bg-[rgb(var(--color-border))] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[rgba(var(--color-accent),1)] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setRemoteUrl('');
              }}
              className="hidden"
            />

            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[rgb(var(--color-surface-hover))] rounded-full text-sm hover:bg-[rgb(var(--color-border))] transition flex items-center gap-2 text-[rgb(var(--color-text))]"
              >
                <Paperclip size={16} className="text-[rgb(var(--color-text-secondary))]" /> {file ? 'Change File' : 'Attach'}
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">or</span>
                <input
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => {
                    setRemoteUrl(e.target.value);
                    setFile(null);
                  }}
                  placeholder="Paste image/video/file URL..."
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-full focus:outline-none focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))]"
                />
              </div>
              <button
                type="submit"
                disabled={isUploading || (!content.trim() && !file && !remoteUrl.trim())}
                className="ml-auto bg-[rgba(var(--color-accent),1)] disabled:bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-on-primary))] px-6 py-2 rounded-full hover:bg-[rgba(var(--color-primary),1)] flex items-center gap-2 font-semibold transition"
              >
                <Send size={16} />
                {isUploading ? 'Uploading...' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full p-4 flex items-center gap-3 hover:bg-[rgb(var(--color-surface-hover))] transition"
          >
            <Edit3 size={20} className="text-[rgb(var(--color-text-secondary))]" />
            <span className="text-[rgb(var(--color-text-secondary))]" >Write a post...</span>
          </button>
        )}
      </div>

      <div>
        {posts.length === 0 && (
          <div className="text-center py-12 text-[rgb(var(--color-text-secondary))]" >
            {FOLLOW_ONLY_FEED ? 'No posts from people you follow yet.' : 'No posts yet. Be the first!'}
          </div>
        )}
        {posts.map((post) => (
          <div key={post.id} className="border-b border-[rgb(var(--color-border))] p-4 hover:bg-[rgb(var(--color-surface-hover))] transition bg-[rgb(var(--color-surface))]" >
            <div className="flex gap-4 items-start">
              <button onClick={() => goToProfile(post.user_id)} className="flex-shrink-0 relative">
                <img
                  src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`}
                  className="w-12 h-12 rounded-full hover:opacity-80 transition"
                  alt="Avatar"
                />
                {isOnline(post.profiles?.last_seen) && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[rgb(var(--color-surface))] rounded-full" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => goToProfile(post.user_id)} className="font-bold hover:underline text-[rgb(var(--color-text))]" >
                    {post.profiles?.display_name}
                  </button>
                  {post.profiles?.verified && <BadgeCheck size={16} className="text-[rgb(var(--color-accent))]" />}
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm">@{post.profiles?.username}</span>
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm">· {new Date(post.created_at).toLocaleDateString()} at {formatTime(post.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[rgb(var(--color-text))]" >{post.content}</p>
                {post.media_url && (
                  <div className="mt-3">
                    {post.media_type === 'image' && (
                      <img 
                        src={post.media_url} 
                        className="rounded-2xl max-h-96 object-cover w-full cursor-pointer transition hover:opacity-90" 
                        alt="Post" 
                        onClick={() => openLightbox(post.media_url, 'image')}
                      />
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
                        className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg hover:bg-[rgb(var(--color-border))] transition inline-block text-[rgb(var(--color-text))]" 
                      >
                        <FileText size={20} className="text-[rgb(var(--color-text-secondary))]" /> Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showLightbox && lightboxMediaUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowLightbox(false)}
        >
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {lightboxMediaType === 'image' && (
              <img 
                src={lightboxMediaUrl} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
                alt="Full size view"
              />
            )}
            {lightboxMediaType === 'video' && (
              <video 
                controls 
                autoPlay
                className="max-w-full max-h-[90vh] rounded-2xl"
              >
                <source src={lightboxMediaUrl} />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          <button 
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
