// src/components/Calls.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  X, RefreshCw, SwitchCamera, AlertCircle, WifiOff 
} from 'lucide-react';
import Peer from 'peerjs';
import { Profile } from '../lib/supabase'; // Adjust path if needed

// --- Types ---

type IncomingCall = {
  from: Profile;
  type: 'audio' | 'video';
  peerCall: Peer.MediaConnection;
};

type CallState = {
  with: Profile;
  type: 'audio' | 'video';
  isCaller: boolean;
  status: 'ringing' | 'connecting' | 'connected' | 'reconnecting';
};

type ToastMsg = {
  id: string;
  message: string;
  type: 'error' | 'info';
};

// --- Helper Hook for Audio Visualization ---
const useAudioLevel = (stream: MediaStream | null) => {
  const [level, setLevel] = useState(0);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }

    // Check if stream has audio tracks
    if (stream.getAudioTracks().length === 0) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 64;
    
    try {
      sourceRef.current = ctx.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
    } catch (e) {
      console.warn("AudioContext error:", e);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      
      // Normalize to 0-1 range roughly, with sensitivity adjustment
      // 0 = silent, 1 = loud
      const normalized = Math.min(1, avg / 50); 
      
      setLevel(normalized);
      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      sourceRef.current?.disconnect();
    };
  }, [stream]);

  return level;
};

// --- Main Component ---

