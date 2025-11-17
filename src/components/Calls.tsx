// src/components/Calls.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  X,
  RefreshCcw, // For flipping camera
  Gauge // For connection stats
} from 'lucide-react';
import Peer from 'peerjs';

// --- Reusable Modal for INCOMING calls only ---
const IncomingCallModal = ({ children, onClose }: { children: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center p-4" onClick={onClose}>
    <div 
      className={`bg-[rgb(var(--color-surface))] rounded-2xl shadow-xl p-6 w-full max-w-sm relative`} 
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))]">
        <X size={20} />
      </button>
      {children}
    </div>
  </div>
);

// --- Reusable Component for Press-and-Hold Hangup Button ---
const HangUpButton = ({ onHangUp }: { onHangUp: () => void }) => {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const HOLD_TIME = 3000; // 3 seconds, 5 is a bit long for UX

  const startHold = () => {
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    setProgress(0);

    // Interval to update progress
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const newProgress = p + (100 / (HOLD_TIME / 50));
        if (newProgress >= 100) {
          clearInterval(intervalRef.current!);
          return 100;
        }
        return newProgress;
      });
    }, 50);

    // Timer to fire the event
    timerRef.current = setTimeout(() => {
      onHangUp();
    }, HOLD_TIME);
  };

  const cancelHold = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
  };

  const-radius = 60; // 2 * pi * r
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      className="relative w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform active:scale-95 transition"
      title="Press and hold to hang up"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          className="transition-all duration-50"
        />
      </svg>
      <PhoneOff size={36} className="relative" />
    </button>
  );
};

