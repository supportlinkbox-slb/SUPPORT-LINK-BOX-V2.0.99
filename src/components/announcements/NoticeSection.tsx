import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Pin,
  Bell,
  ShieldAlert,
  Plus,
  Trash2,
  Users,
  Send,
  Ban,
  CheckCircle2,
  FileText,
  UserCheck,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NoticeType, NoticeItem } from '../../types';
import { formatToBDT } from '../../utils/bangladeshTime';

const TEMPLATE_PRESETS = {
  GENERAL_ANNOUNCEMENT: {
    title: '📢 জরুরি সাধারণ ঘোষণা',
    content: 'সকল সদস্যের দৃষ্টি আকর্ষণ করা যাচ্ছে যে, প্রতিদিনের সাপোর্ট সেশন নিয়ম মেনে সময়মতো সম্পন্ন করুন। নিয়ম লঙ্ঘনে অ্যাকাউন্ট সাময়িক স্থগিত হতে পারে।',
  },
  SIMPLE_WARNING: {
    title: '⚡ সতর্কবার্তা: নিয়মিত সক্রিয় থাকুন',
    content: 'প্রিয় {member_name} ({member_number}), লক্ষ্য করা গেছে আপনি বিগত {days_inactive} দিন যাবত সাপোর্ট সেশনে নিয়মিত নন। অনুগ্রহ করে আজকের সাপোর্ট সম্পূর্ণ করুন এবং পয়েন্ট সংগ্রহ করুন।',
  },
  ALERT_WARNING: {
    title: '⚠️ চূড়ান্ত সতর্কবার্তা: ইন-অ্যাক্টিভ অ্যাকাউন্ট',
    content: 'জরুরি নোটিশ: {member_name} ({member_number}), আপনি {days_inactive} দিন ধরে সম্পূর্ণ নিষ্ক্রিয়। পরবর্তী ২৪ ঘণ্টার মধ্যে নিয়মিত না হলে আপনার বিরুদ্ধে শাস্তিমূলক ব্যবস্থা ও স্পেশাল সাপোর্ট ডিউটি কার্যকর করা হবে।',
  },
  KICKOUT_NOTICE: {
    title: '🔴 সদস্যপদ বাতিল বিজ্ঞপ্তি (Kickout Notice)',
    content: 'বহিষ্কার বিজ্ঞপ্তি: {member_name} ({member_number}), দীর্ঘ {days_inactive} দিন অননুমোদিত নিষ্ক্রিয়তা এবং সতর্কবার্তা উপেক্ষা করার কারণে আপনার মেম্বারশিপ বাতিল করা হয়েছে।',
  },
};

