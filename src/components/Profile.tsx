// src/components/Profile.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, Profile as ProfileType, Post, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BadgeCheck, Edit2, Check, MessageCircle, X, UserMinus, Paperclip, FileText, Settings as SettingsIcon, MoreVertical, Trash2, Camera, Crop } from 'lucide-react';

// Define the type for the crop result, simplifying for this context
type CropResult = {
  blob: Blob;
  fileName: string;
  fileType: string;
};

// --- START: CROP UTILITY FUNCTIONS (In a real app, these would be in a separate utility file) ---

/**
 * Uses HTML Canvas to perform a center-crop on an image and returns the result as a Blob.
 * The 'scale' parameter simulates zooming into the image's center point.
 * @param imageFile The File object (image) to crop.
 * @param type 'avatar' (1:1 aspect) or 'banner' (~2.5:1 aspect).
 * @param scale The zoom factor (1.0 = no zoom).
 * @returns A Promise that resolves to the cropped Blob or null on failure.
 */
const getCroppedImageBlob = (imageFile: File, type: 'avatar' | 'banner', scale: number): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error("Canvas context not available.");
          return resolve(null);
        }

        // Define target dimensions based on type (simulating standard sizes)
        const targetWidth = type === 'avatar' ? 256 : 500;
        const targetHeight = type === 'avatar' ? 256 : 200; // Aspect ratio of 2.5:1 for banner

        // Set canvas dimensions
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Determine the largest possible crop area within the source image
        const imageAspect = image.width / image.height;
        const cropAspect = canvas.width / canvas.height;
        let sx, sy, sWidth, sHeight;

        if (imageAspect > cropAspect) {
            // Image is wider than crop area (cut left/right)
            sHeight = image.height;
            sWidth = image.height * cropAspect;
            sx = (image.width - sWidth) / 2;
            sy = 0;
        } else {
            // Image is taller than crop area (cut top/bottom)
            sWidth = image.width;
            sHeight = image.width / cropAspect;
            sx = 0;
            sy = (image.height - sHeight) / 2;
        }

        // Apply Zoom (Scale): The crop area in the source image is scaled down by the 'scale' factor.
        // This makes the content within the crop area appear larger (zoomed in).
        const inverseScale = 1 / scale;
        
        sWidth *= inverseScale;
        sHeight *= inverseScale;
        
        // Re-center the crop area after scaling
        sx = image.width / 2 - sWidth / 2;
        sy = image.height / 2 - sHeight / 2;

        // Ensure crop area is within image bounds (clamping)
        // If the scaled crop area (sWidth/sHeight) exceeds the image bounds, clamp it.
        // For simplicity with center crop, we trust the scale is reasonable, but we ensure it doesn't start before 0.
        sx = Math.max(0, sx);
        sy = Math.max(0, sy);
        
        // Final Draw: draw the calculated section (sx, sy, sWidth, sHeight) 
        // onto the entire canvas (0, 0, targetWidth, targetHeight)
        ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

        // Convert canvas to Blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, imageFile.type, 0.95); // Quality 0.95

      };
      image.onerror = () => {
        console.error("Error loading image for cropping.");
        resolve(null);
      };
      image.src = e.target?.result as string;
    };
    reader.onerror = () => {
      console.error("Error reading file for cropping.");
      resolve(null);
    };
    reader.readAsDataURL(imageFile);
  });
};
// --- END: CROP UTILITY FUNCTIONS ---

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

  // STATES FOR POST DELETION
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // STATES FOR LIGHTBOX
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxMediaUrl, setLightboxMediaUrl] = useState('');
  const [lightboxMediaType, setLightboxMediaType] = useState<'image' | 'video' | null>(null);

  // NEW STATES FOR PREVIEW/CROPPING
  const [avatarFileToCrop, setAvatarFileToCrop] = useState<File | null>(null);
  const [bannerFileToCrop, setBannerFileToCrop] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState('');
  const [showAvatarCropModal, setShowAvatarCropModal] = useState(false);
  const [showBannerCropModal, setShowBannerCropModal] = useState(false);
  const [isCropping, setIsCropping] = useState(false); // Used for both cropping and direct upload status

  // NEW STATES FOR SIMULATED ZOOM
  const [avatarCropScale, setAvatarCropScale] = useState(1.0);
  const [bannerCropScale, setBannerCropScale] = useState(1.0);

  const openLightbox = (url: string, type: 'image' | 'video') => {
    setLightboxMediaUrl(url);
    setLightboxMediaType(type);
    setShowLightbox(true);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  const avatarFileInput = useRef<HTMLInputElement>(null);
  const bannerFileInput = useRef<HTMLInputElement>(null);

  const isOnline = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return false;
    const now = new Date().getTime();
    const lastSeenTime = new Date(lastSeen).getTime();
    const diff = now - lastSeenTime;
    return diff < 300000; // 5 minutes
  };

  /**
   * Helper function to handle direct upload of files (like GIFs) that don't need cropping.
   */
  const handleDirectUpload = async (file: File, type: 'avatar' | 'banner') => {
    setIsCropping(true); 
    try {
        const result = await uploadMedia(file, 'profiles');
        if (result) {
            if (type === 'avatar') {
                setAvatarUrl(result.url);
            } else {
                setBannerUrl(result.url);
            }
        }
    } catch(e) {
        console.error("Direct upload failed:", e);
    } finally {
        setIsCropping(false);
    }
  };

  // UPDATED HANDLERS FOR FILE SELECTION (TO CHECK FOR GIF)
  const handleAvatarFileSelect = (file: File | null) => {
    if (file) {
      if (file.type === 'image/gif') {
        handleDirectUpload(file, 'avatar');
        return;
      }
      const url = URL.createObjectURL(file);
      setAvatarFileToCrop(file);
      setAvatarPreviewUrl(url); 
      setAvatarCropScale(1.0); // Reset scale on new file select
      setShowAvatarCropModal(true);
    } else {
      setAvatarFileToCrop(null);
      setAvatarPreviewUrl('');
    }
  };

  const handleBannerFileSelect = (file: File | null) => {
    if (file) {
      if (file.type === 'image/gif') {
        handleDirectUpload(file, 'banner');
        return;
      }
      const url = URL.createObjectURL(file);
      setBannerFileToCrop(file);
      setBannerPreviewUrl(url); 
      setBannerCropScale(1.0); // Reset scale on new file select
      setShowBannerCropModal(true);
    } else {
      setBannerFileToCrop(null);
      setBannerPreviewUrl('');
    }
  };

  // ACTUAL CROP AND SAVE FUNCTION USING CANVAS LOGIC
  const handleCropAndSave = async (file: File, type: 'avatar' | 'banner') => {
    if (!file) return;

    setIsCropping(true);
    const scale = type === 'avatar' ? avatarCropScale : bannerCropScale;

    try {
        // 1. Perform client-side cropping using Canvas API
        const croppedBlob = await getCroppedImageBlob(file, type, scale);

        if (!croppedBlob) {
            console.error("Cropping failed, received null Blob.");
            return;
        }

        // 2. Create a new File object from the Blob for upload
        const croppedFile = new File([croppedBlob], `cropped-${file.name}`, { type: croppedBlob.type });

        // 3. Upload the cropped file
        const result = await uploadMedia(croppedFile, 'profiles');

        if (result) {
          if (type === 'avatar') {
            setAvatarUrl(result.url);
          } else {
            setBannerUrl(result.url);
          }
        } else {
            console.error("Media upload failed.");
        }
    } catch(e) {
        console.error("An error occurred during crop or upload:", e);
    } finally {
        // 4. Cleanup states regardless of success/failure
        setIsCropping(false);
        if (type === 'avatar') {
            setShowAvatarCropModal(false);
            setAvatarFileToCrop(null);
            setAvatarPreviewUrl('');
        } else {
            setShowBannerCropModal(false);
            setBannerFileToCrop(null);
            setBannerPreviewUrl('');
        }
    }
  };


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

  // POST DELETION FUNCTIONS
  const startDeleteHold = (post: Post) => {
    if (holdIntervalRef.current) return;

    // Reset and start
    setDeleteProgress(0);
    setPostToDelete(post);
    setShowDeleteModal(true);

    let progress = 0;
    const interval = 50; // Update every 50ms
    const totalTime = 5000; // 5 seconds
    const steps = totalTime / interval;
    const increment = 100 / steps;

    holdIntervalRef.current = setInterval(() => {
      progress += increment;
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        deletePost(post);
        return;
      }
      setDeleteProgress(progress);
    }, interval);
  };

  const cancelDeleteHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setDeleteProgress(0);
  };

  const deletePost = async (post: Post) => {
    setShowDeleteModal(false);
    setPostToDelete(null);
    cancelDeleteHold();

    // Optimistically remove from UI
    setPosts(prev => prev.filter(p => p.id !== post.id));

    // Delete from DB
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id);

    if (error) {
      console.error('Error deleting post:', error);
      // Re-add the post to the UI if deletion failed
      loadPosts(); // Simple re-fetch to correct state
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

  // Real-time preview URLs: prioritize newly selected file preview, then the current state URL, then the loaded profile URL.
  const currentBannerUrl = isEditing && bannerPreviewUrl ? bannerPreviewUrl : bannerUrl || profile.banner_url;
  const currentAvatarUrl = isEditing && avatarPreviewUrl ? avatarPreviewUrl : avatarUrl || profile.avatar_url;


  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[rgb(var(--color-surface))]">
        <div className="relative h-48 bg-[rgb(var(--color-border))]">
          {/* BANNER PREVIEW / CLICK SHORTCUT */}
          {currentBannerUrl ? (
            <button
              onClick={() => isOwnProfile && isEditing && bannerFileInput.current?.click()}
              className={`w-full h-full ${isOwnProfile && isEditing ? 'cursor-pointer group' : ''}`}
              disabled={!isOwnProfile || !isEditing}
            >
              <img src={currentBannerUrl} className="w-full h-full object-cover" alt="Banner" />
              {isOwnProfile && isEditing && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={48} className="text-white" />
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={() => isOwnProfile && isEditing && bannerFileInput.current?.click()}
              className={`w-full h-full ${isOwnProfile && isEditing ? 'cursor-pointer group' : ''}`}
              disabled={!isOwnProfile || !isEditing}
            >
              <div className="w-full h-full bg-gradient-to-br from-[rgba(var(--color-accent),1)] to-[rgba(var(--color-primary),1)] flex items-center justify-center">
                {isOwnProfile && isEditing && <Camera size={48} className="text-white" />}
              </div>
            </button>
          )}
        </div>

        <div className="relative px-4 pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-16">
            {/* AVATAR PREVIEW / CLICK SHORTCUT */}
            <button
              onClick={() => {
                if (isOwnProfile && isEditing) {
                  avatarFileInput.current?.click();
                } else if (!isOwnProfile) {
                  goToProfile(profile.id);
                }
              }}
              className={`relative ${isOwnProfile && isEditing ? 'group cursor-pointer' : ''}`}
            >
              <img
                // Use currentAvatarUrl for real-time preview
                src={currentAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
                className="w-32 h-32 rounded-full border-4 border-[rgb(var(--color-surface))] shadow-lg ring-4 ring-[rgb(var(--color-surface))] hover:opacity-90 transition object-cover"
                alt="Avatar"
              />
              {isOnline(profile.last_seen) && (
                <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-[rgb(var(--color-surface))] rounded-full" />
              )}
              {isOwnProfile && isEditing && (
                <div className="absolute inset-0 w-32 h-32 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={32} className="text-white" />
                </div>
              )}
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
              {/* AVATAR UPLOAD FIELD (HIDDEN) */}
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
                  onChange={(e) => handleAvatarFileSelect(e.target.files?.[0] || null)}
                  className="hidden" 
                />
              </div>
              {/* BANNER UPLOAD FIELD (HIDDEN) */}
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
                  onChange={(e) => handleBannerFileSelect(e.target.files?.[0] || null)}
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
          <button onClick={() => goToProfile(post.user_id)} className="font-bold text-[rgb(var(--color-text))] hover:underline">
            {post.profiles?.display_name}
          </button>
          {post.profiles?.verified && <BadgeCheck size={16} className="text-[rgb(var(--color-accent))]" />}
          <span className="text-[rgb(var(--color-text-secondary))] text-sm">@{post.profiles?.username}</span>
          <span className="text-[rgb(var(--color-text-secondary))] text-sm">
            · {new Date(post.created_at).toLocaleDateString()} at {formatTime(post.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[rgb(var(--color-text))]">{post.content}</p>
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
                        className="flex items-center gap-2 p-3 bg-[rgb(var(--color-surface-hover))] rounded-lg text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))] transition inline-block"
                      >
                        <FileText size={20} /> Download File
                      </a>
                    )}
                  </div>
                )}
      </div>

    {isOwnProfile && (
        <div className="relative flex-shrink-0">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === post.id ? null : post.id);
                }}
                className="p-1 rounded-full text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] transition"
            >
                <MoreVertical size={20} />
            </button>
            {openMenuId === post.id && (
                <div 
                    className="absolute right-0 mt-2 w-48 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-lg shadow-xl overflow-hidden z-10"
                    onMouseLeave={() => setOpenMenuId(null)}
                >
                    <button
                        onClick={() => {
                            setPostToDelete(post);
                            setShowDeleteModal(true);
                            setOpenMenuId(null);
                        }}
                        className="w-full text-left p-3 text-red-500 hover:bg-red-50 transition flex items-center gap-2"
                    >
                        <Trash2 size={18} /> Delete Post
                    </button>
                </div>
            )}
        </div>
    )}
    </div>
  </div>
))}
      </div>

      {/* AVATAR CROP MODAL (with actual cropping logic and zoom simulation) */}
      {showAvatarCropModal && avatarFileToCrop && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => !isCropping && setShowAvatarCropModal(false)}>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl w-full max-w-lg flex flex-col p-6 text-[rgb(var(--color-text))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xl flex items-center gap-2"><Crop size={20} /> Crop Avatar</h3>
                <button 
                  onClick={() => setShowAvatarCropModal(false)} 
                  className="p-2 text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-hover))] rounded-full"
                  disabled={isCropping}
                >
                    <X size={20} />
                </button>
            </div>
            <div className="flex justify-center items-center h-80 w-full bg-[rgb(var(--color-background))] rounded-lg overflow-hidden relative mb-4">
                {/* Image preview showing the effect of the scale on the image */}
                <img 
                  src={avatarPreviewUrl} 
                  className="max-w-full max-h-full object-contain" 
                  alt="Avatar Crop Preview" 
                  style={{ transform: `scale(${avatarCropScale})` }} // Visual Zoom Simulation
                />
                {/* Visual guide for the 1:1 square crop area */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-dashed border-white/80 rounded-full shadow-lg" />
                    <div className="absolute inset-0 bg-black/50" 
                      style={{ 
                        clipPath: 'circle(128px at center)',
                        mixBlendMode: 'saturation' // Darken/desaturate outside area
                      }}
                    />
                    {isCropping && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xl font-bold">
                            Processing...
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium mb-1 text-[rgb(var(--color-text))]">Zoom Level ({avatarCropScale.toFixed(1)}x)</label>
                <input 
                    type="range" 
                    min="1.0" 
                    max="3.0" 
                    step="0.1" 
                    value={avatarCropScale} 
                    onChange={(e) => setAvatarCropScale(parseFloat(e.target.value))} 
                    className="w-full h-2 bg-[rgb(var(--color-border))] rounded-lg appearance-none cursor-pointer range-lg"
                    disabled={isCropping}
                />
                <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-1">Adjusting zoom scales the image content for the **center crop** area.</p>
            </div>
            
            <button
              onClick={() => handleCropAndSave(avatarFileToCrop, 'avatar')}
              className="w-full py-3 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-full font-semibold hover:bg-[rgba(var(--color-primary),1)] transition disabled:opacity-50 mt-4"
              disabled={isCropping}
            >
              {isCropping ? 'Cropping & Uploading...' : 'Crop & Save Avatar'}
            </button>
          </div>
        </div>
      )}

      {/* BANNER CROP MODAL (with actual cropping logic and zoom simulation) */}
      {showBannerCropModal && bannerFileToCrop && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => !isCropping && setShowBannerCropModal(false)}>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl w-full max-w-2xl flex flex-col p-6 text-[rgb(var(--color-text))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xl flex items-center gap-2"><Crop size={20} /> Crop Banner</h3>
                <button 
                  onClick={() => setShowBannerCropModal(false)} 
                  className="p-2 text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-hover))] rounded-full"
                  disabled={isCropping}
                >
                    <X size={20} />
                </button>
            </div>
            <div className="flex justify-center items-center h-48 w-full bg-[rgb(var(--color-background))] rounded-lg overflow-hidden relative mb-4">
                {/* Image preview showing the effect of the scale on the image */}
                <img 
                  src={bannerPreviewUrl} 
                  className="w-full h-full object-cover" 
                  alt="Banner Crop Preview" 
                  style={{ transform: `scale(${bannerCropScale})` }} // Visual Zoom Simulation
                />
                {/* Visual guide for the approx 2.5:1 banner crop area */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Simplified visual: a central box representing the 2.5:1 crop (e.g., 500x200) */}
                    <div className="w-11/12 h-3/5 border-4 border-dashed border-white/80 shadow-lg" />
                    <div className="absolute inset-0 bg-black/50" 
                        style={{ 
                            clipPath: 'polygon(0% 0%, 0% 100%, 5% 100%, 5% 20%, 95% 20%, 95% 80%, 5% 80%, 5% 100%, 100% 100%, 100% 0%)',
                            mixBlendMode: 'saturation' // Darken/desaturate outside area
                        }}
                    />
                    {isCropping && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xl font-bold">
                            Processing...
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-4">
                <label className="block text-sm font-medium mb-1 text-[rgb(var(--color-text))]">Zoom Level ({bannerCropScale.toFixed(1)}x)</label>
                <input 
                    type="range" 
                    min="1.0" 
                    max="3.0" 
                    step="0.1" 
                    value={bannerCropScale} 
                    onChange={(e) => setBannerCropScale(parseFloat(e.target.value))} 
                    className="w-full h-2 bg-[rgb(var(--color-border))] rounded-lg appearance-none cursor-pointer range-lg"
                    disabled={isCropping}
                />
                <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-1">Adjusting zoom scales the image content for the **center crop** area.</p>
            </div>

            <button
              onClick={() => handleCropAndSave(bannerFileToCrop, 'banner')}
              className="w-full py-3 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-full font-semibold hover:bg-[rgba(var(--color-primary),1)] transition disabled:opacity-50 mt-4"
              disabled={isCropping}
            >
              {isCropping ? 'Cropping & Uploading...' : 'Crop & Save Banner'}
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && postToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => {
          setShowDeleteModal(false);
          setPostToDelete(null);
          cancelDeleteHold();
        }}>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl w-full max-w-sm flex flex-col p-6 text-[rgb(var(--color-text))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={24} className="text-red-500 flex-shrink-0" />
              <h3 className="font-bold text-xl">Confirm Deletion</h3>
            </div>
            <p className="mb-6">Are you sure? This action cannot be undone!</p>
            
            <button
              onMouseDown={() => startDeleteHold(postToDelete)}
              onMouseUp={cancelDeleteHold}
              onMouseLeave={cancelDeleteHold}
              onTouchStart={() => startDeleteHold(postToDelete)}
              onTouchEnd={cancelDeleteHold}
              className="relative w-full py-3 rounded-xl font-bold text-lg text-white bg-red-500 overflow-hidden disabled:opacity-50 transition duration-100"
              disabled={deleteProgress > 0 && deleteProgress < 100}
            >
              <div
                className="absolute inset-0 bg-red-700 transition-all duration-50"
                style={{ width: `${deleteProgress}%` }}
              />
              <span className="relative z-10">
                {deleteProgress > 0 ? `Hold to Delete (${Math.ceil(5 - (deleteProgress / 100) * 5)}s)` : 'Hold to Delete'}
              </span>
            </button>

            <button
              onClick={() => {
                setShowDeleteModal(false);
                setPostToDelete(null);
                cancelDeleteHold();
              }}
              className="mt-3 w-full py-2 text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] rounded-xl transition"
            >
              Cancel
            </button>

          </div>
        </div>
      )}

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
                      <div className="relative flex-shrink-0">
                        <img
                          src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`}
                          className="w-10 h-10 rounded-full"
                          alt=""
                        />
                        {isOnline(p.last_seen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[rgb(var(--color-surface))] rounded-full" />
                        )}
                      </div>
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
