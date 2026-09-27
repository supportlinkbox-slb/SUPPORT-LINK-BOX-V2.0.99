import React, { useState, useEffect } from 'react';
import { Sparkles, X, Heart, Calendar, Clock, CheckCircle } from 'lucide-react';
import { FestivalThemeConfig } from '../../types/festivalTheme';

interface FestivalWelcomeModalProps {
  theme: FestivalThemeConfig;
  customGreeting?: string;
  customSubtitle?: string;
  expiresAt?: string;
}

export const FestivalWelcomeModal: React.FC<FestivalWelcomeModalProps> = ({
  theme,
  customGreeting,
  customSubtitle,
  expiresAt,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (theme.id === 'DEFAULT') return;

    // Check if user has already seen this specific theme popup recently
    const storageKey = `slb_theme_seen_${theme.id}_${theme.badge}`;
    const hasSeen = localStorage.getItem(storageKey);

    if (!hasSeen) {
      // Auto open welcome greeting on entry
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [theme.id, theme.badge]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      const storageKey = `slb_theme_seen_${theme.id}_${theme.badge}`;
      localStorage.setItem(storageKey, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || theme.id === 'DEFAULT') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-center overflow-hidden">
        {/* Animated Background Glow */}
        <div
          className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-40 pointer-events-none ${
            theme.id === 'JUMMAH'
              ? 'bg-emerald-500'
              : theme.id === 'EID_UL_FITR' || theme.id === 'EID_UL_ADHA'
              ? 'bg-amber-500'
              : theme.id === 'PAHELA_BAISHAKH'
              ? 'bg-rose-500'
              : 'bg-red-600'
          }`}
        />
        <div
          className={`absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none ${
            theme.id === 'JUMMAH' ? 'bg-teal-500' : 'bg-indigo-600'
          }`}
        />

        {/* Floating Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white transition"
          title="বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Festival Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-3 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{theme.badge}</span>
        </div>

        {/* Big Icon / Emoji */}
        <div className="text-5xl sm:text-6xl my-2 animate-bounce select-none">
          {theme.icon}
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug mt-2">
          {customGreeting || theme.greetingTitle}
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
          {customSubtitle || theme.greetingSubtitle}
        </p>

        {/* Message Card */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed text-left flex items-start gap-3 shadow-inner">
          <Heart className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-200 block mb-1">সাপোর্ট লিংক বক্স পরিবারের বার্তা:</span>
            <span>{theme.welcomeMessage}</span>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/30 transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4 stroke-[2.5]" />
            <span>ধন্যবাদ, সাইটে প্রবেশ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
