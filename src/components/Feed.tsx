// Feed.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, Post, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, BadgeCheck, Edit3, Image, FileText, X, Paperclip, Link, Heart, MessageCircle, LayoutGrid, Smartphone, Play, Pause } from 'lucide-react';
import { Shots } from './Shots';
import { StatusTray } from './Status';

const SVG_PATH = "M403.68 234.366c-3.681 5.618-30.224 30.851-40.724 38.713-25.347 18.983-38.394 24.776-77.79 34.544-23.062 5.718-26.126 6.76-29.666 10.087-7.857 7.384-13.863 11.247-21.384 13.752-9.789 3.259-12.116 5.672-12.116 12.558 0 3.825-.438 5.035-2.25 6.216-2.635 1.716-20.674 9.566-29.076 12.652l-5.825 2.141-2.971-2.116c-9.884-7.038-20.846.73-18.023 12.769 1.281 5.464 4.697 13.648 7.648 18.323 2.003 3.172 3.01 3.922 4.768 3.546 1.226-.263 4.254-.713 6.729-1.001 42.493-4.949 40.864-5.209 23.4 3.732-19.939 10.207-18.133 8.396-15.298 15.335 3.253 7.964 12.604 17.385 20.007 20.156l5.391 2.019.571-3.146c2.04-11.232 8.429-15.14 35.313-21.598l16.883-4.056 13.117 2.49c12.523 2.378 44.627 6.84 45.186 6.281.557-.557-2.339-3.496-10.071-10.22-12.342-10.734-11.967-10.234-8.194-10.934 3.07-.569 13.356.364 24.48 2.221 5.695.951 6.849 1.949 10.602 9.17 8.474 16.302 4.32 33.766-10.663 44.834-12.739 9.412-30.225 15.712-58.895 21.221-41.565 7.986-66.646 14.612-87.823 23.201-38.111 15.456-64.943 39.315-81.349 72.337-25.537 51.399-13.852 115.129 29.49 160.845 11.285 11.904 24.516 22.439 35.558 28.313 9.965 5.301 26.891 11.195 32.681 11.381l4.114.131-3.5.619-3.5.618 4.157 1.262c19.446 5.905 48.822 7.93 69.843 4.814 35.165-5.213 59.534-15.919 91.968-40.404 14.472-10.926 38.359-33.149 60.337-56.135 45.747-47.846 70.153-71.503 80.342-77.878C518.855 595.832 531.512 592 544 592c18.29 0 32.472 6.933 42.959 21 6.102 8.186 10.208 17.124 12.861 28 2.382 9.768 3.878 23.317 2.327 21.069-.752-1.088-1.147-.49-1.65 2.5-1.775 10.54-7.924 25.284-13.676 32.793-8.697 11.352-23.899 22.822-37.247 28.103-13.613 5.385-37.399 10.294-61.035 12.597-27.42 2.671-56.809 7.787-72.039 12.54-28.765 8.977-52.539 27.345-63.932 49.398-14.355 27.783-13.427 60.661 2.466 87.415 5.626 9.47 8.339 12.945 16.466 21.088 6.022 6.035 7.163 6.986 17.716 14.777 18.026 13.307 43.527 22.826 73.017 27.255 13.391 2.011 52.549 2.016 54.558.007.202-.202-2.256-.881-5.462-1.508-14.198-2.779-32.245-10.073-41.829-16.905-15.141-10.793-30.463-25.813-37.688-36.946-2.029-3.126-5.016-7.483-6.638-9.683C416.705 874.014 413 864.636 413 854.684c0-5.65 2.569-16.422 4.312-18.082 9.77-9.301 25.027-16.03 48.822-21.533 64.081-14.82 109.776-51.401 128.122-102.569 3.224-8.992 6.818-27.367 7.726-39.5l.71-9.5.154 9.583c.144 8.953-.301 12.954-2.993 26.917-1.404 7.286-7.125 23.019-11.09 30.5-1.749 3.3-3.649 7.009-4.222 8.242-.572 1.233-1.378 2.246-1.791 2.25s-.75.646-.75 1.425-.357 1.566-.793 1.75-1.887 2.133-3.226 4.333c-2.159 3.55-12.538 16.048-17.218 20.734-3.451 3.456-18.579 15.488-22.376 17.797-2.138 1.3-4.112 2.667-4.387 3.039-.275.371-5.9 3.4-12.5 6.731-16.549 8.351-30.523 13.68-47.732 18.205-2.602.684-4.477 1.656-4.166 2.16.312.503 1.316.689 2.232.412s8.641-1.213 17.166-2.081c40.585-4.13 69.071-9.765 92.5-18.298 15.33-5.583 37.661-18.554 50.945-29.591 10.296-8.554 25.124-24.582 33.34-36.037 3.374-4.704 13.526-23.941 16.397-31.071 2.83-7.028 5.649-16.706 8.011-27.5 1.966-8.988 2.293-13.308 2.27-30-.029-21.817-1.459-32.183-6.545-47.461-4.267-12.818-13.982-32.084-21.064-41.771-7.41-10.137-23.927-26.589-33.354-33.222-15.179-10.682-37.054-20.061-56.5-24.226-13.245-2.836-42.849-2.586-57.5.487-27.999 5.872-54.161 18.066-78.5 36.589-8.789 6.689-30.596 26.259-34.981 31.392-5.122 5.997-38.941 40.833-55.176 56.835-15.863 15.637-22.787 22.017-31.337 28.877-2.742 2.2-5.89 4.829-6.996 5.843-1.105 1.013-6.06 4.488-11.01 7.722s-9.45 6.242-10 6.686c-2.014 1.624-12.507 6.373-19.656 8.896-8.791 3.103-26.867 4.32-35.998 2.425-14.396-2.989-26.608-12.051-32.574-24.172-3.938-8-5.216-13.468-5.248-22.44-.05-14.406 4.83-25.419 16.415-37.046 8.018-8.047 15.344-13.02 27.453-18.636 13.664-6.337 24.699-9.76 68.608-21.281 23.61-6.195 53.403-16.746 65-23.02 37.251-20.151 62.371-49.521 70.969-82.977 3.164-12.312 4.368-32.296 2.62-43.5-2.675-17.153-11.273-37.276-22.004-51.5-10.94-14.501-29.977-30.241-43.244-35.755l-4.987-2.072 5.325-2.166c15.935-6.483 33.215-19.607 42.642-32.385 5.925-8.032 12.007-19.627 10.884-20.751-.359-.358-2.374.874-4.48 2.739-19.929 17.652-32.524 25.61-53.225 33.626-8.739 3.383-30.986 9.264-35.049 9.264-.617 0 2.629-2.521 7.214-5.602 21.853-14.688 39.424-33.648 49.197-53.085 2.254-4.483 7.638-17.828 7.638-18.932 0-1.228-1.997-.034-3.32 1.985m-9.601 249.217c.048 1.165.285 1.402.604.605.289-.722.253-1.585-.079-1.917s-.568.258-.525 1.312m-6.62 20.484c-.363.586-.445 1.281-.183 1.543s.743-.218 1.069-1.067c.676-1.762.1-2.072-.886-.476m207.291 56.656c1.788.222 4.712.222 6.5 0 1.788-.221.325-.403-3.25-.403s-5.038.182-3.25.403m13.333-.362c.23.199 3.117.626 6.417.949 3.811.374 5.27.268 4-.29-1.892-.832-11.303-1.427-10.417-.659M627 564.137c3.575 1.072 7.4 2.351 8.5 2.842 1.1.49 4.025 1.764 6.5 2.83 6.457 2.78 15.574 9.246 22.445 15.918 5.858 5.687 5.899 4.716.055-1.277-3.395-3.481-13.251-11.028-18.5-14.164-4.511-2.696-20.509-8.314-23.33-8.192-1.193.051.755.97 4.33 2.043M283.572 749.028c-2.161 1.635-3.511 2.96-3 2.945.945-.027 8.341-5.92 7.428-5.918-.275 0-2.268 1.338-4.428 2.973M264.5 760.049c-14.725 7.213-25.192 9.921-42 10.865-12.896.724-13.276.798-4.822.936 16.858.275 31.491-2.958 46.822-10.347 6.099-2.939 11.984-6.524 10.5-6.396-.275.023-5 2.247-10.5 4.942M435 897.859c0 1.77 20.812 21.955 28.752 27.887 10.355 7.736 27.863 16.301 40.248 19.691 11.885 3.254 27.788 4.339 38.679 2.641 15.915-2.483 42.821-11.687 56.321-19.268 4.671-2.624 21.633-13.314 22.917-14.443.229-.202.185-.599-.098-.882s-2.496.561-4.917 1.876c-8.642 4.692-29.216 11.343-44.402 14.354-7.013 1.391-13.746 1.775-30.5 1.738-19.299-.042-22.831-.32-34.5-2.724-25.415-5.234-48.507-14.972-66.207-27.92-5.432-3.973-6.293-4.377-6.293-2.95";
const SVG_VIEWBOX = "0 0 784 1168";

