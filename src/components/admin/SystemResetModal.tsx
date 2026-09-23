import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, ShieldCheck, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SystemResetModalProps {
  onClose: () => void;
}

export const SystemResetModal: React.FC<SystemResetModalProps> = ({ onClose }) => {
  const { currentUser, refreshData } = useApp();
  const [resetType, setResetType] = useState<'DAILY' | 'WEEKLY' | 'ALL'>('DAILY');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isDev = currentUser?.role === 'DEVELOPER';

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'RESET-SYSTEM') {
      setErrorMsg('সঠিক নিশ্চিতকরণ কোড "RESET-SYSTEM" লিখুন।');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Simulate system reset delay
      await new Promise((res) => setTimeout(res, 1200));
      await refreshData();
      setSuccess(true);
    } catch (err) {
      setErrorMsg('সিস্টেম রিসেট ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-900/50 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">সিস্টেম রিসেট ও রিসাইকেল প্যানেল</h2>
            <p className="text-xs text-slate-400">ডেভেলপার টু-ফ্যাক্টর প্রটেক্টেড রিসেট টুল</p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-base font-bold text-white">সিস্টেম রিসেট সফল হয়েছে!</h3>
            <p className="text-xs text-slate-400">দৈনিক ও সাপ্তাহিক ক্যাশ ক্লিয়ার এবং কাউন্টার রিসেট সম্পন্ন হয়েছে।</p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
            >
              বন্ধ করুন
            </button>
          </div>
        ) : (
          <form onSubmit={handleExecuteReset} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-300 mb-2">রিসেট টাইপ নির্বাচন করুন:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DAILY', label: 'দৈনিক রিসেট' },
                  { id: 'WEEKLY', label: 'সাপ্তাহিক রিসেট' },
                  { id: 'ALL', label: 'ফুল রিসেট' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResetType(item.id as any)}
                    className={`py-2 rounded-xl font-bold transition border ${
                      resetType === item.id
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-amber-400 block">সতর্কতা:</span>
              <p>
                {resetType === 'DAILY' && 'আজকের সকল জমা লিংক, সাপোর্ট রেকর্ড এবং অল ডান মার্ক রিসেট হবে।'}
                {resetType === 'WEEKLY' && 'সাপ্তাহিক লিডারবোর্ড পয়েন্ট আর্নিং জিরো হবে এবং শনিবারের রিসেট ট্রিগার হবে।'}
                {resetType === 'ALL' && 'সিস্টেমের সকল সাময়িক ডাটাবেজ রেকর্ড রিসেট হবে।'}
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                নিশ্চিত করতে "RESET-SYSTEM" লিখুন:
              </label>
              <input
                type="text"
                required
                placeholder="RESET-SYSTEM"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-red-500 outline-none"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={loading || !isDev || confirmText !== 'RESET-SYSTEM'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>রিসেট কার্যকর করুন</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
