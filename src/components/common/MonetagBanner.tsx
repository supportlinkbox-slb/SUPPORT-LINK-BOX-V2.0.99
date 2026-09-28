import React, { useState, useEffect } from 'react';
import { ExternalLink, Sparkles, ShieldCheck, Gift, Zap, Star, Flame } from 'lucide-react';
import { triggerMonetagDirectLink } from '../../utils/monetag';

interface MonetagBannerProps {
  placement?: 
    | 'top-header'
    | 'home-banner'
    | 'bottom-footer'
    | 'links-inline'
    | 'session-top'
    | 'session-inline'
    | 'session-bottom'
    | 'alldone-footer'
    | 'movies-header'
    | 'movies-inline';
  className?: string;
}

const AD_CREATIVES = [
  {
    title: '✨ এক্সক্লুসিভ পার্টনার অফার ও ডেইলি বোনাস',
    desc: 'সাপোর্ট লিংক বক্স প্ল্যাটফর্মকে ফ্রি রাখতে আমাদের স্পনসর ভিজিট করুন',
    badge: 'Special Sponsor',
    cta: 'ভিজিট করুন',
    icon: Sparkles,
    gradient: 'from-blue-600 to-indigo-600',
  },
  {
    title: '🎁 ইনস্ট্যান্ট রিওয়ার্ডস ও ক্যাশব্যাক ডিলস',
    desc: 'আমাদের ভেরিফাইড অফার পার্টনারদের সাথে যুক্ত হয়ে এক্সক্লুসিভ গিফট পান',
    badge: 'Hot Deal',
    cta: 'অফার দেখুন',
    icon: Gift,
    gradient: 'from-purple-600 to-pink-600',
  },
  {
    title: '⚡ আল্ট্রা ফাস্ট টেক ডিলস ও সুপার ডিসকাউন্ট',
    desc: 'মেম্বারদের জন্য বিশেষ সুবিধা এবং ব্র্যান্ড পার্টনারশিপ ক্যাম্পেইন',
    badge: 'Featured',
    cta: 'ক্লাইম করুন',
    icon: Zap,
    gradient: 'from-amber-600 to-orange-600',
  },
  {
    title: '🎬 প্রিমিয়াম এন্টারটেইনমেন্ট ও ওটিটি রিওয়ার্ড',
    desc: 'হাই স্পিড ব্রাউজিং এবং ট্রেন্ডিং মুভি অফার এক্সপ্লোর করুন',
    badge: 'Recommended',
    cta: 'উপভোগ করুন',
    icon: Star,
    gradient: 'from-emerald-600 to-teal-600',
  },
];

export const MonetagBanner: React.FC<MonetagBannerProps> = ({
  placement = 'home-banner',
  className = '',
}) => {
  // Rotate creatives when user returns from background / external support action
  const [creativeIndex, setCreativeIndex] = useState(() => Math.floor(Math.random() * AD_CREATIVES.length));

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh ad creative automatically when returning to tab
        setCreativeIndex((prev) => (prev + 1) % AD_CREATIVES.length);
      }
    };

    const handleFocus = () => {
      setCreativeIndex((prev) => (prev + 1) % AD_CREATIVES.length);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const creative = AD_CREATIVES[creativeIndex];
  const IconComponent = creative.icon;

  // 1. Ultra Clean Top Header Banner
  if (placement === 'top-header') {
    return (
      <div
        onClick={() => triggerMonetagDirectLink()}
        className={`w-full group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-500/30 hover:border-indigo-400 p-3 shadow-md transition-all duration-300 flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:scale-105 transition">
            <IconComponent className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                {creative.badge}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                Verified
              </span>
            </div>
            <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition truncate">
              {creative.title}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600/30 group-hover:bg-indigo-600 border border-indigo-500/40 text-indigo-200 group-hover:text-white text-[11px] font-bold transition">
          <span>{creative.cta}</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    );
  }

  // 2. Compact Inline Cards (Between Links or Between Support List Items)
  if (placement === 'links-inline' || placement === 'session-inline' || placement === 'movies-inline') {
    return (
      <div
        onClick={() => triggerMonetagDirectLink()}
        className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-indigo-500/40 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 p-4 shadow-md hover:border-indigo-400 hover:shadow-indigo-500/10 flex flex-col justify-between ${className}`}
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${creative.gradient} text-white font-mono font-black text-xs flex flex-col items-center justify-center shadow-md leading-tight`}>
                <IconComponent className="w-4 h-4 text-white" />
                <span className="text-[8px] text-white/80">SPONSOR</span>
              </span>
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  স্পন্সরড পার্টনার ডিল
                </span>
                <span className="text-[10px] text-slate-400 block">কমিউনিটি স্পন্সরশিপ</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {creative.badge}
            </span>
          </div>

          <p className="text-xs text-slate-300 line-clamp-2 my-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
            {creative.title} — {creative.desc}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Partner</span>
          </span>

          <div className={`px-3.5 py-1.5 rounded-xl bg-gradient-to-r ${creative.gradient} group-hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm`}>
            <span>{creative.cta}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Wide Standard Banner (Home Banner, Support Session Top/Bottom, Movies Header, Footer)
  return (
    <div
      onClick={() => triggerMonetagDirectLink()}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-slate-800/80 bg-gradient-to-r from-slate-900/95 via-indigo-950/40 to-slate-900/95 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 p-4 sm:p-5 ${className}`}
    >
      {/* Background Glow Effect */}
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

      <div className="flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition shrink-0">
            <IconComponent className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {creative.badge}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition mt-0.5 line-clamp-1">
              {placement === 'movies-header'
                ? '🎬 এক্সক্লুসিভ প্রিমিয়াম সিনেমা ও রিওয়ার্ডস দেখুন'
                : creative.title}
            </h4>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              {creative.desc}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/20 group-hover:bg-indigo-600 border border-indigo-500/30 group-hover:border-indigo-500 text-indigo-300 group-hover:text-white text-xs font-semibold transition">
          <span className="hidden sm:inline">{creative.cta}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
