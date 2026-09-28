import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { triggerMonetagDirectLink } from '../../utils/monetag';

interface MonetagBannerProps {
  placement?: 'home-banner' | 'links-bottom' | 'alldone-footer' | 'movies-header';
  className?: string;
}

export const MonetagBanner: React.FC<MonetagBannerProps> = ({
  placement = 'home-banner',
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => triggerMonetagDirectLink()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 p-4 sm:p-5 ${className}`}
    >
      {/* Background Glow Effect */}
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

      <div className="flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Sponsored Sponsor
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition mt-0.5 line-clamp-1">
              {placement === 'movies-header'
                ? '🎬 এক্সক্লুসিভ প্রিমিয়াম অফার ও রিওয়ার্ডস দেখুন'
                : '✨ স্পনসরড ডিলস ও ডেইলি বোনাস রিওয়ার্ড প্ল্যাটফর্ম'}
            </h4>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              সাপোর্ট লিংক বক্স প্ল্যাটফর্মকে ফ্রি রাখতে আমাদের স্পনসর ভিজিট করুন
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 group-hover:bg-indigo-600 border border-indigo-500/30 group-hover:border-indigo-500 text-indigo-300 group-hover:text-white text-xs font-semibold transition">
          <span className="hidden sm:inline">ভিজিট করুন</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
