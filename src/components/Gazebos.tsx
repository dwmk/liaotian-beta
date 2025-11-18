// src/components/Gazebos.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Profile, Gazebo, GazeboChannel, GazeboMessage, uploadMedia } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Hash, Volume2, Plus, Settings, Users, X, Send, Paperclip, Mic, Link as LinkIcon,
  MoreVertical, Trash2, Edit3, Check, XCircle, Copy, UserPlus, Crown, Shield,
  ChevronDown, ChevronRight, Menu, Search
} from 'lucide-react';

type MemberWithProfile = {
  user_id: string;
  role: string;
  role_name: string;
  role_color: string;
  profiles: Profile;
};

export const Gazebos = () => {
  const { user } = useAuth();
  const [gazebos, setGazebos] = useState<Gazebo[]>([]);
  const [activeGazebo, setActiveGazebo] = useState<Gazebo | null>(null);
  const [channels, setChannels] = useState<GazeboChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<GazeboChannel | null>(null);
  const [messages, setMessages] = useState<GazeboMessage[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Message input (exact same as Messages.tsx)
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [mediaInputMode, setMediaInputMode] = useState<'file' | 'url' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Edit states
  const [editingGazeboName, setEditingGazeboName] = useState(false);
  const [newGazeboName, setNewGazeboName] = useState('');
  const [editingChannelName, setEditingChannelName] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Load gazebos
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('gazebo_members')
        .select('gazebo_id, gazebos(*)')
        .eq('user_id', user.id);
      if (data) {
        const gazebosList = data.map(d => d.gazebos).filter(Boolean) as Gazebo[];
        setGazebos(gazebosList);
      }
    };
    fetch();
  }, [user]);

  // Select gazebo → load channels + members
  useEffect(() => {
    if (!activeGazebo) {
      setChannels([]);
      setMembers([]);
      setActiveChannel(null);
      return;
    }

    const load = async () => {
      // Channels
      const { data: ch } = await supabase
        .from('gazebo_channels')
        .select('*')
        .eq('gazebo_id', activeGazebo.id)
        .order('created_at');
      setChannels(ch || []);

      // Members with roles
      const { data: mem } = await supabase
        .from('gazebo_members')
        .select('user_id, role, role_name, role_color, profiles(*)')
        .eq('gazebo_id', activeGazebo.id);
      setMembers(mem as any || []);

      // Default to first text channel
      const firstText = ch?.find(c => c.type === 'text');
      if (firstText) setActiveChannel(firstText);
    };
    load();
  }, [activeGazebo]);

  // Load messages + realtime
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'text') return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('gazebo_messages')
        .select('*, sender:profiles(*)')
        .eq('channel_id', activeChannel.id)
        .order('created_at', { ascending: true });
      setMessages((data || []) as GazeboMessage[]);
      scrollToBottom();
    };
    loadMessages();

    const channel = supabase.channel(`gazebo:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'gazebo_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, payload => {
        const msg = payload.new as GazeboMessage;
        supabase.from('profiles').select('*').eq('id', msg.user_id).single()
          .then(({ data }) => {
            setMessages(prev => [...prev, { ...msg, sender: data } as any]);
            scrollToBottom();
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel]);

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  // Voice recording (same as Messages.tsx)
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
        setFile(file);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  };

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file && !remoteUrl.trim() || !activeChannel || !user) return;

    setIsUploading(true);
    let media_url = '';
    let media_type: any = 'text';

    if (file) {
      const res = await uploadMedia(file, 'messages', setUploadProgress);
      if (res) { media_url = res.url; media_type = res.type; }
    } else if (remoteUrl) {
      media_url = remoteUrl;
      media_type = remoteUrl.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image';
    }

    await supabase.from('gazebo_messages').insert({
      channel_id: activeChannel.id,
      user_id: user.id,
      content: content.trim(),
      media_url,
      media_type
    });

    setContent('');
    setFile(null);
    setRemoteUrl('');
    setMediaInputMode(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Create invite
  const createInvite = async () => {
    if (!activeGazebo || activeGazebo.owner_id !== user?.id) return;
    const code = Math.random().toString(36).substring(2, 10);
    await supabase.from('gazebos').update({
      invite_code: code,
      invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invite_uses_max: 0,
      invite_uses_current: 0
    }).eq('id', activeGazebo.id);
    setInviteCode(code);
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
  };

  // Rename gazebo
  const renameGazebo = async () => {
    if (!newGazeboName.trim() || !activeGazebo) return;
    await supabase.from('gazebos').update({ name: newGazeboName }).eq('id', activeGazebo.id);
    setActiveGazebo({ ...activeGazebo, name: newGazeboName });
    setEditingGazeboName(false);
  };

  // Rename channel
  const renameChannel = async (channelId: string) => {
    if (!newChannelName.trim()) return;
    await supabase.from('gazebo_channels').update({ name: newChannelName }).eq('id', channelId);
    setChannels(channels.map(c => c.id === channelId ? { ...c, name: newChannelName } : c));
    setEditingChannelName(null);
  };

  return (
    <div className="flex h-screen bg-[rgb(var(--color-background))]">
      {/* LEFT SIDEBAR - Gazebos */}
      <div className="w-60 bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))]">
        <div className="p-4 border-b border-[rgb(var(--color-border))]">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full text-left font-bold text-lg">
            {activeGazebo?.name || 'Gazebos'}
          </button>
        </div>
        <div className="overflow-y-auto">
          {gazebos.map(g => (
            <div
              key={g.id}
              onClick={() => setActiveGazebo(g)}
              className={`px-4 py-2 hover:bg-[rgb(var(--color-surface-hover))] cursor-pointer flex items-center gap-3 ${activeGazebo?.id === g.id ? 'bg-[rgba(var(--color-primary),0.1)]' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                {g.icon_url ? <img src={g.icon_url} className="w-full h-full rounded-full" /> : g.name[0]}
              </div>
              <span className="truncate">{g.name}</span>
            </div>
          ))}
          <button className="w-full text-left px-4 py-3 hover:bg-[rgb(var(--color-surface-hover))]">
            <Plus className="inline mr-2" /> Add a Server
          </button>
        </div>
      </div>

      {/* CHANNELS & CHAT */}
      {activeGazebo && (
        <>
          {/* Channel Sidebar */}
          <div className={`w-60 bg-[#2f3136] text-gray-300 flex flex-col ${sidebarOpen ? '' : 'hidden'}`}>
            <div className="p-4 flex justify-between items-center border-b border-gray-800 shadow-md">
              {editingGazeboName ? (
                <input
                  autoFocus
                  value={newGazeboName}
                  onChange={e => setNewGazeboName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && renameGazebo()}
                  className="bg-transparent border-b border-white text-white"
                />
              ) : (
                <h1 className="font-bold text-white">{activeGazebo.name}</h1>
              )}
              {activeGazebo.owner_id === user?.id && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingGazeboName(true); setNewGazeboName(activeGazebo.name); }}><Edit3 size={16} /></button>
                  <button onClick={createInvite}><UserPlus size={16} /></button>
                  <button><Settings size={16} /></button>
                </div>
              )}
            </div>

            {inviteCode && (
              <div className="mx-3 my-2 p-2 bg-gray-800 rounded flex justify-between items-center text-sm">
                <code>{inviteCode}</code>
                <button onClick={() => { setInviteCode(null); }}><X size={14} /></button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="px-2 py-2 text-xs font-bold uppercase text-gray-500">Text Channels</div>
              {channels.filter(c => c.type === 'text').map(ch => (
                <div
                  key={ch.id}
                  className={`px-2 py-1 flex items-center justify-between hover:bg-gray-700 cursor-pointer rounded ${activeChannel?.id === ch.id ? 'bg-gray-700' : ''}`}
                  onClick={() => setActiveChannel(ch)}
                >
                  <div className="flex items-center gap-1">
                    <Hash size={18} />
                    {editingChannelName === ch.id ? (
                      <input
                        autoFocus
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && renameChannel(ch.id)}
                        className="bg-transparent text-sm"
                      />
                    ) : (
                      <span>{ch.name}</span>
                    )}
                  </div>
                  {activeGazebo.owner_id === user?.id && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingChannelName(ch.id); setNewChannelName(ch.name); }}>
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-[#36393f]">
            {/* Header */}
            <div className="h-12 bg-[#36393f] border-b border-gray-800 px-4 flex items-center justify886-between text-white shadow-md">
              <div className="flex items-center gap-2">
                <Hash size={24} />
                <span className="font-semibold">{activeChannel?.name || 'general'}</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X /></button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className="flex gap-3 hover:bg-gray-800 px-2 py-1 rounded group">
                  <img src={msg.sender?.avatar_url || `https://ui-avatars.com/api/?name=${msg.sender?.username}`} className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-white">{msg.sender?.display_name}</span>
                      <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    {msg.content && <p className="text-gray-300">{msg.content}</p>}
                    {msg.media_url && msg.media_type === 'image' && <img src={msg.media_url} className="max-w-md rounded mt-2" />}
                    {msg.media_type === 'audio' && <audio controls src={msg.media_url} className="mt-2" />}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input (identical to Messages.tsx) */}
            <div className="p-4 bg-[#40444b]">
              {isUploading && (
                <div className="mb-2 w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-[rgb(var(--color-primary))]" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              <form onSubmit={sendMessage} className="flex items-center gap-2 bg-[#383a40] rounded-lg px-4 py-3">
                <button type="button" onClick={() => setShowMediaMenu(!showMediaMenu)} className="text-gray-400 hover:text-white">
                  <Paperclip size={20} />
                </button>

                {showMediaMenu && (
                  <div className="absolute bottom-16 left-4 bg-[#2f3136] rounded shadow-lg p-2 flex flex-col gap-1 z-50">
                    <button type="button" onClick={() => { fileInputRef.current?.click(); setShowMediaMenu(false); }} className="px-3 py-2 hover:bg-gray-700 text-left">Upload File</button>
                    <button type="button" onClick={() => { setMediaInputMode('url'); setShowMediaMenu(false); }} className="px-3 py-2 hover:bg-gray-700 text-left">Paste Link</button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />

                <button type="button" onClick={toggleRecording} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400'} hover:text-white`}>
                  <Mic size={20} />
                </button>

                <input
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={`Message #${activeChannel?.name}`}
                  className="flex-1 bg-transparent text-white outline-none"
                  disabled={isRecording}
                />

                <button type="submit" disabled={!content && !file && !remoteUrl} className="text-gray-400 hover:text-white">
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>

          {/* Member List */}
          <div className="w-60 bg-[#2f3136] p-4 text-gray-300">
            <h3 className="text-xs font-bold uppercase mb-3">Members — {members.length}</h3>
            {members
              .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0))
              .map(m => (
                <div key={m.user_id} className="flex items-center gap-2 py-1">
                  {m.role === 'owner' && <Crown size={14} className="text-yellow-500" />}
                  {m.role === 'admin' && <Shield size={14} className="text-blue-500" />}
                  <img src={m.profiles.avatar_url || `https://ui-avatars.com/api/?name=${m.profiles.username}`} className="w-8 h-8 rounded-full" />
                  <span style={{ color: m.role_color }}>{m.profiles.display_name}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
};
