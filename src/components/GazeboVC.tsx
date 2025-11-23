// src/components/GazeboVC.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  Maximize2, Minimize2, Users, Volume2, X, Expand, Shrink, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// --- Types ---

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'info' | 'success';
}

interface VoicePeer {
  peerId: string;       // The auto-generated PeerJS ID
  userId: string;       // Supabase User ID
  stream?: MediaStream;
  profile?: { display_name: string; avatar_url: string; username: string };
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  volume: number;       // For audio visualizer
}

interface GazeboVCProps {
  channelId: string;
  channelName: string;
  user: any;
  onDisconnect: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

// --- Video Component (Robust) ---
const VideoTile = React.memo(({ 
    peer, 
    isFocused, 
    onToggleFocus 
}: { 
    peer: VoicePeer;
    isFocused: boolean;
    onToggleFocus: () => void;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Robust stream attachment
    useEffect(() => {
        const videoEl = videoRef.current;
        if (videoEl && peer.stream) {
            videoEl.srcObject = peer.stream;
            videoEl.play().catch(e => console.warn("Autoplay blocked:", e));
        }
    }, [peer.stream]);

    const hasVideo = peer.stream && peer.stream.getVideoTracks().length > 0 && peer.stream.getVideoTracks()[0].enabled;
    const isSpeaking = peer.volume > 15;

    return (
        <div 
            className={`
                relative bg-gray-800 rounded-xl overflow-hidden border-2 transition-all duration-300
                ${isSpeaking ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-transparent'} 
                ${isFocused ? 'col-span-full row-span-full h-full' : 'aspect-video'}
            `}
            onDoubleClick={onToggleFocus}
        >
            {/* Video Feed */}
            {hasVideo && !peer.isVideoOff ? (
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted={peer.peerId === 'local'} // Mute self to avoid feedback
                    className="w-full h-full bg-black object-cover" 
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className={`relative transition-transform duration-150 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
                        <img 
                            src={peer.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peer.userId}`} 
                            className="w-20 h-20 rounded-full shadow-2xl object-cover bg-gray-700 z-10 relative"
                            alt={peer.userId}
                        />
                        {isSpeaking && <div className="absolute -inset-2 rounded-full border-4 border-green-500 opacity-50 animate-ping" />}
                    </div>
                </div>
            )}

            {/* Overlay Info */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-20">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-2 text-white text-xs font-medium">
                    {peer.isMuted ? <MicOff size={12} className="text-red-500" /> : <Mic size={12} className="text-green-400" />}
                    <span className="truncate max-w-[100px]">{peer.profile?.display_name || 'Connecting...'}</span>
                </div>
            </div>

            {/* Controls Overlay (Hover) */}
            <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                 <button onClick={onToggleFocus} className="p-1.5 bg-black/50 rounded-full text-white">
                     {isFocused ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                 </button>
            </div>
        </div>
    );
});

// --- Main Controller ---
export const GazeboVC: React.FC<GazeboVCProps> = ({ 
  channelId, 
  channelName, 
  user, 
  onDisconnect,
  isMinimized,
  onToggleMinimize
}) => {
  // State
  const [localPeerId, setLocalPeerId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Media State
  const [mediaState, setMediaState] = useState({ mic: true, camera: false, screen: false });
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const peersRef = useRef<Record<string, VoicePeer>>({}); // Mutable ref for instant access in callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null); // Supabase Realtime Channel
  const audioContextRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync ref with state
  useEffect(() => { peersRef.current = peers; }, [peers]);

  // Toast Helper
  const addToast = (message: string, type: 'error' | 'info' | 'success') => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // --- 1. Initialization ---
  useEffect(() => {
    const initVoiceChat = async () => {
      try {
        addToast('Accessing media devices...', 'info');
        
        // A. Get Media Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setupAudioAnalysis('local', stream);

        // B. Initialize PeerJS (Auto ID Generation)
        const peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            },
            debug: 1 // Errors only
        });

        peerRef.current = peer;

        peer.on('open', async (id) => {
            console.log("My Peer ID:", id);
            setLocalPeerId(id);
            addToast('Connected to signaling server', 'success');
            
            // C. Store session in DB (Centralized Storage)
            await supabase.from('active_voice_sessions').upsert({
                channel_id: channelId,
                user_id: user.id,
                peer_id: id
            });

            // D. Join Supabase Presence (Fast Signaling)
            joinPresenceChannel(id, stream);
        });

        peer.on('call', (call) => {
            console.log("Incoming call from:", call.peer);
            call.answer(stream);
            handleCall(call);
        });

        peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            addToast(`Connection Error: ${err.type}`, 'error');
            if (err.type === 'peer-unavailable') {
                // Remove the peer from our list locally
                const pid = err.message.split(' ').pop(); // Extract ID from error message if possible
                if (pid) removePeer(pid);
            }
        });

      } catch (err: any) {
        console.error("Init Error:", err);
        addToast(`Failed to start: ${err.message}`, 'error');
        onDisconnect();
      }
    };

    initVoiceChat();

    return () => cleanup();
  }, [channelId]);

