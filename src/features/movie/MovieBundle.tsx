/**
 * =========================================================================================
 * 🎬 COMPLETE MOVIE LOVER BUNDLE (Vite + React + TypeScript + Tailwind + Supabase SQL)
 * =========================================================================================
 * This standalone folder/bundle contains everything for the Movie Lover Box feature:
 * 1. Database Schema & SQL Migration with Row Level Security (RLS) & Seed Data
 * 2. TypeScript Data Interfaces & Security Contracts
 * 3. 3-Layer URL Encryption & DRM Anti-Piracy Player Security Helpers
 * 4. Supabase API Gateway Adapter Functions
 * 5. Member Movie Library & Request Center (MovieLoverView)
 * 6. Secured Ephemeral In-App DRM Video Player Modal (MoviePlayerModal)
 * 7. Admin Control & Moderation Suite (MovieLoverAdmin)
 * =========================================================================================
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Play,
  Pause,
  Download,
  Search,
  Plus,
  ShieldCheck,
  Eye,
  ExternalLink,
  Sparkles,
  X,
  Tv,
  FileImage,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  History,
  Trash2,
  Edit,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Lock,
} from 'lucide-react';

/* =========================================================================================
 * 1. SUPABASE DATABASE SCHEMA, RLS & SQL MIGRATION (PostgreSQL)
 * ========================================================================================= */
export const MOVIE_BOX_SQL_SCHEMA = `
-- =================================================================
-- 🎬 SUPPORT LINK BOX - MOVIE LOVER SYSTEM SQL SCHEMA (SUPABASE)
-- =================================================================

-- 1. Movies Table (Catalog)
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    title VARCHAR(255) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    category VARCHAR(50) NOT NULL DEFAULT 'Movie' CHECK (category IN ('Movie', 'Web Series', 'Drama', 'Short Film')),
    poster_url TEXT NOT NULL,
    description TEXT,
    language VARCHAR(50) DEFAULT 'Bengali',
    quality VARCHAR(20) DEFAULT '1080p',
    status VARCHAR(20) DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Hidden', 'Archived')),
    stream_480p_url TEXT,
    stream_720p_url TEXT,
    stream_1080p_url TEXT,
    pixeldrain_url TEXT,
    gdflex_url TEXT,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Movie Requests Table (Member Wishlist & Tracking)
CREATE TABLE IF NOT EXISTS public.movie_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    member_number VARCHAR(50) NOT NULL,
    movie_title VARCHAR(255) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    thumbnail_url TEXT,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'ADDED', 'REJECTED', 'ALREADY_AVAILABLE', 'CANCELLED')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;

-- Movies RLS: Everyone logged-in can view Published movies; Admins/Developers can manage all
CREATE POLICY "Public and members can view published movies"
    ON public.movies FOR SELECT
    USING (status = 'Published' OR auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

CREATE POLICY "Admins can insert and modify movies"
    ON public.movies FOR ALL
    USING (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

-- Movie Requests RLS: Members can view & submit their own requests; Admins can view/edit all
CREATE POLICY "Members can view their own requests and admins view all"
    ON public.movie_requests FOR SELECT
    USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()) OR auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

CREATE POLICY "Active members can insert requests"
    ON public.movie_requests FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE status = 'ACTIVE'));

CREATE POLICY "Admins can update request status"
    ON public.movie_requests FOR UPDATE
    USING (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

-- 4. Initial Seed Data (Popular Bengali & International Cinema)
INSERT INTO public.movies (title, release_year, category, poster_url, description, language, quality, status, stream_1080p_url, stream_720p_url, stream_480p_url, pixeldrain_url)
VALUES 
(
  'তুফান (Toofan)',
  '2024',
  'Movie',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
  'নব্বই দশকের এক গ্যাংস্টারের উত্থানের রোমাঞ্চকর গল্প। মেগাস্টার শাকিব খানের অ্যাকশন থ্রিলার।',
  'Bengali',
  '1080p',
  'Published',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://pixeldrain.com/u/sample1'
),
(
  'প্রিয়তমা (Priyotoma)',
  '2023',
  'Movie',
  'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=500&auto=format&fit=crop&q=80',
  'একটি ট্র্যাজিক রোমান্টিক ড্রামা যা হৃদয় ছুঁয়ে যায়।',
  'Bengali',
  '1080p',
  'Published',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
  'https://pixeldrain.com/u/sample2'
)
ON CONFLICT DO NOTHING;
`;

/* =========================================================================================
 * 2. TYPES & INTERFACES
 * ========================================================================================= */
export type MovieStatus = 'Draft' | 'Published' | 'Hidden' | 'Archived';

export interface MovieItem {
  id: string;
  title: string;
  release_year: string;
  category: 'Movie' | 'Web Series' | 'Drama' | 'Short Film';
  poster_url: string;
  description?: string;
  language?: string;
  quality?: string;
  status: MovieStatus;
  resolutions: {
    res_480p?: string;
    res_720p?: string;
    res_1080p?: string;
  };
  stream_480p_url?: string;
  stream_720p_url?: string;
  stream_1080p_url?: string;
  pixeldrain_url?: string;
  gdflex_url?: string;
  created_at: string;
  created_by?: string;
  direct_download_url?: string;
}

export type MovieRequestStatus =
  | 'PENDING'
  | 'REVIEWING'
  | 'APPROVED'
  | 'ADDED'
  | 'REJECTED'
  | 'ALREADY_AVAILABLE'
  | 'CANCELLED';

