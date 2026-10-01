import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Save, AlertCircle, CheckCircle, Info } from 'lucide-react';

export const PointSettingsTab: React.FC = () => {
  const { systemConfig, updatePointSettings } = useApp();

  // State fields corresponding to the 11 system config point metrics
  const [pointsDailyLinkSubmit, setPointsDailyLinkSubmit] = useState<number>(5);
  const [pointsPerSupport, setPointsPerSupport] = useState<number>(1);
  const [pointsAllDone, setPointsAllDone] = useState<number>(5);
  const [pointsFastestTop1, setPointsFastestTop1] = useState<number>(10);
  const [pointsFastestTop2, setPointsFastestTop2] = useState<number>(8);
  const [pointsFastestTop3, setPointsFastestTop3] = useState<number>(6);
  const [pointsFastestTop4, setPointsFastestTop4] = useState<number>(4);
  const [pointsFastestTop5, setPointsFastestTop5] = useState<number>(2);
  const [penaltyLateSupport, setPenaltyLateSupport] = useState<number>(2);
  const [penaltyFakeAllDone, setPenaltyFakeAllDone] = useState<number>(10);
  const [penaltyInactive, setPenaltyInactive] = useState<number>(1);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bind values from systemConfig when loaded
  useEffect(() => {
    if (systemConfig) {
      setPointsDailyLinkSubmit(systemConfig.points_daily_link_submit ?? 5);
      setPointsPerSupport(systemConfig.points_per_support ?? 1);
      setPointsAllDone(systemConfig.points_all_done ?? 5);
      setPointsFastestTop1(systemConfig.points_fastest_top1 ?? 10);
      setPointsFastestTop2(systemConfig.points_fastest_top2 ?? 8);
      setPointsFastestTop3(systemConfig.points_fastest_top3 ?? 6);
      setPointsFastestTop4(systemConfig.points_fastest_top4 ?? 4);
      setPointsFastestTop5(systemConfig.points_fastest_top5 ?? 2);
      setPenaltyLateSupport(systemConfig.penalty_late_support ?? 2);
      setPenaltyFakeAllDone(systemConfig.penalty_fake_all_done ?? 10);
      setPenaltyInactive(systemConfig.penalty_inactive ?? 1);
    }
  }, [systemConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const patch = {
      points_daily_link_submit: Number(pointsDailyLinkSubmit),
      points_per_support: Number(pointsPerSupport),
      points_all_done: Number(pointsAllDone),
      points_fastest_top1: Number(pointsFastestTop1),
      points_fastest_top2: Number(pointsFastestTop2),
      points_fastest_top3: Number(pointsFastestTop3),
      points_fastest_top4: Number(pointsFastestTop4),
      points_fastest_top5: Number(pointsFastestTop5),
      penalty_late_support: Math.abs(Number(penaltyLateSupport)),
      penalty_fake_all_done: Math.abs(Number(penaltyFakeAllDone)),
      penalty_inactive: Math.abs(Number(penaltyInactive)),
    };

    try {
      const res = await updatePointSettings(patch);
      if (res.success) {
        setSuccessMsg('পয়েন্ট সিস্টেম কনফিগারেশন সফলভাবে আপডেট করা হয়েছে।');
      } else {
        setErrorMsg(res.error || 'আপডেট করতে ত্রুটি হয়েছে।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">পয়েন্ট সিস্টেম কনফিগারেশন</h3>
          <p className="text-slate-400 text-sm">সদস্যদের লিংক সাবমিশন, অল ডান বোনাস এবং জরিমানা নির্ধারণ করুন।</p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 bg-red-950/50 border border-red-900 p-4 rounded-2xl text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-900 p-4 rounded-2xl text-emerald-400 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Base Earning Points */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-emerald-400 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> মূল পয়েন্ট অর্জন
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">প্রতিদিনের লিংক সাবমিশন</label>
              <input
                type="number"
                min="0"
                value={pointsDailyLinkSubmit}
                onChange={(e) => setPointsDailyLinkSubmit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">প্রতিটি লিংক সাপোর্ট দেওয়া</label>
              <input
                type="number"
                min="0"
                value={pointsPerSupport}
                onChange={(e) => setPointsPerSupport(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">অল ডান সাবমিট করা</label>
              <input
                type="number"
                min="0"
                value={pointsAllDone}
                onChange={(e) => setPointsAllDone(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* 2. Fastest All Done Bonuses */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-blue-400 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> দ্রুততম অল ডান বোনাস (Fastest All Done)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-2">১ম স্থান বোনাস</label>
              <input
                type="number"
                min="0"
                value={pointsFastestTop1}
                onChange={(e) => setPointsFastestTop1(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl px-3 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-2">২য় স্থান বোনাস</label>
              <input
                type="number"
                min="0"
                value={pointsFastestTop2}
                onChange={(e) => setPointsFastestTop2(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl px-3 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-2">৩য় স্থান বোনাস</label>
              <input
                type="number"
                min="0"
                value={pointsFastestTop3}
                onChange={(e) => setPointsFastestTop3(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl px-3 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-2">৪র্থ স্থান বোনাস</label>
              <input
                type="number"
                min="0"
                value={pointsFastestTop4}
                onChange={(e) => setPointsFastestTop4(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl px-3 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-2">৫ম স্থান বোনাস</label>
              <input
                type="number"
                min="0"
                value={pointsFastestTop5}
                onChange={(e) => setPointsFastestTop5(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl px-3 py-3 text-white text-sm outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* 3. Penalties & Deductions */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-rose-500 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> পেনাল্টি এবং ডিডাকশন (Penalties)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">দেরিতে সাপোর্টের জরিমানা</label>
              <input
                type="number"
                min="0"
                value={penaltyLateSupport}
                onChange={(e) => setPenaltyLateSupport(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">ফেক অল ডানের জরিমানা</label>
              <input
                type="number"
                min="0"
                value={penaltyFakeAllDone}
                onChange={(e) => setPenaltyFakeAllDone(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">নিষ্ক্রিয়তার জরিমানা (প্রতিদিন)</label>
              <input
                type="number"
                min="0"
                value={penaltyInactive}
                onChange={(e) => setPenaltyInactive(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm outline-none transition"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-2xl px-6 py-3 transition shadow-lg hover:shadow-emerald-500/20 outline-none disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'সংরক্ষণ করা হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