export const NoticeSection: React.FC = () => {
  const {
    notices,
    currentUser,
    members,
    addNotice,
    deleteNotice,
    generateNotice,
    bulkGenerateNotices,
    revokeNotice,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'BOARD' | 'GENERATOR'>('BOARD');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generator form state
  const [selectedType, setSelectedType] = useState<NoticeType>('SIMPLE_WARNING');
  const [generatorMode, setGeneratorMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [daysInactiveFilter, setDaysInactiveFilter] = useState<number>(3);
  const [title, setTitle] = useState<string>(TEMPLATE_PRESETS.SIMPLE_WARNING.title);
  const [content, setContent] = useState<string>(TEMPLATE_PRESETS.SIMPLE_WARNING.content);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  // Inactive members list for bulk selector
  const inactiveMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedType === 'KICKOUT_NOTICE') {
        return m.status === 'REMOVED' || m.status === 'BANNED';
      }
      return m.status === 'ACTIVE';
    });
  }, [members, selectedType]);

  const handleTypeChange = (newType: NoticeType) => {
    setSelectedType(newType);
    const preset = TEMPLATE_PRESETS[newType] || TEMPLATE_PRESETS.SIMPLE_WARNING;
    setTitle(preset.title);
    setContent(preset.content);

    if (newType === 'ALERT_WARNING') {
      setPriority('HIGH');
      setDaysInactiveFilter(5);
    } else if (newType === 'KICKOUT_NOTICE') {
      setPriority('URGENT');
      setDaysInactiveFilter(7);
      // Reset selected member if active
      if (selectedMemberId) {
        const mem = members.find((m) => m.id === selectedMemberId);
        if (mem && mem.status === 'ACTIVE') {
          setSelectedMemberId('');
        }
      }
    } else {
      setPriority('NORMAL');
      setDaysInactiveFilter(3);
    }
  };

  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId);
  }, [members, selectedMemberId]);

  const renderedPreview = useMemo(() => {
    const memName = selectedMember ? selectedMember.name : 'মেম্বার নাম';
    const memNum = selectedMember ? selectedMember.member_number || 'SLB-XXX' : 'SLB-XXX';
    return content
      .replace(/{member_name}/g, memName)
      .replace(/{member_number}/g, memNum)
      .replace(/{days_inactive}/g, String(daysInactiveFilter));
  }, [content, selectedMember, daysInactiveFilter]);

  const handleGenerateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setStatusMessage({ type: 'error', text: 'শিরোনাম ও বক্তব্য আবশ্যক।' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      if (generatorMode === 'SINGLE') {
        if (!selectedMemberId) {
          setStatusMessage({ type: 'error', text: 'অনুগ্রহ করে একজন মেম্বার নির্বাচন করুন।' });
          setSubmitting(false);
          return;
        }

        if (selectedType === 'KICKOUT_NOTICE' && selectedMember?.status === 'ACTIVE') {
          setStatusMessage({
            type: 'error',
            text: 'সতর্কতা: কোনো অ্যাক্টিভ মেম্বারকে Kickout Notice পাঠানো যাবে না। শুধুমাত্র বহিষ্কৃত বা রিমুভড মেম্বার নির্বাচন করুন।',
          });
          setSubmitting(false);
          return;
        }

        const res = await generateNotice({
          memberId: selectedMemberId,
          type: selectedType,
          title: title.trim(),
          content: renderedPreview,
          level: selectedType,
          daysInactiveFilter,
          isPinned,
          priority,
        });

        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `সফলভাবে ${selectedMember?.name || 'মেম্বার'}-কে নোটিশ ও নোটিফিকেশন পাঠানো হয়েছে।`,
          });
          setModalOpen(false);
        } else {
          setStatusMessage({ type: 'error', text: res.error || 'নোটিশ পাঠাতে ব্যর্থ হয়েছে।' });
        }
      } else {
        // BULK DISPATCH
        const targetIds = inactiveMembers.map((m) => m.id);
        if (targetIds.length === 0) {
          setStatusMessage({ type: 'error', text: 'বাল্ক নোটিশ পাঠানোর মতো কোনো মেম্বার পাওয়া যায়নি।' });
          setSubmitting(false);
          return;
        }

        const res = await bulkGenerateNotices({
          memberIds: targetIds,
          type: selectedType,
          title: title.trim(),
          contentTemplate: content.trim(),
          level: selectedType,
          daysInactiveFilter,
          priority,
        });

        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `সফলভাবে মোট ${res.success_count || targetIds.length} জন মেম্বারকে বাল্ক নোটিশ প্রেরণ করা হয়েছে!`,
          });
          setModalOpen(false);
        } else {
          setStatusMessage({ type: 'error', text: res.error || 'বাল্ক নোটিশ ব্যর্থ হয়েছে।' });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'ত্রুটি ঘটেছে।' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (noticeId: string) => {
    if (!window.confirm('আপনি কি এই নোটিশটি বাতিল (Revoke) করতে চান?')) return;
    const res = await revokeNotice(noticeId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'নোটিশ সফলভাবে প্রত্যাহার করা হয়েছে।' });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'প্রত্যাহার ব্যর্থ হয়েছে।' });
    }
  };

  const getNoticeBadge = (notice: NoticeItem) => {
    if (notice.status === 'REVOKED') {
      return (
        <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Ban className="w-3 h-3 text-slate-500" />
          <span>REVOKED (প্রত্যাহারকৃত)</span>
        </span>
      );
    }

    switch (notice.type) {
      case 'KICKOUT_NOTICE':
      case 'KICKOUT_WARNING':
        return (
          <span className="bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
            <span>🔴 KICKOUT NOTICE</span>
          </span>
        );
      case 'ALERT_WARNING':
        return (
          <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>⚠️ ALERT WARNING</span>
          </span>
        );
      case 'SIMPLE_WARNING':
        return (
          <span className="bg-yellow-950 text-yellow-300 border border-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span>⚡ SIMPLE NOTICE</span>
          </span>
        );
      default:
        return (
          <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Bell className="w-3 h-3 text-blue-400" />
            <span>📢 ANNOUNCEMENT</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-amber-400 font-bold uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>Chapter 14 — Announcement & Notice System</span>
          </div>
          <h1 className="text-2xl font-black text-white">Community Notices & Warnings</h1>
          <p className="text-xs text-slate-400 mt-1">
            কমিউনিটি নোটিশ বোর্ড, ৩-লেভেল সতর্কবার্তা এবং রিয়েল-টাইম নোটিফিকেশন সেন্টার
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>নোটিশ ও ওয়ার্নিং জেনারেটর</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Feedback Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notices Feed */}
      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
            <p className="text-sm font-semibold text-slate-400">বর্তমানে কোনো সক্রিয় নোটিশ নেই</p>
          </div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg relative transition ${
                notice.status === 'REVOKED'
                  ? 'border-slate-800 opacity-60 bg-slate-950/40'
                  : notice.is_pinned
                  ? 'border-cyan-500/40 bg-cyan-950/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {getNoticeBadge(notice)}
                  {notice.is_pinned && notice.status !== 'REVOKED' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800">
                      <Pin className="w-3 h-3" />
                      <span>PINNED</span>
                    </span>
                  )}
                  {notice.days_inactive_filter && (
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">
                      {notice.days_inactive_filter}+ Days Inactive
                    </span>
                  )}
                  {notice.priority === 'URGENT' && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                      জরুরি (URGENT)
                    </span>
                  )}
                </div>

                {isAdmin && notice.status !== 'REVOKED' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRevoke(notice.id)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/80 transition flex items-center gap-1"
                      title="নোটিশ প্রত্যাহার করুন"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Revoke</span>
                    </button>
                    <button
                      onClick={() => deleteNotice(notice.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 transition"
                      title="ডিলিট নোটিশ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-base font-bold text-white mb-2">{notice.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {notice.content}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>প্রকাশক: {notice.created_by_name || 'System Admin'}</span>
                <span>{formatToBDT(notice.created_at, true)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notice & Warning Generator Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Notice & Warning Generator (Chapter 14)</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateNotice} className="space-y-4 text-xs">
              {/* Warning Level Selection (3 Levels) */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  ওয়ার্নিং / নোটিশ লেভেল নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('SIMPLE_WARNING')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      selectedType === 'SIMPLE_WARNING'
                        ? 'bg-yellow-950/40 border-yellow-500 text-yellow-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Level 1: Simple Notice</span>
                    </span>
                    <span className="text-[11px] text-slate-400">ফ্রেন্ডলি রিমাইন্ডার (ইন-অ্যাক্টিভ মেম্বারদের জন্য)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('ALERT_WARNING')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      selectedType === 'ALERT_WARNING'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Level 2: Alert Warning</span>
                    </span>
                    <span className="text-[11px] text-slate-400">জরুরি সতর্কবার্তা ও স্পেশাল ডিউটি সতর্কতা</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('KICKOUT_NOTICE')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      selectedType === 'KICKOUT_NOTICE'
                        ? 'bg-red-950/40 border-red-500 text-red-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                      <span>Level 3: Kickout Notice</span>
                    </span>
                    <span className="text-[11px] text-slate-400">বহিষ্কার নোটিশ (শুধুমাত্র রিমুভড মেম্বারদের জন্য)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('GENERAL_ANNOUNCEMENT')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      selectedType === 'GENERAL_ANNOUNCEMENT'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-400" />
                      <span>General Announcement</span>
                    </span>
                    <span className="text-[11px] text-slate-400">সার্বজনীন কমিউনিটি ঘোষণা</span>
                  </button>
                </div>
              </div>

              {/* Mode Switch: Single vs Bulk */}
              <div className="flex items-center gap-4 pt-1">
                <label className="text-slate-300 font-bold">প্রেরণ পদ্ধতি:</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="genMode"
                      checked={generatorMode === 'SINGLE'}
                      onChange={() => setGeneratorMode('SINGLE')}
                      className="text-cyan-500"
                    />
                    <span>নির্দিষ্ট একক মেম্বার (Single)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="genMode"
                      checked={generatorMode === 'BULK'}
                      onChange={() => setGeneratorMode('BULK')}
                      className="text-cyan-500"
                    />
                    <span>বাল্ক ফিল্টার (Bulk Inactive)</span>
                  </label>
                </div>
              </div>

              {/* Target Member Selection (if Single) */}
              {generatorMode === 'SINGLE' ? (
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    মেম্বার নির্বাচন করুন:
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  >
                    <option value="">-- মেম্বার সিলেক্ট করুন --</option>
                    {members.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={selectedType === 'KICKOUT_NOTICE' && m.status === 'ACTIVE'}
                      >
                        {m.name} ({m.member_number}) — {m.status}{' '}
                        {selectedType === 'KICKOUT_NOTICE' && m.status === 'ACTIVE'
                          ? ' [Kickout নিষিদ্ধ: Active Member]'
                          : ''}
                      </option>
                    ))}
                  </select>
                  {selectedType === 'KICKOUT_NOTICE' && selectedMember?.status === 'ACTIVE' && (
                    <p className="text-[11px] text-red-400 mt-1">
                      ⚠️ নীতিমালার নিয়ম: অ্যাক্টিভ মেম্বারকে Kickout Notice পাঠানো নিষেধ।
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>লক্ষ্যবস্তু মেম্বার সংখ্যা:</span>
                  </div>
                  <span className="font-bold text-cyan-400 font-mono text-sm">
                    {inactiveMembers.length} জন মেম্বার
                  </span>
                </div>
              )}

              {/* Inactive Days Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    নিষ্ক্রিয় দিনের পরিমাপ (Days Inactive):
                  </label>
                  <select
                    value={daysInactiveFilter}
                    onChange={(e) => setDaysInactiveFilter(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value={3}>৩ দিন বা ততোধিক (3+ Days)</option>
                    <option value={5}>৫ দিন বা ততোধিক (5+ Days)</option>
                    <option value={7}>৭ দিন বা ততোধিক (7+ Days)</option>
                    <option value={10}>১০ দিন বা ততোধিক (10+ Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">অগ্রাধিকার (Priority):</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="NORMAL">স্বাভাবিক (NORMAL)</option>
                    <option value="HIGH">উচ্চ (HIGH)</option>
                    <option value="URGENT">জরুরি (URGENT)</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">শিরোনাম (Title):</label>
                <input
                  type="text"
                  required
                  placeholder="নোটিশের শিরোনাম লিখুন..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              {/* Content Template */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  বক্তব্য টেমপ্লেট (Placeholders: {`{member_name}`}, {`{member_number}`}, {`{days_inactive}`}):
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="বক্তব্য লিখুন..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white leading-relaxed"
                />
              </div>

              {/* Live Preview Box */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>লাইভ রেন্ডার্ড প্রিভিউ (Live Preview)</span>
                </div>
                <div className="text-xs text-white font-bold">{title}</div>
                <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed border-l-2 border-cyan-500 pl-3 py-1">
                  {renderedPreview}
                </div>
              </div>

              {/* Pin Option */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded text-cyan-500"
                  />
                  <span>নোটিশ বোর্ডে উপরে পিন করে রাখুন (Pinned Notice)</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>প্রেরণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>নোটিশ ও নোটিফিকেশন পাঠান</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

