import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, X, Ban } from 'lucide-react';
import { MemberProfile } from '../../types';

export const REJECT_REASONS = [
  { code: 'NAME_MISMATCH', bn: 'ফেসবুক আইডির নাম এবং রেজিস্ট্রেশনের নাম মিলছে না', en: 'Facebook name mismatch' },
  { code: 'PHOTO_MISMATCH', bn: 'ফেসবুক প্রোফাইল ছবি এবং রেজিস্ট্রেশনের ছবি মিলছে না', en: 'Profile photo mismatch' },
  { code: 'INVALID_FB_LINK', bn: 'ফেসবুক প্রোফাইল লিংক সঠিক নয়', en: 'Invalid Facebook link' },
];

interface RejectMemberModalProps {
  member: MemberProfile | null;
  onClose: () => void;
  onReject: (memberId: string, reasonCode: string | null, customReason: string) => Promise<void>;
  onBlacklist: (memberId: string, email: string, fbLink: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}

export const RejectMemberModal: React.FC<RejectMemberModalProps> = ({
  member, onClose, onReject, onBlacklist, isProcessing,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setSelectedReason(null); setCustomReason(''); setUseCustom(false);
      setShowBlacklist(false); setBlacklistReason(''); setError(null);
    }
  }, [member]);

  if (!member) return null;

  // SLB-FIX-L26: confirm stays disabled until a reason code or custom text is present
  const canConfirmReject = useCustom ? customReason.trim().length > 0 : !!selectedReason;

  const handleReject = async () => {
    if (!useCustom && !selectedReason) { setError('একটি কারণ সিলেক্ট করুন বা কাস্টম কারণ লিখুন।'); return; }
    if (useCustom && !customReason.trim()) { setError('কাস্টম কারণ লিখুন।'); return; }
    setError(null);
    await onReject(member.id, useCustom ? null : selectedReason, customReason.trim());
  };

  const handleBlacklist = async () => {
    if (!blacklistReason.trim()) { setError('ব্ল্যাকলিস্টের কারণ লিখুন।'); return; }
    setError(null);
    await onBlacklist(member.id, member.email, member.facebook_url || '', blacklistReason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">রেজিস্ট্রেশন বাতিল</h3>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-white font-bold text-sm">{member.name} <span className="font-mono text-cyan-400 text-xs">({member.member_number})</span></div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{member.email}</div>
          </div>

          {!showBlacklist ? (
            <>
              <p className="text-slate-300 font-semibold">বাতিলের কারণ সিলেক্ট করুন:</p>
              <div className="space-y-2">
                {REJECT_REASONS.map((r) => (
                  <label key={r.code} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${selectedReason === r.code && !useCustom ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'}`}>
                    <input type="radio" name="reject-reason" checked={selectedReason === r.code && !useCustom}
                      onChange={() => { setSelectedReason(r.code); setUseCustom(false); setError(null); }}
                      className="mt-0.5 accent-red-500" />
                    <span className="text-slate-200 text-sm">{r.bn}</span>
                  </label>
                ))}
                <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${useCustom ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'}`}>
                  <input type="radio" name="reject-reason" checked={useCustom}
                    onChange={() => { setUseCustom(true); setError(null); }}
                    className="mt-0.5 accent-red-500" />
                  <span className="text-slate-200 text-sm">অন্য কারণ (নিচে লিখুন)</span>
                </label>
              </div>
              {useCustom && (
                <textarea rows={3} value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="কাস্টম কারণ লিখুন... (member-এর email-এ যাবে)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm" />
              )}
              <p className="text-slate-500 text-[11px]">📧 Member-এর email-এ automatic বাংলা+English email যাবে।</p>
              {error && <p className="text-red-400 text-[11px]">{error}</p>}
            </>
          ) : (
            <>
              <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3 text-red-300 text-xs">
                ⚠️ <b>সতর্কতা:</b> ব্ল্যাকলিস্ট করলে এই email + Facebook লিংক দিয়ে <b>কখনো</b> রেজিস্ট্রেশন করা যাবে না। Auth account delete হয়ে যাবে।
              </div>
              <label className="block text-slate-300 font-semibold">ব্ল্যাকলিস্টের কারণ *</label>
              <textarea rows={3} value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="কেন ব্ল্যাকলিস্ট করছেন..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm" />
              {error && <p className="text-red-400 text-[11px]">{error}</p>}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
          {!showBlacklist ? (
            <>
              <button onClick={() => setShowBlacklist(true)} disabled={isProcessing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> ব্ল্যাকলিস্ট
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">বাতিল</button>
                <button onClick={handleReject} disabled={isProcessing || !canConfirmReject}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reject করুন
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setShowBlacklist(false)} disabled={isProcessing} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">← ফেরত</button>
              <button onClick={handleBlacklist} disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} <Ban className="w-3.5 h-3.5" /> Confirm Blacklist
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
