import React, { useState } from 'react';
import { Mail, Link as LinkIcon, User, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { validateAndExtractFacebookProfile } from '../../utils/facebookLinks';

export const AdminInviteMember: React.FC = () => {
  const [email, setEmail] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ rawToken: string; memberNumber: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fbValidation = React.useMemo(() => {
    if (!facebookUrl.trim()) return null;
    return validateAndExtractFacebookProfile(facebookUrl.trim());
  }, [facebookUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessData(null);

    if (!email || !facebookUrl || !facebookName) {
      setErrorMsg('সবগুলো ফিল্ড পূরণ করুন।');
      return;
    }

    if (fbValidation && !fbValidation.isValid) {
      setErrorMsg('Facebook Profile Link সঠিক নয়।');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-invite', {
        body: {
          email: email.trim(),
          facebookUrl: facebookUrl.trim(),
          facebookName: facebookName.trim(),
          facebookIdentityKey: fbValidation?.normalizedId || facebookUrl.trim(),
          facebookIdentityType: fbValidation?.type || 'UNKNOWN',
          profilePhotoUrl: profilePhotoUrl.trim()
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || error?.message || 'ইনভাইট তৈরি করতে সমস্যা হয়েছে।');
      }

      setSuccessData({
        rawToken: data.rawToken,
        memberNumber: data.memberNumber
      });
      setEmail('');
      setFacebookUrl('');
      setFacebookName('');
      setProfilePhotoUrl('');
    } catch (err: any) {
      if (err.message === 'DUPLICATE_FACEBOOK') {
        setErrorMsg('এই ফেসবুক আইডির অধীনে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।');
      } else if (err.message === 'DUPLICATE_EMAIL') {
        setErrorMsg('এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে।');
      } else {
        setErrorMsg(err.message || 'অজানা ত্রুটি।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (successData) {
      const inviteUrl = `${window.location.origin}?invite=${successData.rawToken}`;
      navigator.clipboard.writeText(`আপনার Support Link Box ইনভাইটেশন লিংক:\n${inviteUrl}\n\nটোকেন: ${successData.rawToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          <span>Admin Invite Token (নতুন সদস্য)</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          এখান থেকে সরাসরি নতুন সদস্যের প্রোফাইল (PENDING অবস্থায়) তৈরি করতে পারবেন এবং তাকে একটি Secure Token পাঠাতে পারবেন। 
          সদস্য উক্ত টোকেন দিয়ে লগইন পেজ থেকে নিজের পাসওয়ার্ড সেট করতে পারবেন।
        </p>
      </div>

      {successData ? (
        <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-emerald-400 font-bold mb-1">ইনভাইট তৈরি সফল হয়েছে!</h4>
            <p className="text-xs text-emerald-300/70">Member ID: {successData.memberNumber}</p>
          </div>
          
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 font-mono break-all">
            {successData.rawToken}
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Invite Info'}
          </button>
          
          <p className="text-[10px] text-amber-400/80 mt-4">
            সতর্কতা: এই টোকেনটি শুধুমাত্র একবার দেখানো হবে। অনুগ্রহ করে কপি করে সংরক্ষণ করুন।
          </p>

          <button
            onClick={() => setSuccessData(null)}
            className="text-xs text-slate-400 hover:text-white underline mt-4 block mx-auto"
          >
            নতুন ইনভাইট তৈরি করুন
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase">Facebook Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={facebookName}
                  onChange={(e) => setFacebookName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase">Facebook Profile Link *</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  required
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500"
                />
              </div>
              {fbValidation && (
                <div className={`text-[10px] mt-1 ${fbValidation.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fbValidation.isValid ? '✓ Valid Profile' : '✗ Invalid Facebook Link'}
                </div>
              )}
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase">Profile Picture Link (Optional)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  value={profilePhotoUrl}
                  onChange={(e) => setProfilePhotoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition disabled:opacity-50"
          >
            {loading ? 'প্রক্রিয়াধীন...' : 'ইনভাইট তৈরি করুন'}
          </button>
        </form>
      )}
    </div>
  );
};
