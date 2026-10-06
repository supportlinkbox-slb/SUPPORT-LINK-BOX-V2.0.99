import React from 'react';
import {
  CheckCircle2,
  Trophy,
  Award,
  Sparkles,
  Clock,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { DailyAllDoneBox } from './DailyAllDoneBox';
import { AdSlot } from '../common/AdSlot';

interface AllDoneSectionProps {
  onGoToSupportSession?: () => void;
}

export const AllDoneSection: React.FC<AllDoneSectionProps> = ({ onGoToSupportSession }) => {
  const {
    currentUser,
    allDoneStatus,
    pendingRequiredSupportCount,
    isAllDoneSubmittedToday,
    userAllDoneRecord,
    allDoneRecords,
    todayDate,
    systemConfig, // SLB-FIX-H16
  } = useApp();

  const todaysAllDoneCount = allDoneRecords.filter((r) => r.date === todayDate).length;
  const isSupportComplete = pendingRequiredSupportCount === 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner & Status Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 font-mono text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                বিকাল ৫:০০ - রাত ১২:০০ টা BDT
              </span>
              <span className="text-xs text-slate-400 font-mono">
                আজকের অল ডান: <span className="text-white font-bold">{todaysAllDoneCount} জন</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Official All Done Verification
            </h1>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              আজকের নির্ধারিত সকল লিংকে সাপোর্ট সম্পন্ন করার পর Support Session / Link Box এর ভেতর থেকে All Done নিশ্চিত করে পয়েন্ট ও বোনাস অর্জন করুন।
            </p>
          </div>

          {/* Fastest Bonuses Table Overview */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shrink-0 w-full md:w-64 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Fastest Support Bonuses</span>
            </div>
            {/* SLB-FIX-H16-banner: values from systemConfig (server-configured); server awards ranks 1-5 only */}
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between text-amber-300">
                <span>🥇 1st Fastest</span>
                <span>+{systemConfig.points_fastest_top1 ?? 10} Pts</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>🥈 2nd Fastest</span>
                <span>+{systemConfig.points_fastest_top2 ?? 8} Pts</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>🥉 3rd Fastest</span>
                <span>+{systemConfig.points_fastest_top3 ?? 6} Pts</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>4th Fastest</span>
                <span>+{systemConfig.points_fastest_top4 ?? 4} Pts</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>5th Fastest</span>
                <span>+{systemConfig.points_fastest_top5 ?? 2} Pts</span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                <span>Standard Completion</span>
                <span>+{systemConfig.points_all_done ?? 5} Pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Status Notification */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>আপনার All Done ভেরিফিকেশন স্ট্যাটাস</span>
        </h2>

        <div>
          {isAllDoneSubmittedToday && userAllDoneRecord ? (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-5 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-lg font-black text-white">আজকের All Done সম্পন্ন হয়েছে!</div>
              <p className="text-xs text-slate-300 font-mono">
                সাবমিশন টাইম: {formatToBDT(userAllDoneRecord.completed_at, true)}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {userAllDoneRecord.fastest_rank ? (
                  <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow">
                    🏆 Rank #{userAllDoneRecord.fastest_rank} Fastest
                  </span>
                ) : null}
                <span className="bg-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1 rounded-full border border-emerald-500/30">
                  +{userAllDoneRecord.total_points} Points
                </span>
              </div>
            </div>
          ) : !isSupportComplete ? (
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-1">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="text-base font-bold text-white">সাপোর্ট অপূর্ণ রয়েছে</div>
              <p className="text-xs text-amber-200">
                All Done জমা দেওয়ার জন্য আজকের সকল নির্ধারিত লিংকে সাপোর্ট সম্পন্ন করতে হবে। এখনো{' '}
                <strong className="text-white font-mono">{pendingRequiredSupportCount}</strong> টি সাপোর্ট বাকি রয়েছে।
              </p>
              {onGoToSupportSession && (
                <div className="pt-2">
                  <button
                    onClick={onGoToSupportSession}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5 mx-auto"
                  >
                    <Flame className="w-4 h-4 fill-slate-950" />
                    <span>সাপোর্ট সেশনে যান</span>
                  </button>
                </div>
              )}
            </div>
          ) : !allDoneStatus.isOpen ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-1">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-base font-bold text-white">All Done উইন্ডো এখনো চালু হয়নি</div>
              <p className="text-xs text-slate-400">
                আপনার সকল সাপোর্ট সম্পন্ন হয়েছে! প্রতিদিন বিকাল ৫:০০ টা (BDT) থেকে All Done বক্স উন্মুক্ত হবে।
              </p>
            </div>
          ) : (
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-white">All Done সাবমিশনের জন্য প্রস্তুত!</div>
              <p className="text-xs text-emerald-200 leading-relaxed">
                আপনার সকল সাপোর্ট সম্পন্ন এবং All Done উইন্ডো চালু রয়েছে। অনুগ্রহ করে Support Session / Link Box এ গিয়ে All Done নিশ্চিত করুন।
              </p>
              {onGoToSupportSession && (
                <div className="pt-2">
                  <button
                    onClick={onGoToSupportSession}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 mx-auto transform hover:scale-105"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-slate-950" />
                    <span>সাপোর্ট সেশনে All Done সাবমিট করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's All Done Box Live List */}
      <DailyAllDoneBox />

      {/* 💰 SPONSORED BANNER */}
      <AdSlot />
    </div>
  );
};
