import React, { useState } from 'react';
import { X, Lock, Mail, CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, resetPassword } = useApp();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState<{
    type: 'EMAIL_CONFIRMATION' | 'REGISTER_SUCCESS' | 'PASSWORD_RESET_SENT';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setUsername('');
    setFacebookName('');
    setFacebookUrl('');
    setErrorMsg('');
    setSuccessNotice(null);
  };

  const handleModeSwitch = (newMode: 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD') => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessNotice(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('সঠিক Email Address দিন।');
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
        setErrorMsg(res.error || 'পাসওয়ার্ড রিসেট রিকোয়েস্ট পাঠানো সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।');
      }
      return;
    }

    if (mode === 'REGISTER') {
      if (!name.trim()) {
        setErrorMsg('আপনার পূর্ণ নাম দিন।');
        return;
      }
      if (!username.trim()) {
        setErrorMsg('ইউজারনেম দিন।');
        return;
      }
      if (!facebookName.trim()) {
        setErrorMsg('ফেসবুক প্রোফাইলের নাম দিন।');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('আরও শক্তিশালী Password দিন (কমপক্ষে ৬ অক্ষর)।');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('দুটি Password একই নয়।');
        return;
      }
    }

    setLoading(true);

    if (mode === 'LOGIN') {
      const res = await login(trimmedEmail, password);
      // Clean up sensitive state
      setPassword('');
      setLoading(false);
      if (res.success) {
        resetForm();
        onClose();
      } else {
        setErrorMsg(res.error || 'লগইন ব্যর্থ হয়েছে।');
      }
    } else {
      const res = await register({
        email: trimmedEmail,
        pass: password,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        facebookName: facebookName.trim(),
        facebookUrl: facebookUrl.trim(),
      });
      // Clean up sensitive state
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
            message: res.message || 'রেজিস্ট্রেশন সফল হয়েছে!',
          });
          setTimeout(() => {
            resetForm();
            onClose();
          }, 1500);
        }
      } else {
        setErrorMsg(res.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              {mode === 'FORGOT_PASSWORD' ? <KeyRound className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === 'LOGIN'
                  ? 'সাপোর্ট লিংক বক্সে লগইন'
                  : mode === 'REGISTER'
                  ? 'নতুন অ্যাকাউন্ট রেজিস্টার'
                  : 'পাসওয়ার্ড পুনরুদ্ধার'}
              </h2>
              <p className="text-[11px] text-slate-400">Support Link Box Official</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {successNotice ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mx-auto flex items-center justify-center">
              {successNotice.type === 'EMAIL_CONFIRMATION' || successNotice.type === 'PASSWORD_RESET_SENT' ? (
                <Mail className="w-7 h-7" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1.5">
                {successNotice.type === 'PASSWORD_RESET_SENT'
                  ? 'পাসওয়ার্ড রিসেট নির্দেশনা পাঠানো হয়েছে'
                  : successNotice.type === 'EMAIL_CONFIRMATION'
                  ? 'ইমেইল ভেরিফিকেশন লিংক পাঠানো হয়েছে'
                  : 'রেজিস্ট্রেশন সফল'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                {successNotice.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleModeSwitch('LOGIN')}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition"
            >
              লগইন পেজে ফিরে যান
            </button>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {mode === 'FORGOT_PASSWORD' && (
              <p className="text-xs text-slate-300 leading-relaxed">
                আপনার অ্যাকাউন্টের নিবন্ধিত ইমেইল ঠিকানাটি লিখুন। আমরা আপনাকে পাসওয়ার্ড পুনরায় নির্ধারণের লিংক পাঠাবো।
              </p>
            )}

            {mode === 'REGISTER' && (
              <>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">আপনার পূর্ণ নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: Tanvir Ahmed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">ইউজারনেম *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: tanvir_official"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">ফেসবুক প্রোফাইলের নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: Tanvir Ahmed (FB)"
                    value={facebookName}
                    onChange={(e) => setFacebookName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক)</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/..."
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-slate-300 mb-1">ইমেইল ঠিকানা *</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            {mode !== 'FORGOT_PASSWORD' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-300">পাসওয়ার্ড *</label>
                  {mode === 'LOGIN' && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('FORGOT_PASSWORD')}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'REGISTER' ? 'new-password' : 'current-password'}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs text-slate-300 mb-1">পাসওয়ার্ড নিশ্চিত করুন *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="পাসওয়ার্ড পুনরায় লিখুন"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition mt-2"
            >
              {loading
                ? 'প্রসেসিং...'
                : mode === 'LOGIN'
                ? 'লগইন করুন'
                : mode === 'REGISTER'
                ? 'অ্যাকাউন্ট তৈরি করুন'
                : 'রিসেট লিংক পাঠান'}
            </button>

            <div className="text-center text-xs text-slate-400 pt-1">
              {mode === 'LOGIN' ? (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('REGISTER')}
                  className="text-cyan-400 hover:underline"
                >
                  নতুন অ্যাকাউন্ট নেই? রেজিস্টার করুন
                </button>
              ) : mode === 'REGISTER' ? (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('LOGIN')}
                  className="text-cyan-400 hover:underline"
                >
                  ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('LOGIN')}
                  className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>লগইন পেজে ফিরে যান</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
