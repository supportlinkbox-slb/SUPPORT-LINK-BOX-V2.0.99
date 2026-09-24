import React, { useState } from 'react';
import {
  User,
  Award,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Shield,
  History,
  Calendar,
  ExternalLink,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle,
  Settings,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';

interface MemberProfileViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const MemberProfileView: React.FC<MemberProfileViewProps> = ({ onNavigateTab }) => {
  const { currentUser, pointLedger, dailyLinks, allDoneRecords, logout, updatePassword, isConfigured } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEVELOPER';
  const userLinks = dailyLinks.filter((l) => l.owner_id === currentUser.id);
  const userAllDones = allDoneRecords.filter((r) => r.member_id === currentUser.id);
  const userPointTxs = pointLedger.filter((p) => p.member_id === currentUser.id);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'দুটি পাসওয়ার্ড একই নয়।' });
      return;
    }

    setLoading(true);
    const res = await updatePassword(newPassword);
    setNewPassword('');
    setConfirmPassword('');
    setLoading(false);

    if (res.success) {
      setPasswordMsg({ type: 'success', text: res.message || 'পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে।' });
    } else {
      setPasswordMsg({ type: 'error', text: res.error || 'পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে।' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Admin Power Control Panel Trigger Bar (Visible ONLY for Admins / Developers) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950 border-2 border-purple-500/60 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500 text-white tracking-wide">
                  ADMIN POWER PANEL
                </span>
                <span className="text-xs font-mono font-bold text-purple-300">ROLE: {currentUser.role}</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">অ্যাডমিন কন্ট্রোল টুলস ও সিস্টেম ম্যানেজমেন্ট</h2>
              <p className="text-xs text-purple-200/80">সদস্য অনুমোদন, পয়েন্ট সিস্টেম, ফেক অল ডান রিভিউ ও সেটিংস নিয়ন্ত্রণ করুন।</p>
            </div>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('admin')}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-purple-500/30 transition transform hover:-translate-y-0.5 flex items-center gap-2 shrink-0 border border-purple-400/30"
            >
              <Settings className="w-4 h-4" />
              <span>অ্যাডমিন প্যানেলে প্রবেশ করুন</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <img
              src={currentUser.profile_photo_url}
              alt={currentUser.name}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
            />

            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white">{currentUser.name}</h1>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {currentUser.member_number}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  {currentUser.role}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {currentUser.status}
                </span>
              </div>

              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 pt-1">
                <span>ইমেইল: {currentUser.email}</span>
                {currentUser.facebook_name && <span>ফেসবুক: {currentUser.facebook_name}</span>}
                <span>যুক্ত হয়েছেন: {formatToBDT(currentUser.joined_at, true)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 text-xs font-bold transition self-start sm:self-center"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট করুন</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400">সর্বমোট পয়েন্ট</div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              {currentUser.points}
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400">চলতি সপ্তাহের পয়েন্ট</div>
            <div className="text-xl font-black text-cyan-400 font-mono mt-0.5">
              {currentUser.weekly_points}
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400">মোট লিংক জমা</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {currentUser.total_links_submitted}
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400">মোট দেওয়া সাপোর্ট</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {currentUser.total_supports_given}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Sections: Recent Links & Point Ledger History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submitted Links History */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-cyan-400" />
              <span>আমার সাবমিট করা লিংক ({userLinks.length})</span>
            </h3>
          </div>

          {userLinks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">এখনও কোন লিংক জমা দেওয়া হয়নি।</div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {userLinks.map((l) => (
                <div key={l.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-cyan-400">
                      #{l.serial_display} ({l.date})
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {l.post_type}
                    </span>
                  </div>
                  <p className="text-slate-200 line-clamp-1">{l.caption}</p>
                  <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                    <span>সাপোর্ট পেয়েছেন: {l.total_supports_count} টি</span>
                    <a
                      href={l.fb_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline flex items-center gap-1"
                    >
                      <span>পোস্ট ওপেন করুন</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Point Ledger & Transaction History */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>পয়েন্ট হিস্টোরি ও লেজার ({userPointTxs.length})</span>
            </h3>
          </div>

          {userPointTxs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">কোন পয়েন্ট ট্রানজেকশন পাওয়া যায়নি।</div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {userPointTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white">{tx.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {tx.activity_type} • {formatToBDT(tx.created_at)}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold text-sm ${
                      tx.points > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {tx.points > 0 ? `+${tx.points}` : tx.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security & Password Change Section (Chapter 03) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>অ্যাকাউন্ট নিরাপত্তা ও পাসওয়ার্ড পরিবর্তন</span>
          </h3>
          <span className="text-[11px] text-slate-400">কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড ব্যবহার করুন</span>
        </div>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/60 border border-red-800 text-red-300'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">নতুন পাসওয়ার্ড *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

          <div>
            <label className="block text-xs text-slate-300 mb-1">পাসওয়ার্ড নিশ্চিত করুন *</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
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

          <div className="sm:col-span-2 flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-500">
              পাসওয়ার্ড পরিবর্তনের পর নতুন পাসওয়ার্ড দিয়ে ভবিষ্যতে লগইন করতে হবে।
            </p>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
            >
              {loading ? 'সংরক্ষণ করা হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Switch & Session Security Box */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-red-900/40 pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-bold text-white">সিকিউর লগআউট ও একাউন্ট সুইচ সেন্টার</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              অন্য একাউন্টে লগইন করতে সিকিউরলি Supabase Auth সেশন ক্লোজ করুন। প্রতিটি একাউন্টের পয়েন্ট, হিসেব ও ডাটা পুরোপুরি আলাদা গণনা হবে।
            </p>
          </div>

          <button
            onClick={async () => {
              await logout();
              localStorage.clear();
              sessionStorage.clear();
            }}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-red-600/30 shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>সেশন টার্মিনেট ও অন্য একাউন্টে সুইচ করুন</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            Supabase Auth ID: <code className="text-cyan-400 font-mono">{currentUser.auth_user_id || currentUser.id}</code>
          </span>
          <span className="text-emerald-400 font-bold">✓ Active JWT Encrypted Session</span>
        </div>
      </div>
    </div>
  );
};
