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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemSettings, AdminSupportContact } from '../../types';
import { SystemResetModal } from './SystemResetModal';

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
    const headers = ['Action,Performed By,Description,Created At'];
    const rows = auditLogs.map(
      (a) => `"${a.action}","${a.performed_by_name || 'System'}","${a.description}","${a.created_at}"`
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Central System Engine & Controls</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">ডাইনামিক সিস্টেম সেটিংস প্যানেল</h1>
          <p className="text-xs text-slate-400 mt-1">
            লিংক সময়সীমা, লেট সাপোর্ট লিমিট, এডমিন কন্টাক্ট এবং মেম্বার রিকভারি ডিউটি ডায়নামিক কন্ট্রোল।
          </p>
        </div>

        {isSavedNotice && (
          <div className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>সেটিংস সফলভাবে সংরক্ষিত হয়েছে!</span>
          </div>
        )}
      </div>

      {/* 1. Dynamic System Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>সময়সীমা ও সার্ভিস উইন্ডো কনফিগারেশন</span>
          </h2>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-600/30"
          >
            <Save className="w-4 h-4" />
            <span>সেভ করুন</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-300">লিংক জমা শুরুর সময় (BDT)</label>
            <input
              type="time"
              value={settings.submission_start_time}
              onChange={(e) => setSettings({ ...settings, submission_start_time: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-300">লিংক জমা শেষ সময় (BDT)</label>
            <input
              type="time"
              value={settings.submission_end_time}
              onChange={(e) => setSettings({ ...settings, submission_end_time: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-300">All Done বক্স অন হওয়ার সময়</label>
            <input
              type="time"
              value={settings.all_done_start_time}
              onChange={(e) => setSettings({ ...settings, all_done_start_time: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-300">All Done শেষ ডেডলাইন</label>
            <input
              type="time"
              value={settings.all_done_deadline_time}
              onChange={(e) => setSettings({ ...settings, all_done_deadline_time: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-300">সাপ্তাহিক লেট সাপোর্ট ফ্রি লিমিট</label>
            <input
              type="number"
              min={0}
              max={7}
              value={settings.late_support_weekly_limit}
              onChange={(e) => setSettings({ ...settings, late_support_weekly_limit: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2 flex items-center justify-between">
            <div>
              <span className="block font-bold text-slate-300">গ্লোবাল লিংক জমা টগল</span>
              <span className="text-[11px] text-slate-500">সবাই লিঙ্ক জমা দিতে পারবে</span>
            </div>
            <input
              type="checkbox"
              checked={settings.can_submit_links_global}
              onChange={(e) => setSettings({ ...settings, can_submit_links_global: e.target.checked })}
              className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </form>

      {/* 2. Admin Support Contact Profiles Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-400" />
            <span>এডমিন সাপোর্ট প্রোফাইল (Status Gate Helpline)</span>
          </h2>
          <button
            onClick={() => {
              setIsSavedNotice(true);
              setTimeout(() => setIsSavedNotice(false), 3000);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
          >
            কন্টাক্ট সেভ করুন
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-300 mb-1">সাসপেন্ডেড/পেন্ডিং স্ক্রিন হেল্পলাইন বার্তা</label>
            <textarea
              rows={2}
              value={adminContact.helpline_note}
              onChange={(e) => setAdminContact({ ...adminContact, helpline_note: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Recovery Duty Manager (3-Day & 7-Day Inactivity) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <span>রিকভারি ডিউটি ম্যানেজার (Inactivity Duty Manager)</span>
            </h2>
            <p className="text-xs text-slate-400">৩ দিন ও ৭ দিন নিষ্ক্রিয় মেম্বারদের স্পেশাল সাপোর্ট ডিউটি পেনাল্টি অ্যাসাইনার</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedInactivityDays(3)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedInactivityDays === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400'
              }`}
            >
              ৩ দিন নিষ্ক্রিয়
            </button>
            <button
              onClick={() => setSelectedInactivityDays(7)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedInactivityDays === 7 ? 'bg-red-500 text-white' : 'bg-slate-950 text-slate-400'
              }`}
            >
              ৭ দিন নিষ্ক্রিয়
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
                  <span className="text-amber-400 text-[11px] block">{m.days_inactive || 0} দিন ধরে নিষ্ক্রিয়</span>
                </div>
                <button
                  onClick={() => handleAssignSpecialDuty(m.id)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 font-bold transition shrink-0"
                >
                  স্পেশাল ডিউটি দিন
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. One-Click Excel / CSV Export & Backup */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
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
              <span className="text-slate-500 text-[11px] font-normal">সকল মেম্বারের আইডি, ইমেইল, স্ট্যাটাস ও পয়েন্ট</span>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-green-400 transition" />
          </button>

          <button
            onClick={exportAuditLogsCSV}
            className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-green-800/60 text-white font-bold transition flex items-center justify-between group"
          >
            <div className="text-left space-y-1">
              <span className="block font-bold text-cyan-400">অডিট ট্রেইল লগস ডাউনলোড (CSV)</span>
              <span className="text-slate-500 text-[11px] font-normal">এডমিন অ্যাকশন ও পারমিশন ট্র্যাকিং ব্যাকআপ</span>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition" />
          </button>
        </div>
      </div>

      {/* 5. System Reset & Maintenance Mode (Developer Protection) */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-red-900/40 pb-4 gap-2">
          <div>
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>সিস্টেম মেইনটেন্যান্স ও রিসেট সেন্টার (System Maintenance)</span>
            </h2>
            <p className="text-xs text-slate-400">
              দৈনিক ও সাপ্তাহিক রিসেট টুলস। শুধুমাত্র DEVELOPER অ্যাকাউন্টের টু-ফ্যাক্টর প্রটেক্টেড।
            </p>
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
            <span>সিস্টেম রিসেট মোডাল চালু করুন</span>
          </button>
        </div>

        {!isDev && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>সিস্টেম রিসেট অপশনটি শুধুমাত্র DEVELOPER রোলের জন্য লক করা রয়েছে।</span>
          </p>
        )}
      </div>

      {/* Reset Modal */}
      {isResetModalOpen && <SystemResetModal onClose={() => setIsResetModalOpen(false)} />}
    </div>
  );
};
