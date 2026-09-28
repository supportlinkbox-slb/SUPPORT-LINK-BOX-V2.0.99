import React, { useEffect, useRef } from 'react';
import { Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
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
  zoneId?: string | number;
}

export const MonetagBanner: React.FC<MonetagBannerProps> = ({
  placement = 'home-banner',
  className = '',
  zoneId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // When a direct script zone is provided, mount Monetag script container safely
  useEffect(() => {
    if (!zoneId || !containerRef.current) return;

    try {
      const container = containerRef.current;
      container.innerHTML = '';
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = `https://quge5.com/88/tag.min.js`;
      script.dataset.zone = String(zoneId);
      container.appendChild(script);
    } catch (e) {
      console.warn('Monetag container mount notice:', e);
    }
  }, [zoneId]);

  // 1. Clean Top Header Banner
  if (placement === 'top-header') {
    return (
      <div
        onClick={() => triggerMonetagDirectLink()}
        className={`w-full group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 p-3 shadow-md transition-all duration-300 flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:scale-105 transition">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                Monetag Sponsor
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                Verified Network
              </span>
            </div>
            <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate">
              🎯 Monetag High CPM Sponsor Deals — প্ল্যাটফর্মকে ফ্রি রাখতে ভিজিট করুন
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-[11px] transition shadow">
          <span>Ad দেখুন</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    );
  }

  // 2. Compact Inline Cards (Between Links or Between Movies)
  if (placement === 'links-inline' || placement === 'session-inline' || placement === 'movies-inline') {
    return (
      <div
        onClick={() => triggerMonetagDirectLink()}
        className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-indigo-500/40 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-4 shadow-md hover:border-indigo-400 hover:shadow-indigo-500/10 flex flex-col justify-between ${className}`}
      >
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950 font-mono font-black text-xs flex flex-col items-center justify-center shadow-md leading-tight">
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span className="text-[8px] font-bold">ADS</span>
              </span>
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  Monetag Ads Network
                </span>
                <span className="text-[10px] text-slate-400 block">স্পন্সরড পার্টনারশিপ</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              High CPM Ad
            </span>
          </div>

          <p className="text-xs text-slate-200 line-clamp-2 my-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            🔥 Monetag রিয়েল স্পন্সরড ডিল এবং এক্সক্লুসিভ রিওয়ার্ড ক্যাম্পেইন ভিজিট করুন।
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Monetag Network</span>
          </span>

          <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black flex items-center gap-1.5 transition shadow-sm">
            <span>ক্লিক করুন</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Wide Standard Banner (Home, Footer, Session Top/Bottom)
  return (
    <div
      onClick={() => triggerMonetagDirectLink()}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-slate-800/90 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 p-4 sm:p-5 ${className}`}
    >
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

      {zoneId && <div ref={containerRef} className="monetag-dynamic-container mb-2" />}

      <div className="flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Official Monetag Ad
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified Monetization
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition mt-0.5 line-clamp-1">
              ✨ Monetag স্পন্সরড নেটওয়ার্ক ও ডেইলি রিওয়ার্ড অফার
            </h4>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              সাপোর্ট লিংক বক্স প্ল্যাটফর্মকে চালু রাখতে আমাদের অফিশিয়াল Monetag বিজ্ঞাপন ভিজিট করুন
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black transition shadow-md">
          <span className="hidden sm:inline">Ad দেখুন</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