export const Calls = () => {
  const { user } = useAuth();
  
  // -- State --
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callState, setCallState] = useState<CallState | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  
  // Remote state (inferred from stream tracks)
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteCamOff, setIsRemoteCamOff] = useState(false);

  // Camera Switching
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>();

  // Toasts
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  // -- Refs --
  const peerRef = useRef<Peer | null>(null);
  const activeCallRef = useRef<Peer.MediaConnection | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  
  // Refs for callbacks to access latest state
  const callStateRef = useRef(callState);
  const incomingCallRef = useRef(incomingCall);

  // -- Visualizers --
  const localAudioLevel = useAudioLevel(localStream);
  const remoteAudioLevel = useAudioLevel(remoteStream);

  // Update refs when state changes
  useEffect(() => {
    callStateRef.current = callState;
    incomingCallRef.current = incomingCall;
  }, [callState, incomingCall]);

  // --- Utilities ---

  const addToast = useCallback((msg: string, type: 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message: msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Initialize Ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('/ringtone.mp3'); // Ensure this file exists in /public
    ringtoneRef.current.loop = true;
    return () => {
      ringtoneRef.current?.pause();
      ringtoneRef.current = null;
    };
  }, []);

  // Ringtone Logic
  useEffect(() => {
    if (incomingCall) {
      ringtoneRef.current?.play().catch(() => {});
    } else {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    }
  }, [incomingCall]);

  // Enumerate Cameras
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);
      } catch (err) {
        console.warn("Could not enumerate devices", err);
      }
    };
    getDevices();
  }, []);

  // Detect Remote Stream Mute/Video Off
  useEffect(() => {
    if (!remoteStream) return;

    const checkTracks = () => {
      const audio = remoteStream.getAudioTracks()[0];
      const video = remoteStream.getVideoTracks()[0];
      setIsRemoteMuted(audio ? !audio.enabled : true);
      setIsRemoteCamOff(video ? !video.enabled : true);
    };

    // Listen for events
    remoteStream.getTracks().forEach(track => {
      track.onmute = () => checkTracks();
      track.onunmute = () => checkTracks();
      // 'ended' can happen if they stop the stream
      track.onended = () => checkTracks(); 
    });

    // Polling as a fallback (some browsers don't fire mute consistently for peer connections)
    const interval = setInterval(checkTracks, 1000);
    return () => clearInterval(interval);
  }, [remoteStream]);


  // --- WebRTC Logic ---

  const initPeer = useCallback((retry = false) => {
    if (!user) return;
    
    // If we are retrying, destroy old one first
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    console.log(`Initializing PeerJS (User: ${user.id}) ${retry ? '- RETRY' : ''}`);

    const peer = new Peer(user.id, {
      debug: 1, // 0=none, 3=all
      config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('Peer Connected. ID:', id);
      if (retry) addToast('Connection restored', 'info');
    });

    peer.on('call', (call) => {
      if (callStateRef.current || incomingCallRef.current) {
        // Busy
        call.close();
        return;
      }
      
      // Monitor caller hanging up
      call.on('close', () => {
         setIncomingCall(prev => (prev?.peerCall === call ? null : prev));
         addToast("Call ended by caller", 'info');
      });

      // Handle errors during setup
      call.on('error', (e) => {
        console.error("Incoming call error:", e);
        setIncomingCall(null);
      });

      setIncomingCall({
        from: call.metadata.from,
        type: call.metadata.type,
        peerCall: call
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      
      if (err.type === 'peer-unavailable') {
        addToast(`User is unreachable or offline.`, 'error');
        // If we were calling, cleanup
        if (callStateRef.current?.isCaller) {
            handleHangUp();
        }
      } else if (err.type === 'network' || err.type === 'disconnected') {
        addToast('Network connection lost. Reconnecting...', 'error');
        // Attempt robust reconnect
        setTimeout(() => initPeer(true), 2000);
      } else if (err.type === 'unavailable-id') {
        // ID taken? Should rarely happen with user.id, but good to handle
        console.warn("ID collision, retrying...");
        setTimeout(() => initPeer(true), 1000);
      }
    });

  }, [user]); // Removed addToast from dependency to avoid loop, technically addToast is stable via useCallback

  useEffect(() => {
    if (user) initPeer();
    return () => {
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [user, initPeer]);


  // --- Call Control ---

  const getMedia = useCallback(async (type: 'audio' | 'video', deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? {
           deviceId: deviceId ? { exact: deviceId } : undefined,
           facingMode: deviceId ? undefined : 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      if (type === 'video') {
         setIsCamOff(false);
         // Get the actual device ID used
         const vidTrack = stream.getVideoTracks()[0];
         if (vidTrack) setCurrentCameraId(vidTrack.getSettings().deviceId);
      }
      setIsMuted(false);
      return stream;
    } catch (err) {
      console.error('Media access error:', err);
      addToast('Could not access Camera/Microphone', 'error');
      // Return "dummy" stream to keep connection alive if possible
      return new MediaStream();
    }
  }, [addToast]);

  const cleanupCall = useCallback(() => {
    activeCallRef.current?.close();
    activeCallRef.current = null;
    
    localStream?.getTracks().forEach(t => t.stop());
    remoteStream?.getTracks().forEach(t => t.stop());
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallState(null);
    setIncomingCall(null);
  }, [localStream, remoteStream]);

  const handleHangUp = useCallback(() => {
    if (callStateRef.current) {
        addToast('Call ended', 'info');
    }
    cleanupCall();
  }, [cleanupCall, addToast]);

  const monitorConnection = (call: Peer.MediaConnection) => {
    // Robust connection monitoring
    call.peerConnection.oniceconnectionstatechange = () => {
        const state = call.peerConnection.iceConnectionState;
        console.log("ICE State:", state);
        if (state === 'disconnected' || state === 'failed') {
            addToast('Connection unstable. Reconnecting...', 'error');
            setCallState(prev => prev ? { ...prev, status: 'reconnecting' } : null);
            // PeerJS usually tries to ICE restart automatically. 
            // If it stays failed for too long, we might hang up.
        } else if (state === 'connected' || state === 'completed') {
            setCallState(prev => prev ? { ...prev, status: 'connected' } : null);
        }
    };
  };

  const startCall = useCallback(async (targetUser: Profile, type: 'audio' | 'video') => {
     if (!peerRef.current || !user) return;

     const stream = await getMedia(type);
     
     setCallState({ with: targetUser, type, isCaller: true, status: 'connecting' });

     // Retry logic wrapper
     const attemptCall = (retries = 1) => {
         const call = peerRef.current!.call(targetUser.id, stream, {
             metadata: { from: user, type }
         });
         
         activeCallRef.current = call;
         
         // Monitor robustly
         monitorConnection(call);

         call.on('stream', (rStream) => {
            setRemoteStream(rStream);
            setCallState(prev => prev ? { ...prev, status: 'connected' } : null);
         });

         call.on('close', () => {
             handleHangUp();
             addToast(`${targetUser.display_name} hung up`, 'info');
         });

         call.on('error', (err) => {
             console.error('Call specific error:', err);
             if (retries > 0) {
                 console.log("Retrying call...");
                 setTimeout(() => attemptCall(retries - 1), 1000);
             } else {
                 addToast('Call failed to connect', 'error');
                 handleHangUp();
             }
         });
     };

     attemptCall();

  }, [user, getMedia, handleHangUp, addToast]);

  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    
    const stream = await getMedia(incomingCall.type);
    
    setCallState({ 
        with: incomingCall.from, 
        type: incomingCall.type, 
        isCaller: false,
        status: 'connecting'
    });

    incomingCall.peerCall.answer(stream);
    activeCallRef.current = incomingCall.peerCall;

    monitorConnection(incomingCall.peerCall);

    incomingCall.peerCall.on('stream', (rStream) => {
        setRemoteStream(rStream);
        setCallState(prev => prev ? { ...prev, status: 'connected' } : null);
    });

    incomingCall.peerCall.on('close', () => {
        handleHangUp();
        addToast("Call ended", 'info');
    });

    setIncomingCall(null);
  }, [incomingCall, getMedia, handleHangUp, addToast]);


  const switchCamera = async () => {
      if (!localStream || cameras.length < 2) return;
      
      const currentVidTrack = localStream.getVideoTracks()[0];
      const newIndex = (cameras.findIndex(c => c.deviceId === currentCameraId) + 1) % cameras.length;
      const newDevice = cameras[newIndex];

      // Get new stream
      try {
          const newStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: newDevice.deviceId } },
              audio: false // Don't touch audio
          });
          const newVideoTrack = newStream.getVideoTracks()[0];

          // 1. Replace track in Local Stream (for UI)
          if (currentVidTrack) {
              localStream.removeTrack(currentVidTrack);
              currentVidTrack.stop();
          }
          localStream.addTrack(newVideoTrack);
          setCurrentCameraId(newDevice.deviceId);

          // 2. Replace track in Peer Connection (Sender)
          if (activeCallRef.current && activeCallRef.current.peerConnection) {
              const senders = activeCallRef.current.peerConnection.getSenders();
              const videoSender = senders.find(s => s.track?.kind === 'video');
              if (videoSender) {
                  videoSender.replaceTrack(newVideoTrack);
              }
          }

      } catch (err) {
          addToast("Failed to switch camera", 'error');
      }
  };

  const toggleMute = () => {
      if (localStream) {
          const enabled = !localStream.getAudioTracks()[0]?.enabled;
          localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
          setIsMuted(!enabled);
      }
  };

  const toggleVideo = () => {
      if (localStream) {
          const enabled = !localStream.getVideoTracks()[0]?.enabled;
          localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
          setIsCamOff(!enabled);
      }
  };

  // Listen for window events (Signaling)
  useEffect(() => {
     const handleStartCall = (e: any) => {
        const { targetUser, type } = e.detail;
        startCall(targetUser, type);
     };
     window.addEventListener('startCall', handleStartCall);
     return () => window.removeEventListener('startCall', handleStartCall);
  }, [startCall]);


  // --- Render ---

  // 1. Incoming Call Fullscreen
  if (incomingCall) {
      return (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
               {/* Background Glow */}
               <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600 rounded-full blur-[100px] animate-pulse"></div>
               </div>

               <div className="relative z-10 flex flex-col items-center">
                   <img 
                      src={incomingCall.from.avatar_url || 'https://via.placeholder.com/150'} 
                      alt={incomingCall.from.username}
                      className="w-32 h-32 rounded-full border-4 border-[rgb(var(--color-primary))] shadow-2xl mb-6 animate-bounce"
                   />
                   <h2 className="text-3xl font-bold text-white mb-2">{incomingCall.from.display_name}</h2>
                   <p className="text-gray-300 mb-8 text-lg">@{incomingCall.from.username}</p>
                   <p className="text-gray-400 mb-12 animate-pulse">Incoming {incomingCall.type} call...</p>
                   
                   <div className="flex gap-8">
                       <button onClick={() => { incomingCall.peerCall.close(); setIncomingCall(null); }} 
                         className="flex flex-col items-center gap-2 group">
                         <div className="p-5 bg-red-600 rounded-full text-white shadow-lg group-hover:bg-red-500 transition-all transform group-hover:scale-110">
                            <PhoneOff size={32} />
                         </div>
                         <span className="text-sm text-gray-400">Decline</span>
                       </button>

                       <button onClick={answerCall} 
                         className="flex flex-col items-center gap-2 group">
                         <div className="p-5 bg-green-500 rounded-full text-white shadow-lg group-hover:bg-green-400 transition-all transform group-hover:scale-110 animate-pulse">
                            <Phone size={32} />
                         </div>
                         <span className="text-sm text-gray-400">Accept</span>
                       </button>
                   </div>
               </div>
          </div>
      );
  }

  // 2. Active Call Grid Layout
  if (callState) {
      return (
          <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col">
              
              {/* Header / Status Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                  <div className="flex items-center gap-2 text-white/80 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                      {callState.status === 'reconnecting' ? <WifiOff size={16} className="text-red-500"/> : <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                      <span className="text-xs font-mono uppercase tracking-widest">{callState.status}</span>
                  </div>
                  <button onClick={handleHangUp} className="text-white/60 hover:text-white">
                      <X size={24} />
                  </button>
              </div>

              {/* Toast Container */}
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
                  {toasts.map(t => (
                      <div key={t.id} className={`p-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-5 ${t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-gray-800/90 text-white border border-gray-700'}`}>
                          {t.type === 'error' && <AlertCircle size={18} />}
                          {t.message}
                      </div>
                  ))}
              </div>

              {/* Grid Content */}
              <div className="flex-1 flex flex-col md:flex-row p-2 gap-2">
                  
                  {/* Remote User Cell */}
                  <div className="flex-1 relative bg-gray-900 rounded-2xl overflow-hidden shadow-inner border border-white/10">
                       {callState.type === 'video' && remoteStream && !isRemoteCamOff ? (
                           <video 
                              ref={el => { if(el) el.srcObject = remoteStream }} 
                              autoPlay playsInline 
                              className="w-full h-full object-cover"
                           />
                       ) : (
                           // Avatar Fallback with Visualizer
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <div 
                                 className="relative rounded-full p-1 transition-all duration-75"
                                 style={{ 
                                    boxShadow: `0 0 ${remoteAudioLevel * 50}px ${remoteAudioLevel * 20}px rgba(var(--color-primary), 0.5)`
                                 }}
                               >
                                  <img 
                                    src={callState.with.avatar_url || 'https://via.placeholder.com/150'} 
                                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover relative z-10" 
                                  />
                               </div>
                           </div>
                       )}

                       {/* Remote Status Overlays */}
                       <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                           <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                               <h3 className="text-white font-bold">{callState.with.display_name}</h3>
                               <p className="text-white/60 text-xs">@{callState.with.username}</p>
                           </div>
                           <div className="flex gap-2">
                               {isRemoteMuted && <div className="p-2 bg-red-500/80 rounded-full text-white"><MicOff size={16}/></div>}
                               {isRemoteCamOff && <div className="p-2 bg-red-500/80 rounded-full text-white"><VideoOff size={16}/></div>}
                           </div>
                       </div>
                  </div>

                  {/* Local User Cell */}
                  <div className="flex-1 md:flex-[0.35] relative bg-gray-800 rounded-2xl overflow-hidden shadow-inner border border-white/10">
                        {callState.type === 'video' && localStream && !isCamOff ? (
                           <video 
                              ref={el => { if(el) el.srcObject = localStream }} 
                              autoPlay playsInline muted 
                              className="w-full h-full object-cover transform scale-x-[-1]" // Mirror local
                           />
                       ) : (
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <div 
                                 className="relative rounded-full p-1 transition-all duration-75"
                                 style={{ 
                                    boxShadow: `0 0 ${localAudioLevel * 50}px ${localAudioLevel * 20}px rgba(255, 255, 255, 0.3)`
                                 }}
                               >
                                   <img 
                                     src={user?.user_metadata?.avatar_url || user?.avatar_url || 'https://via.placeholder.com/150'} 
                                     className="w-20 h-20 rounded-full object-cover" 
                                   />
                               </div>
                               <p className="text-white/50 mt-4 text-sm">Camera Off</p>
                           </div>
                       )}

                       <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                           <p className="text-white text-sm font-medium">You</p>
                       </div>
                  </div>
              </div>

              {/* Bottom Controls */}
              <div className="h-24 bg-black/80 backdrop-blur-lg flex items-center justify-center gap-6 pb-4">
                  <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? 'bg-white text-black' : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'}`}>
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>

                  <button onClick={handleHangUp} className="p-5 rounded-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500 transform hover:scale-105 transition-all">
                      <PhoneOff size={32} />
                  </button>

                  {callState.type === 'video' && (
                     <>
                        <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isCamOff ? 'bg-white text-black' : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'}`}>
                           {isCamOff ? <VideoOff size={24} /> : <Video size={24} />}
                        </button>
                        
                        {cameras.length > 1 && !isCamOff && (
                            <button onClick={switchCamera} className="p-4 rounded-full bg-gray-800 text-white border border-gray-700 hover:bg-gray-700">
                                <SwitchCamera size={24} />
                            </button>
                        )}
                     </>
                  )}
              </div>
          </div>
      );
  }

  return null;
};
