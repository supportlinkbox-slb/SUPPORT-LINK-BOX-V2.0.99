import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, ShieldAlert, AlertTriangle, Info, Sparkles, Check, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';
import { AppNotification } from '../../types';

interface NotificationCenterProps {
  onNavigateToTab?: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateToTab }) => {
  const {
    currentUser,
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'WARNINGS'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!currentUser) return null;

  const myNotifications = notifications.filter((n) => n.member_id === currentUser.id);

  const filteredNotifications = myNotifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.is_read;
    if (activeFilter === 'WARNINGS') {
      return n.type === 'WARNING' || n.type === 'FAKE_ALL_DONE' || n.type === 'PENALTY_ISSUED';
    }
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'WARNING':
      case 'ALERT_WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'FAKE_ALL_DONE':
      case 'PENALTY_ISSUED':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'SYSTEM':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition"
        title="বিজ্ঞপ্তি ও নোটিফিকেশন"
        aria-label="বিজ্ঞপ্তি"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">নোটিফিকেশন সেন্টার</span>
              {unreadNotificationCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  {unreadNotificationCount} নতুন
                </span>
              )}
            </div>

            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsAsRead()}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>সব পড়া হয়েছে</span>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800/60 flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeFilter === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              সকল ({myNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeFilter === 'UNREAD'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              অপঠিত ({unreadNotificationCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('WARNINGS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeFilter === 'WARNINGS'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              সতর্কবার্তা
            </button>
          </div>

          {/* List Content */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/50">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Check className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs">কোনো নোটিফিকেশন নেই</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markNotificationAsRead(n.id);
                    if (n.reference_id && onNavigateToTab) {
                      onNavigateToTab('notices');
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 transition cursor-pointer flex items-start gap-3 hover:bg-slate-800/60 ${
                    !n.is_read ? 'bg-slate-800/30' : 'opacity-75'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !n.is_read ? 'font-bold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" title="অপঠিত" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{formatToBDT(n.created_at, true)}</span>
                      {n.reference_id && (
                        <span className="text-cyan-400 flex items-center gap-0.5">
                          <span>বিস্তারিত</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {onNavigateToTab && (
            <div className="p-2.5 bg-slate-950/90 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  onNavigateToTab('notices');
                  setIsOpen(false);
                }}
                className="text-xs text-slate-400 hover:text-cyan-300 font-medium transition"
              >
                সকল কমিউনিটি নোটিশ দেখুন →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
