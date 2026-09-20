import React from 'react';
import { AlertOctagon, ShieldAlert, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SpecialSupportDutyBannerProps {
  onGoToSupport?: () => void;
}

export const SpecialSupportDutyBanner: React.FC<SpecialSupportDutyBannerProps> = ({ onGoToSupport }) => {
  const { activePenalty } = useApp();

  if (!activePenalty) return null;

  return (
    <div className="bg-gradient-to-r from-red-950 via-rose-900/60 to-red-950 border border-red-800 rounded-2xl p-4 sm:p-5 shadow-xl text-white mb-6 animate-pulse-slow">
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
              <span className="text-xs text-red-300">Fake All Done পেনাল্টি কার্যকর</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              বকেয়া সাপোর্ট ও বিশেষ সাপোর্ট ডিউটি পেনাল্টি
            </h3>
            <p className="text-xs text-red-200/90 mt-0.5">
              কারণ: {activePenalty.reason || 'Fake All Done Submission'} • তারিখ: {activePenalty.detected_date}
            </p>
            <div className="mt-2 text-xs font-medium text-amber-200 bg-black/40 px-3 py-2 rounded-xl border border-red-800/40 space-y-1">
              <div>
                <strong>করণীয়:</strong> প্রথমে পূর্বের মিস করা <strong>{activePenalty.missing_support_count}টি সাপোর্ট</strong> সম্পন্ন করুন।
              </div>
              <div className="text-slate-300">
                এরপর পরবর্তী নির্ধারিত দিনে নিজের Link Submit করা আবশ্যক নয়, তবে সকল পোস্টে React + Comment বাধ্যতামূলক।
              </div>
            </div>
          </div>
        </div>

        {onGoToSupport && (
          <div className="shrink-0 self-stretch sm:self-center flex items-center justify-end">
            <button
              onClick={onGoToSupport}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <span>সাপোর্ট সেশনে যান</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
