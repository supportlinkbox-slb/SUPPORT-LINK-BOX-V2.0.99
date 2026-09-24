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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemSettings, AdminSupportContact } from '../../types';
import { SystemResetModal } from './SystemResetModal';

type SettingSectionTab = 'schedule' | 'rules' | 'contact' | 'recovery' | 'backup' | 'security';

export const AdminSettingsPanel: React.FC = () => {
  const {
    currentUser,
    members,
    auditLogs,
    reports,
    allDoneRecords,
    updateMemberStatus,
    refreshData,
  } = useApp();

  const isDev = currentUser?.role === 'DEVELOPER';
  const [activeTab, setActiveTab] = useState<SettingSectionTab>('schedule');

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

  const menuItems = [
    { id: 'schedule', label: 'সময়সীমা ও সিডিউল', icon: Clock, desc: 'লিংক জমা ও অল ডান সময়' },
    { id: 'rules', label: 'নিয়ম ও ফ্রি লিমিট', icon: Sliders, desc: 'লেট লিমিট ও থ্রেশহোল্ড' },
    { id: 'contact', label: 'সাপোর্ট হেল্পলাইন', icon: PhoneCall, desc: 'এডমিন ফেসবুক ও হোয়াটসঅ্যাপ' },
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
                    <input
                      type="time"
                      value={settings.submission_start_time}
                      onChange={(e) => setSettings({ ...settings, submission_start_time: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-32 text-center"
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">লিংক জমা শেষ সময় (BDT)</span>
                      <span className="text-[11px] text-slate-500">লিংক জমার শেষ সীমা (ডিফল্ট: ১৬:৫০ PM)</span>
                    </div>
                    <input
                      type="time"
                      value={settings.submission_end_time}
                      onChange={(e) => setSettings({ ...settings, submission_end_time: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-32 text-center"
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">All Done বক্স শুরু হওয়ার সময়</span>
                      <span className="text-[11px] text-slate-500">সাপোর্ট সম্পন্নকারীদের অল ডান অপশন আনলক সময়</span>
                    </div>
                    <input
                      type="time"
                      value={settings.all_done_start_time}
                      onChange={(e) => setSettings({ ...settings, all_done_start_time: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-32 text-center"
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">All Done শেষ ডেডলাইন</span>
                      <span className="text-[11px] text-slate-500">অল ডান করার শেষ রাত ১২:০০ টা (২৩:৫৯ BDT)</span>
                    </div>
                    <input
                      type="time"
                      value={settings.all_done_deadline_time}
                      onChange={(e) => setSettings({ ...settings, all_done_deadline_time: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-32 text-center"
                    />
                  </div>

                  <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-950/30 transition">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">সিডিউল লিংক খোলার সময়</span>
                      <span className="text-[11px] text-slate-500">আগামীকালের আগাম লিংক জমা খোলার BDT সময়</span>
                    </div>
                    <input
                      type="time"
                      defaultValue="12:00"
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none w-32 text-center"
                    />
                  </div>
                </div>
              </div>
            </form>
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    <span>রিকভারি ডিউটি ম্যানেজার (Inactivity Duty)</span>
                  </h2>
                  <p className="text-xs text-slate-400">৩ দিন ও ৭ দিন নিষ্ক্রিয় মেম্বার পেনাল্টি অ্যাসাইনার</p>
                </div>

                <div className="flex gap-2">
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

          {/* Section 5: Data Backup & CSV */}
          {activeTab === 'backup' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                <span>ডেটা ব্যাকআপ ও CSV/Excel এক্সপোর্ট Engine</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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
    </div>
  );
};