  // --- 2. Cleanup ---
  const cleanup = async () => {
      // Clean DB
      if (user) {
          await supabase.from('active_voice_sessions').delete().match({ 
              channel_id: channelId, 
              user_id: user.id 
          });
      }

      channelRef.current?.unsubscribe();
      peerRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
  };

  // --- 3. Signaling (Supabase Presence) ---
  const joinPresenceChannel = (myPeerId: string, stream: MediaStream) => {
      const channel = supabase.channel(`vc:${channelId}`, {
          config: { presence: { key: myPeerId } }
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const activeUsers = Object.values(state).flat() as any[];
            
            // Connect to users we aren't connected to yet
            activeUsers.forEach(remoteUser => {
                if (remoteUser.peerId !== myPeerId && !peersRef.current[remoteUser.peerId]) {
                    // MESH NETWORK STRATEGY:
                    // Only initiate call if My ID > Their ID. 
                    // This prevents A calling B AND B calling A (duplicate connections).
                    if (myPeerId > remoteUser.peerId) {
                        console.log("Initiating call to:", remoteUser.peerId);
                        const call = peerRef.current!.call(remoteUser.peerId, stream, {
                            metadata: { 
                                userId: user.id, 
                                profile: user.user_metadata 
                            }
                        });
                        handleCall(call, remoteUser);
                    }
                }
            });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach((p: any) => removePeer(p.peerId));
        })
        .on('broadcast', { event: 'media_state' }, ({ payload }) => {
            // Update mute/video state without reconnecting
            setPeers(prev => ({
                ...prev,
                [payload.peerId]: { 
                    ...prev[payload.peerId], 
                    isMuted: payload.isMuted, 
                    isVideoOff: payload.isVideoOff,
                    isScreenSharing: payload.isScreenSharing
                }
            }));
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    peerId: myPeerId,
                    userId: user.id,
                    profile: user.user_metadata,
                    mediaState // Initial state
                });
            }
        });
  };

  const broadcastMediaState = async (newState: typeof mediaState) => {
      if (!channelRef.current || !localPeerId) return;
      await channelRef.current.send({
          type: 'broadcast',
          event: 'media_state',
          payload: {
              peerId: localPeerId,
              isMuted: !newState.mic,
              isVideoOff: !newState.camera,
              isScreenSharing: newState.screen
          }
      });
  };

  // --- 4. Call Handling ---
  const handleCall = (call: Peer.MediaConnection, metadataHint?: any) => {
      const remotePeerId = call.peer;
      const metadata = call.metadata || metadataHint || {};

      // Optimistic Add
      addPeerToState(remotePeerId, metadata);

      call.on('stream', (remoteStream) => {
          console.log("Received stream from:", remotePeerId);
          updatePeerStream(remotePeerId, remoteStream);
          setupAudioAnalysis(remotePeerId, remoteStream);
      });

      call.on('close', () => removePeer(remotePeerId));
      call.on('error', () => removePeer(remotePeerId));
  };

  const addPeerToState = async (id: string, metadata: any) => {
      // If profile missing, fetch from DB using userId if available
      let profile = metadata.profile;
      const userId = metadata.userId;

      if (!profile && userId) {
          const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (data) profile = data;
      }

      setPeers(prev => ({
          ...prev,
          [id]: {
              peerId: id,
              userId: userId || 'unknown',
              profile: profile || { display_name: 'Unknown User', avatar_url: '' },
              stream: undefined,
              volume: 0,
              isMuted: false,
              isVideoOff: false
          }
      }));
  };

  const updatePeerStream = (id: string, stream: MediaStream) => {
      setPeers(prev => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: { ...prev[id], stream } };
      });
  };

  const removePeer = (id: string) => {
      setPeers(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
      });
  };

  // --- 5. Media Controls ---
  const toggleMic = () => {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      const enabled = !track.enabled;
      track.enabled = enabled;
      
      const newState = { ...mediaState, mic: enabled };
      setMediaState(newState);
      broadcastMediaState(newState);
  };

  const toggleCamera = async () => {
      if (!localStream) return;
      
      if (mediaState.camera) {
          // Stop Video
          localStream.getVideoTracks().forEach(t => {
              t.stop();
              localStream.removeTrack(t);
          });
          const newState = { ...mediaState, camera: false, screen: false };
          setMediaState(newState);
          broadcastMediaState(newState);
      } else {
          // Start Video
          try {
              const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
              const videoTrack = videoStream.getVideoTracks()[0];
              localStream.addTrack(videoTrack);
              
              // Patch existing connections
              replaceVideoTrack(videoTrack);
              
              const newState = { ...mediaState, camera: true, screen: false };
              setMediaState(newState);
              broadcastMediaState(newState);
          } catch (e) {
              addToast("Failed to access camera", "error");
          }
      }
  };

  const toggleScreen = async () => {
      if (!localStream) return;

      if (mediaState.screen) {
          // Stop Screen -> Revert to Camera if it was on, or just stop video
          localStream.getVideoTracks().forEach(t => t.stop()); // Stop screen track
          const newState = { ...mediaState, screen: false, camera: false }; // Simplified logic: turning off screen turns off video
          setMediaState(newState);
          broadcastMediaState(newState);
      } else {
          try {
              const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              const screenTrack = displayStream.getVideoTracks()[0];
              
              // Auto-handle native stop button
              screenTrack.onended = () => {
                  const newState = { ...mediaState, screen: false, camera: false };
                  setMediaState(newState);
                  broadcastMediaState(newState);
              };

              // Replace current video track
              const oldTrack = localStream.getVideoTracks()[0];
              if (oldTrack) {
                  oldTrack.stop();
                  localStream.removeTrack(oldTrack);
              }
              localStream.addTrack(screenTrack);
              
              replaceVideoTrack(screenTrack);

              const newState = { ...mediaState, screen: true, camera: false };
              setMediaState(newState);
              broadcastMediaState(newState);
          } catch (e) {
              addToast("Screen sharing cancelled", "info");
          }
      }
  };

  const replaceVideoTrack = (newTrack: MediaStreamTrack) => {
      Object.values(peerRef.current?.connections || {}).forEach((conns: any) => {
          conns.forEach((conn: any) => {
              const sender = conn.peerConnection.getSenders().find((s: any) => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(newTrack);
              else conn.peerConnection.addTrack(newTrack, localStream);
          });
      });
  };

  const setupAudioAnalysis = (id: string, stream: MediaStream) => {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      try {
          const source = audioContextRef.current.createMediaStreamSource(stream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
              if (peersRef.current[id] || id === 'local') {
                  analyser.getByteFrequencyData(dataArray);
                  const vol = dataArray.reduce((a,b) => a+b) / dataArray.length;
                  
                  if (id === 'local') {
                      // Update local volume? Optional.
                  } else {
                      setPeers(prev => prev[id] ? ({ ...prev, [id]: { ...prev[id], volume: vol } }) : prev);
                  }
                  requestAnimationFrame(checkVolume);
              }
          };
          checkVolume();
      } catch (e) {
          // Often fails if track is muted initially, harmless
      }
  };

  // --- Render Helpers ---
  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen();
          setIsFullScreen(true);
      } else {
          document.exitFullscreen();
          setIsFullScreen(false);
      }
  };

  // Prepare participants list
  const participants = [
      {
          peerId: 'local',
          userId: user.id,
          stream: localStream || undefined,
          profile: { 
              display_name: 'You', 
              avatar_url: user.user_metadata.avatar_url, 
              username: user.user_metadata.username 
          },
          isMuted: !mediaState.mic,
          isVideoOff: !mediaState.camera && !mediaState.screen,
          volume: 0 // Local visualizer usually distracting
      },
      ...Object.values(peers)
  ];

  // Minimized View
  if (isMinimized) {
      return (
          <div className="fixed bottom-20 right-4 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[60] animate-in slide-in-from-bottom-5">
              <div className="bg-green-600 p-2 flex justify-between items-center text-white">
                  <span className="font-bold text-xs flex items-center gap-2 truncate">
                      <Volume2 size={14}/> {channelName}
                  </span>
                  <div className="flex gap-1">
                      <button onClick={onToggleMinimize}><Maximize2 size={14}/></button>
                      <button onClick={onDisconnect} className="hover:text-red-200"><X size={14}/></button>
                  </div>
              </div>
              <div className="p-2 grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                  {participants.map(p => (
                      <div key={p.peerId} className={`aspect-square bg-gray-800 rounded relative overflow-hidden ${p.volume > 20 ? 'border border-green-500' : ''}`}>
                          {p.stream && !p.isVideoOff ? (
                             <video 
                                ref={el => {if(el && p.stream) el.srcObject = p.stream}} 
                                autoPlay muted playsInline 
                                className="w-full h-full object-cover" 
                             />
                          ) : (
                             <img src={p.profile?.avatar_url} className="w-full h-full object-cover opacity-50"/>
                          )}
                          <div className="absolute bottom-0 inset-x-0 text-[8px] text-white bg-black/50 truncate px-1">{p.profile?.display_name}</div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // Full View
  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-gray-800/50 backdrop-blur border-b border-gray-700 shrink-0">
             <div>
                 <h2 className="font-bold text-lg flex items-center gap-2">
                     <Volume2 className="text-green-500"/> {channelName}
                 </h2>
                 <p className="text-xs text-gray-400">{participants.length} Active</p>
             </div>
             <div className="flex gap-2">
                 <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-700 rounded-full"><Expand size={20}/></button>
                 <button onClick={onToggleMinimize} className="p-2 hover:bg-gray-700 rounded-full"><Minimize2 size={20}/></button>
             </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
             <div className={`
                 grid gap-4 w-full max-w-7xl transition-all duration-500
                 ${focusedPeerId ? 'grid-cols-1 h-full' : ''}
                 ${!focusedPeerId && participants.length === 1 ? 'grid-cols-1 max-w-3xl' : ''}
                 ${!focusedPeerId && participants.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
                 ${!focusedPeerId && participants.length > 2 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : ''}
                 auto-rows-fr
             `}>
                 {participants.map(p => {
                     if (focusedPeerId && p.peerId !== focusedPeerId) return null;
                     
                     return (
                         <VideoTile 
                            key={p.peerId}
                            peer={p}
                            isFocused={focusedPeerId === p.peerId}
                            onToggleFocus={() => setFocusedPeerId(focusedPeerId ? null : p.peerId)}
                         />
                     );
                 })}
             </div>
        </div>

        {/* Controls */}
        <div className="h-24 bg-gray-800 flex items-center justify-center gap-6 shrink-0 pb-safe">
             <button onClick={toggleMic} className={`p-4 rounded-full ${mediaState.mic ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 text-white'}`}>
                 {mediaState.mic ? <Mic size={24}/> : <MicOff size={24}/>}
             </button>
             
             <button onClick={toggleCamera} className={`p-4 rounded-full ${mediaState.camera ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>
                 {mediaState.camera ? <Video size={24}/> : <VideoOff size={24}/>}
             </button>
             
             <button onClick={toggleScreen} className={`p-4 rounded-full ${mediaState.screen ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                 <Monitor size={24}/>
             </button>

             <div className="w-px h-10 bg-gray-700 mx-2"/>
             
             <button onClick={onDisconnect} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2">
                 <PhoneOff size={20}/> End
             </button>
        </div>

        {/* Floating Toasts */}
        <div className="fixed bottom-28 right-6 flex flex-col gap-2 z-[70] pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right fade-in ${t.type === 'error' ? 'bg-red-500' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-700'}`}>
                    {t.type === 'error' && <AlertCircle size={16}/>}
                    {t.message}
                </div>
            ))}
        </div>
    </div>
  );
};
