import React, { useState } from 'react';
import {
  Lock,
  Mail,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { validateAndExtractFacebookProfile } from '../../utils/facebookLinks';

export const LoginPage: React.FC = () => {
  const { login, register, resetPassword } = useApp();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Registration Fields (Chapter 03 Section 4)
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    type: 'EMAIL_CONFIRMATION' | 'REGISTER_SUCCESS' | 'PASSWORD_RESET_SENT';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Facebook live validation
  const fbValidation = React.useMemo(() => {
    if (!facebookUrl.trim()) return null;
    return validateAndExtractFacebookProfile(facebookUrl.trim());
  }, [facebookUrl]);

  const handleModeSwitch = (newMode: 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD') => {
    setMode(newMode);
    setErrorMsg('');
    setPendingNotice(null);
    setSuccessNotice(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPendingNotice(null);
    setSuccessNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('সঠিক Email Address প্রদান করুন।');
      return;
    }

    if (mode === 'FORGOT_PASSWORD') {
      setLoading(true);
      const res = await resetPassword(trimmedEmail);
      setLoading(false);
      if (res.success) {
        setSuccessNotice({
          type: 'PASSWORD_RESET_SENT',
          message:
            res.message ||
            'যদি এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট থাকে, তবে পাসওয়ার্ড রিসেট লিংক আপনার ইনবক্সে পাঠানো হয়েছে। অনুগ্রহ করে ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করুন।',
        });
      } else {
        setErrorMsg(res.error || 'পাসওয়ার্ড রিসেট রিকোয়েস্ট পাঠানো সম্ভব হয়নি।');
      }
      return;
    }

    if (mode === 'REGISTER') {
      if (!name.trim()) {
        setErrorMsg('আপনার পূর্ণ নাম (Real Name) প্রদান করুন।');
        return;
      }
      if (!username.trim()) {
        setErrorMsg('ইউজারনেম (Username) প্রদান করুন।');
        return;
      }
      if (username.length < 3 || username.length > 30) {
        setErrorMsg('ইউজারনেম ৩ থেকে ৩০ অক্ষরের মধ্যে হতে হবে।');
        return;
      }
      if (!facebookName.trim()) {
        setErrorMsg('আপনার ফেসবুক প্রোফাইলের নাম প্রদান করুন।');
        return;
      }
      if (facebookUrl.trim()) {
        const val = validateAndExtractFacebookProfile(facebookUrl.trim());
        if (!val.valid) {
          setErrorMsg(val.error || 'সঠিক ফেসবুক প্রোফাইল লিংক দিন।');
          return;
        }
      }
      if (password.length < 6) {
        setErrorMsg('আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('দুটি Password একই নয়। পুনরায় চেক করুন।');
        return;
      }
    }

    setLoading(true);

    if (mode === 'LOGIN') {
      const res = await login(trimmedEmail, password);
      setLoading(false);
      if (!res.success) {
        if (res.error?.includes('Admin Approval') || res.error?.includes('অনুমোদনের অপেক্ষায়')) {
          setPendingNotice(res.error);
        } else {
          setErrorMsg(res.error || 'লগইন ব্যর্থ হয়েছে।');
        }
      }
    } else {
      const res = await register({
        email: trimmedEmail,
        pass: password,
        name: name.trim(),
        realName: name.trim(),
        username: username.trim(),
        facebookName: facebookName.trim(),
        facebookUrl: facebookUrl.trim(),
        profilePhotoUrl:
          profilePhotoUrl.trim() ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        facebookIdentityKey: fbValidation?.identityKey,
        facebookIdentityType: fbValidation?.identityType,
      });
      setPassword('');
      setConfirmPassword('');
      setLoading(false);

      if (res.success) {
        if (res.needsEmailConfirmation) {
          setSuccessNotice({
            type: 'EMAIL_CONFIRMATION',
            message:
              res.message ||
              'আপনার Email-এ Confirmation link পাঠানো হয়েছে। অনুগ্রহ করে Email চেক করে অ্যাকাউন্ট নিশ্চিত করুন।',
          });
        } else {
          setSuccessNotice({
            type: 'REGISTER_SUCCESS',
            message:
              res.message ||
              'আপনার Registration সফলভাবে সম্পন্ন হয়েছে। বর্তমানে আপনার Account Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
          });
        }
      } else {
        setErrorMsg(res.error || 'রেজিস্ট্রেশন সম্পন্ন করা যায়নি।');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-lg mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 text-white font-black text-2xl mx-auto">
            SLB
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">SUPPORT LINK BOX</h1>
          <p className="text-xs text-slate-400 font-medium">
            বাংলাদেশ ফেসবুক ক্রিয়েটর ও মেম্বার এনগেজমেন্ট প্ল্যাটফর্ম
          </p>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                {mode === 'FORGOT_PASSWORD' ? <KeyRound className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {mode === 'LOGIN'
                    ? 'অ্যাকাউন্টে লগইন করুন'
                    : mode === 'REGISTER'
                    ? 'নতুন অ্যাকাউন্ট রেজিস্ট্রেশন'
                    : 'পাসওয়ার্ড পুনরুদ্ধার'}
                </h2>
                <p className="text-[11px] text-slate-400">Chapter 03 Strict Security Architecture</p>
              </div>
            </div>
          </div>

          {/* Pending Approval Strict Notice (Chapter 03 Section 2) */}
          {pendingNotice && (
            <div className="p-5 bg-amber-950/80 border-b border-amber-800/80 text-amber-200 text-xs leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Account Admin Approval-এর অপেক্ষায় আছে</span>
              </div>
              <p>{pendingNotice}</p>
              <div className="text-[11px] text-amber-400/90 pt-1 font-medium">
                অ্যাডমিন প্যানেল থেকে অনুমোদন প্রদান করা হলে আপনি সাথে সাথে লগইন করতে পারবেন।
              </div>
            </div>
          )}

          {/* Success Confirmation View */}
          {successNotice ? (
            <div className="p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mx-auto flex items-center justify-center">
                {successNotice.type === 'EMAIL_CONFIRMATION' || successNotice.type === 'PASSWORD_RESET_SENT' ? (
                  <Mail className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-2">
                  {successNotice.type === 'PASSWORD_RESET_SENT'
                    ? 'পাসওয়ার্ড রিসেট নির্দেশনা পাঠানো হয়েছে'
                    : successNotice.type === 'EMAIL_CONFIRMATION'
                    ? 'ইমেইল ভেরিফিকেশন লিংক পাঠানো হয়েছে'
                    : 'রেজিস্ট্রেশন সফল (অপেক্ষমান)'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed px-2">
                  {successNotice.message}
                </p>
              </div>
              <button
                onClick={() => {
                  setSuccessNotice(null);
                  handleModeSwitch('LOGIN');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
              >
                লগইন পৃষ্ঠায় ফিরে যান
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium leading-relaxed flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* REGISTER FIELDS (Chapter 03 Section 4) */}
              {mode === 'REGISTER' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Field 1: Profile Photo */}
                  <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      ১. Profile Picture লিংক
                    </label>
                    <p className="text-[11px] text-slate-400">
                      আপনার Facebook Profile-এ বর্তমানে যে Profile Picture ব্যবহার করছেন, সম্ভব হলে সেই একই ছবি দিন।
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          profilePhotoUrl.trim() ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                        }
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-900"
                      />
                      <input
                        type="url"
                        value={profilePhotoUrl}
                        onChange={(e) => setProfilePhotoUrl(e.target.value)}
                        placeholder="https://... (ইমেজ বা ছবি লিংক)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>

                  {/* Field 2 & 3: Real Name and Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        ২. পূর্ণ নাম (Real Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Facebook-এর আসল নাম"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        বানান পরিবর্তন বা ডাকনাম নয়
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        ৩. ইউনিক ইউজারনেম (Username) *
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="যেমন: Shihab_Vai"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        SLB প্ল্যাটফর্মের নিজস্ব ইউজারনেম
                      </span>
                    </div>
                  </div>

                  {/* Field 4 & 5: Facebook Name and Profile URL */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        ৪. Original Facebook Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={facebookName}
                        onChange={(e) => setFacebookName(e.target.value)}
                        placeholder="Facebook-এর নাম যেমন আছে"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        ৫. Facebook Profile Link *
                      </label>
                      <input
                        type="url"
                        required
                        value={facebookUrl}
                        onChange={(e) => setFacebookUrl(e.target.value)}
                        placeholder="https://www.facebook.com/your_profile"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                      {fbValidation && (
                        <div className="mt-1.5 text-xs">
                          {fbValidation.valid ? (
                            <div className="text-emerald-400 flex items-center gap-1.5 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>বৈধ ফেসবুক প্রোফাইল (Key: {fbValidation.identityKey})</span>
                            </div>
                          ) : (
                            <div className="text-red-400 flex items-center gap-1.5 font-medium text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{fbValidation.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'FORGOT_PASSWORD' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="কমপক্ষে ৬ অক্ষর"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              {mode === 'REGISTER' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="পুনরায় পাসওয়ার্ড দিন"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'LOGIN' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">নিরাপদ সেশন গেটওয়ে</span>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('FORGOT_PASSWORD')}
                    className="text-cyan-400 hover:underline font-medium"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>প্রক্রিয়াধীন...</span>
                  </>
                ) : mode === 'LOGIN' ? (
                  'লগইন করুন'
                ) : mode === 'REGISTER' ? (
                  'অ্যাকাউন্ট রেজিস্টার করুন'
                ) : (
                  'রিসেট লিংক পাঠান'
                )}
              </button>

              <div className="pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
                {mode === 'LOGIN' ? (
                  <p>
                    অ্যাকাউন্ট নেই?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('REGISTER')}
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      নতুন অ্যাকাউন্ট তৈরি করুন
                    </button>
                  </p>
                ) : (
                  <p>
                    ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('LOGIN')}
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      লগইন করুন
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>Support Link Box Official • Chapter 03 Security Standard</p>
          <p className="text-slate-600">সবচেয়ে নিরাপদ ও বিশ্বস্ত মেম্বার এনগেজমেন্ট প্ল্যাটফর্ম</p>
        </div>
      </div>
    </div>
  );
};
