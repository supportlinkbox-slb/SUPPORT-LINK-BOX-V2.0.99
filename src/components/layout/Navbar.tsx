import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Award,
  Link as LinkIcon,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  User,
  LogOut,
  Clock,
  Menu,
  X,
  Settings,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { NotificationCenter } from '../announcements/NotificationCenter';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenSubmitModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
  onOpenSubmitModal,
}) => {
  const {
    currentUser,
    isAuthenticated,
    logout,
    submissionStatus,
    allDoneStatus,
    pendingRequiredSupportCount,
    isAllDoneSubmittedToday,
    isConfigured,
  } = useApp();

  const [bdtClock, setBdtClock] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setBdtClock(formatToBDT(new Date(), false));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'links', label: 'আজকের লিংক', icon: LinkIcon },
    { id: 'support', label: "Support Session", icon: Flame, badge: pendingRequiredSupportCount > 0 ? pendingRequiredSupportCount : null },
    { id: 'alldone', label: 'All Done Box', icon: CheckCircle2, status: isAllDoneSubmittedToday },
    { id: 'leaderboard', label: 'লিডারবোর্ড', icon: Award },
    { id: 'notices', label: 'নোটিশ বোর্ড', icon: AlertTriangle },
    { id: 'reports', label: 'রিপোর্ট', icon: ShieldAlert },
  ];

  const canAccessAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      {/* Top Utility Bar with BDT Live Time and Role Switcher */}
      <div className="bg-slate-950 px-4 py-1.5 text-xs border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-400">বাংলাদেশ সময় (BDT):</span>
          <span className="font-mono font-semibold text-emerald-400">{bdtClock || '12:00:00 PM BDT'}</span>
          <span className="hidden md:inline-block text-slate-500">|</span>
          <span className="hidden md:inline-block text-slate-400">
            {submissionStatus.isOpen ? (
              <span className="text-blue-400 font-medium">লিংক জমা চালু (৪:৫০ PM পর্যন্ত)</span>
            ) : (
              <span className="text-amber-400 font-medium">{submissionStatus.message}</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isConfigured ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Supabase Connected
            </span>
          ) : (
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Live Preview Mode
            </span>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab('links')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 text-white font-black text-xl">
              SLB
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-extrabold text-base tracking-tight text-white">
                <span>SUPPORT LINK BOX</span>
                <span className="text-[10px] px-1.5 py-0.5 font-bold uppercase rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  OFFICIAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">বাংলাদেশ ফেসবুক সাপোর্ট কমিউনিটি</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition relative ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="ml-1 bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.status && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400"></span>
                  )}
                </button>
              );
            })}

            {canAccessAdmin && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'admin'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                    : 'text-purple-300 hover:bg-purple-950/40'
                }`}
              >
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>

          {/* Right Action Buttons: Submit Link + Profile / Auth */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onOpenSubmitModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30 transition transform hover:-translate-y-0.5"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>লিংক জমা দিন</span>
            </button>

            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <NotificationCenter onNavigateToTab={setCurrentTab} />
                <div
                  className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition"
                  onClick={() => setCurrentTab('profile')}
                >
                  <img
                    src={currentUser.profile_photo_url}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-cyan-400/50"
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                      <span>{currentUser.name.split(' ')[0]}</span>
                      <span className="text-[10px] text-amber-400 font-mono">({currentUser.points} pts)</span>
                    </div>
                    <div className="text-[10px] text-cyan-400 font-mono">{currentUser.member_number}</div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                লগইন / রেজিস্টার
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            {isAuthenticated && currentUser && (
              <NotificationCenter onNavigateToTab={setCurrentTab} />
            )}
            <button
              onClick={onOpenSubmitModal}
              className="p-2 rounded-lg bg-cyan-600 text-white font-bold text-xs"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-amber-500 text-slate-950 font-bold text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {canAccessAdmin && (
            <button
              onClick={() => {
                setCurrentTab('admin');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-purple-300 bg-purple-950/40 border border-purple-800/40"
            >
              <Settings className="w-4 h-4" />
              <span>Admin Dashboard</span>
            </button>
          )}

          <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <img
                  src={currentUser.profile_photo_url}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-bold text-white">{currentUser.name}</div>
                  <div className="text-[11px] text-cyan-400 font-mono">{currentUser.member_number} • {currentUser.points} pts</div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                লগইন / রেজিস্টার
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