// --- Reusable Call Control Button ---
const CallButton = ({ 
  onClick, 
  icon, 
  title, 
  className = '' 
}: { 
  onClick: () => void; 
  icon: React.ReactNode; 
  title: string; 
  className?: string; 
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg backdrop-blur-md bg-white/20 hover:bg-white/30 active:bg-white/40 transition ${className}`}
  >
    {icon}
  </button>
);

// --- Draggable Picture-in-Picture Component ---
const DraggablePIP = ({ children }: { children: React.ReactNode }) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const pipRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (pipRef.current) {
      const rect = pipRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }
    e.stopPropagation();
  };

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    let newX = clientX - offsetRef.current.x;
    let newY = clientY - offsetRef.current.y;
    
    // Constrain to viewport
    const width = pipRef.current?.offsetWidth || 128;
    const height = pipRef.current?.offsetHeight || 176;
    newX = Math.max(20, Math.min(newX, window.innerWidth - width - 20));
    newY = Math.max(20, Math.min(newY, window.innerHeight - height - 20));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const onDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', onDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onDragEnd);
    };
  }, [isDragging, onDragMove]);

  return (
    <div
      ref={pipRef}
      className="absolute w-32 h-44 rounded-2xl overflow-hidden shadow-2xl z-20 cursor-move border-2 border-white/50"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        touchAction: 'none' // Important for touch dragging
      }}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
    >
      {children}
    </div>
  );
};


// --- Main Calls Component ---
type IncomingCall = {
  from: Profile;
  type: 'audio' | 'video';
  peerCall: Peer.MediaConnection;
};

export const Calls = () => {
  const { user } = useAuth();
  
  // State for call management
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callInProgress, setCallInProgress] = useState<{ with: Profile; type: 'audio' | 'video'; isCaller: boolean; status: 'ringing' | 'connected' } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<string>('Connecting...');

  // Refs for PeerJS and State
  const peerRef = useRef<Peer | null>(null);
  const activeCallRef = useRef<Peer.MediaConnection | null>(null);
  const callInProgressRef = useRef(callInProgress);
  const incomingCallRef = useRef(incomingCall);
  const localStreamRef = useRef(localStream);

  useEffect(() => {
    callInProgressRef.current = callInProgress;
    incomingCallRef.current = incomingCall;
    localStreamRef.current = localStream;
  }, [callInProgress, incomingCall, localStream]);

  // --- WebRTC & Media Functions ---

  const getMedia = useCallback(async (type: 'audio' | 'video', newFacingMode?: 'user' | 'environment') => {
    setMediaError(null);
    const currentFacingMode = newFacingMode || facingMode;
    
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: type === 'video' ? { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (type === 'video') setIsCamOff(false);
      setIsMuted(false);
      return stream;
    } catch (err: any) {
      console.error('Error getting user media:', err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
         setMediaError('No microphone or camera found.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
         setMediaError(type === 'video' ? 'Microphone/Camera access denied.' : 'Microphone access denied.');
      } else {
         setMediaError('Error accessing media devices.');
      }
      setLocalStream(null); 
      setIsMuted(true);
      if (type === 'video') setIsCamOff(true);
      return new MediaStream();
    }
  }, [facingMode]);

  const cleanupCall = useCallback(() => {
    if (activeCallRef.current) {
        activeCallRef.current.close();
        activeCallRef.current = null;
    }
    
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallInProgress(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCamOff(false);
    setMediaError(null);
    setConnectionStats('Connecting...');
  }, [remoteStream]);

  // --- Connection Stats Monitor ---
  useEffect(() => {
    if (!callInProgress || callInProgress.status !== 'connected' || !activeCallRef.current) {
      setConnectionStats('Connecting...');
      return;
    }

    const interval = setInterval(async () => {
      try {
        const stats = await activeCallRef.current?.peerConnection.getStats();
        let rtt = 'N/A';
        stats?.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
            rtt = `${Math.round(report.currentRoundTripTime * 1000)}ms`;
          }
        });
        setConnectionStats(`Ping: ${rtt}`);
      } catch (e) {
        setConnectionStats('Stats Error');
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [callInProgress]);

  // --- Call Action Functions ---

  const handleHangUp = useCallback(() => {
    cleanupCall(); 
  }, [cleanupCall]);
  
  const startCall = useCallback(async (targetUser: Profile, type: 'audio' | 'video') => {
    if (!user || callInProgressRef.current || !peerRef.current) return;

    setCallInProgress({ with: targetUser, type, isCaller: true, status: 'ringing' });
    const stream = await getMedia(type); 
    
    const metadata = { from: user, type: type };
    const call = peerRef.current.call(targetUser.id, stream, { metadata });
    activeCallRef.current = call;

    call.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      setCallInProgress(prev => prev ? { ...prev, status: 'connected' } : null);
    });
    call.on('close', cleanupCall);
    call.on('error', (err) => {
      console.error('Peer call error:', err);
      cleanupCall();
    });
  }, [user, getMedia, cleanupCall]);
  
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    const { from, type, peerCall } = incomingCall;
    
    setCallInProgress({ with: from, type, isCaller: false, status: 'connecting' });
    setIncomingCall(null);
    
    const stream = await getMedia(type);
    peerCall.answer(stream);
    
    activeCallRef.current = peerCall;

    peerCall.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      setCallInProgress(prev => prev ? { ...prev, status: 'connected' } : null);
    });
    peerCall.on('close', cleanupCall);
    peerCall.on('error', (err) => {
      console.error('Peer call error:', err);
      cleanupCall();
    });
  }, [user, incomingCall, getMedia, cleanupCall]);

  const denyCall = useCallback(() => {
     if(incomingCall) {
        incomingCall.peerCall.close();
     }
     setIncomingCall(null);
  }, [incomingCall]);

  // --- Event Listeners ---

  useEffect(() => {
     const handleStartCall = (e: any) => {
        const { targetUser, type } = e.detail;
        startCall(targetUser, type);
     };
     window.addEventListener('startCall', handleStartCall);
     return () => window.removeEventListener('startCall', handleStartCall);
  }, [startCall]);

  useEffect(() => {
    if (!user) return;
    if (peerRef.current) return;

    // Use a random ID for PeerJS in this simple setup
    // For a robust app, you'd use the user's Supabase ID (user.id)
    // But this can cause "ID taken" errors on hot-reload.
    // We'll stick to user.id for persistence.
    const peer = new Peer(user.id);
    peerRef.current = peer;

    peer.on('open', (id) => console.log('PeerJS connected with ID:', id));

    peer.on('call', (call) => {
      const metadata = call.metadata;
      
      if (callInProgressRef.current || incomingCallRef.current) {
        call.close();
        return;
      }
      
      call.on('close', () => {
         setIncomingCall(prev => (prev?.peerCall === call ? null : prev));
      });

      setIncomingCall({
        from: metadata.from,
        type: metadata.type,
        peerCall: call
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'peer-unavailable') {
          if (callInProgressRef.current && callInProgressRef.current.status === 'ringing') {
             setMediaError(`${callInProgressRef.current.with.display_name} is unreachable.`);
             setTimeout(cleanupCall, 3000); // Hang up after 3s
          }
      }
      if (err.type === 'disconnected') {
        peer.reconnect(); // Attempt to reconnect
      }
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
    };
  }, [user, cleanupCall]);


  // --- Media Toggles ---

  const toggleMute = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() || [];
    if (audioTracks.length > 0) {
        const newMutedState = !isMuted;
        audioTracks.forEach(track => {
            track.enabled = !newMutedState;
        });
        setIsMuted(newMutedState);
    } else {
        setMediaError('No microphone track available.');
    }
  };

  const toggleCamera = () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() || [];
    if (videoTracks.length > 0) {
        const newCamOffState = !isCamOff;
        videoTracks.forEach(track => {
            track.enabled = !newCamOffState;
        });
        setIsCamOff(newCamOffState);
    } else {
        setMediaError('No camera track available.');
    }
  };
  
  const flipCamera = async () => {
    if (!callInProgress || callInProgress.type !== 'video' || !localStreamRef.current) return;
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    // Get new stream with flipped camera
    const newStream = await getMedia('video', newFacingMode);
    if (!newStream) {
      setMediaError("Failed to switch camera.");
      return;
    }
    
    const newVideoTrack = newStream.getVideoTracks()[0];
    
    if (newVideoTrack && activeCallRef.current) {
      const sender = activeCallRef.current.peerConnection.getSenders().find(
        s => s.track?.kind === 'video'
      );
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
        
        // Stop old tracks
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        
        setLocalStream(newStream); // Set the new stream (which has both audio and video)
        setFacingMode(newFacingMode);
        setIsCamOff(false); // Ensure camera is on
      }
    }
  };
  
  // --- Render Logic ---

  if (incomingCall) {
    return (
      <IncomingCallModal onClose={denyCall}>
        <div className="text-center text-[rgb(var(--color-text))] flex flex-col items-center">
          <img 
            src={incomingCall.from.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.from.username}`} 
            alt="avatar"
            className="w-24 h-24 rounded-full mb-4 ring-4 ring-[rgb(var(--color-surface-hover))]"
          />
          <h3 className="text-2xl font-bold">{incomingCall.from.display_name}</h3>
          <p className="text-[rgb(var(--color-text-secondary))] text-lg">
            Incoming {incomingCall.type} call...
          </p>
          <div className="flex justify-around w-full mt-8">
            <button
              onClick={denyCall}
              className="flex flex-col items-center gap-2 text-red-500 hover:opacity-70 transition"
              title="Deny"
            >
              <span className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                <PhoneOff size={28} className="text-white" />
              </span>
              Deny
            </button>
            <button
              onClick={answerCall}
              className="flex flex-col items-center gap-2 text-green-500 hover:opacity-70 transition"
              title="Answer"
            >
              <span className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <Phone size={28} className="text-white" />
              </span>
              Answer
            </button>
          </div>
        </div>
      </IncomingCallModal>
    );
  }

  if (callInProgress) {
     return (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between">
            {/* Main Video / Avatar Area */}
            <div className="absolute inset-0 w-full h-full">
              {callInProgress.type === 'video' ? (
                // --- VIDEO CALL UI ---
                <>
                  {/* Remote Video */}
                  <video 
                      ref={el => { if (el) el.srcObject = remoteStream; }} 
                      autoPlay 
                      playsInline 
                      className={`w-full h-full object-cover transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {/* Remote Avatar Fallback (while connecting) */}
                  {(!remoteStream || callInProgress.status === 'ringing') && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                          <img 
                            src={callInProgress.with.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callInProgress.with.username}`} 
                            alt="avatar"
                            className="w-40 h-40 rounded-full mb-4 shadow-lg"
                          />
                          <h2 className="text-3xl font-bold">{callInProgress.with.display_name}</h2>
                          <p className="text-xl text-gray-400 mt-2">{callInProgress.status === 'ringing' ? 'Ringing...' : 'Connecting...'}</p>
                      </div>
                  )}
                </>
              ) : (
                // --- AUDIO CALL UI ---
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <img 
                    src={callInProgress.with.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callInProgress.with.username}`} 
                    alt="avatar"
                    className="w-48 h-48 rounded-full mb-4 shadow-lg ring-4 ring-white/20"
                  />
                  <h2 className="text-4xl font-bold">{callInProgress.with.display_name}</h2>
                  <p className="text-2xl text-gray-400 mt-2">
                    {callInProgress.status === 'ringing' ? 'Ringing...' : (callInProgress.status === 'connected' ? 'Connected' : 'Connecting...')}
                  </p>
                </div>
              )}
            </div>

            {/* Local Video (PIP) */}
            {callInProgress.type === 'video' && localStream && (
              <DraggablePIP>
                <video 
                  ref={el => { if (el) el.srcObject = localStream; }} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`w-full h-full object-cover transform transition-transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${isCamOff ? 'hidden' : 'block'}`}
                />
                {/* Avatar Fallback for PIP */}
                {isCamOff && user && (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <img 
                      src={user.profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.profile.username}`} 
                      alt="your avatar"
                      className="w-20 h-20 rounded-full opacity-50"
                    />
                  </div>
                )}
              </DraggablePIP>
            )}
            
            {/* Header Info (Stats) */}
            <div className="relative z-10 p-4 pt-8 flex items-center gap-2 backdrop-blur-sm bg-black/20">
              <Gauge size={16} className="text-white/70" />
              <span className="text-sm text-white/70 font-medium">
                {connectionStats}
              </span>
              {mediaError && (
                  <p className="text-red-400 text-sm ml-auto">{mediaError}</p>
              )}
            </div>

            {/* Footer Controls */}
            <div className="relative z-10 p-6 flex items-center justify-around w-full max-w-lg mx-auto backdrop-blur-sm bg-black/20 rounded-t-2xl">
                <CallButton
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                  icon={isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                  className={isMuted ? 'bg-white text-black' : ''}
                />
                
                {callInProgress.type === 'video' && (
                  <CallButton
                    onClick={toggleCamera}
                    title={isCamOff ? "Turn camera on" : "Turn camera off"}
                    icon={isCamOff ? <VideoOff size={28} /> : <Video size={28} />}
                    className={isCamOff ? 'bg-white text-black' : ''}
                  />
                )}
                
                {callInProgress.type === 'video' && (
                  <CallButton
                    onClick={flipCamera}
                    title="Flip Camera"
                    icon={<RefreshCcw size={28} />}
                  />
                )}
                
                <HangUpButton onHangUp={handleHangUp} />
            </div>
        </div>
     );
  }
  
  return null; // No call, no UI
};
