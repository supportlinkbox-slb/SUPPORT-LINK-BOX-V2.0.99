import React, { useState } from 'react';
import { CheckCircle2, Trophy, Clock, User, ShieldAlert, Award, AlertOctagon, X, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { AllDoneRecord } from '../../types';

export const DailyAllDoneBox: React.FC = () => {
  const { allDoneRecords, todayDate, currentUser, confirmFakeAllDone, addAuditLog } = useApp();
  const [selectedRecordForReview, setSelectedRecordForReview] = useState<AllDoneRecord | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isAdminOrDev = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'DEVELOPER');
  const todaysRecords = allDoneRecords.filter((r) => r.date === todayDate);

  const handleConfirmFake = async () => {
    if (!selectedRecordForReview) return;
    if (!reviewReason.trim()) {
      setReviewError('ফেক অল ডান বাতিল করার কারণ উল্লেখ করা বাধ্যতামূলক।');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await confirmFakeAllDone(selectedRecordForReview.id, reviewReason.trim());
      if (res.success) {
        setSelectedRecordForReview(null);
        setReviewReason('');
      } else {
        setReviewError(res.error || 'ফেক অল ডান নিশ্চিত করতে ত্রুটি হয়েছে।');
      }
    } catch (err: any) {
      setReviewError(err.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে।');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Today's Verified All Done Box</span>
          </h2>
          <p className="text-xs text-slate-400">
            আজকের সকল ভেরিফাইড অল ডান তালিকা ও পয়েন্ট অর্জন
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-cyan-400 border border-slate-700">
          মোট জমা: {todaysRecords.length} জন
        </span>
      </div>

      {todaysRecords.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Clock className="w-10 h-10 mx-auto text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">এখনও কেউ অল ডান জমা দেয়নি</div>
          <p className="text-xs text-slate-500">
            বিকাল ৫:০০ টার পর থেকে প্রথম ৫ জনের জন্য রয়েছে বিশেষ ফাস্টেস্ট বোনাস!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {todaysRecords.map((record, index) => {
            const isTop5 = record.fastest_rank && record.fastest_rank <= 5;
            const rankLabel =
              record.fastest_rank === 1
                ? '🥇 1st'
                : record.fastest_rank === 2
                ? '🥈 2nd'
                : record.fastest_rank === 3
                ? '🥉 3rd'
                : record.fastest_rank
                ? `#${record.fastest_rank}`
                : null;

            return (
              <div
                key={record.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition"
              >
                {/* Left: Rank, Avatar, Name */}
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      index === 0
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : index === 1
                        ? 'bg-slate-300 text-slate-950'
                        : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </span>

                  <img
                    src={record.member_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={record.member_name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{record.member_name}</span>
                      {record.status === 'REVOKED' ? (
                        <span className="text-[10px] font-bold bg-red-950 text-red-300 px-1.5 py-0.2 rounded border border-red-800">
                          REVOKED (বাতিল)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800/60">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {record.member_number} • {formatToBDT(record.completed_at)}
                    </div>
                  </div>
                </div>

                {/* Right: Fastest Badge & Points & Admin Action */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {rankLabel && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      <span>{rankLabel} Fastest</span>
                    </span>
                  )}

                  {record.alternative_id_used && (
                    <span
                      className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40"
                      title={`Alternative Account: ${record.alternative_id_details?.account_name}`}
                    >
                      অন্য আইডি
                    </span>
                  )}

                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-lg">
                    +{record.total_points} pts
                  </span>

                  {isAdminOrDev && record.status !== 'REVOKED' && (
                    <button
                      onClick={() => {
                        setSelectedRecordForReview(record);
                        setReviewReason('');
                        setReviewError(null);
                      }}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-950/60 hover:bg-red-900/80 px-2 py-1 rounded-lg border border-red-800/60 transition flex items-center gap-1 ml-1"
                      title="ফেক অল ডান যাচাই ও পেনাল্টি"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Fake Audit</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Fake All Done Confirmation Dialog */}
      {selectedRecordForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>Confirm Fake All Done Punishment</span>
              </div>
              <button
                onClick={() => setSelectedRecordForReview(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-4 space-y-2 text-xs text-red-200">
              <p className="font-bold text-white text-sm">
                আপনি কি নিশ্চিত যে {selectedRecordForReview.member_name} ({selectedRecordForReview.member_number}) প্রয়োজনীয় Support সম্পন্ন না করেই All Done Submit করেছে?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li>All Done স্ট্যাটাস অবিলম্বে <strong className="text-red-400">REVOKED (বাতিল)</strong> হবে।</li>
                <li>অর্জিত পয়েন্ট ({selectedRecordForReview.total_points} pts) নেগেটিভ রিভার্সাল ট্রানজ্যাকশনের মাধ্যমে কেটে নেওয়া হবে।</li>
                <li>সদস্যের জন্য <strong className="text-amber-300">🔴 Special Support Duty</strong> চালু হবে।</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                বাতিলের কারণ ও প্রমাণ (বাধ্যতামূলক):
              </label>
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="যেমন: লিংক #৩ ও #৭ এ রিঅ্যাক্ট/কমেন্ট পাওয়া যায়নি..."
                className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            {reviewError && (
              <div className="p-3 bg-red-950/80 border border-red-700 text-red-200 text-xs rounded-xl">
                {reviewError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedRecordForReview(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                বাতিল করুন
              </button>
              <button
                onClick={handleConfirmFake}
                disabled={isSubmittingReview}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {isSubmittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>কনফার্ম ও পেনাল্টি আরোপ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
