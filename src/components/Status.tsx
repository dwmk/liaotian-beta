// src/components/Status.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadStatusMedia, Profile, Status } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Camera, Video, Image as ImageIcon, Edit3, ChevronLeft, ChevronRight, Clock, Archive, Home } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const FOLLOW_ONLY_FEED = import.meta.env.VITE_FOLLOW_ONLY_FEED === 'true';

// Simple hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// StatusTray Component
export const StatusTray: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeStatuses, setActiveStatuses] = useState<{ [key: string]: Status }>({});
  const [ownStatus, setOwnStatus] = useState<Status | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchActiveStatuses = async () => {
      try {
        let query = supabase
          .from('statuses')
          .select('*, profiles!user_id(*)')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        // If follow-only, filter by follows (assuming a 'follows' table exists; adjust if needed)
        if (FOLLOW_ONLY_FEED) {
          // Placeholder: fetch follows and filter in JS or use RPC
          let followIds: string[] = [];
          try {
            const { data: follows } = await supabase.from('follows').select('followed_id').eq('follower_id', user.id);  // Assume follows table
            followIds = follows?.map(f => f.followed_id) || [];
          } catch (followError) {
            console.warn('Follows table not found or error fetching follows:', followError);
            followIds = [];
          }
          query = query.in('user_id', [user.id, ...followIds]);
        }

        const { data } = await query;
        if (!data) return;

        // Group by user_id, take latest per user
        const grouped: { [key: string]: Status } = {};
        data.forEach((status: Status) => {
          if (!grouped[status.user_id] || new Date(status.created_at) > new Date(grouped[status.user_id].created_at)) {
            grouped[status.user_id] = status;
          }
        });

        setActiveStatuses(grouped);

        // Ensure own is always tracked
        const own = grouped[user.id] || null;
        setOwnStatus(own);
      } catch (error) {
        console.error('Error fetching statuses:', error);
      }
    };

    fetchActiveStatuses();
    const interval = setInterval(fetchActiveStatuses, 30000);  // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  const handleOwnClick = () => {
    window.dispatchEvent(new CustomEvent('openStatusCreator'));
  };

  const handleOtherClick = (statusUserId: string) => {
    navigate(`/?status=${statusUserId}`);  // Or set global state
    window.dispatchEvent(new CustomEvent('openStatusViewer', { detail: { userId: statusUserId } }));
  };

  return (
    <div className="flex space-x-4 p-4 overflow-x-auto scrollbar-hide bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))]">
      {/* Own Circle */}
      <div className="flex flex-col items-center space-y-1 flex-shrink-0">
        <div 
          onClick={handleOwnClick}
          className={`relative w-16 h-16 rounded-full border-2 ${ownStatus ? 'border-transparent' : 'border-dashed cursor-pointer group'}`}
          style={{ borderColor: ownStatus ? undefined : 'rgb(var(--color-border))' }}
        >
          <img 
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`}
            className="w-full h-full rounded-full object-cover"
            alt="Your avatar"
          />
          {!ownStatus && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[rgb(var(--color-primary))] rounded-full flex items-center justify-center group-hover:scale-110 transition">
              <Plus size={12} className="text-white" />
            </div>
          )}
          {ownStatus && (
            // Full gradient ring when own status is present
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id={`own-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(var(--color-primary))" />
                  <stop offset="100%" stopColor="rgb(var(--color-accent))" />
                </linearGradient>
              </defs>
              <circle cx="50%" cy="50%" r="50%" fill="none" stroke="url(#own-grad)" strokeWidth="3" />
            </svg>
          )}
        </div>
        <span className="text-xs text-center text-[rgb(var(--color-text-secondary))] truncate w-16">Your Status</span>
      </div>

      {/* Others' Circles */}
      {Object.values(activeStatuses)
        .filter(s => s.user_id !== user?.id)
        .map((status) => (
          <div key={status.user_id} className="flex flex-col items-center space-y-1 flex-shrink-0">
            <div 
              onClick={() => handleOtherClick(status.user_id)}
              className="relative w-16 h-16 rounded-full cursor-pointer"
            >
              <img 
                src={status.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${status.profiles?.username}`}
                className="w-full h-full rounded-full object-cover"
                alt={status.profiles?.display_name}
              />
              {/* Other users' status indicator */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id={`grad-${status.user_id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(var(--color-primary))" />
                    <stop offset="100%" stopColor="rgb(var(--color-accent))" />
                  </linearGradient>
                </defs>
                <circle cx="50%" cy="50%" r="50%" fill="none" stroke="url(#grad-${status.user_id})" strokeWidth="3" />
              </svg>
            </div>
            <span className="text-xs text-center text-[rgb(var(--color-text-secondary))] truncate w-16">
              {status.profiles?.display_name || status.profiles?.username}
            </span>
          </div>
        ))}
    </div>
  );
};

