import React, { useState } from 'react';
import {
  Settings,
  Clock,
  Shield,
  PhoneCall,
  UserCheck,
  AlertTriangle,
  Download,
  RotateCcw,
  Save,
  CheckCircle2,
  RefreshCw,
  Lock,
  FileSpreadsheet,
  Sliders,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Database,
  Calendar,
  Layers,
  Sparkles,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemSettings, AdminSupportContact } from '../../types';
import { SystemResetModal } from './SystemResetModal';
import { AdminNoticeGeneratorModal } from './AdminNoticeGeneratorModal';
import { FestivalThemeManagerModal } from './FestivalThemeManagerModal';
import { FESTIVAL_THEMES } from '../../types/festivalTheme';
import { lifecycleApi } from '../../lib/supabase';
import { TimePicker12Hour } from '../common/TimePicker12Hour';
import { getActiveMonetagLink, setActiveMonetagLink, MONETAG_CONFIG } from '../../utils/monetag';

type SettingSectionTab = 'schedule' | 'monetag' | 'rules' | 'contact' | 'recovery' | 'theme' | 'backup' | 'security';

export const AdminSettingsPanel: React.FC = () => {
  const {
    currentUser,
    members,
    auditLogs,
    reports,
    allDoneRecords,
    updateMemberStatus,
    refreshData,
    activeFestivalTheme,
    currentThemeConfig,
    setActiveFestivalThemeState,
  } = useApp();

  const isDev = currentUser?.role === 'DEVELOPER';
  const [activeTab, setActiveTab] = useState<SettingSectionTab>('schedule');
  const [isThemeManagerModalOpen, setIsThemeManagerModalOpen] = useState(false);

  // System Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    submission_start_time: '00:00',
    submission_end_time: '16:50',
    all_done_start_time: '17:00',
    all_done_deadline_time: '23:59',
    late_support_weekly_limit: 2,
    can_submit_links_global: true,
    maintenance_mode: false,
  });

  // Admin Contact Profiles State
  const [adminContact, setAdminContact] = useState<AdminSupportContact>({
    id: `contact-${currentUser?.id || 'admin'}`,
    admin_id: currentUser?.id || '',
    admin_name: currentUser?.name || 'Admin Support',
    admin_role: currentUser?.role || 'ADMIN',
    facebook_url: currentUser?.facebook_url || '',
    whatsapp_number: '+8801700000000',
    helpline_note: 'যেকোনো একাউন্ট সমস্যা বা পেন্ডিং এপ্রুভালের জন্য ফেসবুক/হোয়াটসঅ্যাপে যোগাযোগ করুন।',
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedInactivityDays, setSelectedInactivityDays] = useState<3 | 7>(3);
  const [isNoticeGeneratorOpen, setIsNoticeGeneratorOpen] = useState(false);
  const [isRunning10amCutoff, setIsRunning10amCutoff] = useState(false);
  const [cutoffResult, setCutoffResult] = useState<{ count: number; date: string; members: string[] } | null>(null);
  const [isArchivingSheets, setIsArchivingSheets] = useState(false);
  const [archiveResult, setArchiveResult] = useState<{ rows: number; checksum: string; status: string } | null>(null);

  const handleRun10amCutoff = async () => {
    if (!confirm('আপনি কি পূর্ববর্তী দিনের ১০:০০ AM BDT রিকভারি কাট-অফ চেক রান করতে চান? বকেয়া সাপোর্ট সম্পন্ন না করা মেম্বাররা স্বয়ংক্রিয়ভাবে সাসপেন্ড হবে।')) return;
    setIsRunning10amCutoff(true);
    setCutoffResult(null);
    try {
      const res = await lifecycleApi.execute10amRecoveryCutoff();
      if (res.success && res.data) {
        setCutoffResult({
          count: res.data.suspended_count || 0,
          date: res.data.target_date || 'Yesterday',
          members: res.data.suspended_members || [],
        });
        await refreshData();
      } else {
        alert(res.error || 'কাট-অফ রান ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      alert(err.message || 'ত্রুটি ঘটেছে');
    } finally {
      setIsRunning10amCutoff(false);
    }
  };

  const handleTriggerSheetsArchive = async () => {
    setIsArchivingSheets(true);
    setArchiveResult(null);
    try {
      const res = await lifecycleApi.triggerGoogleSheetsArchive();
      if (res.success && res.data) {
        setArchiveResult({
          rows: res.data.exported_rows || 0,
          checksum: res.data.sha256_checksum || '',
          status: res.data.status || 'VERIFIED',
        });
      } else {
        alert(res.error || 'গুগল শিটস অটো আর্কাইভ ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      alert(err.message || 'ত্রুটি ঘটেছে');
    } finally {
      setIsArchivingSheets(false);
    }
  };

  // Filter inactive members for Recovery Duty Manager
  const inactiveMembers = members.filter((m) => {
    if (m.status !== 'ACTIVE' && m.status !== 'INACTIVE') return false;
    const days = m.days_inactive || 0;
    return days >= selectedInactivityDays;
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleAssignSpecialDuty = async (memberId: string) => {
    if (!confirm('আপনি কি এই সদস্যকে স্পেশাল সাপোর্ট ডিউটি পেনাল্টি অ্যাসাইন করতে চান?')) return;
    await updateMemberStatus(memberId, 'SUSPENDED');
  };

  // CSV Export Helpers
  const exportMembersCSV = () => {
    const headers = ['Member Number,Name,Email,Role,Status,Points,Weekly Points,Joined At'];
    const rows = members.map(
      (m) =>
        `"${m.member_number}","${m.name}","${m.email}","${m.role}","${m.status}",${m.points},${m.weekly_points},"${m.joined_at}"`
    );
    downloadCSV([headers, ...rows].join('\n'), `slb_members_export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportAuditLogsCSV = () => {
    const headers = ['Action,Performed By,Details,Created At'];
    const rows = auditLogs.map(
      (a) => `"${a.action}","${a.actor_name || 'System'}","${a.details || ''}","${a.created_at}"`
    );
    downloadCSV([headers, ...rows].join('\n'), `slb_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [monetagUrlInput, setMonetagUrlInput] = useState(() => getActiveMonetagLink());

  const menuItems = [
    { id: 'schedule', label: 'সময়সীমা ও সিডিউল', icon: Clock, desc: 'লিংক জমা ও অল ডান সময়' },
    { id: 'monetag', label: 'Monetag Ad মনিটাইজেশন', icon: Sparkles, desc: 'স্মার্টলিঙ্ক ও আর্নিং কনফিগার' },
    { id: 'rules', label: 'নিয়ম ও ফ্রি লিমিট', icon: Sliders, desc: 'লেট লিমিট ও থ্রেশহোল্ড' },
    { id: 'contact', label: 'সাপোর্ট হেল্পলাইন', icon: PhoneCall, desc: 'এডমিন ফেসবুক ও হোয়াটসঅ্যাপ' },
    { id: 'theme', label: 'উৎসব ও বিশেষ দিবস থিম', icon: Sparkles, desc: 'জুম্মা, ঈদ, বৈশাখী শুভেচ্ছা থিম' },
    { id: 'recovery', label: 'রিকভারি ম্যানেজার', icon: UserCheck, desc: '৩/৭ দিন নিষ্ক্রিয় ডিউটি' },
    { id: 'backup', label: 'ডেটা ও ব্যাকআপ', icon: FileSpreadsheet, desc: 'CSV ডিরেক্টরি ডাউনলোড' },
    { id: 'security', label: 'সিকিউরিটি ও রিসেট', icon: AlertTriangle, desc: 'ডেভেলপার রিসেট সেন্টার' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* App Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>এডমিন সেটিংস সেন্টার</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                APP V3.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">iOS/Material কার্ড গ্রুপ স্টাইলে সিস্টেম কনফিগারেশন</p>
          </div>
        </div>

        {isSavedNotice && (
          <div className="px-4 py-2 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-bounce shadow-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span>সেটিংস সংরক্ষিত হয়েছে!</span>
          </div>
        )}
      </div>

      {/* Main App Layout: Side Drawer Menu + Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* App Side Navigation Drawer (Desktop Sidebar / Mobile Horizontal Scroller) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-xl space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden lg:block">
            সেটিংস ক্যাটাগরি
          </div>

          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 scrollbar-none pb-1 lg:pb-0">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SettingSectionTab)}
                  className={`w-full text-left p-3 rounded-2xl transition flex items-center justify-between group shrink-0 lg:shrink ${
                    isActive
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-white shadow-md'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 group-hover:text-cyan-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 hidden lg:block">{item.desc}</div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 hidden lg:block transition-transform ${
                      isActive ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600 opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Grouped Content Cards (iOS / Material List Style) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Time & Schedule Settings */}
          {activeTab === 'schedule' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-sm font-bold text-white">সময়সীমা ও সার্ভিস উইন্ডো</h2>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>সেভ</span>
                  </button>
                </div>

                {/* iOS List Row Items */}
                <div className="divide-y divide-slate-800/80">
                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">লিংক জমা শুরুর সময় (BDT)</span>
                      <span className="text-[11px] text-slate-500">প্রতিদিন কত টায় সদস্য লিংক জমা দেওয়া শুরু করবে</span>
                    </div>
                    <TimePicker12Hour
                      value={settings.submission_start_time}
                      onChange={(val) => setSettings({ ...settings, submission_start_time: val })}
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">লিংক জমা শেষ সময় (BDT)</span>
                      <span className="text-[11px] text-slate-500">লিংক জমার শেষ সীমা (ডিফল্ট: 04:50 PM)</span>
                    </div>
                    <TimePicker12Hour
                      value={settings.submission_end_time}
                      onChange={(val) => setSettings({ ...settings, submission_end_time: val })}
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">All Done বক্স শুরু হওয়ার সময়</span>
                      <span className="text-[11px] text-slate-500">সাপোর্ট সম্পন্নকারীদের অল ডান অপশন আনলক সময়</span>
                    </div>
                    <TimePicker12Hour
                      value={settings.all_done_start_time}
                      onChange={(val) => setSettings({ ...settings, all_done_start_time: val })}
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">All Done শেষ ডেডলাইন</span>
                      <span className="text-[11px] text-slate-500">অল ডান করার শেষ রাত ১১:৫৯ PM (BDT)</span>
                    </div>
                    <TimePicker12Hour
                      value={settings.all_done_deadline_time}
                      onChange={(val) => setSettings({ ...settings, all_done_deadline_time: val })}
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">সিডিউল লিংক খোলার সময়</span>
                      <span className="text-[11px] text-slate-500">আগামীকালের আগাম লিংক জমা খোলার BDT সময়</span>
                    </div>
                    <TimePicker12Hour
                      value="12:00"
                      onChange={() => {}}
                    />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Section: Monetag Official Ad & SmartLink Manager */}
          {activeTab === 'monetag' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm font-bold text-white">Monetag Official Ad Network কনফিগারেশন</h2>
                </div>
                <button
                  onClick={() => {
                    setActiveMonetagLink(monetagUrlInput);
                    setIsSavedNotice(true);
                    setTimeout(() => setIsSavedNotice(false), 3000);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>সেভ করুন</span>
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs">
                <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent p-4 rounded-2xl border border-amber-500/30">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Monetag High-CPM Direct SmartLink</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    আপনার সাইটের সকল ব্যানার, কার্ডের মাঝের অ্যাড, এবং সাসপেনশন রিকভারি টাস্কে এই লিংক থেকে রিয়েল Monetag বিজ্ঞাপন ওপেন হবে এবং আপনার Monetag একাউন্টে আয় জমা হবে।
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    অফিশিয়াল Monetag Direct SmartLink URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://otieuwou.net/4/8856230"
                    value={monetagUrlInput}
                    onChange={(e) => setMonetagUrlInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:border-amber-500 outline-none text-xs"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ডিফল্ট লিংক: <span className="font-mono text-cyan-400">{MONETAG_CONFIG.directLinkUrl}</span>
                  </span>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMonetagLink(monetagUrlInput);
                      window.open(monetagUrlInput, '_blank');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <span>Monetag Ad টেস্ট করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMonetagUrlInput(MONETAG_CONFIG.directLinkUrl);
                      setActiveMonetagLink(MONETAG_CONFIG.directLinkUrl);
                      setIsSavedNotice(true);
                      setTimeout(() => setIsSavedNotice(false), 3000);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
                  >
                    ডিফল্ট লিংকে রিসেট
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Rules & Limits */}
          {activeTab === 'rules' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <h2 className="text-sm font-bold text-white">নিয়ম ও ফ্রি লিমিট গাইডলাইন</h2>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>সেভ</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80">
                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">সাপ্তাহিক লেট সাপোর্ট ফ্রি লিমিট</span>
                      <span className="text-[11px] text-slate-500">সপ্তাহে কতবার রিকভারি ফি/অ্যাড ছাড়া ছাড় দেওয়া হবে</span>
                    </div>
                    <select
                      value={settings.late_support_weekly_limit}
                      onChange={(e) =>
                        setSettings({ ...settings, late_support_weekly_limit: parseInt(e.target.value) || 0 })
                      }
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    >
                      <option value={0}>0 (কোন ছাড় নেই)</option>
                      <option value={1}>1 বার / সপ্তাহ</option>
                      <option value={2}>2 বার / সপ্তাহ (Default)</option>
                      <option value={3}>3 বার / সপ্তাহ</option>
                    </select>
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">লিডারবোর্ড Qualified Threshold Point</span>
                      <span className="text-[11px] text-slate-500">লিডারবোর্ডে কোয়ালিফাই হওয়ার নূন্যতম পয়েন্ট (ডিফল্ট: ১৭ pts)</span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={17}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-28 text-center"
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">গ্লোবাল লিংক জমা টগল</span>
                      <span className="text-[11px] text-slate-500">সবাই লিংক জমা দিতে পারবে</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.can_submit_links_global}
                      onChange={(e) => setSettings({ ...settings, can_submit_links_global: e.target.checked })}
                      className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Section 3: Support Contact */}
          {activeTab === 'contact' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">এডমিন সাপোর্ট হেল্পলাইন</h2>
                </div>
                <button
                  onClick={() => {
                    setIsSavedNotice(true);
                    setTimeout(() => setIsSavedNotice(false), 3000);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow"
                >
                  সেভ
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">এডমিন ফেসবুক প্রোফাইল লিংক</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/admin"
                    value={adminContact.facebook_url}
                    onChange={(e) => setAdminContact({ ...adminContact, facebook_url: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">হোয়াটসঅ্যাপ হেল্পলাইন নম্বর</label>
                  <input
                    type="text"
                    placeholder="+8801700000000"
                    value={adminContact.whatsapp_number}
                    onChange={(e) => setAdminContact({ ...adminContact, whatsapp_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">সাসপেন্ডেড/পেন্ডিং স্ক্রিন বার্তা</label>
                  <textarea
                    rows={2}
                    value={adminContact.helpline_note}
                    onChange={(e) => setAdminContact({ ...adminContact, helpline_note: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Recovery Manager */}
          {activeTab === 'recovery' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-5 p-5">
              {/* 10:00 AM BDT Recovery Cutoff Controller */}
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>১০:০০ AM BDT রিকভারি কাট-অফ ক্রন ইঞ্জিন</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          AUTO-CRON 04:00 UTC
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        পূর্ববর্তী দিনের লিংক জমা দেয়া যেসকল সদস্য সকাল ১০:০০ AM BDT পর্যন্ত বাকি সাপোর্ট পূরণ করেননি, তাদের একাউন্ট স্বয়ংক্রিয়ভাবে সাসপেন্ড করা হয়।
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRun10amCutoff}
                    disabled={isRunning10amCutoff}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRunning10amCutoff ? 'animate-spin' : ''}`} />
                    <span>{isRunning10amCutoff ? 'চেক চলছে...' : 'কাট-অফ চেক রান করুন'}</span>
                  </button>
                </div>

                {cutoffResult && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-amber-400">কাট-অফ রান ফলাফল ({cutoffResult.date}):</span>
                      <span>সাসপেন্ডেড মেম্বার: <strong className="text-red-400 font-mono">{cutoffResult.count}</strong> জন</span>
                    </div>
                    {cutoffResult.members.length > 0 && (
                      <p className="text-[11px] text-slate-400">
                        সাসপেন্ডকৃত সদস্যগণ: {cutoffResult.members.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2 pt-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    <span>রিকভারি ডিউটি ম্যানেজার (Inactivity Duty)</span>
                  </h2>
                  <p className="text-xs text-slate-400">৩ দিন ও ৭ দিন নিষ্ক্রিয় মেম্বার পেনাল্টি অ্যাসাইনার</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNoticeGeneratorOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>নোটিশ জেনারেটর</span>
                  </button>
                  <button
                    onClick={() => setSelectedInactivityDays(3)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedInactivityDays === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    ৩ দিন
                  </button>
                  <button
                    onClick={() => setSelectedInactivityDays(7)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedInactivityDays === 7 ? 'bg-red-500 text-white' : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    ৭ দিন
                  </button>
                </div>
              </div>

              {inactiveMembers.length === 0 ? (
                <div className="bg-slate-950/60 rounded-2xl p-6 text-center text-xs text-slate-400">
                  {selectedInactivityDays} দিন বা তার বেশি নিষ্ক্রিয় কোনো সদস্য পাওয়া যায়নি।
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                  {inactiveMembers.map((m) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-bold text-white">{m.name}</span>
                        <span className="text-slate-500 ml-2">({m.member_number})</span>
                        <span className="text-amber-400 text-[11px] block">{m.days_inactive || 0} দিন নিষ্ক্রিয়</span>
                      </div>
                      <button
                        onClick={() => handleAssignSpecialDuty(m.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 font-bold transition shrink-0"
                      >
                        ডিউটি দিন
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Festival & Special Day Themes */}
          {activeTab === 'theme' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>উৎসব ও বিশেষ দিবস থিম কন্ট্রোলার</span>
                      {activeFestivalTheme.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {currentThemeConfig.badge} সক্রিয়
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      জুম্মা, ঈদ, পহেলা বৈশাখ, স্বাধীনতা ও বিজয় দিবসের জন্য পুরো সাইটে থিম ও স্বাগতম বার্তা সক্রিয় করুন।
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsThemeManagerModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
                >
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>থিম পরিবর্তন / সেট করুন</span>
                </button>
              </div>

              {/* Current Active Theme Preview */}
              <div className={`p-4 rounded-2xl border ${currentThemeConfig.bannerBg} flex items-center justify-between gap-4 transition shadow-inner`}>
                <div className="flex items-center gap-3.5">
                  <span className="text-4xl select-none">{currentThemeConfig.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{currentThemeConfig.name}</span>
                      <span className="text-[10px] text-amber-300 font-mono font-bold">
                        ({currentThemeConfig.badge})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 max-w-md">
                      {activeFestivalTheme.customGreeting || currentThemeConfig.greetingTitle}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeFestivalTheme.isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeFestivalTheme.isActive ? 'ACTIVE' : 'DEFAULT'}
                  </span>
                  {activeFestivalTheme.isActive && activeFestivalTheme.expiresAt && (
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      মেয়াদ: {new Date(activeFestivalTheme.expiresAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Supported Themes Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block">উপলব্ধ উৎসব থিমসমূহ:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.values(FESTIVAL_THEMES).filter(t => t.id !== 'DEFAULT').map(t => (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center gap-2.5 text-xs"
                    >
                      <span className="text-2xl select-none">{t.icon}</span>
                      <div>
                        <span className="font-bold text-slate-200 block text-[11px] truncate">{t.name}</span>
                        <span className="text-[9px] text-amber-400 font-mono">{t.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Data Backup & CSV */}
          {activeTab === 'backup' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-400" />
                    <span>গুগল শিটস অটো আর্কাইভ ও ব্যাকআপ Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    ব্লুপ্রিন্ট সেকশন ৫১-৫৪: ক্রিপ্টোগ্রাফিক SHA-256 চেকসাম ভেরিফিকেশন সহ অটো-এক্সপোর্ট
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerSheetsArchive}
                  disabled={isArchivingSheets}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isArchivingSheets ? 'animate-spin' : ''}`} />
                  <span>{isArchivingSheets ? 'ব্যাকআপ ও চেকসাম তৈরি হচ্ছে...' : 'গুগল শিটসে ব্যাকআপ নিন'}</span>
                </button>
              </div>

              {/* Archive Result with Verified Checksum */}
              {archiveResult && (
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-300">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>গুগল শিটস আর্কাইভ সফলভাবে সংরক্ষিত হয়েছে!</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 border border-emerald-500/30 font-mono">
                      {archiveResult.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500">সংরক্ষিত সারি (Rows):</span>{' '}
                      <strong className="text-white font-mono">{archiveResult.rows} টি</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">SHA-256 Checksum:</span>{' '}
                      <span className="text-cyan-400 font-mono text-[10px] truncate block">
                        {archiveResult.checksum}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <button
                  onClick={exportMembersCSV}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-green-800/60 text-white font-bold transition flex items-center justify-between group"
                >
                  <div className="text-left space-y-1">
                    <span className="block font-bold text-green-400">মেম্বার ডিরেক্টরি ডাউনলোড (CSV)</span>
                    <span className="text-slate-500 text-[11px] font-normal">আইডি, ইমেইল, স্ট্যাটাস ও পয়েন্ট</span>
                  </div>
                  <Download className="w-5 h-5 text-slate-400 group-hover:text-green-400 transition" />
                </button>

                <button
                  onClick={exportAuditLogsCSV}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-green-800/60 text-white font-bold transition flex items-center justify-between group"
                >
                  <div className="text-left space-y-1">
                    <span className="block font-bold text-cyan-400">অডিট ট্রেইল লগস ডাউনলোড (CSV)</span>
                    <span className="text-slate-500 text-[11px] font-normal">এডমিন অ্যাকশন ব্যাকআপ</span>
                  </div>
                  <Download className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition" />
                </button>
              </div>
            </div>
          )}

          {/* Section 6: Security & System Reset */}
          {activeTab === 'security' && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-red-900/40 pb-3 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>সিস্টেম মেইনটেন্যান্স ও রিসেট সেন্টার</span>
                  </h2>
                  <p className="text-xs text-slate-400">দৈনিক ও সাপ্তাহিক রিসেট। DEVELOPER টু-ফ্যাক্টর প্রটেক্টেড।</p>
                </div>

                <button
                  onClick={() => setIsResetModalOpen(true)}
                  disabled={!isDev}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    isDev
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>সিস্টেম রিসেট</span>
                </button>
              </div>

              {!isDev && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>সিস্টেম রিসেট অপশনটি শুধুমাত্র DEVELOPER রোলের জন্য লক করা রয়েছে।</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reset Modal */}
      {isResetModalOpen && <SystemResetModal onClose={() => setIsResetModalOpen(false)} />}

      {/* Admin Notice Generator Modal */}
      {isNoticeGeneratorOpen && (
        <AdminNoticeGeneratorModal
          isOpen={isNoticeGeneratorOpen}
          onClose={() => setIsNoticeGeneratorOpen(false)}
        />
      )}

      {/* Festival Theme Manager Modal */}
      {isThemeManagerModalOpen && (
        <FestivalThemeManagerModal
          isOpen={isThemeManagerModalOpen}
          onClose={() => setIsThemeManagerModalOpen(false)}
        />
      )}
    </div>
  );
};
