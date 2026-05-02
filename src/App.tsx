/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Radio, 
  Music, 
  Zap, 
  MessageSquare, 
  DollarSign, 
  Plus, 
  Trash2,
  FileAudio,
  User,
  Mic,
  MicOff,
  Settings,
  Monitor,
  Headphones,
  Signal,
  Circle,
  Download,
  GripVertical,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { supabase, type DBTrack } from './lib/supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Track {
  id: string;
  name: string;
  url: string;
  isLive?: boolean;
}

interface ChatMsg {
  id: string;
  user: string;
  text: string;
  time: number;
}

export default function App() {
  const [user, setUser] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [radioName, setRadioName] = useState<string>('SaCrAh PuLsAr 7.0');
  const [isLogged, setIsLogged] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedUrl, setLastSyncedUrl] = useState('');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [commercials, setCommercials] = useState<Track[]>([]);
  const [fxList, setFxList] = useState<{id: string, name: string, url: string}[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  
  // Broadcast Settings
  const [server, setServer] = useState('');
  const [mount, setMount] = useState('');
  const [port, setPort] = useState('');
  const [password, setPassword] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  
  const [volume, setVolume] = useState(0.8);

  // Supabase Auth and Data Fetching
  useEffect(() => {
    if (!supabase) return;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsLogged(true);
          setUser(session.user.user_metadata?.nickname || session.user.email?.split('@')[0] || 'User');
        }
      } catch (e) {
        console.warn("Auth check failed:", e);
      }
    };
    checkAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLogged(true);
        setUser(session.user.user_metadata?.nickname || session.user.email?.split('@')[0] || 'User');
      } else if (!session && isLogged) {
        // Only sign out if we were previously logged in via Supabase
        // This avoids kicking out users who logged in via fallback/demo mode
        const checkCurrentSession = async () => {
           const { data: { session: currentSession } } = await supabase.auth.getSession();
           if (!currentSession) setIsLogged(false);
        }
        // Actually, simpler: if we had a session and now we don't, logout.
        // But for this app, let's be more permissive.
      }
    });

    return () => data.subscription.unsubscribe();
  }, [isLogged]);

  useEffect(() => {
    if (!isLogged || !supabase) return;

    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const currentUserId = session.user.id;

      // Fetch Tracks for this user
      const { data: tracksData, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', currentUserId)
        .order('position', { ascending: true });

      if (tracksData && !tracksError) {
        const pTracks = tracksData.filter(t => t.type === 'playlist').map(t => ({ id: t.id, name: t.name, url: t.url, isLive: t.is_live }));
        const cTracks = tracksData.filter(t => t.type === 'commercial').map(t => ({ id: t.id, name: t.name, url: t.url }));
        setPlaylist(pTracks);
        setCommercials(cTracks);
      }

      // Fetch Settings for this user
      const { data: settingsData, error: settingsError } = await supabase
        .from('radio_settings')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (settingsData && !settingsError) {
        setRadioName(settingsData.radio_name || 'SaCrAh PuLsAr 7.0');
        setVolume(settingsData.default_volume ?? 0.8);
        setAutoDj(settingsData.auto_dj ?? true);
      }
    };

    fetchInitialData();
  }, [isLogged]);

  const saveTrackToSupabase = async (track: Track, type: 'playlist' | 'commercial' | 'vignette') => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('tracks').upsert({
      id: track.id,
      name: track.name,
      url: track.url,
      is_live: !!track.isLive,
      type: type,
      user_id: session.user.id,
      created_at: new Date().toISOString()
    });
    if (error) console.error('Error saving track to Supabase:', error);
  };

  const updateRadioSettings = async (updates: any) => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('radio_settings').upsert({
      radio_name: radioName,
      default_volume: volume,
      auto_dj: autoDj,
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
      ...updates
    }, { onConflict: 'user_id' });
    
    if (error) console.error('Error updating settings in Supabase:', error);
  };

  const deleteTrackFromSupabase = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (error) console.error('Error deleting track from Supabase:', error);
  };
  const [isMicActive, setIsMicActive] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [autoDj, setAutoDj] = useState(true);

  const [isMicMuted, setIsMicMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fxAudioRef = useRef<HTMLAudioElement | null>(null);
  const vignetteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micDestinationRef = useRef<AudioDestinationNode | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices);
    });
  }, []);

  // Sync Output Device
  useEffect(() => {
    const applyOutput = async (audio: HTMLAudioElement | null) => {
      if (audio && (audio as any).setSinkId && selectedOutput) {
        try {
          await (audio as any).setSinkId(selectedOutput);
        } catch (err) {
          console.error("Failed to set output device", err);
        }
      }
    };
    
    applyOutput(audioRef.current);
    applyOutput(fxAudioRef.current);
    applyOutput(vignetteAudioRef.current);
  }, [selectedOutput]);

  // Automatic "Download" (Sync) from Stream URL
  useEffect(() => {
    if (liveUrl.trim() && liveUrl !== lastSyncedUrl && isLogged) {
      const timer = setTimeout(() => {
        playLive();
        setLastSyncedUrl(liveUrl);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [liveUrl, isLogged]);

  const toggleMic = async () => {
    if (isMicActive) {
      // Ensure all tracks are stopped and context is suspended/closed
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
      }
      if (micContextRef.current) {
        if (micContextRef.current.state !== 'closed') {
          await micContextRef.current.close();
        }
      }
      micStreamRef.current = null;
      micContextRef.current = null;
      micSourceRef.current = null;
      setIsMicActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: selectedInput ? { deviceId: { exact: selectedInput } } : true 
        });
        
        // Setup local monitoring
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        
        // If an output device is selected, attempt to route it there (experimental/limited support)
        if ((audioCtx as any).setSinkId && selectedOutput) {
          (audioCtx as any).setSinkId(selectedOutput).catch((e: any) => console.log("AudioContext.setSinkId failed", e));
        }
        
        source.connect(audioCtx.destination);
        
        micStreamRef.current = stream;
        micContextRef.current = audioCtx;
        micSourceRef.current = source;
        setIsMicActive(true);
      } catch (err) {
        console.error("Mic access denied", err);
        alert("Erro ao acessar microfone. Verifique as permissões.");
      }
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleGlobalDragLeave = () => {
    setIsDragging(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    
    if (audioFiles.length > 0) {
      const newTracks = audioFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file)
      }));
      setPlaylist(prev => [...prev, ...newTracks]);
      newTracks.forEach(t => saveTrackToSupabase(t, 'playlist'));
    }
  };

  useEffect(() => {
    audioRef.current = new Audio();
    fxAudioRef.current = new Audio();
    vignetteAudioRef.current = new Audio();
    
    if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.onended = () => {
          if (autoDj) handleNext();
        };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
      }
      fxAudioRef.current?.pause();
      vignetteAudioRef.current?.pause();
    };
  }, [playlist, currentTrack]); // Added currentTrack dependency to ensure onended uses latest state

  useEffect(() => {
    // Implement Talkover (ducking): reduce music volume when mic is active
    const duckFactor = isMicActive ? 0.3 : 1.0;
    const finalVolume = isMicMuted ? 0 : volume * duckFactor;
    
    if (audioRef.current) audioRef.current.volume = finalVolume;
    if (fxAudioRef.current) fxAudioRef.current.volume = isMicMuted ? 0 : volume;
    if (vignetteAudioRef.current) vignetteAudioRef.current.volume = isMicMuted ? 0 : volume;
  }, [volume, isMicMuted, isMicActive]);

  const handleNext = () => {
    // Check main playlist first
    let currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % playlist.length;
      playTrack(playlist[nextIndex]);
      return;
    }

    // Check commercials if not found in main playlist
    currentIndex = commercials.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex !== -1) {
      if (currentIndex + 1 < commercials.length) {
        playTrack(commercials[currentIndex + 1]);
      } else if (playlist.length > 0) {
        // Go back to main playlist after last commercial
        playTrack(playlist[0]);
      }
      return;
    }

    // Default: Play first track of main playlist
    if (playlist.length > 0) {
      playTrack(playlist[0]);
    }
  };

  const handlePrevious = () => {
    // Check main playlist
    let currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
      playTrack(playlist[prevIndex]);
      return;
    }

    // Check commercials
    currentIndex = commercials.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + commercials.length) % commercials.length;
      playTrack(commercials[prevIndex]);
      return;
    }

    // Default: Play last track of main playlist
    if (playlist.length > 0) {
      playTrack(playlist[playlist.length - 1]);
    }
  };

  // Supabase Chat Subscription
  useEffect(() => {
    if (!supabase) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat')
        .select('*')
        .order('time', { ascending: true })
        .limit(50);
      
      if (data && !error) {
        setChatMessages(data.map(m => ({
          id: m.id,
          user: m.user_name,
          text: m.message,
          time: Number(m.time)
        })));
      }
    };

    fetchMessages();

    const channel = supabase
      .channel('chat_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, (payload) => {
        const newMsg = payload.new;
        setChatMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, {
            id: newMsg.id,
            user: newMsg.user_name,
            text: newMsg.message,
            time: Number(newMsg.time)
          }];
        });
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const [isPlaylistOver, setIsPlaylistOver] = useState(false);
  const [isFxOver, setIsFxOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, type: 'playlist' | 'commercial') => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaylistOver(false);
    setIsFxOver(false);

    const files = Array.from(e.dataTransfer.files) as File[];
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    
    if (audioFiles.length > 0) {
      const newTracks = audioFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file)
      }));
      
      if (type === 'playlist') {
        setPlaylist(prev => [...prev, ...newTracks]);
        newTracks.forEach(t => saveTrackToSupabase(t, 'playlist'));
      } else {
        setCommercials(prev => [...prev, ...newTracks]);
        newTracks.forEach(t => saveTrackToSupabase(t, 'commercial'));
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim()) {
      alert("Por favor, insira um Nickname.");
      return;
    }

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: email.trim() || 'demo@pulsar.com', 
          password: authPassword.trim() || 'demo123456' 
        });
        
        if (error) {
          // If login fails, try to sign up with nickname in metadata
          const { error: signUpError } = await supabase.auth.signUp({
            email: email.trim() || 'demo@pulsar.com',
            password: authPassword.trim() || 'demo123456',
            options: {
              data: { nickname: user.trim() }
            }
          });
          if (signUpError) {
            console.warn("Supabase Auth failed:", signUpError.message);
            setIsLogged(true); // Fallback for UI access
          }
        }
      } else {
        // Fallback for when supabase is not configured
        console.log("Supabase not configured, entering demo mode.");
        setIsLogged(true);
      }
      
      setSessionStartTime(Date.now());
      setIsLogged(true); // Ensure logged in state is set
      // setIsLogged is handled by onAuthStateChange
      
      if (liveUrl.trim()) {
        const streamTracks = [
          { id: 'live-master', name: '🔴 MASTER_STREAM', url: liveUrl, isLive: true },
          { id: 'st-alpha', name: '📡 STREAM_SOURCE_ALPHA', url: liveUrl },
          { id: 'st-beta', name: '📡 STREAM_SOURCE_BETA', url: liveUrl },
          { id: 'st-gamma', name: '📡 STREAM_SOURCE_GAMMA', url: liveUrl },
        ];
        setPlaylist(prev => {
          const existingNames = new Set(prev.map(t => t.name));
          const newTracks = streamTracks.filter(t => !existingNames.has(t.name));
          newTracks.forEach(t => saveTrackToSupabase(t, 'playlist'));
          return [...prev, ...newTracks];
        });
      }
    } catch (err) {
      console.error("Login process error:", err);
      setSessionStartTime(Date.now());
      setIsLogged(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newTracks = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file)
    }));
    setPlaylist(prev => [...prev, ...newTracks]);
    newTracks.forEach(t => saveTrackToSupabase(t, 'playlist'));
  };

  const handleFxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newFxs = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file)
    }));
    setFxList(prev => [...prev, ...newFxs]);
  };

  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const safePlay = async (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    try {
      await audio.play();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Playback error:", error);
      }
    }
  };

  const playTrack = (track: Track) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = track.url;
      setIsPlaying(true);
      setCurrentTrack(track);
      safePlay(audioRef.current);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.src) {
           safePlay(audioRef.current);
        } else if (playlist.length > 0) {
           playTrack(playlist[0]);
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playLive = () => {
    if (liveUrl.trim() && audioRef.current) {
      setIsSyncing(true);
      const track: Track = { id: 'live', name: '🔴 MASTER_STREAM', url: liveUrl, isLive: true };
      playTrack(track);
      
      // Automatic Ingestion (Simulated Download/Connection)
      setTimeout(() => {
        const timestamp = Date.now();
        const streamTracks = [
          { id: 'st-music-1-' + timestamp, name: '📡 STREAM_MUSIC_HITS', url: liveUrl },
          { id: 'st-music-2-' + timestamp, name: '📡 STREAM_MUSIC_TOP40', url: liveUrl },
          { id: 'st-music-3-' + timestamp, name: '📡 STREAM_MUSIC_RETRO', url: liveUrl },
          { id: 'st-music-4-' + timestamp, name: '📡 STREAM_MUSIC_INDIE', url: liveUrl },
        ];
        
        const vignetteTracks = [
          { id: 'vig-st-main-' + timestamp, name: '🎵 JINGLE_INSTITUCIONAL', url: liveUrl },
          { id: 'vig-st-ident-' + timestamp, name: '🎵 IDENT_RADIO_PROMO', url: liveUrl },
          { id: 'vig-st-trans-' + timestamp, name: '🎵 TRANSIÇÃO_RÁPIDA', url: liveUrl },
          { id: 'vig-st-legal-' + timestamp, name: '🎵 PREFIXO_LEGAL', url: liveUrl },
        ];
        
        setPlaylist(prev => {
          const existingNames = new Set(prev.map(t => t.name));
          const newTracks = streamTracks.filter(t => !existingNames.has(t.name));
          newTracks.forEach(t => saveTrackToSupabase(t, 'playlist'));
          const updatedPlaylist = [...prev, ...newTracks];
          // Auto-start first loaded track if nothing is playing
          if (!isPlaying && updatedPlaylist.length > 0) {
            playTrack(updatedPlaylist[0]);
          }
          return updatedPlaylist;
        });

        setCommercials(prev => {
          const existingNames = new Set(prev.map(t => t.name));
          const newTracks = vignetteTracks.filter(t => !existingNames.has(t.name));
          newTracks.forEach(t => saveTrackToSupabase(t, 'commercial'));
          return [...prev, ...newTracks];
        });

        setIsSyncing(false);
      }, 2500);
    }
  };

  const playFx = (url: string) => {
    if (fxAudioRef.current) {
      fxAudioRef.current.pause();
      fxAudioRef.current.src = url;
      safePlay(fxAudioRef.current);
    }
  };

  const playVignette = (url: string) => {
    // Immediate parallel playback for vignettes/jingles using dedicated ref
    if (vignetteAudioRef.current) {
      vignetteAudioRef.current.pause();
      vignetteAudioRef.current.src = url;
      safePlay(vignetteAudioRef.current);
    }
  };

  const sendMsg = async () => {
    if (!msgInput.trim()) return;
    
    const msgId = Math.random().toString(36).substr(2, 9);
    let currentUserId = null;

    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      currentUserId = session?.user?.id || null;
    }
    
    const msgData = {
      id: msgId,
      user_name: user || 'Anonymous',
      message: msgInput,
      time: Date.now(),
      user_id: currentUserId
    };

    if (supabase) {
      const { error } = await supabase.from('chat').insert(msgData);
      if (error) {
        console.error('Error sending message:', error);
        // Local fallback
        setChatMessages(prev => [...prev, {
          id: msgId,
          user: msgData.user_name,
          text: msgData.message,
          time: msgData.time
        }]);
      }
    } else {
      // Local demo mode
      setChatMessages(prev => [...prev, {
        id: msgId,
        user: msgData.user_name,
        text: msgData.message,
        time: msgData.time
      }]);
    }
    
    setMsgInput('');
  };

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 font-sans selection:bg-brand-red/30">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-bg-card border border-border-main p-8 rounded-xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-red shadow-[0_0_15px_rgba(255,59,59,0.5)]" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-bg-inner rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,59,59,0.4)] overflow-hidden border border-brand-red/30">
              <img src="https://i.ibb.co/1GzM9hLM/logo-radio.jpg" alt="Radio Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter text-white">SACRAH <span className="text-brand-red">PULSAR</span> 7.0</h1>
              <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">Broadcast Studio Engine</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted ml-1 flex items-center gap-2">
                <User size={10} /> Nickname
              </label>
              <input 
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Ex: DJ Pulsar"
                className="w-full bg-bg-inner border border-border-main text-white px-3 py-2 rounded-lg focus:border-brand-red outline-none transition-all placeholder:text-text-dim text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted ml-1 flex items-center gap-2">
                <Signal size={10} /> Email
              </label>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-bg-inner border border-border-main text-white px-3 py-2 rounded-lg focus:border-brand-red outline-none transition-all placeholder:text-text-dim text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted ml-1 flex items-center gap-2">
                <Settings size={10} /> Access Key
              </label>
              <input 
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg-inner border border-border-main text-white px-3 py-2 rounded-lg focus:border-brand-red outline-none transition-all placeholder:text-text-dim text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted ml-1 flex items-center gap-2">
                <Monitor size={10} /> Station Identifier
              </label>
              <input 
                value={radioName}
                onChange={e => setRadioName(e.target.value)}
                placeholder="Station Name"
                className="w-full bg-bg-inner border border-border-main text-white px-3 py-2 rounded-lg focus:border-brand-blue outline-none transition-all placeholder:text-text-dim text-xs font-mono"
              />
            </div>
            <button className="w-full bg-brand-red hover:bg-brand-red/90 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-brand-red/20 active:scale-95 text-xs uppercase tracking-widest mt-2">
              Authorize Uplink
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-border-main flex justify-between items-center opacity-50">
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-brand-red" />
              <div className="w-1 h-1 rounded-full bg-brand-red" />
              <div className="w-1 h-1 rounded-full bg-brand-red" />
            </div>
            <span className="text-[8px] font-mono text-text-dim">SECURE_TUNNEL_v7.02</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const filteredChat = chatMessages.filter(m => m.time >= sessionStartTime);

  return (
    <div 
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className={cn(
        "h-screen bg-bg-main text-text-main font-sans selection:bg-brand-red/30 p-4 flex flex-col gap-4 overflow-hidden relative",
        isDragging && "ring-4 ring-brand-red ring-inset"
      )}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-brand-red/10 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-none">
          <div className="bg-bg-card border-2 border-dashed border-brand-red p-12 rounded-3xl flex flex-col items-center gap-6 shadow-2xl scale-110">
            <div className="w-20 h-20 bg-brand-red rounded-full flex items-center justify-center animate-bounce">
              <Plus size={40} className="text-white" />
            </div>
            <p className="text-xl font-bold uppercase tracking-[0.3em] text-white">Drop to Load Stream Data</p>
          </div>
        </div>
      )}

      {/* Floating Mic Button */}
      <motion.button
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMic}
        className={cn(
          "fixed bottom-24 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl z-[60] border-2 transition-all",
          isMicActive ? "bg-brand-green border-white text-white animate-pulse" : "bg-brand-red border-white/20 text-white"
        )}
      >
        {isMicActive ? <Mic size={32} /> : <MicOff size={32} />}
      </motion.button>

      {/* Header */}
      <header className="bg-bg-card border border-border-main rounded-xl px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-bg-inner rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,59,59,0.4)] overflow-hidden border border-brand-red/30">
            <img src="https://i.ibb.co/1GzM9hLM/logo-radio.jpg" alt="Radio Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white uppercase">SACRAH <span className="text-brand-red">PULSAR</span> 7.0</h1>
            <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">Broadcast Studio Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs text-text-muted font-mono uppercase">STATION: <span className="text-white">{radioName}</span></span>
            <span className="text-[10px] text-brand-green flex items-center gap-1.5 font-bold uppercase tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" /> STUDIO ONLINE
            </span>
          </div>
          <div className="hidden md:block w-px h-8 bg-border-main" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-white leading-none uppercase">{user}</p>
              <p className="text-[10px] text-text-dim font-bold uppercase tracking-tighter mt-0.5">Administrator</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-bg-inner border border-border-main flex items-center justify-center overflow-hidden">
              <img src="https://i.ibb.co/1GzM9hLM/logo-radio.jpg" alt="User Profile" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: 12-Column Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        
        {/* Column 1: Audio Sources (3 cols) */}
        <section className="md:col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Main Playlist */}
          <div className="flex-1 bg-bg-card border border-border-main rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border-main flex justify-between items-center bg-bg-panel">
              <div className="flex items-center gap-3">
                <h2 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-muted">
                  <Music className="w-3 h-3 text-brand-red" /> Music Queue
                </h2>
                <button 
                  onClick={() => {
                    const newVal = !autoDj;
                    setAutoDj(newVal);
                    updateRadioSettings({ auto_dj: newVal });
                  }}
                  className={cn(
                    "text-[8px] font-bold px-2 py-0.5 rounded-full border transition-all",
                    autoDj ? "bg-brand-green/20 border-brand-green text-brand-green" : "bg-bg-inner border-border-main text-text-dim"
                  )}
                >
                  AUTO DJ: {autoDj ? 'ON' : 'OFF'}
                </button>
              </div>
              <label className="cursor-pointer text-[9px] font-bold bg-bg-card border border-border-main hover:bg-bg-hover px-2 py-1 rounded text-text-muted transition-colors uppercase tracking-tight">
                + Add
                <input type="file" multiple onChange={handleFileUpload} className="hidden" accept="audio/*" />
              </label>
            </div>
            
            <Reorder.Group 
              axis="y" 
              values={playlist} 
              onReorder={setPlaylist}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'playlist')}
              onDragEnter={() => setIsPlaylistOver(true)}
              onDragLeave={() => setIsPlaylistOver(false)}
              className={cn(
                "flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar relative transition-colors",
                isPlaylistOver ? "bg-brand-red/5" : ""
              )}
            >
              {playlist.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4 border-2 border-dashed border-white/10 m-2 rounded-xl">
                    <UploadCloud size={40} />
                    <p className="text-[10px] font-mono tracking-[0.3em] uppercase">Drag & Drop Music Here</p>
                 </div>
              ) : (
                playlist.map((track) => (
                  <Reorder.Item 
                    key={track.id} 
                    value={track}
                    className={cn(
                      "p-2 rounded-lg border-l-2 transition-all group flex items-center justify-between cursor-default",
                      currentTrack?.id === track.id ? "bg-bg-hover border-brand-red" : "border-transparent bg-bg-card/40 hover:bg-bg-hover/50 opacity-70 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                      <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded shrink-0 opacity-40 group-hover:opacity-100">
                        <GripVertical size={14} />
                      </div>
                      <div className="overflow-hidden flex-1 cursor-pointer" onClick={() => playTrack(track)}>
                        <p className={cn("text-[11px] font-bold truncate", currentTrack?.id === track.id ? "text-white" : "text-text-main")}>{track.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => downloadFile(track.url, track.name)} className="p-1 hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity"><Download size={12} /></button>
                      <button onClick={() => {
                        setPlaylist(prev => prev.filter(t => t.id !== track.id));
                        deleteTrackFromSupabase(track.id);
                      }} className="p-1 hover:text-brand-red"><Trash2 size={12} /></button>
                    </div>
                  </Reorder.Item>
                ))
              )}
            </Reorder.Group>
          </div>

          {/* Vignettes & Commercials */}
          <div className="h-2/5 bg-bg-card border border-border-main rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 border-b border-border-main flex justify-between items-center bg-bg-panel">
              <h2 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-muted">
                <Signal className="w-3 h-3 text-brand-yellow" /> Vignettes / Commercials
              </h2>
              <label className="cursor-pointer text-[9px] font-bold bg-bg-card border border-border-main px-2 py-1 rounded text-text-muted uppercase">
                + Load
                <input type="file" multiple onChange={(e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  const newTracks = files.map(file => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    url: URL.createObjectURL(file)
                  }));
                  setCommercials(prev => [...prev, ...newTracks]);
                  newTracks.forEach(t => saveTrackToSupabase(t, 'commercial'));
                }} className="hidden" accept="audio/*" />
              </label>
            </div>
            <Reorder.Group 
              axis="y" 
              values={commercials} 
              onReorder={setCommercials}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'commercial')}
              onDragEnter={() => setIsFxOver(true)}
              onDragLeave={() => setIsFxOver(false)}
              className={cn(
                "flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar relative transition-colors",
                isFxOver ? "bg-brand-yellow/5" : ""
              )}
            >
               {commercials.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4 border-2 border-dashed border-white/10 m-2 rounded-xl">
                    <UploadCloud size={30} />
                    <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-center">Drop Vignettes Here</p>
                 </div>
               ) : (
                 commercials.map(track => (
                    <Reorder.Item 
                      key={track.id} 
                      value={track} 
                      className="p-2 rounded-lg border-l-2 border-transparent bg-bg-card/40 hover:bg-bg-hover/50 flex items-center justify-between group transition-all cursor-default"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded shrink-0 opacity-40 group-hover:opacity-100">
                          <GripVertical size={12} />
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-[10px] font-bold truncate text-text-main">{track.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => {
                          const newTrack = { ...track, id: 'vignette-' + Date.now() };
                          setPlaylist(prev => [...prev, newTrack]);
                        }} className="p-1 text-brand-green hover:scale-110" title="Add to Playlist"><Plus size={10} /></button>
                        <button onClick={() => downloadFile(track.url, track.name)} className="p-1 text-text-dim hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity"><Download size={10} /></button>
                        <button 
                          onClick={() => playVignette(track.url)} 
                          className="p-1 text-brand-yellow hover:scale-110 active:scale-95 transition-transform"
                          title="Tocar Imediato"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>
                        <button onClick={() => {
                          setCommercials(prev => prev.filter(t => t.id !== track.id));
                          deleteTrackFromSupabase(track.id);
                        }} className="p-1 hover:text-brand-red"><Trash2 size={10} /></button>
                      </div>
                    </Reorder.Item>
                 ))
               )}
            </Reorder.Group>
          </div>
        </section>

        {/* Column 2: Master Console (6 cols) */}
        <section className="md:col-span-6 flex flex-col gap-4 overflow-hidden min-h-0">
          
          {/* Main Visualizer & Playback */}
          <div className="flex-1 bg-bg-card border border-border-main rounded-xl p-6 relative overflow-hidden flex flex-col shadow-inner">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand-red to-transparent shadow-[0_0_10px_rgba(255,59,59,0.3)]" />
            
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <div className="w-56 h-56 rounded-full border-4 border-border-main relative flex items-center justify-center p-3 animate-pulse shadow-lg">
                <div className="w-full h-full rounded-full bg-bg-inner flex items-center justify-center overflow-hidden relative shadow-[inset_0_0_30px_rgba(0,0,0,0.9)] border border-border-main/50">
                   <AnimatePresence>
                     {isPlaying && (
                        <motion.div 
                          key="visualizer"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.15 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                           <Music className="w-32 h-32 text-brand-red" fill="currentColor" />
                        </motion.div>
                     )}
                   </AnimatePresence>
                   <div className="z-10 text-center space-y-1">
                     {isMicActive && (
                       <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-brand-red text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(255,59,59,0.5)] flex flex-col items-center gap-1 animate-pulse border border-white/20">
                         <div className="flex items-center gap-1">
                           <div className="w-1 h-1 bg-white rounded-full" />
                           MIC LIVE
                         </div>
                         <div className="text-[6px] opacity-70">TALKOVER ACTIVE (70% DUCK)</div>
                       </div>
                     )}
                     {isSyncing && (
                       <div className="flex flex-col items-center justify-center gap-1 mb-2">
                         <div className="flex gap-2">
                           <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce" />
                           <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                           <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                         </div>
                         <span className="text-[8px] font-mono text-brand-blue uppercase font-bold tracking-widest">Auto-Downloading Stream Tracks...</span>
                       </div>
                     )}
                     <p className={cn(
                       "text-[10px] font-mono tracking-widest font-bold",
                       currentTrack?.isLive || isPlaying ? "text-brand-red animate-pulse" : "text-text-dim"
                     )}>
                       {currentTrack?.isLive ? "LIVE BROADCAST" : isPlaying ? "SIGNAL ACTIVE" : "STANDBY"}
                     </p>
                     <h3 className="text-2xl font-bold leading-tight uppercase text-white tracking-tighter max-w-[200px] break-words">
                       {currentTrack?.name || "No Input Signal"}
                     </h3>
                     <p className="text-[9px] font-mono text-text-dim mt-2 tracking-[0.2em] font-bold">MASTER OUT: 0.0dB</p>
                   </div>
                </div>
                <div className="absolute -inset-2 rounded-full border border-brand-red/20 border-dashed animate-spin-slow" style={{ animationDuration: '20s' }} />
              </div>
              
              <div className="flex items-center gap-8">
                <button 
                  onClick={handlePrevious}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-bg-hover border border-border-main text-text-muted hover:text-white hover:border-text-muted transition-all active:scale-95 shadow-sm"
                >
                   <SkipBack size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={togglePlay}
                  className={cn(
                    "w-20 h-20 flex items-center justify-center rounded-xl transition-all shadow-xl active:scale-95 group",
                    isPlaying ? "bg-bg-inner border-2 border-brand-red text-brand-red" : "bg-brand-red text-white shadow-brand-red/20"
                  )}
                >
                   {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                </button>
                <button 
                  onClick={handleNext}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-bg-hover border border-border-main text-text-muted hover:text-white hover:border-text-muted transition-all active:scale-95 shadow-sm"
                >
                   <SkipForward size={20} fill="currentColor" />
                </button>
              </div>

              {/* Volume & Mute Controls */}
              <div className="w-full max-w-xs flex items-center gap-4 bg-bg-inner/50 p-3 rounded-2xl border border-border-main/30">
                <button 
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isMicMuted ? "text-brand-red bg-brand-red/10 border border-brand-red/20" : "text-text-muted hover:text-white"
                  )}
                >
                  {isMicMuted ? <MicOff size={18} /> : <Headphones size={18} />}
                </button>
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-[10px] font-mono text-text-dim w-8">{Math.round(volume * 100)}%</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      updateRadioSettings({ default_volume: val });
                    }}
                    className="flex-1 h-1 bg-bg-hover rounded-full appearance-none cursor-pointer accent-brand-red"
                  />
                </div>
              </div>
            </div>

            {/* Simulated Live Waveform */}
            <div className="h-16 w-full flex items-end gap-1 px-2 pointer-events-none">
              {[...Array(40)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ 
                    height: isPlaying ? `${Math.floor(Math.random() * 80) + 10}%` : '4px'
                  }}
                  transition={{ duration: 0.15, repeat: Infinity, repeatType: "reverse" }}
                  className={cn(
                    "flex-1 rounded-t-[1px] transition-colors",
                    isPlaying ? (i > 30 ? "bg-brand-red" : i > 20 ? "bg-brand-blue" : i > 10 ? "bg-indigo-500" : "bg-brand-green") : "bg-bg-inner"
                  )}
                  style={{ opacity: isPlaying ? 0.6 : 0.2 }}
                />
              ))}
            </div>
          </div>

          {/* FX Sampler Launchpad */}
          <div className="h-56 bg-bg-card border border-border-main rounded-xl p-4 flex flex-col shadow-sm shrink-0">
            <h3 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
               <Zap size={10} className="text-brand-yellow" /> Hardware Sampler V1
            </h3>
            <div className="flex-1 grid grid-cols-4 gap-3">
              {fxList.slice(0, 8).map((fx) => (
                <div key={fx.id} className="relative group">
                  <button 
                    onClick={() => playFx(fx.url)}
                    className="w-full h-full bg-bg-hover border border-border-main rounded-lg text-[9px] font-bold text-brand-blue hover:bg-brand-blue hover:text-white hover:border-transparent active:translate-y-0.5 transition-all uppercase truncate px-2"
                  >
                    {fx.name.slice(0, 8)}
                  </button>
                  <div className="absolute top-0 right-0 p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadFile(fx.url, fx.name)} className="text-text-muted hover:text-white"><Download size={8} /></button>
                    <button onClick={() => setFxList(prev => prev.filter(item => item.id !== fx.id))} className="text-text-muted hover:text-brand-red"><Trash2 size={8} /></button>
                  </div>
                </div>
              ))}
              {[...Array(Math.max(0, 8 - fxList.length))].map((_, i) => (
                <label key={i + fxList.length} className="cursor-pointer bg-bg-inner border border-border-main border-dashed flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors">
                  <Plus size={16} className="text-text-dim" />
                  <input type="file" multiple onChange={handleFxUpload} className="hidden" accept="audio/*" />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Column 3: Interaction & Broadcast Config (3 cols) */}
        <section className="md:col-span-3 flex flex-col gap-4 overflow-hidden min-h-0">
          
          {/* Chat Engine */}
          <div className="flex-1 bg-bg-card border border-border-main rounded-xl flex flex-col overflow-hidden shadow-sm min-h-[300px]">
            <div className="p-3 bg-bg-panel border-b border-border-main flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <MessageSquare size={14} className="text-brand-blue" />
                 <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Listener Comm</h3>
               </div>
               <div className="bg-brand-green/10 text-brand-green px-2 py-0.5 rounded text-[9px] font-bold tracking-tighter uppercase">
                 ONLINE
               </div>
            </div>
            
            <div 
              ref={chatScrollRef}
              className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar"
            >
              {filteredChat.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-text-dim opacity-20 gap-2">
                   <MessageSquare className="animate-bounce" />
                   <p className="text-[10px] font-mono tracking-widest">AWAITING_COMM</p>
                </div>
              )}
              {filteredChat.map((msg) => (
                <div key={msg.id} className="space-y-1 group">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-tighter",
                      msg.user === user ? "text-brand-red" : "text-brand-blue"
                    )}>
                      {msg.user}
                    </span>
                    <span className="text-[8px] font-mono text-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-main bg-bg-hover/50 p-2.5 rounded-lg border border-border-main/30 leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-bg-inner border-t border-border-main">
               <div className="relative">
                  <input 
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMsg()}
                    placeholder="Broadcast message..."
                    className="w-full bg-bg-hover border border-border-main rounded-lg pl-3 pr-10 py-2.5 text-xs text-white focus:border-brand-blue outline-none transition-all placeholder:text-text-dim"
                  />
                  <button 
                    onClick={sendMsg}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-blue hover:text-white transition-colors"
                  >
                    <SkipForward size={16} fill="currentColor" />
                  </button>
               </div>
            </div>
          </div>

          {/* Broadcast / Station Control */}
          <div className="bg-bg-card border border-border-main rounded-xl p-4 space-y-4 shadow-sm shrink-0">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Radio size={12} className="text-brand-red" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Broadcast Engine v7</h3>
                </div>
                <div className="flex gap-1.5 items-center">
                    <span className="text-[8px] font-mono text-brand-green font-bold uppercase">Uplink: ESTABLISHED</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                <div className="col-span-2 space-y-3 pt-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-mono uppercase text-text-dim flex items-center gap-2">
                            <Monitor size={10} /> Audio Input (Mic)
                        </label>
                        <select 
                            value={selectedInput}
                            onChange={e => setSelectedInput(e.target.value)}
                            className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] text-white focus:border-brand-blue outline-none"
                        >
                            <option value="">Default Input</option>
                            {audioDevices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,4)}`}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5 pb-2">
                        <label className="text-[9px] font-mono uppercase text-text-dim flex items-center gap-2">
                            <Headphones size={10} /> Monitor Output
                        </label>
                        <select 
                            value={selectedOutput}
                            onChange={e => setSelectedOutput(e.target.value)}
                            className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] text-white focus:border-brand-blue outline-none"
                        >
                            <option value="">Default Output</option>
                            {audioDevices.filter(d => d.kind === 'audiooutput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,4)}`}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="col-span-2">
                    <label className="text-[9px] font-mono uppercase text-text-dim block mb-1 font-bold tracking-tighter">Icecast/Shoutcast Server</label>
                    <input 
                        value={server}
                        onChange={e => setServer(e.target.value)}
                        placeholder="streaming.server-node.com"
                        className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-brand-blue outline-none"
                    />
                </div>
                <div>
                    <label className="text-[9px] font-mono uppercase text-text-dim block mb-1 font-bold tracking-tighter">Port</label>
                    <input 
                        value={port}
                        onChange={e => setPort(e.target.value)}
                        placeholder="8000"
                        className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-brand-blue outline-none"
                    />
                </div>
                <div>
                    <label className="text-[9px] font-mono uppercase text-text-dim block mb-1 font-bold tracking-tighter">Mount</label>
                    <input 
                        value={mount}
                        onChange={e => setMount(e.target.value)}
                        placeholder="/stream_a"
                        className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-brand-blue outline-none"
                    />
                </div>
                <div className="col-span-2">
                    <label className="text-[9px] font-mono uppercase text-text-dim block mb-1 font-bold tracking-tighter">Encoder Password</label>
                    <input 
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="********"
                        className="w-full bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-brand-blue outline-none"
                    />
                </div>
            </div>

            <div className="pt-2">
                <label className="text-[9px] font-mono uppercase text-text-dim block mb-1 font-bold tracking-tighter">Public Mount Stream URL</label>
                <div className="flex gap-2">
                    <input 
                        value={liveUrl}
                        onChange={e => setLiveUrl(e.target.value)}
                        placeholder="https://icecast.com/listen.mp3"
                        className="flex-1 bg-bg-inner border border-border-main rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-brand-red outline-none border-l-brand-red/50 border-l-2"
                    />
                    <button 
                        onClick={playLive}
                        className={cn(
                            "px-3 rounded border transition-all active:scale-95 flex items-center justify-center",
                            currentTrack?.isLive ? "bg-brand-red border-transparent text-white shadow-[0_0_15px_rgba(255,59,59,0.4)]" : "border-border-main text-text-muted hover:text-brand-red shadow-sm"
                        )}
                    >
                        <Radio size={14} />
                    </button>
                </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => window.open('https://mpago.la/2JiKXDy', '_blank')}
                className="w-full bg-brand-green hover:bg-brand-green/90 text-white py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 transition-all active:scale-[0.98] uppercase"
              >
                  <DollarSign size={12} className="animate-pulse" /> DONATE VIA MERCADO PAGO
              </button>
            </div>
          </div>

        </section>
      </main>

      {/* Footer / Status Console */}
      <footer className="h-8 flex items-center justify-between px-4 bg-bg-inner border border-border-main rounded-lg text-[10px] font-mono text-text-dim shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <span>ENCODER: <span className={cn(isPlaying ? "text-brand-green" : "text-text-muted")}>{isPlaying ? "STABLE" : "STANDBY"}</span></span>
            <span className="hidden sm:inline">BITRATE: <span className="text-white">320 KBPS</span></span>
            <span className="hidden sm:inline">LATENCY: <span className="text-white">42MS</span></span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-brand-red animate-pulse" : "bg-text-dim")} /> 
            REC {isPlaying ? "ON" : "OFF"}
          </span>
          <span className="text-white uppercase hidden md:inline">v7.02 PRODUCTION BUILD</span>
        </div>
      </footer>
    </div>
  );
}

// Helper icon component since RadioButton isn't in lucide default list (Radio is)
const RadioButton = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
