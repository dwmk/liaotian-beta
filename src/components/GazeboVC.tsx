// src/components/GazeboVC.tsx
import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  Maximize2, Minimize2, Users, Volume2, X, Expand, Shrink
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VoicePeer {
  peerId: string;
  userId: string;
  stream?: MediaStream;
  profile?: any;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
}

interface GazeboVCProps {
  channelId: string;
  channelName: string;
  user: any;
  onDisconnect: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export const GazeboVC: React.FC<GazeboVCProps> = ({ 
  channelId, 
  channelName, 
  user, 
  onDisconnect,
  isMinimized,
  onToggleMinimize
}) => {
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [volumeMap, setVolumeMap] = useState<Record<string, number>>({});
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

  // Initialize Connection
  useEffect(() => {
    if (!user || !channelId) return;

    const init = async () => {
      try {
        // 1. Get Local Audio Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setupAudioAnalysis('local', stream);

        // 2. Initialize PeerJS
        const myPeerId = `${user.id}::${channelId}`; // Separator to easily split
        const peer = new Peer(myPeerId);
        peerRef.current = peer;

        peer.on('open', (id) => {
          joinPresenceChannel(id, stream);
        });

        peer.on('call', (call) => {
          call.answer(stream);
          handleCallStream(call);
        });

        peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            // Optional: Retry logic here
        });

      } catch (err) {
        console.error("Media access error:", err);
        alert("Could not access microphone. Please check permissions.");
        onDisconnect();
      }
    };

    init();

    return () => cleanup();
  }, [channelId]);

  const cleanup = () => {
    presenceChannelRef.current?.unsubscribe();
    peerRef.current?.destroy();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    
    // Cleanup Audio Context
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
    
    setPeers({});
    setLocalStream(null);
  };

  // --- Audio Visualizer Logic ---
  const setupAudioAnalysis = (peerId: string, stream: MediaStream) => {
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Prevent duplicate nodes
      if (sourceNodesRef.current.has(peerId)) return;

      try {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 32;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceNodesRef.current.set(peerId, source);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateVolume = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            
            setVolumeMap(prev => ({...prev, [peerId]: average}));
            requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (e) {
          console.warn("Audio analysis setup failed (likely muted track):", e);
      }
  };

  // --- Signaling & Calls ---
  const joinPresenceChannel = (myPeerId: string, stream: MediaStream) => {
    const channel = supabase.channel(`vc:${channelId}`);
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as any[];

        users.forEach((u) => {
           if (u.peerId !== myPeerId && !peers[u.peerId]) {
               // Determistic call direction (alphabetical)
               if (myPeerId > u.peerId) {
                   const call = peerRef.current!.call(u.peerId, stream);
                   handleCallStream(call, u.user_id, u.user_metadata);
               }
           }
        });
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
          // Handle instant state updates (mute/video toggles)
          newPresences.forEach((p: any) => {
             if (peers[p.peerId]) {
                 setPeers(prev => ({
                     ...prev,
                     [p.peerId]: { ...prev[p.peerId], isMuted: p.isMuted, isVideoOff: p.isVideoOff }
                 }));
             }
          });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await updatePresence(myPeerId, !isMicOn, !isCameraOn);
        }
      });
  };

  const updatePresence = async (peerId: string, isMuted: boolean, isVideoOff: boolean) => {
      if (!presenceChannelRef.current) return;
      await presenceChannelRef.current.track({ 
        user_id: user.id, 
        peerId, 
        user_metadata: user.user_metadata, // Send minimal metadata for display
        isMuted, 
        isVideoOff 
      });
  };

  const handleCallStream = (call: Peer.MediaConnection, userId?: string, metadata?: any) => {
      const remotePeerId = call.peer;
      const extractedUserId = userId || remotePeerId.split('::')[0];

      // Setup initial peer state
      setPeers(prev => ({
          ...prev,
          [remotePeerId]: { 
              peerId: remotePeerId, 
              userId: extractedUserId, 
              profile: metadata || { display_name: 'User' }, // Fallback or wait for fetch
              stream: undefined
          }
      }));

      // If we don't have metadata, fetch it
      if (!metadata) {
          supabase.from('profiles').select('display_name, avatar_url').eq('id', extractedUserId).single()
          .then(({ data }) => {
              if (data) {
                  setPeers(prev => ({ ...prev, [remotePeerId]: { ...prev[remotePeerId], profile: data } }));
              }
          });
      }

      call.on('stream', (remoteStream) => {
          setPeers(prev => ({ ...prev, [remotePeerId]: { ...prev[remotePeerId], stream: remoteStream } }));
          setupAudioAnalysis(remotePeerId, remoteStream);
      });

      call.on('close', () => {
          setPeers(prev => {
              const newP = { ...prev };
              delete newP[remotePeerId];
              return newP;
          });
          sourceNodesRef.current.delete(remotePeerId);
      });
  };

  // --- Media Toggles ---
  const toggleMic = () => {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMicOn(track.enabled);
      updatePresence(peerRef.current!.id, !track.enabled, !isCameraOn);
  };

  const toggleCamera = async () => {
      if (!localStream) return;

      if (isCameraOn) {
          // Turn Off
          localStream.getVideoTracks().forEach(t => {
              t.stop();
              localStream.removeTrack(t);
          });
          setIsCameraOn(false);
          updatePresence(peerRef.current!.id, !isMicOn, true);
      } else {
          // Turn On
          try {
              const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
              const videoTrack = videoStream.getVideoTracks()[0];
              
              localStream.addTrack(videoTrack);
              setIsCameraOn(true);

              // Update all connections
              Object.values(peerRef.current?.connections || {}).forEach((conns: any) => {
                   conns.forEach((conn: any) => {
                       const sender = conn.peerConnection.getSenders().find((s: any) => s.track?.kind === 'video');
                       if (sender) sender.replaceTrack(videoTrack);
                       else conn.peerConnection.addTrack(videoTrack, localStream);
                   });
              });
              updatePresence(peerRef.current!.id, !isMicOn, false);
          } catch (e) { console.error("Video fail", e); }
      }
  };

  const toggleScreenShare = async () => {
      if (isScreenSharing) {
          // Stop Sharing
          localStream?.getVideoTracks().forEach(t => t.stop());
          setIsScreenSharing(false);
          if (isCameraOn) {
              setIsCameraOn(false); // Reset camera toggle state for simplicity
              setTimeout(toggleCamera, 100); // Restart camera
          }
      } else {
          // Start Sharing
          try {
              const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              const screenTrack = displayStream.getVideoTracks()[0];
              screenTrack.onended = () => toggleScreenShare(); // Handle UI stop

              // Replace track
              const oldVideo = localStream?.getVideoTracks()[0];
              if (oldVideo) oldVideo.stop();
              
              // Add or replace in stream
              if (localStream) {
                  const newStream = new MediaStream([localStream.getAudioTracks()[0], screenTrack]);
                  setLocalStream(newStream);
                  localStreamRef.current = newStream; // Update ref for new connections
              }

              // Update Peers
              Object.values(peerRef.current?.connections || {}).forEach((conns: any) => {
                  conns.forEach((conn: any) => {
                      const sender = conn.peerConnection.getSenders().find((s: any) => s.track?.kind === 'video');
                      if (sender) sender.replaceTrack(screenTrack);
                      else conn.peerConnection.addTrack(screenTrack, localStream!);
                  });
              });
              
              setIsScreenSharing(true);
          } catch (e) { console.error("Screen share fail", e); }
      }
  };

  const toggleBrowserFullScreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen();
          setIsFullScreenMode(true);
      } else {
          document.exitFullscreen();
          setIsFullScreenMode(false);
      }
  };

  // --- Renders ---

  // 1. Minimized "PiP" Mode
  if (isMinimized) {
      return (
          <div className="fixed bottom-20 right-4 w-72 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl shadow-2xl overflow-hidden z-[60] animate-in slide-in-from-bottom-10">
              <div className="bg-green-500 p-2 flex justify-between items-center text-white">
                  <span className="font-bold text-xs flex items-center gap-2 truncate">
                      <Volume2 size={14}/> {channelName}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={onToggleMinimize} className="hover:bg-green-600 p-1 rounded"><Maximize2 size={14}/></button>
                    <button onClick={onDisconnect} className="hover:bg-red-600 p-1 rounded"><PhoneOff size={14}/></button>
                  </div>
              </div>
              
              <div className="grid grid-cols-3 gap-1 p-2 bg-black/90 max-h-48 overflow-y-auto">
                  {/* Self */}
                  <div className="relative aspect-square rounded bg-gray-700 overflow-hidden border border-gray-600">
                      <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">You</div>
                      {!isMicOn && <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5"><MicOff size={8} className="text-white"/></div>}
                  </div>
                  {/* Peers */}
                  {Object.values(peers).map(p => (
                      <div key={p.peerId} className={`relative aspect-square rounded bg-gray-700 overflow-hidden border ${volumeMap[p.peerId] > 20 ? 'border-green-500' : 'border-gray-600'}`}>
                          {p.stream && p.stream.getVideoTracks().length > 0 && p.stream.getVideoTracks()[0].enabled ? (
                              <video ref={el => {if(el) el.srcObject = p.stream!}} autoPlay playsInline muted className="w-full h-full object-cover" />
                          ) : (
                              <img src={p.profile?.avatar_url} className="w-full h-full object-cover opacity-50" />
                          )}
                          {p.isMuted && <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5"><MicOff size={8} className="text-white"/></div>}
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // 2. Full Screen / Standard Mode
  const participants = [
      { 
          peerId: 'local', 
          userId: user.id, 
          stream: localStream || undefined, 
          profile: { ...user.user_metadata, display_name: 'You' }, 
          isMuted: !isMicOn,
          isVideoOff: !isCameraOn,
          volume: 0 
      },
      ...Object.values(peers).map(p => ({...p, volume: volumeMap[p.peerId] || 0}))
  ];

  // Dynamic Grid Calc
  const getGridClass = (count: number) => {
      if (focusedPeerId) return 'grid-cols-1';
      if (count === 1) return 'grid-cols-1 max-w-3xl mx-auto w-full';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2';
      if (count <= 4) return 'grid-cols-2';
      if (count <= 9) return 'grid-cols-2 md:grid-cols-3';
      return 'grid-cols-3 md:grid-cols-4';
  };

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 bg-black flex flex-col ${!isFullScreenMode && 'top-0'}`}>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
             <div className="pointer-events-auto">
                 <h2 className="text-white font-bold text-xl flex items-center gap-2">
                     <Volume2 className="text-green-400" /> {channelName}
                 </h2>
                 <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                     <span className="flex items-center gap-1"><Users size={12}/> {participants.length} Connected</span>
                 </div>
             </div>
             <div className="pointer-events-auto flex gap-2">
                 <button onClick={toggleBrowserFullScreen} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition">
                     {isFullScreenMode ? <Shrink size={20}/> : <Expand size={20}/>}
                 </button>
                 <button onClick={onToggleMinimize} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition">
                     <Minimize2 size={20} />
                 </button>
             </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center custom-scrollbar">
            <div className={`grid gap-4 w-full transition-all duration-500 ${getGridClass(participants.length)} ${focusedPeerId ? 'h-full' : 'auto-rows-fr'}`}>
                {participants.map(p => {
                    const isFocused = focusedPeerId === p.peerId;
                    if (focusedPeerId && !isFocused) return null; // Hide others if focused (or move to sidebar strip in V2)
                    
                    const hasVideo = p.stream?.getVideoTracks().length! > 0 && p.stream?.getVideoTracks()[0].enabled;

                    return (
                        <div 
                            key={p.peerId} 
                            className={`relative bg-gray-800 rounded-xl overflow-hidden border-2 transition-all duration-200 group ${p.volume > 20 ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-transparent'} ${isFocused ? 'w-full h-full' : 'aspect-video'}`}
                            onDoubleClick={() => setFocusedPeerId(isFocused ? null : p.peerId)}
                        >
                            {/* Video Feed */}
                            {hasVideo ? (
                                <video 
                                    ref={el => {if (el && p.stream) el.srcObject = p.stream}}
                                    autoPlay 
                                    playsInline 
                                    muted={p.peerId === 'local'}
                                    className={`w-full h-full bg-black ${isScreenSharing && p.peerId === 'local' ? 'object-contain' : 'object-cover'}`} 
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                    <div className={`relative transition-transform duration-150 ${p.volume > 20 ? 'scale-110' : 'scale-100'}`}>
                                        <img 
                                            src={p.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.userId}`} 
                                            className="w-24 h-24 rounded-full shadow-2xl object-cover bg-gray-700"
                                        />
                                        {p.volume > 20 && <div className="absolute -inset-2 rounded-full border-4 border-green-500 opacity-50 animate-ping" />}
                                    </div>
                                </div>
                            )}

                            {/* Status Overlay */}
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-white text-sm font-medium shadow-lg">
                                    {p.isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} className="text-green-400" />}
                                    {p.profile?.display_name}
                                </div>
                            </div>

                            {/* Hover Controls */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setFocusedPeerId(isFocused ? null : p.peerId)}
                                    className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                                >
                                    {isFocused ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="h-20 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex items-center justify-center gap-4 px-8 shrink-0 z-30 pb-safe">
            <button 
                onClick={toggleMic}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${isMicOn ? 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]' : 'bg-red-500 text-white shadow-lg shadow-red-500/40'}`}
                title={isMicOn ? "Mute" : "Unmute"}
            >
                {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            
            <button 
                onClick={toggleCamera}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${isCameraOn ? 'bg-white text-black shadow-lg' : 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]'}`}
                title="Toggle Camera"
            >
                {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button 
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${isScreenSharing ? 'bg-green-500 text-white shadow-lg shadow-green-500/40' : 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]'}`}
                title="Share Screen"
            >
                <Monitor size={24} />
            </button>

            <div className="w-px h-8 bg-[rgb(var(--color-border))] mx-2" />

            <button 
                onClick={onDisconnect}
                className="px-8 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg hover:shadow-red-600/20 transition-all duration-200 flex items-center gap-2"
            >
                <PhoneOff size={20} />
                <span className="hidden md:inline">Disconnect</span>
            </button>
        </div>
    </div>
  );
};
