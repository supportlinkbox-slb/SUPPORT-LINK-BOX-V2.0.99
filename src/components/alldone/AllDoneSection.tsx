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
          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shrink-0 w-full md:w-64">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
              <Trophy className="w-4 h-4" />
              <span>দ্রুততম ৫ জনের বোনাস পয়েন্ট:</span>
            </div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-amber-300">
                <span>🥇 ১ম জন:</span>
                <span className="font-bold">+১০ বোনাস (১৫ মোট)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>🥈 ২য় জন:</span>
                <span className="font-bold">+৮ বোনাস (১৩ মোট)</span>
              </div>
              <div className="flex justify-between text-amber-500">
                <span>🥉 ৩য় জন:</span>
                <span className="font-bold">+৬ বোনাস (১১ মোট)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>৪র্থ / ৫ম জন:</span>
                <span className="font-bold">+৪ / +২ বোনাস (৯ / ৭ মোট)</span>
              </div>
              <div className="flex justify-between text-slate-500 border-t border-slate-800 pt-1">
                <span>অন্যান্য সবাই:</span>
                <span className="font-bold text-emerald-400">+৫ পয়েন্ট (Base)</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Submission Status Overview */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center text-center">
          {isAllDoneSubmittedToday && userAllDoneRecord ? (
            <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-6 max-w-md w-full text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-base font-bold text-white">আজকের All Done সম্পন্ন হয়েছে!</div>
              <div className="text-xs text-slate-300">
                সাবমিশন সময়: {formatToBDT(userAllDoneRecord.completed_at, true)}
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                {userAllDoneRecord.fastest_rank ? (
                  <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Rank #{userAllDoneRecord.fastest_rank} Fastest</span>
                  </span>
                ) : null}
                <span className="bg-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1 rounded-full border border-emerald-500/30">
                  +{userAllDoneRecord.total_points} Points Awarded
                </span>
              </div>
            </div>
          ) : !isSupportComplete ? (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-6 max-w-lg w-full text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-white">সাপোর্ট এখনও অসম্পূর্ণ রয়েছে</div>
              <p className="text-xs text-amber-300 leading-relaxed">
                আপনার এখনও <span className="font-bold text-white">{pendingRequiredSupportCount}</span> টি লিংকে সাপোর্ট দেওয়া বাকি আছে। সবগুলো লিংকে সাপোর্ট সম্পন্ন করার পরই All Done সাবমিট সক্রিয় হবে।
              </p>
              {onGoToSupportSession && (
                <div className="pt-2">
                  <button
                    onClick={onGoToSupportSession}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition flex items-center gap-2 mx-auto transform hover:scale-105"
                  >
                    <Flame className="w-4 h-4 fill-slate-950" />
                    <span>সাপোর্ট সেশনে যান</span>
                  </button>
                </div>
              )}
            </div>
          ) : !allDoneStatus.isOpen ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-lg w-full text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-white">সব সাপোর্ট সম্পন্ন! All Done উইন্ডো অপেক্ষায়</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                আপনার সকল সাপোর্ট সম্পন্ন হয়েছে। All Done সাবমিশন শুরু হবে বিকাল ৫:০০ (১৭:০০ BDT)-এ। ১৭:০০ BDT হলে Link Box / Support Session পেজ থেকে আপনি All Done সাবমিট করতে পারবেন।
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>উইন্ডো: ১৭:০০ - ২৪:০০ BDT</span>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-6 max-w-lg w-full text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
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
    </div>
  );
};
