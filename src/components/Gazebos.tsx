// src/components/Gazebos.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile, Gazebo, GazeboChannel, GazeboMessage, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Hash, Volume2, Plus, Settings, Users, X, Send, Paperclip, Mic, Link as LinkIcon,
  Trash2, Edit3, Check, Copy, Crown, Shield, ChevronDown, Menu, Search, 
  FileText, LogOut, Image as ImageIcon, Video as VideoIcon, MoreVertical, Play, Pause
} from 'lucide-react';

// --- Types ---
type GazebosProps = {
  initialInviteCode?: string | null;
  onInviteHandled?: () => void;
};

type MemberWithProfile = {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  role_name: string;
  role_color: string;
  profiles: Profile;
};

type InviteLink = {
  id: string;
  invite_code: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
};

// --- AudioPlayer Helper (Matches Messages.tsx) ---
const AudioPlayer = ({ src, isOutgoing }: { src: string, isOutgoing: boolean }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
  
    const primaryColor = isOutgoing ? 'rgb(var(--color-text-on-primary))' : 'rgb(var(--color-accent))';
    const trackColor = isOutgoing ? 'rgba(var(--color-text-on-primary), 0.3)' : 'rgb(var(--color-border))';
  
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const setAudioData = () => setDuration(audio.duration);
      const setAudioTime = () => setCurrentTime(audio.currentTime);
      const togglePlay = () => setIsPlaying(!audio.paused);
      const onEnded = () => { setIsPlaying(false); audio.currentTime = 0; };
  
      audio.addEventListener('loadedmetadata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('play', togglePlay);
      audio.addEventListener('pause', togglePlay);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('loadedmetadata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('play', togglePlay);
        audio.removeEventListener('pause', togglePlay);
        audio.removeEventListener('ended', onEnded);
      };
    }, []);
  
    const handlePlayPause = () => {
      if (audioRef.current) isPlaying ? audioRef.current.pause() : audioRef.current.play();
    };
  
    return (
      <div className="flex items-center space-x-2 w-full max-w-full mb-1">
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
        <button onClick={handlePlayPause} className="flex-shrink-0 p-2 rounded-full transition-colors" style={{ backgroundColor: isOutgoing ? 'rgba(var(--color-text-on-primary), 0.15)' : 'rgb(var(--color-surface-hover))', color: primaryColor }}>
          {isPlaying ? <Pause size={16} fill={primaryColor} /> : <Play size={16} fill={primaryColor} />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <input type="range" min="0" max={duration || 100} value={currentTime} onChange={(e) => { if(audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value); }} className="w-full h-1 appearance-none rounded-full cursor-pointer" style={{ background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((currentTime / duration) * 100) || 0}%, ${trackColor} ${((currentTime / duration) * 100) || 0}%, ${trackColor} 100%)` }} />
          <span className="text-[10px]" style={{ color: primaryColor }}>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>
    );
};

// --- Main Component ---
export const Gazebos = ({ initialInviteCode, onInviteHandled }: GazebosProps) => {
  const { user } = useAuth();
  
  // Data State
  const [gazebos, setGazebos] = useState<Gazebo[]>([]);
  const [activeGazebo, setActiveGazebo] = useState<Gazebo | null>(null);
  const [channels, setChannels] = useState<GazeboChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<GazeboChannel | null>(null);
  const [messages, setMessages] = useState<GazeboMessage[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);

  // UI State
  const [mobileView, setMobileView] = useState<'servers' | 'channels' | 'chat'>('servers');
  const [showMembersPanel, setShowMembersPanel] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateGazeboModal, setShowCreateGazeboModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);

  // Message Input State
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [mediaInputMode, setMediaInputMode] = useState<'file' | 'url' | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Derived State
  const isOwner = activeGazebo?.owner_id === user?.id;
  const memberRole = members.find(m => m.user_id === user?.id)?.role || 'member';
  const isAdmin = isOwner || memberRole === 'admin';

  // --- Initialization & Navigation ---

  useEffect(() => {
    if (!user) return;
    const fetchGazebos = async () => {
      const { data } = await supabase.from('gazebo_members').select('gazebo_id, gazebos(*)').eq('user_id', user.id);
      if (data) {
        const list = data.map(d => d.gazebos).filter(Boolean) as Gazebo[];
        setGazebos(list);
        
        if (initialInviteCode) {
           handleInviteJoin(initialInviteCode).then(g => {
               if (g) { setActiveGazebo(g); setMobileView('channels'); }
               if (onInviteHandled) onInviteHandled();
           });
        } else if (list.length > 0 && !activeGazebo) {
            // Don't auto-select on mobile to allow list view
            if (window.innerWidth > 768) setActiveGazebo(list[0]);
        }
      }
    };
    fetchGazebos();
  }, [user, initialInviteCode]);

  useEffect(() => {
    if (!activeGazebo) { setChannels([]); setMembers([]); setActiveChannel(null); return; }
    
    const loadDetails = async () => {
        // Channels
        const { data: cData } = await supabase.from('gazebo_channels').select('*').eq('gazebo_id', activeGazebo.id).order('created_at');
        setChannels(cData || []);
        // Auto-select first text channel if on desktop
        if (window.innerWidth > 768 && !activeChannel) {
            setActiveChannel(cData?.find(c => c.type === 'text') || null);
        }

        // Members
        const { data: mData } = await supabase.from('gazebo_members').select('user_id, role, profiles(*)').eq('gazebo_id', activeGazebo.id);
        const mList: MemberWithProfile[] = (mData || []).map(m => ({
            user_id: m.user_id, role: m.role as any,
            role_name: m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member',
            role_color: m.role === 'owner' ? '#eab308' : m.role === 'admin' ? '#3b82f6' : '#94a3b8',
            profiles: m.profiles as Profile
        }));
        setMembers(mList);
    };
    loadDetails();
  }, [activeGazebo]);

  useEffect(() => {
      if (!activeChannel || activeChannel.type !== 'text') { setMessages([]); return; }
      
      const loadMsgs = async () => {
          const { data } = await supabase.from('gazebo_messages').select('*, sender:profiles(*)').eq('channel_id', activeChannel.id).order('created_at', { ascending: true });
          setMessages(data as GazeboMessage[] || []);
          setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
      };
      loadMsgs();

      const sub = supabase.channel(`ch:${activeChannel.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gazebo_messages', filter: `channel_id=eq.${activeChannel.id}` }, payload => {
            const newMsg = payload.new as GazeboMessage;
            supabase.from('profiles').select('*').eq('id', newMsg.user_id).single().then(({ data }) => {
                setMessages(prev => [...prev, { ...newMsg, sender: data as Profile }]);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
        }).subscribe();

      return () => { supabase.removeChannel(sub); };
  }, [activeChannel]);

  // --- Actions ---

  const handleInviteJoin = async (code: string) => {
      if (!user) return null;
      const { data: inv } = await supabase.from('gazebo_invites').select('*, gazebos(*)').eq('invite_code', code).single();
      if (!inv) return null;
      
      const g = inv.gazebos as Gazebo;
      const { error } = await supabase.from('gazebo_members').insert({ gazebo_id: g.id, user_id: user.id, role: 'member' });
      if (!error) {
          await supabase.from('gazebo_invites').update({ uses_count: inv.uses_count + 1 }).eq('id', inv.id);
          setGazebos(prev => [...prev, g]);
          return g;
      } else {
          // Likely already a member
          const existing = gazebos.find(gaz => gaz.id === g.id);
          return existing || g;
      }
  };

  const createGazebo = async (name: string) => {
      if (!name.trim() || !user) return;
      const { data: g, error } = await supabase.from('gazebos').insert({
          name: name.trim(), type: 'group', owner_id: user.id,
          icon_url: `https://ui-avatars.com/api/?name=${name}&background=random`
      }).select().single();
      
      if (g) {
          await supabase.from('gazebo_members').insert({ gazebo_id: g.id, user_id: user.id, role: 'owner' });
          const { data: c } = await supabase.from('gazebo_channels').insert({ gazebo_id: g.id, name: 'general', type: 'text' }).select().single();
          setGazebos(prev => [...prev, g]);
          setActiveGazebo(g);
          if (c) setActiveChannel(c);
          setShowCreateGazeboModal(false);
      }
  };

  const updateGazebo = async (updates: Partial<Gazebo>) => {
      if (!activeGazebo || !isAdmin) return;
      const { data } = await supabase.from('gazebos').update(updates).eq('id', activeGazebo.id).select().single();
      if (data) {
          setActiveGazebo(data);
          setGazebos(prev => prev.map(g => g.id === data.id ? data : g));
      }
  };

  const deleteGazebo = async () => {
      if (!activeGazebo || !isOwner || !confirm('Delete this Gazebo? This cannot be undone.')) return;
      await supabase.from('gazebos').delete().eq('id', activeGazebo.id);
      setGazebos(prev => prev.filter(g => g.id !== activeGazebo.id));
      setActiveGazebo(null);
      setMobileView('servers');
  };

  const manageChannel = async (action: 'create' | 'update' | 'delete', payload?: any) => {
      if (!activeGazebo || !isAdmin) return;
      if (action === 'create') {
          const { data } = await supabase.from('gazebo_channels').insert({ gazebo_id: activeGazebo.id, name: payload.name, type: payload.type }).select().single();
          if (data) setChannels(prev => [...prev, data]);
          setShowCreateChannelModal(false);
      }
      if (action === 'update' && editingChannelId) {
          const { data } = await supabase.from('gazebo_channels').update({ name: payload }).eq('id', editingChannelId).select().single();
          if (data) setChannels(prev => prev.map(c => c.id === data.id ? data : c));
          setEditingChannelId(null);
      }
      if (action === 'delete' && payload) {
          if (!confirm('Delete channel?')) return;
          await supabase.from('gazebo_channels').delete().eq('id', payload);
          setChannels(prev => prev.filter(c => c.id !== payload));
          if (activeChannel?.id === payload) setActiveChannel(null);
      }
  };

  const manageInvite = async (action: 'create' | 'delete', codeOrId?: string) => {
      if (!activeGazebo || !isAdmin) return;
      if (action === 'create') {
          const code = codeOrId || Math.random().toString(36).substring(2, 10);
          const { data, error } = await supabase.from('gazebo_invites').insert({
              gazebo_id: activeGazebo.id, invite_code: code, created_by_user_id: user!.id
          }).select().single();
          if (data) setInviteLinks(prev => [data, ...prev]);
          else alert('Error creating invite. Code might exist.');
      }
      if (action === 'delete' && codeOrId) {
          await supabase.from('gazebo_invites').delete().eq('id', codeOrId);
          setInviteLinks(prev => prev.filter(i => i.id !== codeOrId));
      }
  };

  // --- Message Logic (Copied from Messages.tsx) ---
  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeChannel || !user || isUploading || (!content.trim() && !file && !remoteUrl)) return;
      
      setIsUploading(true);
      let media_url = remoteUrl;
      let media_type = null;

      if (file) {
          if (file.type.startsWith('audio/')) media_type = 'audio';
          const res = await uploadMedia(file, 'gazebo-messages', setUploadProgress);
          if (!res) { setIsUploading(false); return; }
          media_url = res.url;
          media_type = media_type || res.type;
      } else if (remoteUrl) {
           if (remoteUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) media_type = 'image';
           else if (remoteUrl.match(/\.(mp4|webm|mov|avi)$/i)) media_type = 'video';
           else if (remoteUrl.match(/\.(mp3|wav|ogg|m4a)$/i)) media_type = 'audio';
           else media_type = 'document';
      }

      await supabase.from('gazebo_messages').insert({
          channel_id: activeChannel.id, user_id: user.id, content: content.trim(),
          media_url: media_url, media_type: media_type || 'text'
      });

      setContent(''); setFile(null); setRemoteUrl(''); setIsUploading(false); setMediaInputMode(null);
  };

  const startRecording = () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];
          recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
          recorder.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              setFile(new File([blob], 'voice.webm', { type: 'audio/webm' }));
              setIsRecording(false);
              stream.getTracks().forEach(t => t.stop());
          };
          recorder.start();
          setIsRecording(true);
      });
  };
  const stopRecording = () => mediaRecorderRef.current?.stop();

  // --- Render Helpers ---
  const getPreview = () => {
      if (!file && !remoteUrl) return null;
      const src = file ? URL.createObjectURL(file) : remoteUrl;
      if (file?.type.startsWith('image') || remoteUrl.match(/\.(jpg|png|gif|webp)$/)) return <img src={src} className="h-20 rounded" />;
      return <div className="bg-[rgb(var(--color-surface-hover))] p-2 rounded text-sm flex items-center gap-2"><FileText size={16} /> Attached Media</div>;
  };

  // --- Modals ---
  const CreateGazeboModal = () => (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[rgb(var(--color-surface))] p-6 rounded-lg w-96 shadow-xl border border-[rgb(var(--color-border))]">
              <h3 className="text-xl font-bold mb-4">Create a Gazebo</h3>
              <input id="newGazeboName" type="text" placeholder="Server Name" className="w-full p-2 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded mb-4 text-[rgb(var(--color-text))]" />
              <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCreateGazeboModal(false)} className="px-4 py-2 text-[rgb(var(--color-text-secondary))]">Cancel</button>
                  <button onClick={() => createGazebo((document.getElementById('newGazeboName') as HTMLInputElement).value)} className="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded">Create</button>
              </div>
          </div>
      </div>
  );

  const CreateChannelModal = () => {
      const [name, setName] = useState('');
      const [type, setType] = useState<'text'|'voice'>('text');
      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-[rgb(var(--color-surface))] p-6 rounded-lg w-96 shadow-xl border border-[rgb(var(--color-border))]">
                  <h3 className="text-xl font-bold mb-4">Create Channel</h3>
                  <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))} placeholder="channel-name" className="w-full p-2 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded mb-4 text-[rgb(var(--color-text))]" />
                  <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={type==='text'} onChange={()=>setType('text')} /> <Hash size={16}/> Text</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={type==='voice'} onChange={()=>setType('voice')} /> <Volume2 size={16}/> Voice</label>
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowCreateChannelModal(false)} className="px-4 py-2 text-[rgb(var(--color-text-secondary))]">Cancel</button>
                      <button onClick={() => manageChannel('create', { name, type })} className="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded">Create</button>
                  </div>
              </div>
          </div>
      );
  };

  const SettingsModal = () => (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[rgb(var(--color-surface))] p-6 rounded-lg w-full max-w-md shadow-xl border border-[rgb(var(--color-border))] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between mb-6">
                  <h2 className="text-2xl font-bold">Server Settings</h2>
                  <button onClick={() => setShowSettingsModal(false)}><X /></button>
              </div>
              
              <div className="space-y-6">
                  <section>
                      <h3 className="font-bold mb-2 uppercase text-xs text-[rgb(var(--color-text-secondary))]">Overview</h3>
                      <div className="flex gap-4 items-center mb-4">
                          <img src={activeGazebo?.icon_url} className="w-20 h-20 rounded-full object-cover" />
                          <button className="text-sm bg-[rgb(var(--color-surface-hover))] px-3 py-1 rounded">Change Icon</button>
                      </div>
                      <input type="text" defaultValue={activeGazebo?.name} onBlur={(e) => updateGazebo({ name: e.target.value })} className="w-full p-2 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded" />
                  </section>

                  <section>
                      <h3 className="font-bold mb-2 uppercase text-xs text-[rgb(var(--color-text-secondary))]">Invites</h3>
                      <div className="flex gap-2 mb-2">
                          <input id="customCode" placeholder="Custom Code" className="flex-1 p-2 bg-[rgb(var(--color-background))] rounded border border-[rgb(var(--color-border))]" />
                          <button onClick={() => manageInvite('create', (document.getElementById('customCode') as HTMLInputElement).value)} className="bg-[rgb(var(--color-primary))] text-white px-3 rounded">Create</button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                          {inviteLinks.map(i => (
                              <div key={i.id} className="flex justify-between items-center bg-[rgb(var(--color-surface-hover))] p-2 rounded text-sm">
                                  <span className="font-mono truncate">{i.invite_code}</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${i.invite_code}`); alert('Copied!'); }}><Copy size={14}/></button>
                                      <button onClick={() => manageInvite('delete', i.id)} className="text-red-500"><Trash2 size={14}/></button>
                                  </div>
                              </div>
                          ))}
                          <button onClick={async () => { const { data } = await supabase.from('gazebo_invites').select('*').eq('gazebo_id', activeGazebo!.id); setInviteLinks(data || []); }} className="text-xs underline text-[rgb(var(--color-text-secondary))]">Load Invites</button>
                      </div>
                  </section>

                  {isOwner && (
                      <section className="pt-4 border-t border-[rgb(var(--color-border))]">
                          <button onClick={deleteGazebo} className="flex items-center gap-2 text-red-500 hover:bg-red-500/10 w-full p-2 rounded transition">
                              <Trash2 size={18} /> Delete Server
                          </button>
                      </section>
                  )}
              </div>
          </div>
      </div>
  );

  // --- Conditional Rendering for Mobile/Desktop ---

  // If mobile, we only show one column at a time. 
  // Desktop shows all columns.
  const isMobile = window.innerWidth <= 768;

  return (
    <div className="flex h-full w-full bg-[rgb(var(--color-background))] overflow-hidden text-[rgb(var(--color-text))]">
      
      {/* COLUMN 1: Server List (Always visible on Desktop, visible on Mobile if view='servers') */}
      <div className={`flex-shrink-0 w-18 bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))] flex flex-col items-center py-3 space-y-2 z-30 ${isMobile && mobileView !== 'servers' ? 'hidden' : 'flex'} w-20`}>
         {gazebos.map(g => (
             <button key={g.id} onClick={() => { setActiveGazebo(g); setMobileView('channels'); }} className={`group relative w-12 h-12 flex items-center justify-center rounded-3xl hover:rounded-xl transition-all duration-300 overflow-hidden ${activeGazebo?.id === g.id ? 'rounded-xl bg-[rgb(var(--color-primary))]' : 'bg-[rgb(var(--color-surface-hover))]'}`}>
                 {g.icon_url ? <img src={g.icon_url} className="w-full h-full object-cover" /> : <span className="font-bold text-lg">{g.name.substring(0,2).toUpperCase()}</span>}
                 {activeGazebo?.id === g.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />}
             </button>
         ))}
         <button onClick={() => setShowCreateGazeboModal(true)} className="w-12 h-12 rounded-3xl bg-[rgb(var(--color-surface-hover))] text-green-500 hover:bg-green-500 hover:text-white flex items-center justify-center transition-all duration-300">
             <Plus size={24} />
         </button>
      </div>

      {/* COLUMN 2: Channels (Visible if activeGazebo selected. On mobile, view='channels') */}
      <div className={`flex-shrink-0 w-60 bg-[rgb(var(--color-surface))] flex flex-col border-r border-[rgb(var(--color-border))] ${isMobile && mobileView !== 'channels' ? 'hidden' : 'flex'} ${!activeGazebo ? 'hidden' : ''}`}>
          {/* Header */}
          <div className="h-12 border-b border-[rgb(var(--color-border))] flex items-center justify-between px-4 font-bold shadow-sm hover:bg-[rgb(var(--color-surface-hover))] cursor-pointer transition" onClick={() => isAdmin && setShowSettingsModal(true)}>
              <span className="truncate">{activeGazebo?.name}</span>
              {isAdmin && <ChevronDown size={16} />}
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isMobile && <button onClick={() => setMobileView('servers')} className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))] mb-4 px-2"><ChevronDown className="rotate-90" size={14}/> Back to Servers</button>}
              
              <div className="flex items-center justify-between px-2 pt-4 pb-1 text-xs font-bold text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] group">
                  <span>TEXT CHANNELS</span>
                  {isAdmin && <button onClick={() => setShowCreateChannelModal(true)}><Plus size={14} /></button>}
              </div>
              {channels.filter(c => c.type === 'text').map(c => (
                  <div key={c.id} className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer ${activeChannel?.id === c.id ? 'bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] hover:text-[rgb(var(--color-text))]'}`}>
                      <div className="flex items-center gap-2 truncate flex-1" onClick={() => { setActiveChannel(c); setMobileView('chat'); }}>
                          <Hash size={18} className="text-[rgb(var(--color-text-secondary))]" />
                          {editingChannelId === c.id ? 
                              <input autoFocus defaultValue={c.name} onKeyDown={e => { if(e.key === 'Enter') manageChannel('update', e.currentTarget.value); }} onBlur={() => setEditingChannelId(null)} className="bg-transparent outline-none w-full" /> 
                              : <span>{c.name}</span>
                          }
                      </div>
                      {isAdmin && activeChannel?.id === c.id && (
                          <div className="hidden group-hover:flex gap-1">
                              <Settings size={14} onClick={() => setEditingChannelId(c.id)} />
                              <Trash2 size={14} onClick={() => manageChannel('delete', c.id)} className="text-red-500" />
                          </div>
                      )}
                  </div>
              ))}

              <div className="flex items-center justify-between px-2 pt-4 pb-1 text-xs font-bold text-[rgb(var(--color-text-secondary))] group">
                  <span>VOICE CHANNELS</span>
                  {isAdmin && <button onClick={() => setShowCreateChannelModal(true)}><Plus size={14} /></button>}
              </div>
              {channels.filter(c => c.type === 'voice').map(c => (
                   <div key={c.id} className="flex items-center gap-2 px-2 py-1 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-hover))] hover:text-[rgb(var(--color-text))] cursor-pointer">
                       <Volume2 size={18} />
                       <span>{c.name}</span>
                   </div>
              ))}
          </div>
          {/* User Mini Bar */}
          <div className="p-2 bg-[rgb(var(--color-surface-hover))] flex items-center gap-2">
               <img src={user?.user_metadata.avatar_url} className="w-8 h-8 rounded-full bg-gray-500" />
               <div className="flex-1 min-w-0">
                   <div className="text-sm font-bold truncate">{user?.user_metadata.display_name || 'User'}</div>
                   <div className="text-xs text-[rgb(var(--color-text-secondary))] truncate">#{user?.email?.split('@')[0]}</div>
               </div>
               <button className="p-1 hover:bg-[rgb(var(--color-surface))]" onClick={() => setActiveGazebo(null)}><LogOut size={16}/></button>
          </div>
      </div>

      {/* COLUMN 3: Chat Area (Visible if activeChannel. On mobile, view='chat') */}
      <div className={`flex-1 flex flex-col min-w-0 bg-[rgb(var(--color-background))] ${isMobile && mobileView !== 'chat' ? 'hidden' : 'flex'}`}>
          {!activeChannel ? (
              <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-secondary))] flex-col p-8 text-center">
                  <div className="w-16 h-16 bg-[rgb(var(--color-surface))] rounded-full flex items-center justify-center mb-4"><Hash size={32} /></div>
                  <h3 className="text-lg font-bold">No Channel Selected</h3>
                  <p>Select a text channel from the sidebar to start chatting.</p>
              </div>
          ) : (
              <>
                  {/* Chat Header */}
                  <div className="h-12 border-b border-[rgb(var(--color-border))] flex items-center justify-between px-4 shadow-sm bg-[rgb(var(--color-surface))]">
                      <div className="flex items-center gap-2">
                          {isMobile && <button onClick={() => setMobileView('channels')}><Menu size={24} /></button>}
                          <Hash size={24} className="text-[rgb(var(--color-text-secondary))]" />
                          <span className="font-bold">{activeChannel.name}</span>
                          {activeChannel.topic && <span className="text-sm text-[rgb(var(--color-text-secondary))] hidden md:block border-l border-[rgb(var(--color-border))] pl-4 ml-2">{activeChannel.topic}</span>}
                      </div>
                      <div className="flex gap-4 text-[rgb(var(--color-text-secondary))]">
                          <button onClick={() => setShowMembersPanel(!showMembersPanel)} className={`${showMembersPanel ? 'text-[rgb(var(--color-text))]' : ''}`}><Users size={24}/></button>
                      </div>
                  </div>

                  {/* Messages List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((msg, i) => {
                          const showHeader = i === 0 || messages[i-1].user_id !== msg.user_id || (new Date(msg.created_at).getTime() - new Date(messages[i-1].created_at).getTime() > 300000);
                          return (
                              <div key={msg.id} className={`group flex gap-4 ${!showHeader ? 'mt-0.5 py-0.5' : 'mt-4'}`}>
                                  {showHeader ? (
                                      <img src={msg.sender?.avatar_url} className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80" />
                                  ) : <div className="w-10" />}
                                  <div className="flex-1 min-w-0">
                                      {showHeader && (
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="font-bold hover:underline cursor-pointer">{msg.sender?.display_name}</span>
                                              <span className="text-xs text-[rgb(var(--color-text-secondary))]">{new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                                          </div>
                                      )}
                                      <div className="text-[rgb(var(--color-text))] whitespace-pre-wrap break-words">
                                          {msg.content}
                                      </div>
                                      {msg.media_url && (
                                          <div className="mt-2">
                                              {msg.media_type === 'image' && <img src={msg.media_url} className="max-h-80 rounded-lg" />}
                                              {msg.media_type === 'video' && <video src={msg.media_url} controls className="max-h-80 rounded-lg" />}
                                              {msg.media_type === 'audio' && <div className="bg-[rgb(var(--color-surface))] p-2 rounded w-64"><AudioPlayer src={msg.media_url} isOutgoing={false} /></div>}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )
                      })}
                      <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 pt-0">
                      <div className="bg-[rgb(var(--color-surface-hover))] rounded-lg p-2 pr-4">
                          {getPreview() && <div className="mb-2 p-2 border-b border-[rgb(var(--color-border))] flex justify-between">{getPreview()} <button onClick={() => {setFile(null); setRemoteUrl('');}}><X/></button></div>}
                          <div className="flex items-center gap-2">
                             <button onClick={() => setShowMediaMenu(!showMediaMenu)} className="p-2 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] rounded-full relative">
                                 <Plus size={20} className="bg-[rgb(var(--color-text-secondary))] text-[rgb(var(--color-surface))] rounded-full p-0.5" />
                                 {showMediaMenu && (
                                     <div className="absolute bottom-10 left-0 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded shadow-lg flex flex-col p-2 w-40">
                                         <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 p-2 hover:bg-[rgb(var(--color-surface-hover))] rounded text-sm"><ImageIcon size={16}/> Upload File</button>
                                         <button onClick={() => { setMediaInputMode('url'); setShowMediaMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-[rgb(var(--color-surface-hover))] rounded text-sm"><LinkIcon size={16}/> Paste URL</button>
                                     </div>
                                 )}
                             </button>
                             
                             {mediaInputMode === 'url' ? (
                                 <div className="flex-1 flex items-center gap-2">
                                     <input autoFocus className="flex-1 bg-transparent outline-none" placeholder="https://..." value={remoteUrl} onChange={e=>setRemoteUrl(e.target.value)} />
                                     <button onClick={()=>setMediaInputMode(null)}><X/></button>
                                 </div>
                             ) : (
                                 <input 
                                    className="flex-1 bg-transparent outline-none py-2 max-h-32 overflow-y-auto" 
                                    placeholder={`Message #${activeChannel.name}`}
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                                 />
                             )}
                             
                             <input type="file" ref={fileInputRef} className="hidden" onChange={e => {if(e.target.files?.[0]) setFile(e.target.files[0])}} />

                             {content || file || remoteUrl ? (
                                 <button onClick={handleSend} disabled={isUploading} className="p-2 text-[rgb(var(--color-primary))]"><Send size={20}/></button>
                             ) : (
                                 <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[rgb(var(--color-text-secondary))]'}`}><Mic size={20}/></button>
                             )}
                          </div>
                      </div>
                  </div>
              </>
          )}
      </div>

      {/* COLUMN 4: Member List (Desktop only, collapsible) */}
      {showMembersPanel && !isMobile && (
          <div className="w-60 bg-[rgb(var(--color-surface))] border-l border-[rgb(var(--color-border))] flex flex-col p-4 overflow-y-auto">
              {['owner', 'admin', 'member'].map(role => {
                  const roleMembers = members.filter(m => m.role === role);
                  if (roleMembers.length === 0) return null;
                  return (
                      <div key={role} className="mb-6">
                          <h3 className="text-xs font-bold text-[rgb(var(--color-text-secondary))] uppercase mb-2">{role === 'owner' ? 'Owner' : role === 'admin' ? 'Admins' : 'Members'} — {roleMembers.length}</h3>
                          {roleMembers.map(m => (
                              <div key={m.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-[rgb(var(--color-surface-hover))] cursor-pointer opacity-90 hover:opacity-100">
                                  <div className="relative">
                                      <img src={m.profiles.avatar_url} className="w-8 h-8 rounded-full" />
                                      {/* Simple online indicator simulation based on last message could go here */}
                                  </div>
                                  <span className={`font-medium truncate`} style={{ color: m.role_color }}>{m.profiles.display_name}</span>
                                  {role === 'owner' && <Crown size={14} className="text-yellow-500 ml-auto" />}
                                  {role === 'admin' && <Shield size={14} className="text-blue-500 ml-auto" />}
                              </div>
                          ))}
                      </div>
                  )
              })}
          </div>
      )}

      {/* Modals */}
      {showCreateGazeboModal && <CreateGazeboModal />}
      {showCreateChannelModal && <CreateChannelModal />}
      {showSettingsModal && <SettingsModal />}

    </div>
  );
};
