import React from 'react';
import { AlertOctagon, Flame, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SpecialSupportDutyBanner: React.FC = () => {
  const { activePenalty, resolvePunishment } = useApp();

  if (!activePenalty) return null;

  return (
    <div className="bg-gradient-to-r from-red-950 via-rose-900/60 to-red-950 border border-red-800 rounded-2xl p-4 shadow-xl text-white mb-6 animate-pulse-slow">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500 text-red-300 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full">
                🔴 Special Support Duty
              </span>
              <span className="text-xs text-red-300">এডমিন কর্তৃক আরোপিত পেনাল্টি</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              বকেয়া সাপোর্ট ও বিশেষ ডিউটি কার্যকর
            </h3>
            <p className="text-xs text-red-200/90 mt-0.5">
              কারণ: {activePenalty.reason} • সনাক্তকারী: {activePenalty.detected_by_admin}
            </p>
            <div className="mt-2 text-xs font-medium text-amber-200 bg-black/40 px-3 py-1.5 rounded-lg inline-block border border-red-800/40">
              করণীয়: পূর্বে মিস করা {activePenalty.missing_support_count}টি সাপোর্ট + ১টি অতিরিক্ত ফ্রি সাপোর্ট দিন সম্পন্ন করতে হবে।
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => resolvePunishment(activePenalty.id)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ডিউটি সম্পন্ন মার্ক করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
