import React from 'react';
import {
  Link as LinkIcon,
  Flame,
  Award,
  Plus,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Film,
  ChevronRight,
  UserCheck,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { AdSlot } from '../common/AdSlot';

interface HomeDashboardViewProps {
  onOpenSubmitModal: () => void;
  onNavigateTab: (tab: string) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  onOpenSubmitModal,
  onNavigateTab,
}) => {
  const {
    currentUser,
    dailyLinks,
    todayDate,
    reports,
    activePenalty,
    pendingRequiredSupportCount,
    isAllDoneSubmittedToday,
    isLinkSupported,
    currentThemeConfig,
    activeFestivalTheme,
  } = useApp();

  const isFestival = currentThemeConfig.id !== 'DEFAULT';

  if (!currentUser) return null;

  // 1. User's today link
  const myTodayLink = dailyLinks.find(
    (l) => l.owner_id === currentUser.id && l.date === todayDate && (l.status ?? 'active') === 'active'
  );

  // 2. Today's total links submitted in the community
  const todaysTotalLinksCount = dailyLinks.filter(
    (l) => l.date === todayDate && (l.status ?? 'active') === 'active'
  ).length;

  // 3. Number of links supported by current user today
  const mySupportedLinksCount = dailyLinks.filter(
    (l) => l.date === todayDate && (l.status ?? 'active') === 'active' && isLinkSupported(l.id)
  ).length;

  // 4. Click/Support count received on current user's link today
  const myLinkReceivedSupportsCount = myTodayLink ? (myTodayLink.total_supports_count || 0) : 0;

  // 5. Check if reports filed against user's links
  const reportsAgainstMyLinks = reports.filter(
    (r) => r.link_owner_id === currentUser.id && r.status === 'PENDING'
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-6">
      {/* 🚀 TOP HEADER SPONSOR BANNER (Clean Empty Space) */}
      <AdSlot />

      {/* ========================================== */}
      {/* ⚠️ TOP CRITICAL ALERTS SECTION */}
      {/* ========================================== */}

      {/* Alert 1: Reports Filed Against User's Link */}
      {reportsAgainstMyLinks.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/90 via-red-900/80 to-slate-900 border-2 border-red-500/80 rounded-2xl p-4 shadow-2xl shadow-red-500/10 space-y-3 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>আপনার জমা লিংকে রিপোর্ট এসেছে!</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500 text-white font-mono font-bold">
                    {reportsAgainstMyLinks.length} টি পেন্ডিং
                  </span>
                </h3>
                <p className="text-xs text-red-200 mt-0.5">
                  অন্য সদস্য আপনার জমা লিংকে কমেন্ট বা পোস্ট সংক্রান্ত অভিযোগ করেছেন। অনুগ্রহ করে দ্রুত রিভিউ করুন।
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('reports')}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition shrink-0 flex items-center gap-1"
            >
              <span>রিপোর্ট দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-red-500/30">
            {reportsAgainstMyLinks.map((rep) => (
              <div
                key={rep.id}
                className="bg-red-950/60 p-2.5 rounded-xl border border-red-800/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400 font-bold">#{rep.link_serial}</span>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium text-[10px]">
                    {rep.category}
                  </span>
                  <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">{rep.description}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{formatToBDT(rep.created_at, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert 2: Active Admin Action / Special Support Duty Penalty */}
      {activePenalty && (
        <div className="bg-gradient-to-r from-amber-950/90 via-purple-950/80 to-slate-900 border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl shadow-amber-500/10 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500 text-slate-950 font-black uppercase">
                    ADMIN ACTION ACTIVE
                  </span>
                  <h3 className="text-sm font-bold text-white">বিশেষ সাপোর্ট ডিউটি (Special Support Duty)</h3>
                </div>
                <p className="text-xs text-amber-200 mt-1">
                  কারণ: <span className="font-semibold text-white">{activePenalty.reason}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('support')}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1 shadow-md shadow-amber-500/20"
            >
              <span>ডিউটি সম্পন্ন করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 🎊 FESTIVAL & SPECIAL DAY THEME CELEBRATION BANNER */}
      {/* ========================================== */}
      {isFestival && (
        <div className={`p-5 sm:p-6 rounded-3xl bg-gradient-to-r ${currentThemeConfig.bannerBg} border-2 shadow-2xl relative overflow-hidden transition-all duration-500 animate-fadeIn`}>
          <div className="absolute -right-8 -bottom-8 text-8xl opacity-15 select-none pointer-events-none animate-pulse">
            {currentThemeConfig.icon}
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl sm:text-5xl select-none animate-bounce shrink-0">
                {currentThemeConfig.icon}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/10 text-white border border-white/20 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>{currentThemeConfig.badge}</span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight leading-snug">
                  {activeFestivalTheme.customGreeting || currentThemeConfig.greetingTitle}
                </h2>
                <p className="text-xs text-slate-200 mt-1 max-w-xl leading-relaxed">
                  {activeFestivalTheme.customSubtitle || currentThemeConfig.greetingSubtitle}
                </p>
              </div>
            </div>
            {activeFestivalTheme.expiresAt && (
              <div className="shrink-0 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-slate-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>লাইভ থিম সক্রিয়</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 👤 WELCOME / PROFILE HEADER */}
      {/* ========================================== */}
      <div className={`bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
        isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80'
      }`}>
        <div className={`absolute -right-10 -top-10 w-48 h-48 rounded-full blur-2xl pointer-events-none ${
          isFestival ? currentThemeConfig.bgGlow : 'bg-cyan-500/10'
        }`} />
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <img
              src={currentUser.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser.name}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 shadow-md shrink-0 ${
                isFestival ? 'border-amber-400/80 shadow-amber-500/20' : 'border-cyan-500/50 shadow-cyan-500/20'
              }`}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-white">{currentUser.name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {currentUser.member_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {currentUser.status}
                </span>
                {isFestival && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {currentThemeConfig.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>আজকের তারিখ: <strong className="text-cyan-400 font-mono">{todayDate}</strong></span>
                <span>•</span>
                <span>মোট পয়েন্ট: <strong className="text-amber-400">{currentUser.points || 0} Pts</strong></span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🚀 PRIMARY ACTION BUTTONS BAR */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onNavigateTab('support')}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 active:scale-[0.99]"
        >
          <Flame className="w-5 h-5 fill-slate-950 text-slate-950 animate-pulse" />
          <span>সাপোর্ট সেসন শুরু করুন</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSubmitModal}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-cyan-500/20 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 active:scale-[0.99]"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>{myTodayLink ? 'নতুন লিংক সাবমিট করুন' : 'আজকের লিংক জমা দিন'}</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* 📊 COMPACT MOBILE GRID STAT CARDS (2x2 / 2x3) */}
      {/* ========================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* CARD 1: আপনার আজকের লিংক নাম্বার */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-cyan-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              আজকের লিংক
            </span>
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
              isFestival ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}>
              <LinkIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            {myTodayLink ? (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tracking-tight">
                    {myTodayLink.serial_display}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    P{myTodayLink.part_number}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-1">
                  ধরন: <strong className="text-white">{myTodayLink.post_type}</strong>
                </p>
              </div>
            ) : (
              <div>
                <div className="text-sm sm:text-base font-bold text-slate-400">জমা দেওয়া হয়নি</div>
                <p className="text-[10px] text-slate-500 mt-0.5">বিকাল ৪:৫০ পর্যন্ত সুযোগ</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">আমার স্লট</span>
            <span className="text-cyan-400 font-bold font-mono">
              {myTodayLink ? `Part ${myTodayLink.part_number}` : 'No Link'}
            </span>
          </div>
        </div>

        {/* CARD 2: আজকের মোট জমা লিংক */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-purple-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              মোট জমা লিংক
            </span>
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
              isFestival ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {todaysTotalLinksCount} <span className="text-xs font-normal text-slate-400">টি</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">আজকের মোট কমিউনিটি পোস্ট</p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">বাকি লিংক</span>
            <span className="text-amber-400 font-bold font-mono">
              {pendingRequiredSupportCount} টি সাপোর্ট বাকি
            </span>
          </div>
        </div>

        {/* CARD 3: আমার সম্পন্ন সাপোর্ট */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-emerald-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              আমার সাপোর্ট
            </span>
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
              isFestival ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {mySupportedLinksCount} <span className="text-xs font-normal text-slate-400">টি</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">আজকে সফলভাবে সম্পন্ন</p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">স্ট্যাটাস</span>
            <span className={pendingRequiredSupportCount === 0 && todaysTotalLinksCount > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {pendingRequiredSupportCount === 0 && todaysTotalLinksCount > 0 ? "সব সম্পন্ন ✓" : "চলমান..."}
            </span>
          </div>
        </div>

        {/* CARD 4: আমার লিংকে আসা সাপোর্ট */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-blue-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              প্রাপ্ত সাপোর্ট
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono tracking-tight">
              {myLinkReceivedSupportsCount} <span className="text-xs font-normal text-slate-400">ক্লিক</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">আপনার লিংকে সাপোর্ট পড়েছে</p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">লিংক পজিশন</span>
            <span className="text-blue-400 font-bold font-mono">
              {myTodayLink ? `Serial #${myTodayLink.serial_display}` : 'N/A'}
            </span>
          </div>
        </div>

        {/* CARD 5: All Done স্ট্যাটাস */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-amber-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              All Done স্ট্যাটাস
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            {isAllDoneSubmittedToday ? (
              <div>
                <div className="text-sm sm:text-base font-black text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>জমা সম্পন্ন</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">পয়েন্ট যুক্ত হয়েছে</p>
              </div>
            ) : (
              <div>
                <div className="text-sm sm:text-base font-black text-amber-400">পেন্ডিং</div>
                <p className="text-[10px] text-slate-400 mt-0.5">সব সাপোর্ট শেষে জমা দিন</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">সময়সীমা</span>
            <span className="text-slate-300 font-mono">বিকাল ৫:০০ - রাত ১১:৫৯</span>
          </div>
        </div>

        {/* CARD 6: একাউন্ট পয়েন্ট ও র‍্যাংক */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 transition shadow-lg flex flex-col justify-between aspect-square relative overflow-hidden group hover:scale-[1.02] duration-300 ${
          isFestival ? currentThemeConfig.cardBorder : 'border-slate-800/80 hover:border-cyan-500/40'
        }`}>
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-tight">
              মোট পয়েন্ট
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto">
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
              {currentUser.points || 0} <span className="text-xs font-normal text-slate-400">Pts</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">কমিউনিটি এক্টিভিটি পয়েন্ট</p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">রোলের ধরন</span>
            <span className="text-cyan-400 font-bold">{currentUser.role}</span>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🚀 QUICK NAVIGATION TILES */}
      {/* ========================================== */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          কুইক অ্যাক্সেস মেনু
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onNavigateTab('links')}
            className="p-3 sm:p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition shrink-0">
              <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition">Today's Links</div>
              <div className="text-[10px] text-slate-400">সকল সাপোর্ট লিংক তালিকা</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('alldone')}
            className="p-3 sm:p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">All Done Box</div>
              <div className="text-[10px] text-slate-400">সাপোর্ট শেষে অল ডান জমা দিন</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('movies')}
            className="p-3 sm:p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition shrink-0">
              <Film className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-purple-400 transition">Movie Lover Zone</div>
              <div className="text-[10px] text-slate-400">মুভি দেখুন ও রিকোয়েস্ট করুন</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('leaderboard')}
            className="p-3 sm:p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition shrink-0">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition">Leaderboard</div>
              <div className="text-[10px] text-slate-400">র‍্যাঙ্কিং ও পয়েন্ট দেখুন</div>
            </div>
          </button>
        </div>
      </div>

      {/* 💰 BOTTOM FOOTER SPONSOR BANNER (Empty Space) */}
      <AdSlot />
    </div>
  );
};
