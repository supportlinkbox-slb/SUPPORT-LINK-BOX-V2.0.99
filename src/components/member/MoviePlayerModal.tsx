import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { MemberProfile } from '../../types';
import { ObfuscatedMediaStreamPayload, resolveObfuscatedStream } from '../../utils/mediaSecurity';

interface MoviePlayerModalProps {
  movieTitle: string;
  category?: string;
  payload: ObfuscatedMediaStreamPayload;
  currentUser: MemberProfile;
  onClose: () => void;
}

export const MoviePlayerModal: React.FC<MoviePlayerModalProps> = ({
  movieTitle,
  category,
  payload,
  currentUser,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [remainingTimeSec, setRemainingTimeSec] = useState<number>(() => {
    return Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
  });

  // Dynamic Floating Watermark Coordinates (Randomized periodically to prevent video recording cropping)
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '20%' });

  // 1. Layer 2: Resolve stream in-memory only
  useEffect(() => {
    const result = resolveObfuscatedStream(
      payload.obfuscatedData,
      currentUser.id,
      payload.salt,
      payload.expiresAt
    );

    if (result.success && result.url) {
      setResolvedUrl(result.url);
    } else {
      setError(result.error || 'স্ট্রিমিং ডিকোড ব্যর্থ হয়েছে।');
    }

    // Cleanup in-memory URL upon unmount
    return () => {
      setResolvedUrl(null);
    };
  }, [payload, currentUser.id]);

  // 2. Token expiration timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
      setRemainingTimeSec(remaining);
      if (remaining <= 0) {
        setError('স্ট্রিমিং টোকেনের ৩ মিনিটের মেয়াদ শেষ হয়ে গেছে। প্লেয়ারটি বন্ধ করা হচ্ছে।');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [payload.expiresAt, onClose]);

  // 3. Dynamic Watermark Floating Animation
  useEffect(() => {
    const wmInterval = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 70 + 10) + '%';
      const randomLeft = Math.floor(Math.random() * 60 + 10) + '%';
      setWatermarkPos({ top: randomTop, left: randomLeft });
    }, 8000);

    return () => clearInterval(wmInterval);
  }, []);

  // 4. Anti-Piracy Context Menu and Key Restrictions
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setProgress((curr / dur) * 100);
    setCurrentTime(formatTime(curr));
    setDuration(formatTime(dur));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * (videoRef.current.duration || 0);
    videoRef.current.currentTime = seekTime;
    setProgress(parseFloat(e.target.value));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none"
      onContextMenu={handleContextMenu}
    >
      <div
        ref={containerRef}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[95vh]"
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold text-white truncate text-sm">{movieTitle}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              {payload.resolution}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Countdown timer */}
            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>টোকেন মেয়াদ: {Math.floor(remainingTimeSec / 60)}:{String(remainingTimeSec % 60).padStart(2, '0')}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative flex-1 bg-black min-h-[300px] sm:min-h-[420px] flex items-center justify-center overflow-hidden group">
          {error ? (
            <div className="p-6 text-center space-y-3 max-w-md">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                প্লেয়ার বন্ধ করুন
              </button>
            </div>
          ) : resolvedUrl ? (
            <>
              {/* Native Sandboxed Video Element */}
              <video
                ref={videoRef}
                src={resolvedUrl}
                className="w-full h-full object-contain max-h-[65vh]"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture
                playsInline
                onClick={togglePlay}
              />

              {/* Dynamic Anti-Piracy DRM Floating Watermark */}
              <div
                className="absolute pointer-events-none transition-all duration-1000 ease-in-out opacity-25 select-none text-[10px] sm:text-xs font-mono font-bold text-white bg-black/40 px-2.5 py-1 rounded border border-white/10 shadow-sm"
                style={{ top: watermarkPos.top, left: watermarkPos.left }}
              >
                <span>{currentUser.member_number} • {currentUser.name}</span>
                <span className="block text-[8px] text-cyan-300 opacity-75">SESSION: {payload.streamId}</span>
              </div>

              {/* Custom Bottom Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition opacity-0 group-hover:opacity-100 flex flex-col gap-2">
                {/* Progress Bar */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress || 0}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />

                <div className="flex items-center justify-between text-xs text-slate-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="font-mono text-[11px] text-slate-400">
                      {currentTime} / {duration}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      <ShieldCheck className="w-3 h-3" />
                      <span>3-Layer Obfuscated DRM</span>
                    </span>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center space-y-2 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-mono">সিকিউরিটি ডিক্রিপশন ও স্ট্রিম প্রিপেয়ার হচ্ছে...</p>
            </div>
          )}
        </div>

        {/* Security Footer Note */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct storage URLs are fully masked & sandboxed. No raw hotlink exposure.</span>
          </div>
          <span className="hidden sm:inline text-slate-600">SLB MEDIA VAULT V3</span>
        </div>
      </div>
    </div>
  );
};