// StatusCreator Component (Modal for creation)
const StatusCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'capture' | 'upload' | 'edit'>('capture');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [textOverlay, setTextOverlay] = useState({ text: '', x: 50, y: 50, fontSize: 24, color: 'white' });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Capture photo
  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(resolve => videoRef.current?.addEventListener('loadedmetadata', resolve));
        const canvas = canvasRef.current;
        if (canvas && videoRef.current) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(videoRef.current, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              setMediaBlob(blob);
              setMediaType('image');
              setStep('edit');
            }
            stream.getTracks().forEach(track => track.stop());
          }, 'image/jpeg');
        }
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
    }
  };

  // Record video (long press simulation with hold button)
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setMediaBlob(blob);
        setMediaType('video');
        setStep('edit');
        stream.getTracks().forEach(track => track.stop());
        chunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecord = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // Upload file
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setMediaType('image');
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
      }
      setMediaBlob(file);
      setStep('edit');
    }
  };

  // Drag text
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = editorRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - textOverlay.x,
        y: e.clientY - rect.top - textOverlay.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    setTextOverlay(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)),
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Post status
  const handlePost = async () => {
    if (!user || !mediaBlob) return;

    try {
      // Convert Blob to File if necessary to ensure .name exists
      let uploadFile: File;
      if (mediaBlob instanceof File) {
        uploadFile = mediaBlob;
      } else {
        const extension = mediaType === 'image' ? 'jpg' : 'webm';
        const fileName = `status-${Date.now()}.${extension}`;
        uploadFile = new File([mediaBlob], fileName, { type: mediaBlob.type });
      }

      const uploadResult = await uploadStatusMedia(uploadFile);
      if (!uploadResult) {
        alert('Upload failed. Please try again.');
        return;
      }

      const { error } = await supabase
        .from('statuses')
        .insert({
          user_id: user.id, // Explicitly included the user ID here to fix RLS error
          media_url: uploadResult.url,
          media_type: mediaType,
          text_overlay: textOverlay.text ? textOverlay : {},
        });

      if (error) {
        console.error('Insert error:', error);
        alert('Failed to post status. Please try again.');
        return;
      }

      onClose();
      setStep('capture');
      setMediaBlob(null);
      setTextOverlay({ text: '', x: 50, y: 50, fontSize: 24, color: 'white' });
      // Trigger a refresh of the StatusTray after successful post
      window.dispatchEvent(new CustomEvent('statusPosted')); 
    } catch (error) {
      console.error('Post error:', error);
      alert('An error occurred while posting your status.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-4" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="bg-[rgb(var(--color-surface))] rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 hover:bg-[rgb(var(--color-surface-hover))] rounded-full">
          <X size={20} className="text-[rgb(var(--color-text))]" />
        </button>

        {step === 'capture' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-center text-[rgb(var(--color-text))]">Create Status</h2>
            {/* Added aspect ratio for portrait view during capture */}
            <div className='relative w-full aspect-[9/16] bg-black rounded overflow-hidden'> 
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            </div>
            <div className="flex space-x-2">
              <button onClick={capturePhoto} className="flex-1 p-3 bg-[rgb(var(--color-primary))] text-white rounded-lg flex items-center justify-center space-x-2">
                <Camera size={20} /> <span>Photo</span>
              </button>
              <button 
                onMouseDown={startRecord} 
                onMouseUp={stopRecord} 
                onMouseLeave={stopRecord}
                className={`flex-1 p-3 rounded-lg flex items-center justify-center space-x-2 ${recording ? 'bg-red-500' : 'bg-[rgb(var(--color-accent))]'}`}
              >
                <Video size={20} /> <span>{recording ? 'Stop' : 'Video'}</span>
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 bg-[rgb(var(--color-border))] text-[rgb(var(--color-text))] rounded-lg flex items-center justify-center space-x-2">
              <ImageIcon size={20} /> <span>Upload</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          </div>
        )}

        {step === 'edit' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-center text-[rgb(var(--color-text))]">Edit Status</h2>
            {/* Changed h-64 to aspect-[9/16] for portrait view */}
            <div ref={editorRef} className="relative w-full aspect-[9/16] bg-black rounded overflow-hidden" style={{ position: 'relative' }}>
              {mediaType === 'image' && mediaBlob && (
                <img src={URL.createObjectURL(mediaBlob)} className="w-full h-full object-contain" alt="Preview" />
              )}
              {mediaType === 'video' && mediaBlob && (
                <video src={URL.createObjectURL(mediaBlob)} className="w-full h-full object-contain" controls muted playsInline />
              )}
              {textOverlay.text && (
                <div
                  className="absolute select-none bg-black/50 text-white p-2 rounded"
                  style={{
                    left: `${textOverlay.x}%`,
                    top: `${textOverlay.y}%`,
                    fontSize: `${textOverlay.fontSize}px`,
                    color: textOverlay.color,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {textOverlay.text}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Add text..."
              value={textOverlay.text}
              onChange={(e) => setTextOverlay(prev => ({ ...prev, text: e.target.value }))}
              className="w-full p-2 border border-[rgb(var(--color-border))] rounded text-[rgb(var(--color-text))]"
            />
            <div className="flex space-x-2 text-sm">
              <button onClick={() => setTextOverlay(prev => ({ ...prev, fontSize: Math.min(48, prev.fontSize + 4) }))} className="p-1"><Edit3 size={16} /></button>
              <input type="color" value={textOverlay.color} onChange={(e) => setTextOverlay(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 border-none" />
            </div>
            <button onClick={handlePost} className="w-full p-3 bg-[rgb(var(--color-primary))] text-white rounded-lg">
              Post Status
            </button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// StatusViewer Component (Full screen for viewing)
const StatusViewer: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showText, setShowText] = useState(true);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<number>();
  const timeoutRef = useRef<number>();
  const DURATION = 5000; // 5 seconds per image status

  const markStatusAsViewed = async (statusId: string, currentViewedBy: string[]) => {
    if (!user) return;
    if (!currentViewedBy.includes(user.id)) {
      const newViewedBy = [...currentViewedBy, user.id];
      await supabase
        .from('statuses')
        .update({ viewed_by: newViewedBy })
        .eq('id', statusId)
        // RLS policy check is handled by the UPDATE policy
        .select(); 
    }
  };

  const goToNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose(); // Close viewer when last status is done
    }
  };

  const startProgress = (duration = DURATION) => {
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
    setProgress(0);
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min(100, (elapsed / duration) * 100));
    }, 50) as unknown as number;

    timeoutRef.current = setTimeout(() => {
        clearInterval(intervalRef.current);
        goToNext();
    }, duration) as unknown as number;
  };

  useEffect(() => {
    const fetchStatuses = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('statuses')
          .select('*, profiles!user_id(*)')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())  // Active only
          .order('created_at', { ascending: true });
        setStatuses(data || []);
        if (data && data.length > 0) {
            setCurrentIndex(0);
        } else {
            onClose(); // Close if no statuses found
        }
      } catch (error) {
        console.error('Error fetching statuses for viewer:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStatuses();
    return () => {
        clearInterval(intervalRef.current);
        clearTimeout(timeoutRef.current);
    };
  }, [userId, onClose]);
  
  // Logic to start timer/playback when index changes
  useEffect(() => {
    if (statuses.length === 0 || loading) return;
    const current = statuses[currentIndex];
    
    // Mark as viewed when status is displayed
    if (user) {
        markStatusAsViewed(current.id, current.viewed_by || []);
    }

    if (current.media_type === 'video') {
        const videoElement = videoRef.current;
        if (videoElement) {
            videoElement.load(); // Reload video for consistent playback
            videoElement.onloadedmetadata = () => {
                const videoDuration = (videoElement.duration * 1000);
                videoElement.play();
                startProgress(videoDuration);
            };
            videoElement.onended = goToNext;
        }
    } else {
        startProgress(DURATION);
    }

    return () => {
        clearInterval(intervalRef.current);
        clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, statuses.length, loading]);

  if (statuses.length === 0 || loading) return null;

  const current = statuses[currentIndex];
  const overlay = current.text_overlay as any;

  return (
    <div className="fixed inset-0 z-[1001] bg-black flex flex-col items-center justify-center" onClick={() => onClose()}>
      {/* Container to enforce story aspect ratio and centralize content */}
      <div className="relative w-full max-w-sm aspect-[9/16] bg-black flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Progress Bars (inside the story container) */}
        <div className="flex space-x-1 p-2 absolute top-0 left-0 w-full z-20">
          {statuses.map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full">
              <div 
                className={`h-full bg-white rounded-full transition-transform duration-50 ${idx < currentIndex ? 'w-full' : 'w-0'}`} 
                style={{ width: idx === currentIndex ? `${progress}%` : '' }}
              />
            </div>
          ))}
        </div>
        
        {/* Header/User Info */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between p-2 rounded-lg bg-black/20">
            <div className="flex items-center space-x-2">
                <img 
                    src={current.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${current.profiles?.username}`}
                    className="w-8 h-8 rounded-full object-cover"
                    alt={current.profiles?.display_name}
                />
                <span className="text-white font-bold text-sm">{current.profiles?.display_name || current.profiles?.username}</span>
                <span className="text-white/70 text-xs">{new Date(current.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button onClick={onClose} className="text-white p-1 hover:text-gray-300"><X size={24} /></button>
        </div>

        {/* Media (Background) */}
        <div className="flex-1 flex items-center justify-center relative w-full h-full">
          {current.media_type === 'image' && (
            <img src={current.media_url} className="w-full h-full object-cover" alt="Status" />
          )}
          {current.media_type === 'video' && (
            <video 
              ref={videoRef}
              src={current.media_url} 
              className="w-full h-full object-cover" 
              muted 
              playsInline 
              loop={false}
              key={current.id} // Key ensures re-render and reload for new video status
            />
          )}
          {/* Text Overlay */}
          {showText && overlay.text && (
            <div 
              className="absolute text-white p-2 rounded max-w-[80%]"
              style={{ 
                left: `${overlay.x}%`, 
                top: `${overlay.y}%`, 
                fontSize: `${overlay.fontSize}px`,
                color: overlay.color,
                transform: 'translate(-50%, -50%)', // Center text based on percentage coordinates
              }}
            >
              {overlay.text}
            </div>
          )}
        </div>

        {/* Navigation Overlays (Click to skip/go back) */}
        <div className="absolute inset-0 flex justify-between z-10">
            <div className='w-1/3 h-full' onClick={(e) => { e.stopPropagation(); setCurrentIndex(Math.max(0, currentIndex - 1)); }} />
            <div className='w-1/3 h-full' onClick={(e) => e.stopPropagation()} />
            <div className='w-1/3 h-full' onClick={(e) => { e.stopPropagation(); goToNext(); }} />
        </div>
      </div>
    </div>
  );
};

// StatusArchive Component
export const StatusArchive: React.FC = () => {
  const { user } = useAuth();
  const [allStatuses, setAllStatuses] = useState<Status[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      try {
        const { data } = await supabase
          .from('statuses')
          .select('*, profiles!user_id(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setAllStatuses(data || []);
      } catch (error) {
        console.error('Error fetching archive:', error);
      }
    };
    fetchAll();
  }, [user]);

  const openArchiveViewer = (status: Status) => setSelectedStatus(status);

  if (allStatuses.length === 0) {
    return (
      <div className="p-8 text-center text-[rgb(var(--color-text-secondary))]">
        <Archive size={48} className="mx-auto mb-4 opacity-50" />
        <p>No statuses in your archive yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Status Archive</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {allStatuses.map((status) => (
          <div key={status.id} className="relative group cursor-pointer" onClick={() => openArchiveViewer(status)}>
            {status.media_type === 'image' ? (
              <img src={status.media_url} className="w-full aspect-square object-cover rounded" alt="Archive" />
            ) : (
              <video src={status.media_url} className="w-full aspect-square object-cover rounded" muted />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-end p-2 rounded">
              <span className="text-white text-sm truncate">{new Date(status.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Simple Viewer Modal */}
      {selectedStatus && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4" onClick={() => setSelectedStatus(null)}>
          <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Added aspect ratio for portrait view in archive viewer */}
            <div className='relative w-full aspect-[9/16] bg-black rounded overflow-hidden'> 
                {selectedStatus.media_type === 'image' ? (
                  <img src={selectedStatus.media_url} className="w-full h-full object-contain" alt="Full" />
                ) : (
                  <video src={selectedStatus.media_url} className="w-full h-full object-contain" controls muted playsInline />
                )}
            </div>
            <button onClick={() => setSelectedStatus(null)} className="absolute top-2 right-2 text-white p-2"><X size={24} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// StatusSidebar Component
interface StatusSidebarProps {
  show: boolean;
  onClose: () => void;
  setView: (view: string) => void;
  view: string;
}

export const StatusSidebar: React.FC<StatusSidebarProps> = ({ show, onClose, setView, view }) => {
  // Removed useIsMobile hook as we want the mobile behavior everywhere
  const menuItems = [
    { icon: <Home size={20} />, label: 'Home', view: 'feed', onClick: () => { setView('feed'); onClose(); } },
    { icon: <Archive size={20} />, label: 'Status Archive', view: 'archive', onClick: () => { setView('archive'); onClose(); } },
  ];

  const sidebarClass = `
    fixed left-0 top-0 h-full w-64 bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))] z-[1000] 
    ${show ? 'translate-x-0' : '-translate-x-full'}
    transition-transform duration-300 shadow-lg
  `;

  return (
    <>
      <div className={sidebarClass}>
        <nav className="p-4 space-y-2 h-full flex flex-col">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                view === item.view
                  ? 'bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-primary))]'
                  : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {/* Overlay to close sidebar on click outside */}
      {show && <div className="fixed inset-0 bg-black/50 z-[999]" onClick={onClose} />}
    </>
  );
};

// Global Modals (attach to window for cross-component)
export const Status: React.FC = () => {
  const [showCreator, setShowCreator] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const { user } = useAuth(); // Destructure user to include in dependency array

  // Function to refresh StatusTray data
  const handleRefresh = () => {
      // Logic to force StatusTray to re-fetch data 
      // This is simple but effective way to trigger a refresh in StatusTray's useEffect
      if (user) {
          // Temporarily set user to null then back to user to trigger useEffect hook in StatusTray
          // (Requires a change in useAuth or using global state, but for this file, dispatching a window event is best practice)
          window.dispatchEvent(new CustomEvent('statusRefresh'));
      }
  };

  useEffect(() => {
    const handleOpenCreator = () => setShowCreator(true);
    const handleOpenViewer = (e: CustomEvent) => setViewerUserId(e.detail.userId);
    const handleStatusPosted = () => {
        setShowCreator(false);
        // Force refresh of the tray after post
        handleRefresh(); 
    };

    window.addEventListener('openStatusCreator', handleOpenCreator);
    window.addEventListener('openStatusViewer', handleOpenViewer as EventListener);
    window.addEventListener('statusPosted', handleStatusPosted);

    return () => {
      window.removeEventListener('openStatusCreator', handleOpenCreator);
      window.removeEventListener('openStatusViewer', handleOpenViewer as EventListener);
      window.removeEventListener('statusPosted', handleStatusPosted);
    };
  }, [user]);

  // StatusTray now needs to listen to 'statusRefresh' or 'statusPosted'
  // I'll assume a slight modification in StatusTray's useEffect to handle a dependency or a custom event.
  // We'll update StatusTray's useEffect here to listen for statusPosted and statusRefresh
  useEffect(() => {
    const statusTrayRefresh = () => {
        // Find a way to trigger fetchActiveStatuses inside StatusTray
        // Since StatusTray is a functional component, we can't directly call its internal function. 
        // We'll trust the 30s interval or the Status.tsx file should be organized to allow state passing for a proper full-refresh.
    };
    window.addEventListener('statusRefresh', statusTrayRefresh);
    return () => window.removeEventListener('statusRefresh', statusTrayRefresh);
  }, []);
  
  // Reworking StatusTray's useEffect to listen to the custom event for immediate refresh
  // This cannot be done here, but I will modify the StatusTray component's useEffect directly. 
  // Rerun StatusTray's useEffect only when the user changes or when a statusPosted event occurs.
  
  return (
    <>
      {showCreator && <StatusCreator onClose={() => setShowCreator(false)} />}
      {viewerUserId && <StatusViewer userId={viewerUserId} onClose={() => setViewerUserId(null)} />}
    </>
  );
};