// --- NEW AudioPlayer COMPONENT FOR FEED ---
interface AudioPlayerProps {
  src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Use fixed accent colors for the player in the feed context
  const primaryColor = 'rgb(var(--color-accent))';
  const trackColor = 'rgb(var(--color-border))';
  
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);

    const togglePlay = () => setIsPlaying(!audio.paused);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('play', togglePlay);
    audio.addEventListener('pause', togglePlay);
    audio.addEventListener('ended', () => {
        setIsPlaying(false);
        audio.currentTime = 0; // Reset after playing
    });

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('play', togglePlay);
      audio.removeEventListener('pause', togglePlay);
      audio.removeEventListener('ended', () => {});
    };
  }, []);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="flex items-center space-x-2 w-full max-w-full p-2 bg-[rgb(var(--color-surface-hover))] rounded-xl">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      
      <button 
        onClick={handlePlayPause}
        className={`flex-shrink-0 p-2 rounded-full transition-colors`}
        style={{
            backgroundColor: 'rgb(var(--color-accent))', 
            color: 'rgb(var(--color-text-on-primary))',
        }}
      >
        {isPlaying ? <Pause size={16} fill="rgb(var(--color-text-on-primary))" /> : <Play size={16} fill="rgb(var(--color-text-on-primary))" />}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 appearance-none rounded-full cursor-pointer transition"
          style={{
            background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((currentTime / duration) * 100) || 0}%, ${trackColor} ${((currentTime / duration) * 100) || 0}%, ${trackColor} 100%)`,
          }}
        />
        <span className="text-xs flex-shrink-0 text-[rgb(var(--color-text-secondary))]">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
// --- END AudioPlayer COMPONENT FOR FEED ---

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

// Auxiliary types for the new features
interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    verified: boolean;
  };
}

interface Liker {
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    verified: boolean;
  };
}
// NEW: Constants and functions for URL embedding
// Regex to check if the content is *only* a URL. Simplistic regex for common URLs.
const URL_REGEX = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;

const getEmbeddedMedia = (content: string, media_url: string | null) => {
  if (media_url) return null; // DO NOT embed if post already has media

  const trimmedContent = content.trim();
  if (URL_REGEX.test(trimmedContent)) {
    // Check for YouTube URL (for embedding as iframe)
    const youtubeMatch = trimmedContent.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/i);

    if (youtubeMatch && youtubeMatch[1]) {
      const videoId = youtubeMatch[1];
      return (
        <iframe
          title="Embedded YouTube Video"
          className="rounded-2xl max-h-96 w-full aspect-video"
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      );
    }
    
    // For other general links, show a simple link preview component
    return (
      <a href={trimmedContent} target="_blank" rel="noopener noreferrer" 
        className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))] transition inline-flex"
      >
        <Link size={20} />
        {trimmedContent.length > 50 ? trimmedContent.substring(0, 47) + '...' : trimmedContent}
      </a>
    );
  }
  return null;
};

// --- PAGINATION START ---
const POST_PAGE_SIZE = 10;
// --- PAGINATION END ---

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

  // Tabs State
  const [activeTab, setActiveTab] = useState<'posts' | 'shots'>('posts');

  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxMediaUrl, setLightboxMediaUrl] = useState('');
  const [lightboxMediaType, setLightboxMediaType] = useState<'image' | 'video' | null>(null);

  // Social features state
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [activeLikesModal, setActiveLikesModal] = useState<string | null>(null);
  const [likersList, setLikersList] = useState<Liker[]>([]);
  const [activeCommentsModal, setActiveCommentsModal] = useState<string | null>(null);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  // --- PAGINATION STATE START ---
  const [postPage, setPostPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  // --- PAGINATION STATE END ---

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

  const getPostCounts = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return { likeCounts: {}, commentCounts: {} };

    const likeCounts: Record<string, number> = {};
    const commentCounts: Record<string, number> = {};

    for (const postId of postIds) {
      const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
        supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('entity_type', 'post')
          .eq('entity_id', postId),
        supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)
      ]);
      likeCounts[postId] = likeCount || 0;
      commentCounts[postId] = commentCount || 0;
    }

    return { likeCounts, commentCounts };
  }, []);

  const fetchUserLikes = useCallback(async (currentPosts: Post[]) => {
    if (!user || currentPosts.length === 0) return;
    const postIds = currentPosts.map(p => p.id);
    const { data } = await supabase
      .from('likes')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'post')
      .in('entity_id', postIds);
    
    if (data) {
      // --- MODIFICATION: Add to existing set, don't replace
      setLikedPostIds(prevSet => new Set([...prevSet, ...data.map(d => d.entity_id)]));
    }
  }, [user]);

  // --- MODIFICATION: Load only first page
  const loadPosts = useCallback(async () => {
    setPosts([]);
    setPostPage(0);
    setHasMorePosts(true);

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
    
    const { data } = await query.range(0, POST_PAGE_SIZE - 1);
    
    const loadedPosts = data || [];
    const postIds = loadedPosts.map(p => p.id);
    const { likeCounts, commentCounts } = await getPostCounts(postIds);
    const postsWithCounts = loadedPosts.map(post => ({
      ...post,
      like_count: likeCounts[post.id] || 0,
      comment_count: commentCounts[post.id] || 0,
    }));
    setPosts(postsWithCounts);
    
    if (postsWithCounts.length < POST_PAGE_SIZE) {
      setHasMorePosts(false);
    }
    
    fetchUserLikes(postsWithCounts);
  }, [user, fetchUserLikes, getPostCounts]);
  
  // --- NEW: Load more posts for infinite scroll
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMorePosts || !hasMorePosts) return;
    
    setIsLoadingMorePosts(true);
    const nextPage = postPage + 1;
    const from = nextPage * POST_PAGE_SIZE;
    const to = from + POST_PAGE_SIZE - 1;

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
    
    const { data } = await query.range(from, to);
    
    const newPosts = data || [];
    const newPostIds = newPosts.map(p => p.id);
    const { likeCounts, commentCounts } = await getPostCounts(newPostIds);
    const newPostsWithCounts = newPosts.map(post => ({
      ...post,
      like_count: likeCounts[post.id] || 0,
      comment_count: commentCounts[post.id] || 0,
    }));
    setPosts(current => [...current, ...newPostsWithCounts]);
    setPostPage(nextPage);
    
    if (newPosts.length < POST_PAGE_SIZE) {
      setHasMorePosts(false);
    }
    
    fetchUserLikes(newPostsWithCounts);
    setIsLoadingMorePosts(false);
  }, [isLoadingMorePosts, hasMorePosts, postPage, user, fetchUserLikes, getPostCounts]);

  // Handle Likes - MODIFIED LOGIC
  const handleInitialLike = async (post: Post) => {
    if (!user) return;

    // 1. If the user hasn't liked it yet, apply the like immediately
    if (!likedPostIds.has(post.id)) {
        const newSet = new Set(likedPostIds);
        newSet.add(post.id);
        setLikedPostIds(newSet);

        // Optimistic UI Update
        setPosts(current => current.map(p => {
            if (p.id === post.id) return { ...p, like_count: (p.like_count + 1) };
            return p;
        }));

        // DB Insert
        await supabase.from('likes').insert({ user_id: user.id, entity_id: post.id, entity_type: 'post' });
    }

    // 2. Open the modal (Requirement: Always open modal on click)
    openLikesList(post.id);
  };

  // New function to remove like ONLY from the modal
  const handleRemoveLikeFromModal = async (postId: string) => {
      if (!user) return;

      // Optimistic UI Update
      const newSet = new Set(likedPostIds);
      newSet.delete(postId);
      setLikedPostIds(newSet);

      setPosts(current => current.map(p => {
          if (p.id === postId) return { ...p, like_count: Math.max(0, p.like_count - 1) };
          return p;
      }));

      // Remove user from the displayed list immediately
      setLikersList(prev => prev.filter(liker => liker.user_id !== user.id));

      // DB Delete
      await supabase.from('likes').delete().match({ user_id: user.id, entity_id: postId, entity_type: 'post' });
  };

  const openLikesList = async (postId: string) => {
    setActiveLikesModal(postId);
    const { data } = await supabase
      .from('likes')
      .select('user_id, profiles(*)')
      .eq('entity_id', postId)
      .eq('entity_type', 'post');
    if (data) setLikersList(data as unknown as Liker[]);
  };

  // Handle Comments
  const openCommentsList = async (postId: string) => {
    setActiveCommentsModal(postId);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) setCommentsList(data as Comment[]);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeCommentsModal || !newCommentText.trim()) return;
    
    setIsPostingComment(true);
    const postId = activeCommentsModal;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: newCommentText.trim()
      })
      .select('*, profiles(*)')
      .single();

    if (!error && data) {
      setCommentsList(prev => [...prev, data as Comment]);
      setNewCommentText('');
      // Update post comment count in feed optimistically
      setPosts(current => current.map(p => {
        if (p.id === postId) return { ...p, comment_count: (p.comment_count || 0) + 1 };
        return p;
      }));
    }
    setIsPostingComment(false);
  };

  // --- FIX: Split useEffect into two hooks ---

  // Effect 1: Handles initial load and Supabase subscriptions
  useEffect(() => {
    loadPosts();

    const channel = supabase.channel('feed-updates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      if (FOLLOW_ONLY_FEED && user) {
        if (payload.new.user_id === user.id) {
          const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).single();
          if (data) setPosts(current => [{ ...data, like_count: 0, comment_count: 0 }, ...current]);
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
      if (data) setPosts(current => [{ ...data, like_count: 0, comment_count: 0 }, ...current]);
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes', filter: 'entity_type=eq.post' }, (payload) => {
      if (payload.new.user_id === user?.id) return;
      const postId = payload.new.entity_id;
      setPosts(current => current.map(p =>
        p.id === postId ? { ...p, like_count: (p.like_count || 0) + 1 } : p
      ));
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes', filter: 'entity_type=eq.post' }, (payload) => {
      if (payload.old.user_id === user?.id) return;
      const postId = payload.old.entity_id;
      setPosts(current => current.map(p =>
        p.id === postId ? { ...p, like_count: Math.max(0, (p.like_count || 0) - 1) } : p
      ));
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
      if (payload.new.user_id === user?.id) return;
      const postId = payload.new.post_id;
      setPosts(current => current.map(p =>
        p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
      ));
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadPosts]); // Only depends on user and the memoized loadPosts

  // Effect 2: Handles scroll listening for composer shrink and pagination
  useEffect(() => {
    const handleScroll = () => {
      // Handle composer shrink
      const scrolled = window.scrollY > 100;
      if (scrolled && isExpanded) setIsExpanded(false);
      setHasScrolled(scrolled);
      
      // --- PAGINATION: Handle infinite scroll
      if (
        activeTab === 'posts' && // Only scroll load on posts tab
        window.innerHeight + document.documentElement.scrollTop + 200 >= document.documentElement.offsetHeight &&
        hasMorePosts &&
        !isLoadingMorePosts
      ) {
        loadMorePosts();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isExpanded, hasMorePosts, isLoadingMorePosts, loadMorePosts, activeTab]); // Depends on scroll-related state

  // --- END FIX ---

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
      } else if (remoteUrl.match(/\.(mp3|wav|ogg|m4a|weba)$/i)) { // Added audio types
        media_type = 'audio';
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
    // Close modals if open
    setActiveLikesModal(null);
    setActiveCommentsModal(null);

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
      // --- MODIFIED: Use AudioPlayer for local file preview ---
      if (file.type.startsWith('audio/')) {
        return <AudioPlayer src={url} />;
      }
      // --------------------------------------------------------
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
      // --- MODIFIED: Use AudioPlayer for remote URL preview ---
      if (remoteUrl.match(/\.(mp3|wav|ogg|m4a|weba)$/i)) {
        return <AudioPlayer src={remoteUrl} />;
      }
      // --------------------------------------------------------
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
      {activeTab === 'posts' && <StatusTray />}
      {/* COMPOSER - Only visible when Posts tab is active */}
      {activeTab === 'posts' && (
      <div ref={scrollRef} className="bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] shadow-sm">
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
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" // Added audio/*
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
                  placeholder="Paste image/video/audio/file URL..." // Updated placeholder
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
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] sticky top-[0px] z-30">
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition border-b-2 ${activeTab === 'posts' ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]' : 'border-transparent text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]'}`}
        >
            <LayoutGrid size={18} /> Posts
        </button>
        <button 
          onClick={() => setActiveTab('shots')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition border-b-2 ${activeTab === 'shots' ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]' : 'border-transparent text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]'}`}
        >
            <Smartphone size={18} /> Shots
        </button>
      </div>

      <div>
        {/* CONDITIONAL RENDERING: POSTS vs SHOTS */}
        {activeTab === 'shots' ? (
            <Shots />
        ) : (
        <>
        {posts.length === 0 && !isLoadingMorePosts && ( // <-- Modified condition
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
                {/* NEW: Embed Link if detected and no media is attached */}
                  {getEmbeddedMedia(post.content, post.media_url) && (
                      <div className="mt-3">
                          {getEmbeddedMedia(post.content, post.media_url)}
                      </div>
                  )}
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
                    {/* NEW: Custom Audio Player for Posts */}
                    {post.media_type === 'audio' && (
                        <div className="rounded-2xl w-full">
                            <AudioPlayer src={post.media_url} />
                        </div>
                    )}
                    {/* END NEW */}
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
                
                {/* Action Bar */}
                <div className="flex items-center gap-6 mt-3">
                  <div className="flex items-center gap-1 group">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleInitialLike(post); }}
                      className={`p-2 rounded-full transition ${
                        likedPostIds.has(post.id) 
                          ? 'text-pink-500 bg-pink-500/10' 
                          : 'text-[rgb(var(--color-text-secondary))] hover:bg-pink-500/10 hover:text-pink-500'
                      }`}
                    >
                      <Heart size={18} fill={likedPostIds.has(post.id) ? "currentColor" : "none"} />
                    </button>
                    {post.like_count > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openLikesList(post.id); }}
                        className="text-sm text-[rgb(var(--color-text-secondary))] hover:underline"
                      >
                        {post.like_count}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 group">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openCommentsList(post.id); }}
                      className="p-2 rounded-full transition text-[rgb(var(--color-text-secondary))] hover:bg-blue-500/10 hover:text-blue-500"
                    >
                      <MessageCircle size={18} />
                    </button>
                    {post.comment_count > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openCommentsList(post.id); }}
                        className="text-sm text-[rgb(var(--color-text-secondary))] hover:underline"
                      >
                        {post.comment_count}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* --- PAGINATION INDICATORS START --- */}
        {isLoadingMorePosts && (
          <div className="flex justify-center p-4">
            <div className="logo-loading-container w-6 h-6 relative">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={SVG_VIEWBOX}
                    className="logo-svg"
                >
                    <defs>
                        <clipPath id="logo-clip">
                            <rect
                                id="clip-rect"
                                x="0"
                                y="0"
                                width="100%"
                                height="100%"
                            />
                        </clipPath>
                    </defs>
                    <path
                        d={SVG_PATH}
                        fill="none"
                        stroke="rgb(var(--color-primary))"
                        strokeWidth="10"
                        strokeOpacity="0.1" 
                    />
                    <path
                        d={SVG_PATH}
                        fill="rgb(var(--color-primary))" 
                        clipPath="url(#logo-clip)"
                        className="logo-fill-animated"
                    />
                </svg>
            </div>
          </div>
        )}
        
        {!isLoadingMorePosts && !hasMorePosts && posts.length > 0 && (
          <div className="text-center py-8 text-sm text-[rgb(var(--color-text-secondary))]">
            You've reached the end of the feed.
          </div>
        )}
        {/* --- PAGINATION INDICATORS END --- */}
        </>
        )}
      </div>

      {/* Lightbox */}
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

      {/* Likes Modal */}
      {activeLikesModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4"
          onClick={() => setActiveLikesModal(null)}
        >
          <div 
            className="bg-[rgb(var(--color-surface))] w-full max-w-md rounded-2xl max-h-[70vh] flex flex-col shadow-2xl border border-[rgb(var(--color-border))]" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[rgb(var(--color-border))] flex items-center justify-between">
              <h3 className="font-bold text-lg text-[rgb(var(--color-text))]">Likes</h3>
              <button onClick={() => setActiveLikesModal(null)} className="p-1 hover:bg-[rgb(var(--color-surface-hover))] rounded-full">
                <X size={20} className="text-[rgb(var(--color-text))]" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {likersList.length === 0 ? (
                 <p className="text-center text-[rgb(var(--color-text-secondary))]">No likes yet.</p>
              ) : (
                likersList.map((liker, idx) => (
                  <div key={`${liker.user_id}-${idx}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                        src={liker.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${liker.profiles?.username}`}
                        className="w-10 h-10 rounded-full cursor-pointer"
                        alt="Avatar"
                        onClick={() => goToProfile(liker.user_id)}
                        />
                        <div>
                        <button onClick={() => goToProfile(liker.user_id)} className="font-bold hover:underline text-[rgb(var(--color-text))] text-sm block">
                            {liker.profiles?.display_name}
                            {liker.profiles?.verified && <BadgeCheck size={14} className="inline ml-1 text-[rgb(var(--color-accent))]" />}
                        </button>
                        <span className="text-sm text-[rgb(var(--color-text-secondary))]">@{liker.profiles?.username}</span>
                        </div>
                    </div>
                    {/* Requirement: Unliking is only possible from here */}
                    {liker.user_id === user?.id && (
                        <button 
                            onClick={() => handleRemoveLikeFromModal(activeLikesModal)}
                            className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                            title="Remove Like"
                        >
                            <Heart size={16} className="fill-current" />
                        </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {activeCommentsModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4"
          onClick={() => setActiveCommentsModal(null)}
        >
          <div 
            className="bg-[rgb(var(--color-surface))] w-full max-w-lg rounded-2xl h-[80vh] flex flex-col shadow-2xl border border-[rgb(var(--color-border))]" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[rgb(var(--color-border))] flex items-center justify-between">
              <h3 className="font-bold text-lg text-[rgb(var(--color-text))]">Comments</h3>
              <button onClick={() => setActiveCommentsModal(null)} className="p-1 hover:bg-[rgb(var(--color-surface-hover))] rounded-full">
                <X size={20} className="text-[rgb(var(--color-text))]" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {commentsList.length === 0 ? (
                 <div className="h-full flex items-center justify-center">
                   <p className="text-[rgb(var(--color-text-secondary))]">No comments yet. Be the first!</p>
                 </div>
              ) : (
                commentsList.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <img 
                       src={comment.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.profiles?.username}`}
                       className="w-9 h-9 rounded-full cursor-pointer flex-shrink-0"
                       alt="Avatar"
                       onClick={() => goToProfile(comment.user_id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <button onClick={() => goToProfile(comment.user_id)} className="font-bold hover:underline text-[rgb(var(--color-text))] text-sm">
                          {comment.profiles?.display_name}
                        </button>
                        {comment.profiles?.verified && <BadgeCheck size={12} className="text-[rgb(var(--color-accent))]" />}
                        <span className="text-xs text-[rgb(var(--color-text-secondary))]">{formatTime(comment.created_at)}</span>
                      </div>
                      <p className="text-[rgb(var(--color-text))] text-sm mt-0.5 whitespace-pre-wrap break-words bg-[rgb(var(--color-surface-hover))] p-2 rounded-r-xl rounded-bl-xl inline-block">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostComment} className="p-3 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-b-2xl">
              <div className="flex items-center gap-2 bg-[rgb(var(--color-surface-hover))] rounded-full px-4 py-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[rgb(var(--color-text))]"
                  autoFocus
                />
                <button 
                  type="submit" 
                  disabled={!newCommentText.trim() || isPostingComment}
                  className="text-[rgb(var(--color-accent))] disabled:opacity-50 hover:text-[rgb(var(--color-primary))] transition"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
