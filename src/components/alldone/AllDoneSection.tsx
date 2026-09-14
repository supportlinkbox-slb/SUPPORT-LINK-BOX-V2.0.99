import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { DailyAllDoneBox } from './DailyAllDoneBox';

export const AllDoneSection: React.FC = () => {
  const {
    currentUser,
    allDoneStatus,
    pendingRequiredSupportCount,
    isAllDoneSubmittedToday,
    userAllDoneRecord,
    submitAllDone,
    allDoneRecords,
    todayDate,
  } = useApp();

  const [altIdOpen, setAltIdOpen] = useState(false);
  const [altName, setAltName] = useState('');
  const [altLink, setAltLink] = useState('');
  const [altNote, setAltNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const todaysAllDoneCount = allDoneRecords.filter((r) => r.date === todayDate).length;

  const handleAllDoneSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const altDetails = altIdOpen && altName.trim()
      ? { account_name: altName.trim(), account_link: altLink.trim(), note: altNote.trim() }
      : undefined;

    const res = await submitAllDone(altDetails);
    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(
        `অভিনন্দন! আপনার All Done সফলভাবে সম্পন্ন হয়েছে। ${
          res.rank ? `আপনি #${res.rank} তম দ্রুততম হয়েছেন! মোট পয়েন্ট: +${res.points}` : `মোট পয়েন্ট: +${res.points}`
        }`
      );
    } else {
      setErrorMsg(res.error || 'All Done সম্পন্ন করা যায়নি।');
    }
  };

  const isEligible = pendingRequiredSupportCount === 0;

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
              আজকের সকল লিংকে লাইক ও কমেন্ট সম্পন্ন করার পর All Done বাটনে ক্লিক করে আপনার উপস্থিতি নিশ্চিত করুন এবং পয়েন্ট অর্জন করুন।
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
                <span className="font-bold">+১০ বোনাস (১৩ মোট)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>🥈 ২য় জন:</span>
                <span className="font-bold">+৮ বোনাস (১১ মোট)</span>
              </div>
              <div className="flex justify-between text-amber-500">
                <span>🥉 ৩য় জন:</span>
                <span className="font-bold">+৬ বোনাস (৯ মোট)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>৪র্থ / ৫ম জন:</span>
                <span className="font-bold">+৪ / +২ বোনাস</span>
              </div>
              <div className="flex justify-between text-slate-500 border-t border-slate-800 pt-1">
                <span>অন্যান্য সবাই:</span>
                <span className="font-bold">+৩ পয়েন্ট</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Submission Status */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center text-center space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2 max-w-md w-full">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 max-w-md w-full">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {isAllDoneSubmittedToday && userAllDoneRecord ? (
            <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-6 max-w-md w-full text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-base font-bold text-white">আজকের All Done সম্পন্ন হয়েছে!</div>
              <div className="text-xs text-slate-300">
                সাবমিশন সময়: {formatToBDT(userAllDoneRecord.completed_at, true)}
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                {userAllDoneRecord.fastest_rank ? (
                  <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-md">
                    🏆 Rank #{userAllDoneRecord.fastest_rank} Fastest
                  </span>
                ) : null}
                <span className="bg-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1 rounded-full border border-emerald-500/30">
                  +{userAllDoneRecord.total_points} Points Awarded
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              {/* Obligation Warning */}
              {!isEligible && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs rounded-xl text-left flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">সাপোর্ট বাকি আছে:</span>
                    <span> আপনার এখনও {pendingRequiredSupportCount} টি লিংকে সাপোর্ট দেওয়া বাকি রয়েছে। সব লিংকে সাপোর্ট দিয়ে অল ডান সম্পন্ন করুন।</span>
                  </div>
                </div>
              )}

              {/* Alternative ID Disclosure Accordion */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden text-left">
                <button
                  type="button"
                  onClick={() => setAltIdOpen(!altIdOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    <span>আপনি কি অন্য আইডি দিয়ে সাপোর্ট কমপ্লিট করেছেন?</span>
                  </span>
                  <span className="text-[11px] text-cyan-400 underline">
                    {altIdOpen ? 'লুকান' : 'তথ্য দিন'}
                  </span>
                </button>

                {altIdOpen && (
                  <div className="px-4 pb-4 space-y-2.5 pt-1 border-t border-slate-850">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        যে ফেসবুক অ্যাকাউন্ট দিয়ে সাপোর্ট দিয়েছেন তার নাম:
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: MD Hasan Profile 2"
                        value={altName}
                        onChange={(e) => setAltName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        ঐ অ্যাকাউন্টের ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক):
                      </label>
                      <input
                        type="url"
                        placeholder="https://facebook.com/..."
                        value={altLink}
                        onChange={(e) => setAltLink(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Central ALL DONE Button */}
              <button
                onClick={handleAllDoneSubmit}
                disabled={submitting || !isEligible}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:hover:scale-100 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5"
              >
                <CheckCircle2 className="w-5 h-5 fill-slate-950" />
                <span>{submitting ? 'ভেরিফাই করা হচ্ছে...' : 'ALL DONE নিশ্চিত করুন'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Today's All Done Box Live List */}
      <DailyAllDoneBox />
    </div>
  );
};
