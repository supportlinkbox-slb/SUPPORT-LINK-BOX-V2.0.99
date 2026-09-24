import React from 'react';
import {
  Link as LinkIcon,
  Flame,
  Award,
  Plus,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Film,
  MessageSquare,
  ChevronRight,
  UserCheck,
  AlertOctagon,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';

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
    submissionStatus,
    isLinkSupported,
  } = useApp();

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

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEVELOPER';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ========================================== */}
      {/* ⚠️ TOP CRITICAL ALERTS / ADMIN ACTIONS SECTION */}
      {/* ========================================== */}

      {/* Alert 1: Reports Filed Against User's Link */}
      {reportsAgainstMyLinks.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/90 via-red-900/80 to-slate-900 border-2 border-red-500/80 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-red-500/10 space-y-3 animate-pulse">
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
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 pt-1 border-t border-red-800/60">
            {reportsAgainstMyLinks.slice(0, 2).map((rep) => (
              <div key={rep.id} className="bg-slate-950/80 rounded-xl p-2.5 text-xs flex items-center justify-between text-slate-200">
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
        <div className="bg-gradient-to-r from-amber-950/90 via-purple-950/80 to-slate-900 border-2 border-amber-500/80 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-amber-500/10 space-y-3">
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

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser.name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/50 shadow-md shadow-cyan-500/20 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">স্বাগতম, {currentUser.name}!</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {currentUser.member_number}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {currentUser.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>আজকের তারিখ (BDT): <strong className="text-cyan-400 font-mono">{todayDate}</strong></span>
                <span>•</span>
                <span>মোট পয়েন্ট: <strong className="text-amber-400">{currentUser.points || 0} Pts</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('support')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5"
            >
              <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>সাপোর্ট সেসন শুরু করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 📊 REAL-TIME MEMBER LIVE DASHBOARD CARDS */}
      {/* ========================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: 1* তার ঐদিনের লিংক নাম্বার */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 transition shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">১. আপনার আজকের লিংক নাম্বার</span>
              {myTodayLink ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-cyan-400 font-mono tracking-tight">
                      {myTodayLink.serial_display}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Part {myTodayLink.part_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate max-w-[200px]">
                    পোস্ট ধরন: <strong className="text-white">{myTodayLink.post_type}</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-base font-bold text-slate-400">আজ কোনো লিংক জমা দেননি</div>
                  <p className="text-[11px] text-slate-500">বিকাল ৪:৫০ পর্যন্ত লিংক জমা দিতে পারবেন।</p>
                </div>
              )}
            </div>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <LinkIcon className="w-6 h-6" />
            </div>
          </div>

          {/* Pending support status from previous days */}
          {pendingRequiredSupportCount > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>পূর্বের সাপোর্ট বাকি আছে!</span>
            </div>
          )}

          {!myTodayLink && (
            <button
              onClick={onOpenSubmitModal}
              className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>এখনই লিংক জমা দিন</span>
            </button>
          )}
        </div>

        {/* CARD 2: 2* ঐদিন ঐ পর্যন্ত কতটি লিংক সাবমিট হয়েছে */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">২. আজকে মোট জমা পড়া লিংক</span>
              <div className="text-3xl font-black text-white font-mono">
                {todaysTotalLinksCount} <span className="text-sm font-sans font-normal text-slate-400">টি</span>
              </div>
              <p className="text-xs text-slate-400">বাংলাদেশ কমিউনিটি সাপোর্ট প্রসেসে সক্রিয়।</p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>লাইভ আপডেট গণনা চলছে</span>
          </div>
        </div>

        {/* CARD 3: 3* সে কত লিংকে সাপোর্ট করেছে ঐদিন */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">৩. আপনার প্রদানকৃত সাপোর্ট</span>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {mySupportedLinksCount} <span className="text-sm font-sans font-normal text-slate-400">টি</span>
              </div>
              <p className="text-xs text-slate-400">আজ আপনি যতগুলো লিংক রিয়েক্ট/কমেন্ট করেছেন।</p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 pt-2 border-t border-slate-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>সাপোর্ট পয়েন্ট অর্জন নিশ্চিত</span>
          </div>
        </div>

        {/* CARD 4: 4* ঐদিন তার কত লিংকে সাপোর্ট বাকি আছে */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">৪. আপনার অল ডান পর্যন্ত বাকি সাপোর্ট</span>
              <div className="text-3xl font-black text-amber-400 font-mono">
                {pendingRequiredSupportCount} <span className="text-sm font-sans font-normal text-slate-400">টি</span>
              </div>
              <p className="text-xs text-slate-400">অল ডান দিতে এই লিংকগুলোতে সাপোর্ট বাধ্যতামূলক।</p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('support')}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
          >
            <span>সাপোর্ট সেসনে যান</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* CARD 5: 5* ঐ দিন তার লিংকে কতজন সাপোর্ট করেছে (ক্লিক কাউন্ট) */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">৫. আপনার লিংকে রিসিভড সাপোর্ট</span>
              <div className="text-3xl font-black text-purple-400 font-mono">
                {myLinkReceivedSupportsCount} <span className="text-sm font-sans font-normal text-slate-400">জন</span>
              </div>
              <p className="text-xs text-slate-400">আজ আপনার লিংকে যতজন মেম্বার সাপোর্ট দিয়েছেন।</p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="text-[11px] text-purple-300 font-bold flex items-center gap-1 pt-2 border-t border-slate-800">
            <Eye className="w-3.5 h-3.5" />
            <span>রিয়েল-টাইম রিসিভড ক্লিক কাউন্ট</span>
          </div>
        </div>

        {/* BONUS CARD: অল ডান ও মোট পয়েন্ট */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">অল ডান স্ট্যাটাস</span>
              <div className="text-2xl font-black text-white">
                {isAllDoneSubmittedToday ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 text-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>আজকের অল ডান সম্পন্ন</span>
                  </span>
                ) : (
                  <span className="text-amber-400 text-lg">পেন্ডিং (বিকাল ৫:০০ থেকে)</span>
                )}
              </div>
              <p className="text-xs text-slate-400">বিকেল ৫:০০ টার পর অল ডান বক্স খুলে যায়।</p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('alldone')}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>All Done সেকশনে যান</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🚀 QUICK NAVIGATION HUB */}
      {/* ========================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>দ্রুত নেভিগেশন সেকশনস (Quick Access Hub)</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('support')}
            className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">Support Session</div>
              <div className="text-[10px] text-slate-400">সব লিংক ওপেন ও সাপোর্ট করুন</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('alldone')}
            className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">All Done Box</div>
              <div className="text-[10px] text-slate-400">সাপোর্ট শেষে অল ডান জমা দিন</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('movies')}
            className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-purple-400 transition">Movie Lover Zone</div>
              <div className="text-[10px] text-slate-400">মুভি দেখুন ও রিকোয়েস্ট করুন</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('leaderboard')}
            className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl transition text-left space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition">Leaderboard</div>
              <div className="text-[10px] text-slate-400">র‍্যাঙ্কিং ও পয়েন্ট দেখুন</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