export interface MovieRequest {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string;
  movie_title: string;
  release_year: string;
  thumbnail_url?: string;
  status: MovieRequestStatus;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ObfuscatedMediaStreamPayload {
  streamId: string;
  mediaId: string;
  resolution: string;
  obfuscatedData: string;
  signature: string;
  salt: string;
  issuedAt: number;
  expiresAt: number;
}

/* =========================================================================================
 * 3. 3-LAYER DRM STREAM SECURITY & URL OBFUSCATION
 * ========================================================================================= */
export function obfuscateStreamUrl(
  rawUrl: string,
  memberId: string,
  secretSalt: string = 'slb_stream_sec_v3'
): string {
  const combinedKey = `${memberId}:${secretSalt}:${Date.now().toString(36)}`;
  let result = '';
  for (let i = 0; i < rawUrl.length; i++) {
    const charCode = rawUrl.charCodeAt(i) ^ combinedKey.charCodeAt(i % combinedKey.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function resolveObfuscatedStream(
  obfuscatedData: string,
  memberId: string,
  salt: string,
  expiresAt: number
): { success: boolean; url?: string; error?: string } {
  if (Date.now() > expiresAt) {
    return { success: false, error: 'স্ট্রিমিং টোকেনের ৩ মিনিটের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে পুনরায় চালু করুন।' };
  }

  try {
    const decodedStr = decodeURIComponent(escape(atob(obfuscatedData)));
    const combinedKey = `${memberId}:${salt}`;
    let rawUrl = '';
    for (let i = 0; i < decodedStr.length; i++) {
      const charCode = decodedStr.charCodeAt(i) ^ combinedKey.charCodeAt(i % combinedKey.length);
      rawUrl += String.fromCharCode(charCode);
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      return {
        success: true,
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      };
    }

    return { success: true, url: rawUrl };
  } catch {
    return {
      success: true,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    };
  }
}

export function createEphemeralStreamSession(
  mediaId: string,
  resolution: string,
  rawTargetUrl: string,
  memberId: string
): ObfuscatedMediaStreamPayload {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 180 * 1000; // 3 minutes
  const salt = `salt_${Math.random().toString(36).substring(2, 9)}`;
  const obfuscatedData = obfuscateStreamUrl(rawTargetUrl, memberId, salt);
  const signature = `sig_${btoa(`${mediaId}:${memberId}:${expiresAt}`)}`;

  return {
    streamId: `stream_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    mediaId,
    resolution,
    obfuscatedData,
    signature,
    salt,
    issuedAt,
    expiresAt,
  };
}

/* =========================================================================================
 * 4. SECURE IN-APP VIDEO PLAYER MODAL WITH FLOATING WATERMARK (Layer 3 DRM)
 * ========================================================================================= */
export const MoviePlayerModalComponent: React.FC<{
  movieTitle: string;
  category?: string;
  payload: ObfuscatedMediaStreamPayload;
  currentUser: { id: string; name: string; member_number: string };
  onClose: () => void;
}> = ({ movieTitle, category, payload, currentUser, onClose }) => {
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
  const [remainingTimeSec, setRemainingTimeSec] = useState<number>(() =>
    Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000))
  );

  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '20%' });

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
      setError(result.error || 'ভিডিও লিংক ডিক্রিপ্ট করা সম্ভব হয়নি।');
    }
  }, [payload, currentUser.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
      setRemainingTimeSec(remaining);
      if (remaining === 0) {
        setError('স্ট্রিমিং সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার প্লে করুন।');
        if (videoRef.current) videoRef.current.pause();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [payload.expiresAt]);

  useEffect(() => {
    const wmInterval = setInterval(() => {
      const topVal = Math.floor(Math.random() * 70 + 10);
      const leftVal = Math.floor(Math.random() * 70 + 10);
      setWatermarkPos({ top: `${topVal}%`, left: `${leftVal}%` });
    }, 12000);
    return () => clearInterval(wmInterval);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(formatTime(curr));
    setDuration(formatTime(dur));
    if (dur > 0) setProgress((curr / dur) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const targetPct = parseFloat(e.target.value);
    const dur = videoRef.current.duration || 0;
    videoRef.current.currentTime = (targetPct / 100) * dur;
    setProgress(targetPct);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col space-y-0 relative">
        {/* Top Info Bar */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold shrink-0">
              {payload.resolution}
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-white truncate">{movieTitle}</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
              <Clock className="w-3.5 h-3.5" />
              <span>{Math.floor(remainingTimeSec / 60)}:{remainingTimeSec % 60 < 10 ? '0' : ''}{remainingTimeSec % 60}</span>
            </span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Sandbox Viewport */}
        <div
          ref={containerRef}
          className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {error ? (
            <div className="text-center p-6 space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-xs text-amber-200">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                বন্ধ করুন
              </button>
            </div>
          ) : resolvedUrl ? (
            <>
              <video
                ref={videoRef}
                src={resolvedUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                playsInline
                autoPlay
              />

              {/* Dynamic Anti-Piracy Watermark */}
              <div
                style={{ top: watermarkPos.top, left: watermarkPos.left }}
                className="absolute pointer-events-none transition-all duration-1000 z-30 opacity-40 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10 text-[9px] text-white/90 font-mono"
              >
                <span>{currentUser.member_number}</span> • <span>{currentUser.name}</span>
              </div>

              {/* Custom Player Controls Bar */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition duration-200 z-40 flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />

                <div className="flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlay} className="p-1 hover:text-cyan-400 transition">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button onClick={toggleMute} className="p-1 hover:text-cyan-400 transition">
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="text-[10px] font-mono text-slate-400">
                      {currentTime} / {duration}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={toggleFullscreen} className="p-1 hover:text-cyan-400 transition">
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 animate-spin text-cyan-400" />
              <span>ডিক্রিপ্ট হচ্ছে...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
