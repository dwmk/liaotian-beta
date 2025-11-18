// src/components/Gazebos.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile, Gazebo, GazeboChannel, GazeboMessage, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Hash, Volume2, Mic, MicOff, PhoneOff, Send, Paperclip, Users, Settings, X, Image as ImageIcon } from 'lucide-react';
import Peer from 'peerjs';

// --- Reusing AudioPlayer logic implies duplicating it or exporting it. 
// For this context, I will implement a simple inline player to keep file separate.
const SimpleAudioPlayer = ({ src }: { src: string }) => (
  <audio controls src={src} className="w-full h-8 mt-1" />
);

type VoicePeer = {
  peerId: string;
  stream: MediaStream;
  user?: Profile;
};

export const Gazebos = () => {
  const { user } = useAuth();
  
  // --- UI State ---
  const [gazebos, setGazebos] = useState<Gazebo[]>([]);
  const [activeGazebo, setActiveGazebo] = useState<Gazebo | null>(null);
  const [channels, setChannels] = useState<GazeboChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<GazeboChannel | null>(null);
  const [messages, setMessages] = useState<GazeboMessage[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- Message Input State ---
  const [inputText, setInputText] = useState('');
  const [inputMedia, setInputMedia] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Voice Chat State ---
  const [myPeer, setMyPeer] = useState<Peer | null>(null);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [voicePeers, setVoicePeers] = useState<VoicePeer[]>([]); // Remote peers
  const [isMuted, setIsMuted] = useState(false);
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const peersRef = useRef<{ [key: string]: Peer.MediaConnection }>({});

  // --- 1. FETCH GAZEBOS ---
  useEffect(() => {
    if (!user) return;
    const fetchGazebos = async () => {
      // Get gazebos where user is a member
      const { data: memberData } = await supabase
        .from('gazebo_members')
        .select('gazebo_id')
        .eq('user_id', user.id);
      
      if (memberData && memberData.length > 0) {
        const ids = memberData.map(m => m.gazebo_id);
        const { data: gData } = await supabase
          .from('gazebos')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: true });
        setGazebos(gData || []);
      }
    };
    fetchGazebos();
  }, [user]);

  // --- 2. SELECT GAZEBO & FETCH CHANNELS ---
  useEffect(() => {
    if (!activeGazebo) {
      setChannels([]);
      setActiveChannel(null);
      return;
    }

    const fetchDetails = async () => {
      // Fetch Channels
      const { data: cData } = await supabase
        .from('gazebo_channels')
        .select('*')
        .eq('gazebo_id', activeGazebo.id)
        .order('created_at', { ascending: true });
      
      setChannels(cData || []);
      
      // Default to first text channel
      const defaultText = cData?.find(c => c.type === 'text');
      if (defaultText && !activeChannel) {
        setActiveChannel(defaultText);
      }

      // Fetch Members
      const { data: mData } = await supabase
        .from('gazebo_members')
        .select('user_id, profiles(*)')
        .eq('gazebo_id', activeGazebo.id);
      
      if (mData) {
        const mapped = mData.map((m: any) => m.profiles).filter(Boolean);
        setMembers(mapped);
      }
    };

    fetchDetails();
  }, [activeGazebo]);

  // --- 3. TEXT CHAT LOGIC ---
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'text') return;

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('gazebo_messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('channel_id', activeChannel.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) setMessages(data.reverse());
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`gazebo_chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'gazebo_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
         // Fetch full sender profile for the new message
         const { data: senderData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.user_id)
            .single();
            
         const newMsg = { ...payload.new, sender: senderData } as GazeboMessage;
         setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !inputMedia) || !activeChannel || !user) return;

    setIsUploading(true);
    let mediaUrl = '';
    let mediaType = 'text';

    if (inputMedia) {
      const res = await uploadMedia(inputMedia, 'messages'); // Reusing 'messages' bucket bucket logic
      if (res) {
        mediaUrl = res.url;
        mediaType = res.type;
      }
    }

    await supabase.from('gazebo_messages').insert({
      channel_id: activeChannel.id,
      user_id: user.id,
      content: inputText,
      media_url: mediaUrl,
      media_type: mediaType
    });

    setInputText('');
    setInputMedia(null);
    setIsUploading(false);
  };


  // --- 4. VOICE CHAT LOGIC (Mesh Network) ---
  
  // Initialize Peer on component mount
  useEffect(() => {
    if(!user) return;
    const peer = new Peer(user.id); // Using user.id as Peer ID for simplicity
    setMyPeer(peer);

    peer.on('call', (call) => {
       // Answer incoming calls automatically if we are in a voice channel
       // In a real app, check metadata to match channel ID
       navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
             setVoicePeers(prev => {
                if (prev.find(p => p.peerId === call.peer)) return prev;
                return [...prev, { peerId: call.peer, stream: remoteStream }];
             });
          });
       });
    });

    return () => {
      peer.destroy();
    }
  }, [user]);

  const joinVoiceChannel = async (channelId: string) => {
    if (!myPeer || !user) return;
    
    // 1. Get Local Media
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setMyStream(stream);
        setActiveVoiceChannelId(channelId);
        setIsMuted(false);

        // 2. Announce presence via Supabase Realtime to find others in channel
        const channel = supabase.channel(`voice_signaling:${channelId}`, {
            config: { presence: { key: user.id } }
        });

        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            // For every user in state, if it's not me, call them
            Object.keys(state).forEach(userId => {
                if (userId !== user.id && !peersRef.current[userId]) {
                    // CALL THEM
                    const call = myPeer.call(userId, stream);
                    peersRef.current[userId] = call;
                    
                    call.on('stream', (remoteStream) => {
                        setVoicePeers(prev => {
                            if (prev.find(p => p.peerId === userId)) return prev;
                            return [...prev, { peerId: userId, stream: remoteStream }];
                        });
                    });
                    
                    call.on('close', () => {
                        setVoicePeers(prev => prev.filter(p => p.peerId !== userId));
                        delete peersRef.current[userId];
                    });
                }
            });
        }).subscribe(async (status) => {
             if(status === 'SUBSCRIBED') {
                 await channel.track({ online_at: new Date().toISOString() });
             }
        });

    } catch (err) {
        console.error("Error joining voice:", err);
    }
  };

  const leaveVoiceChannel = () => {
      myStream?.getTracks().forEach(t => t.stop());
      setMyStream(null);
      setVoicePeers([]);
      setActiveVoiceChannelId(null);
      
      // Close all connections
      Object.values(peersRef.current).forEach(call => call.close());
      peersRef.current = {};
      
      // Unsub from presence happens automatically on component unmount or we could manage channel refs
      supabase.removeAllChannels(); // Brute force cleanup for prototype
  };

  const toggleMute = () => {
      if(myStream) {
          myStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
          setIsMuted(!isMuted);
      }
  };

  // --- 5. CREATION LOGIC ---
  const createGazebo = async (name: string, type: 'group' | 'guild') => {
     if(!user) return;
     
     // 1. Create Gazebo
     const { data: gData, error } = await supabase.from('gazebos').insert({
         name,
         type,
         owner_id: user.id,
         icon_url: `https://ui-avatars.com/api/?name=${name}&background=random`
     }).select().single();
     
     if(error || !gData) return;

     // 2. Add Owner as Member
     await supabase.from('gazebo_members').insert({
         gazebo_id: gData.id,
         user_id: user.id,
         role: 'owner'
     });

     // 3. Create Default Channels
     const channelsToCreate = [];
     channelsToCreate.push({ gazebo_id: gData.id, name: 'general', type: 'text' });
     if (type === 'guild') {
         channelsToCreate.push({ gazebo_id: gData.id, name: 'General Voice', type: 'voice' });
     }
     
     await supabase.from('gazebo_channels').insert(channelsToCreate);

     // Refresh list
     setGazebos(prev => [...prev, gData]);
     setShowCreateModal(false);
  };


  return (
    <div className="flex h-full w-full bg-[rgb(var(--color-background))] overflow-hidden relative">
      
      {/* --- 1. SERVER RAIL (Far Left) --- */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-2 bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))] z-20">
         {gazebos.map(g => (
            <button
               key={g.id}
               onClick={() => setActiveGazebo(g)}
               className={`relative group w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 overflow-hidden ${activeGazebo?.id === g.id ? 'rounded-[16px] ring-2 ring-[rgb(var(--color-primary))]' : ''}`}
            >
                <img src={g.icon_url} alt={g.name} className="w-full h-full object-cover" />
                {/* Tooltip could go here */}
            </button>
         ))}
         
         <div className="w-8 h-[2px] bg-[rgb(var(--color-border))] rounded-full my-1" />
         
         <button 
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 rounded-[24px] bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))] hover:text-white transition-all flex items-center justify-center"
         >
            <Plus size={24} />
         </button>
      </div>

      {/* --- 2. CHANNEL RAIL (Contextual) --- */}
      {activeGazebo && (
        <div className="w-60 bg-[rgb(var(--color-surface))] flex flex-col border-r border-[rgb(var(--color-border))]">
            {/* Header */}
            <div className="h-12 border-b border-[rgb(var(--color-border))] flex items-center px-4 font-bold text-[rgb(var(--color-text))] truncate shadow-sm">
                {activeGazebo.name}
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* TEXT CHANNELS */}
                <div className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase px-2 pt-2 mb-1">Text Channels</div>
                {channels.filter(c => c.type === 'text').map(c => (
                    <button
                        key={c.id}
                        onClick={() => { setActiveChannel(c); setActiveVoiceChannelId(null); }}
                        className={`w-full flex items-center px-2 py-1.5 rounded-md text-sm transition ${activeChannel?.id === c.id && activeChannel.type === 'text' ? 'bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] hover:text-[rgb(var(--color-text))]'}`}
                    >
                        <Hash size={16} className="mr-2 opacity-70" />
                        {c.name}
                    </button>
                ))}

                {/* VOICE CHANNELS */}
                {activeGazebo.type === 'guild' && (
                    <>
                        <div className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase px-2 pt-4 mb-1">Voice Channels</div>
                        {channels.filter(c => c.type === 'voice').map(c => (
                            <div key={c.id}>
                                <button
                                    onClick={() => {
                                        if(activeVoiceChannelId === c.id) return; // Already in
                                        if(activeVoiceChannelId) leaveVoiceChannel(); // Leave current
                                        joinVoiceChannel(c.id);
                                        setActiveChannel(c); // Set for view context
                                    }}
                                    className={`w-full flex items-center px-2 py-1.5 rounded-md text-sm transition ${activeVoiceChannelId === c.id ? 'bg-[rgba(var(--color-accent),0.1)] text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] hover:text-[rgb(var(--color-text))]'}`}
                                >
                                    <Volume2 size={16} className="mr-2 opacity-70" />
                                    {c.name}
                                </button>
                                {/* Render avatars of people inside if active */}
                                {activeVoiceChannelId === c.id && (
                                    <div className="pl-8 py-1 space-y-1">
                                        <div className="flex items-center gap-2 text-xs text-[rgb(var(--color-text))]">
                                            <img src={user?.user_metadata?.avatar_url || user?.email} className="w-5 h-5 rounded-full bg-gray-300" alt="Me" />
                                            <span>You</span>
                                        </div>
                                        {voicePeers.map(p => (
                                             <div key={p.peerId} className="flex items-center gap-2 text-xs text-[rgb(var(--color-text))]">
                                                <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-[10px]">?</div>
                                                <span className="opacity-70">User</span>
                                                <audio autoPlay ref={el => { if(el) el.srcObject = p.stream }} />
                                             </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Voice Controls Footer (If connected) */}
            {activeVoiceChannelId && (
                <div className="p-2 bg-[rgb(var(--color-surface-hover))] border-t border-[rgb(var(--color-border))]">
                    <div className="text-xs text-green-600 font-bold mb-2 flex items-center gap-1">
                        <Volume2 size={12} /> Voice Connected
                    </div>
                    <div className="flex items-center justify-between">
                        <button onClick={toggleMute} className="p-2 rounded-md hover:bg-[rgb(var(--color-surface))]">
                            {isMuted ? <MicOff size={18} className="text-red-500"/> : <Mic size={18} />}
                        </button>
                        <button onClick={leaveVoiceChannel} className="p-2 rounded-md hover:bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]">
                            <PhoneOff size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* --- 3. MAIN AREA (Chat or Placeholder) --- */}
      <div className="flex-1 flex flex-col bg-[rgb(var(--color-background))] min-w-0">
         {!activeGazebo ? (
             <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-secondary))] flex-col">
                 <Users size={64} className="mb-4 opacity-20" />
                 <p>Select a Gazebo server to start chatting.</p>
             </div>
         ) : !activeChannel ? (
             <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-secondary))]">
                 <p>Select a channel.</p>
             </div>
         ) : activeChannel.type === 'voice' ? (
            <div className="flex-1 flex items-center justify-center flex-col text-[rgb(var(--color-text))] bg-[rgb(var(--color-background))]">
                <h2 className="text-2xl font-bold mb-2">{activeChannel.name}</h2>
                <p className="text-[rgb(var(--color-text-secondary))] mb-8">Voice Channel</p>
                
                <div className="flex flex-wrap gap-4 justify-center p-8">
                    {/* Self */}
                    <div className={`w-32 h-32 rounded-full bg-[rgb(var(--color-surface))] border-4 ${activeVoiceChannelId === activeChannel.id ? 'border-green-500' : 'border-gray-500'} flex items-center justify-center relative shadow-lg`}>
                        <img src={user?.user_metadata?.avatar_url} className="w-full h-full rounded-full object-cover opacity-50" />
                        <span className="absolute font-bold">You</span>
                    </div>
                    {/* Peers */}
                    {activeVoiceChannelId === activeChannel.id && voicePeers.map(p => (
                        <div key={p.peerId} className="w-32 h-32 rounded-full bg-[rgb(var(--color-surface))] border-4 border-green-500 flex items-center justify-center relative shadow-lg">
                            <span className="absolute font-bold">User</span>
                        </div>
                    ))}
                </div>
            </div>
         ) : (
             // TEXT CHANNEL VIEW
             <>
                {/* Chat Header */}
                <div className="h-12 border-b border-[rgb(var(--color-border))] flex items-center px-4 bg-[rgb(var(--color-surface))] shadow-sm z-10">
                    <Hash size={20} className="text-[rgb(var(--color-text-secondary))] mr-2" />
                    <span className="font-bold text-[rgb(var(--color-text))]">{activeChannel.name}</span>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
                    {messages.map(msg => (
                        <div key={msg.id} className="flex gap-3 hover:bg-[rgba(var(--color-surface),0.5)] -mx-4 px-4 py-1 group">
                             <img 
                                src={msg.sender?.avatar_url || `https://ui-avatars.com/api/?name=${msg.sender?.username || 'U'}`} 
                                className="w-10 h-10 rounded-full object-cover mt-1 cursor-pointer hover:opacity-80"
                             />
                             <div className="min-w-0 flex-1">
                                 <div className="flex items-baseline gap-2">
                                     <span className="font-bold text-[rgb(var(--color-text))] cursor-pointer hover:underline">
                                         {msg.sender?.display_name || 'Unknown'}
                                     </span>
                                     <span className="text-[10px] text-[rgb(var(--color-text-secondary))]">
                                         {new Date(msg.created_at).toLocaleString()}
                                     </span>
                                 </div>
                                 
                                 {msg.media_url && (
                                    <div className="my-2">
                                        {msg.media_type === 'image' && <img src={msg.media_url} className="max-h-60 rounded-lg" />}
                                        {msg.media_type === 'video' && <video src={msg.media_url} controls className="max-h-60 rounded-lg" />}
                                        {msg.media_type === 'audio' && <SimpleAudioPlayer src={msg.media_url} />}
                                    </div>
                                 )}
                                 
                                 <p className="text-[rgb(var(--color-text-secondary))] whitespace-pre-wrap break-words">
                                     {msg.content}
                                 </p>
                             </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[rgb(var(--color-surface))] px-4 pb-6">
                    <div className="bg-[rgb(var(--color-surface-hover))] rounded-lg p-2 flex flex-col border border-[rgb(var(--color-border))] focus-within:border-[rgb(var(--color-accent))] transition">
                        {inputMedia && (
                            <div className="flex items-center gap-2 p-2 bg-[rgb(var(--color-background))] rounded mb-2 w-max">
                                <Paperclip size={14} />
                                <span className="text-xs truncate max-w-[200px]">{inputMedia.name}</span>
                                <button onClick={() => setInputMedia(null)}><X size={14}/></button>
                            </div>
                        )}
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <label className="cursor-pointer text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] p-1">
                                <input type="file" className="hidden" onChange={e => setInputMedia(e.target.files?.[0] || null)} />
                                <Plus size={20} className="bg-[rgb(var(--color-text-secondary))] text-[rgb(var(--color-background))] rounded-full p-0.5" />
                            </label>
                            <input 
                                type="text" 
                                className="flex-1 bg-transparent outline-none text-[rgb(var(--color-text))]"
                                placeholder={`Message #${activeChannel.name}`}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                disabled={isUploading}
                            />
                            <button 
                                type="submit" 
                                disabled={!inputText && !inputMedia}
                                className="text-[rgb(var(--color-primary))] disabled:opacity-50 p-1"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>
             </>
         )}
      </div>
      
      {/* Members Rail (Right side - Guilds only usually) */}
      {activeGazebo && activeGazebo.type === 'guild' && (
         <div className="w-60 bg-[rgb(var(--color-surface))] border-l border-[rgb(var(--color-border))] hidden lg:block p-3 overflow-y-auto">
             <h3 className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase mb-3">Members — {members.length}</h3>
             {members.map(m => (
                 <div key={m.id} className="flex items-center gap-2 mb-3 opacity-90 hover:opacity-100 cursor-pointer">
                     <div className="relative">
                        <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.username}`} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                        {/* Simple online dot check based on last_seen */}
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[rgb(var(--color-surface))] ${new Date().getTime() - new Date(m.last_seen || 0).getTime() < 5 * 60 * 1000 ? 'bg-green-500' : 'bg-gray-400'}`} />
                     </div>
                     <span className="text-sm font-medium text-[rgb(var(--color-text))] truncate">{m.display_name}</span>
                 </div>
             ))}
         </div>
      )}

      {/* --- CREATE MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
            <div className="bg-[rgb(var(--color-surface))] p-6 rounded-lg shadow-xl w-96" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-[rgb(var(--color-text))]">Create a Gazebo</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <button onClick={() => createGazebo('My Group', 'group')} className="p-4 border border-[rgb(var(--color-border))] rounded hover:bg-[rgb(var(--color-surface-hover))] text-center">
                        <Users className="mx-auto mb-2 text-[rgb(var(--color-primary))]" />
                        <div className="font-bold text-[rgb(var(--color-text))]">Group Chat</div>
                        <div className="text-xs text-[rgb(var(--color-text-secondary))]">Single channel for friends</div>
                    </button>
                    <button onClick={() => createGazebo('My Server', 'guild')} className="p-4 border border-[rgb(var(--color-border))] rounded hover:bg-[rgb(var(--color-surface-hover))] text-center">
                        <Settings className="mx-auto mb-2 text-[rgb(var(--color-accent))]" />
                        <div className="font-bold text-[rgb(var(--color-text))]">Guild</div>
                        <div className="text-xs text-[rgb(var(--color-text-secondary))]">Multiple channels & voice</div>
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
