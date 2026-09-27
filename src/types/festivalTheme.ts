export type FestivalThemeType =
  | 'DEFAULT'
  | 'JUMMAH'
  | 'EID_UL_FITR'
  | 'EID_UL_ADHA'
  | 'PAHELA_BAISHAKH'
  | 'INDEPENDENCE_DAY'
  | 'VICTORY_DAY'
  | 'MOTHER_LANGUAGE_DAY';

export interface FestivalThemeConfig {
  id: FestivalThemeType;
  name: string;
  badge: string;
  greetingTitle: string;
  greetingSubtitle: string;
  welcomeMessage: string;
  icon: string; // Emoji or Lucide key
  primaryGradient: string; // Tailwind gradient classes
  accentColor: string;
  bgGlow: string;
  particleType: 'none' | 'crescent' | 'flower' | 'flag' | 'star' | 'lantern';
  bannerBg: string;
  cardBorder: string;
}

export interface ActiveThemeState {
  themeId: FestivalThemeType;
  activatedAt: string; // ISO
  durationHours: number; // e.g. 1, 6, 12, 24, 48
  expiresAt: string; // ISO
  customGreeting?: string;
  customSubtitle?: string;
  isActive: boolean;
}

export const FESTIVAL_THEMES: Record<FestivalThemeType, FestivalThemeConfig> = {
  DEFAULT: {
    id: 'DEFAULT',
    name: 'ডিফল্ট সাইবার ড্রাইভ',
    badge: 'Standard',
    greetingTitle: 'সাপোর্ট লিংক বক্সে স্বাগতম',
    greetingSubtitle: 'আজকের সাপোর্ট ও অল ডান কার্যক্রম সুষ্ঠুভাবে সম্পন্ন করুন',
    welcomeMessage: 'নিয়ম মেনে সময়মতো লিংক জমা দিন এবং পারস্পরিক সহযোগিতায় গ্রুপ এগিয়ে নিন।',
    icon: '⚡',
    primaryGradient: 'from-cyan-500 via-blue-600 to-indigo-600',
    accentColor: 'text-cyan-400',
    bgGlow: 'bg-cyan-500/10',
    particleType: 'none',
    bannerBg: 'from-slate-900 via-slate-900/90 to-cyan-950/40 border-cyan-500/30',
    cardBorder: 'border-slate-800 hover:border-cyan-500/40',
  },
  JUMMAH: {
    id: 'JUMMAH',
    name: 'জুম্মা মোবারক থিম',
    badge: 'জুম্মা স্পেশাল',
    greetingTitle: '✨ জুম্মা মোবারক ✨',
    greetingSubtitle: 'পবিত্র জুম্মার দিন আপনার ও আপনার পরিবারের উপর অফুরন্ত রহমত বর্ষিত হোক',
    welcomeMessage: 'আজকের পবিত্র জুম্মায় সবার সুস্থতা ও সফলতা কামনা করছি। সময়মতো লিংক দিন ও সাপোর্ট করুন।',
    icon: '🕌',
    primaryGradient: 'from-emerald-500 via-teal-600 to-emerald-700',
    accentColor: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/15',
    particleType: 'crescent',
    bannerBg: 'from-emerald-950/90 via-slate-900 to-teal-950/60 border-emerald-500/40',
    cardBorder: 'border-emerald-800/60 hover:border-emerald-500/60 shadow-emerald-950/30',
  },
  EID_UL_FITR: {
    id: 'EID_UL_FITR',
    name: 'ঈদ-উল-ফিতর থিম',
    badge: 'ঈদ স্পেশাল',
    greetingTitle: '🌙 ঈদ মোবারক! তাকাব্বালাল্লাহু মিন্না ওয়া মিনকুম 🌙',
    greetingSubtitle: 'পবিত্র ঈদ-উল-ফিতরের আনন্দ ছড়িয়ে পড়ুক আপনার প্রতিটি মুহূর্তে',
    welcomeMessage: 'সাপোর্ট লিংক বক্স পরিবারের পক্ষ থেকে আপনাকে ও আপনার পরিবারকে জানাই পবিত্র ঈদুল ফিতরের শুভেচ্ছা!',
    icon: '🌙',
    primaryGradient: 'from-amber-400 via-emerald-600 to-teal-700',
    accentColor: 'text-amber-300',
    bgGlow: 'bg-amber-500/15',
    particleType: 'lantern',
    bannerBg: 'from-amber-950/80 via-emerald-950/70 to-slate-900 border-amber-500/40',
    cardBorder: 'border-amber-800/60 hover:border-amber-500/60 shadow-amber-950/30',
  },
  EID_UL_ADHA: {
    id: 'EID_UL_ADHA',
    name: 'ঈদ-উল-আযহা থিম',
    badge: 'কোরবানি ঈদ',
    greetingTitle: '🐑 পবিত্র ঈদ-উল-আযহার শুভেচ্ছা ও ঈদ মোবারক 🐑',
    greetingSubtitle: 'ত্যাগের মহিমায় ভাস্বর হোক আমাদের জীবন, তৈরি হোক ঐক্যের বন্ধন',
    welcomeMessage: 'ঈদ-উল-আযহার পবিত্র ত্যাগের আনন্দ ভাগাভাগি হোক প্রতিটি প্রিয়জনের সাথে। শুভ ঈদ!',
    icon: '✨',
    primaryGradient: 'from-amber-500 via-orange-600 to-rose-700',
    accentColor: 'text-orange-400',
    bgGlow: 'bg-orange-500/15',
    particleType: 'star',
    bannerBg: 'from-orange-950/80 via-slate-900 to-amber-950/60 border-orange-500/40',
    cardBorder: 'border-orange-800/60 hover:border-orange-500/60 shadow-orange-950/30',
  },
  PAHELA_BAISHAKH: {
    id: 'PAHELA_BAISHAKH',
    name: 'পহেলা বৈশাখ (শুভ নববর্ষ)',
    badge: '১৪৩১ বৈশাখী',
    greetingTitle: '🎉 শুভ নববর্ষ! এসো হে বৈশাখ এসো এসো 🎉',
    greetingSubtitle: 'নতুন বছরে মুছে যাক সকল গ্লানি, সূচিত হোক নতুন সম্ভাবনার সোনালী সকাল',
    welcomeMessage: 'বাঙালির প্রাণের উৎসব পহেলা বৈশাখের রঙিন শুভেচ্ছা! নতুন উদ্যমে এগিয়ে চলুক আমাদের গ্রুপ।',
    icon: '🎭',
    primaryGradient: 'from-red-600 via-rose-500 to-yellow-500',
    accentColor: 'text-yellow-400',
    bgGlow: 'bg-red-500/15',
    particleType: 'flower',
    bannerBg: 'from-red-950/90 via-rose-950/70 to-yellow-950/40 border-rose-500/50',
    cardBorder: 'border-rose-800/60 hover:border-yellow-500/60 shadow-rose-950/30',
  },
  INDEPENDENCE_DAY: {
    id: 'INDEPENDENCE_DAY',
    name: 'স্বাধীনতা দিবস (২৬শে মার্চ)',
    badge: '২৬শে মার্চ',
    greetingTitle: '🇧🇩 মহান স্বাধীনতা ও জাতীয় দিবসের রক্তিম শুভেচ্ছা 🇧🇩',
    greetingSubtitle: 'শ্রদ্ধাভরে স্মরণ করি বীর শহীদদের, যাঁদের রক্তে অর্জিত স্বাধীন বাংলাদেশ',
    welcomeMessage: 'স্বাধীনতার চেতনায় ঐক্যবদ্ধ হোক আমাদের কর্ম ও সম্প্রীতি। সকল শহীদদের জানাই বিনম্র শ্রদ্ধা।',
    icon: '🇧🇩',
    primaryGradient: 'from-emerald-600 via-teal-700 to-red-600',
    accentColor: 'text-red-400',
    bgGlow: 'bg-emerald-500/15',
    particleType: 'flag',
    bannerBg: 'from-emerald-950/90 via-slate-900 to-red-950/50 border-emerald-500/40',
    cardBorder: 'border-emerald-800/60 hover:border-red-500/60 shadow-emerald-950/30',
  },
  VICTORY_DAY: {
    id: 'VICTORY_DAY',
    name: 'বিজয় দিবস (১৬ই ডিসেম্বর)',
    badge: '১৬ই ডিসেম্বর',
    greetingTitle: '🇧🇩 শুভ মহান বিজয় দিবস! বিজয়ের উল্লাস চিরন্তন 🇧🇩',
    greetingSubtitle: 'বীর সন্তানদের ত্যাগের স্মৃতি চির অম্লান, লাল সবুজের পতাকায় মাথা উঁচু হোক',
    welcomeMessage: '১৬ই ডিসেম্বরের রক্তিম বিজয় শুভেচ্ছা! শ্রদ্ধা ও ভালোবাসায় সিক্ত আমাদের প্রিয় মাতৃভূমি।',
    icon: '🎖️',
    primaryGradient: 'from-emerald-700 via-emerald-600 to-red-600',
    accentColor: 'text-emerald-400',
    bgGlow: 'bg-red-500/15',
    particleType: 'flag',
    bannerBg: 'from-emerald-950/90 via-red-950/60 to-slate-900 border-red-500/50',
    cardBorder: 'border-emerald-800/60 hover:border-red-500/60 shadow-red-950/30',
  },
  MOTHER_LANGUAGE_DAY: {
    id: 'MOTHER_LANGUAGE_DAY',
    name: 'আন্তর্জাতিক মাতৃভাষা দিবস (২১শে ফেব্রুয়ারি)',
    badge: '২১শে ফেব্রুয়ারি',
    greetingTitle: '🖤 রক্তে রাঙানো একুশে ফেব্রুয়ারি, আমি কি ভুলিতে পারি 🖤',
    greetingSubtitle: 'ভাষার জন্য জীবন দেওয়া বীর ভাষা শহীদদের প্রতি আমাদের সশ্রদ্ধ সালাম ও ভালোবাসা',
    welcomeMessage: 'আন্তর্জাতিক মাতৃভাষা দিবসে সালাম বরকত রফিক জব্বারসহ সকল ভাষা শহীদদের বিনম্র শ্রদ্ধা।',
    icon: '🥀',
    primaryGradient: 'from-slate-700 via-slate-800 to-red-900',
    accentColor: 'text-rose-400',
    bgGlow: 'bg-rose-500/15',
    particleType: 'flower',
    bannerBg: 'from-slate-950 via-red-950/40 to-slate-900 border-rose-500/30',
    cardBorder: 'border-slate-700/80 hover:border-rose-500/60 shadow-slate-950/50',
  },
};
