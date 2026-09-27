import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NoticeType, MemberProfile } from '../../types';

interface AdminNoticeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminNoticeGeneratorModal: React.FC<AdminNoticeGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { members, bulkGenerateNotices, currentUser } = useApp();

  const [inactivityFilter, setInactivityFilter] = useState<'ALL' | '3' | '5' | '7' | '15'>('3');
  const [noticeType, setNoticeType] = useState<NoticeType>('WARNING');
  const [level, setLevel] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [title, setTitle] = useState('নিয়মিত সাপোর্ট ও সক্রিয়তা নোটিশ');
  const [contentTemplate, setContentTemplate] = useState(
    'সম্মানিত {member_name} ({member_number}), আপনি বিগত {days_inactive} দিন ধরে গ্রুপে নিয়মিত সাপোর্ট প্রদানে নিষ্ক্রিয় আছেন। অনুগ্রহ করে আজই আজকের লিংকে সাপোর্ট সম্পন্ন করে অল ডান করুন, অন্যথায় আপনার অ্যাকাউন্ট স্থগিত হতে পারে।'
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Compute matching inactive members
  const matchedMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.status !== 'ACTIVE' && m.status !== 'INACTIVE') return false;
      const days = m.days_inactive || 0;
      if (inactivityFilter === 'ALL') return true;
      if (inactivityFilter === '3') return days >= 3;
      if (inactivityFilter === '5') return days >= 5;
      if (inactivityFilter === '7') return days >= 7;
      if (inactivityFilter === '15') return days >= 15;
      return false;
    });
  }, [members, inactivityFilter]);

  // Pre-select all matching members when filter changes
  React.useEffect(() => {
    setSelectedMemberIds(matchedMembers.map((m) => m.id));
  }, [matchedMembers]);

  // Update default template when inactivity filter changes
  const handleInactivityFilterChange = (filter: 'ALL' | '3' | '5' | '7' | '15') => {
    setInactivityFilter(filter);
    if (filter === '3') {
      setTitle('সতর্কবার্তা: ৩ দিন নিষ্ক্রিয়তা');
      setContentTemplate(
        'সম্মানিত {member_name} ({member_number}), আপনি ৩ দিন ধরে গ্রুপে অনিয়মিত। অনুগ্রহ করে আজকের লিংকে সাপোর্ট প্রদান করে গ্রুপকে সচল রাখুন।'
      );
      setLevel('WARNING');
    } else if (filter === '5') {
      setTitle('জরুরি নোটিশ: ৫ দিন সাপোর্ট অনুপস্থিত');
      setContentTemplate(
        'সদস্য {member_name} ({member_number}), আপনি টানা ৫ দিন অল ডান ও সাপোর্ট সম্পন্ন করেননি। দ্রুত কার্যক্রম শুরু করুন।'
      );
      setLevel('WARNING');
    } else if (filter === '7') {
      setTitle('চূড়ান্ত সতর্কতা: ৭ দিন নিষ্ক্রিয়তা ডিউটি');
      setContentTemplate(
        'সদস্য {member_name} ({member_number}), ৭ দিন নিষ্ক্রিয় থাকার কারণে আপনার ওপর স্পেশাল সাপোর্ট ডিউটি পেনাল্টি প্রযোজ্য হতে চলেছে। অনতিবিলম্বে এডমিনের সাথে যোগাযোগ করুন।'
      );
      setLevel('CRITICAL');
    } else if (filter === '15') {
      setTitle('অ্যাকাউন্ট অপসারণ সতর্কতা: ১৫+ দিন নিষ্ক্রিয়');
      setContentTemplate(
        'সদস্য {member_name} ({member_number}), আপনি ১৫ দিনের অধিক সময় ধরে নিষ্ক্রিয়। ২৪ ঘণ্টার মধ্যে সক্রিয় না হলে অ্যাকাউন্ট অপসারণ (REMOVED) করা হবে।'
      );
      setLevel('CRITICAL');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedMemberIds.length === matchedMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(matchedMembers.map((m) => m.id));
    }
  };

  const handleToggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) {
      setResultMsg({ success: false, text: 'কমপক্ষে একজন সদস্য নির্বাচন করুন।' });
      return;
    }
    if (!title.trim() || !contentTemplate.trim()) {
      setResultMsg({ success: false, text: 'শিরোনাম ও নোটিশের বিবরণ পূরণ করুন।' });
      return;
    }

    setIsSubmitting(true);
    setResultMsg(null);

    const daysInactiveNum = inactivityFilter === 'ALL' ? 3 : parseInt(inactivityFilter);

    const res = await bulkGenerateNotices({
      memberIds: selectedMemberIds,
      type: noticeType,
      title: title.trim(),
      contentTemplate: contentTemplate.trim(),
      level: level,
      daysInactiveFilter: daysInactiveNum,
      priority: level === 'CRITICAL' ? 'URGENT' : 'NORMAL',
    });

    setIsSubmitting(false);

    if (res.success) {
      setResultMsg({
        success: true,
        text: `সফলভাবে ${res.success_count ?? selectedMemberIds.length} জন নিষ্ক্রিয় সদস্যকে নোটিশ পাঠানো হয়েছে!`,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setResultMsg({
        success: false,
        text: res.error || 'নোটিশ পাঠাতে ব্যর্থ হয়েছে।',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>স্মার্ট নোটিশ জেনারেটর</span>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  INACTIVITY ENGINE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ৩+, ৫+, ৭+, ১৫+ দিন নিষ্ক্রিয় সদস্যদের ফিল্টার করে স্বয়ংক্রিয় বাল্ক নোটিশ প্রেরণ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSendBulk} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {resultMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                resultMsg.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/60 border-red-800 text-red-300'
              }`}
            >
              {resultMsg.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{resultMsg.text}</span>
            </div>
          )}

          {/* Inactivity Threshold Filter Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>নিষ্ক্রিয়তার সীমা ফিল্টার (Inactivity Filter):</span>
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">
                ম্যাচ করেছে: {matchedMembers.length} জন
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { id: '3', label: '৩+ দিন নিষ্ক্রিয়', desc: 'সাধারণ সতর্কতা' },
                  { id: '5', label: '৫+ দিন নিষ্ক্রিয়', desc: 'জরুরি রিমাইন্ডার' },
                  { id: '7', label: '৭+ দিন নিষ্ক্রিয়', desc: 'ডিউটি পেনাল্টি' },
                  { id: '15', label: '১৫+ দিন নিষ্ক্রিয়', desc: 'রিমুভ ওয়ার্নিং' },
                  { id: 'ALL', label: 'সকল সদস্য', desc: 'গ্রুপ ব্রডকাস্ট' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleInactivityFilterChange(tab.id)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    inactivityFilter === tab.id
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <div className="text-xs font-bold">{tab.label}</div>
                  <div className="text-[10px] text-slate-500">{tab.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notice Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">নোটিশের ধরন</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="WARNING">সতর্কবার্তা (WARNING)</option>
                <option value="SYSTEM">সাধারণ নোটিশ (SYSTEM)</option>
                <option value="ALERT_WARNING">জরুরি অ্যালার্ট (ALERT)</option>
                <option value="KICKOUT_NOTICE">বহিষ্কার নোটিশ (KICKOUT)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">তীব্রতার মাত্রা (Level)</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="INFO">সাধারণ (INFO)</option>
                <option value="WARNING">সতর্কতামূলক (WARNING)</option>
                <option value="CRITICAL">জরুরি ও বিপজ্জনক (CRITICAL)</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">নোটিশের শিরোনাম</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Template Content */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>বার্তা টেমপ্লেট</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ট্যাগ: {'{member_name}'}, {'{member_number}'}, {'{days_inactive}'}
              </span>
            </div>
            <textarea
              rows={3}
              value={contentTemplate}
              onChange={(e) => setContentTemplate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Matched Recipients Multi-select Section */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>প্রাপক সদস্যবৃন্দ ({selectedMemberIds.length}/{matchedMembers.length} জন নির্বাচিত)</span>
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] text-amber-400 hover:underline font-semibold flex items-center gap-1"
              >
                {selectedMemberIds.length === matchedMembers.length ? (
                  <>
                    <Square className="w-3 h-3" />
                    <span>সব বাতিল করুন</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3 h-3" />
                    <span>সব নির্বাচন করুন</span>
                  </>
                )}
              </button>
            </div>

            {matchedMembers.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
                এই ফিল্টারে কোনো নিষ্ক্রিয় সদস্য পাওয়া যায়নি।
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-850 p-1">
                {matchedMembers.map((m) => {
                  const isSelected = selectedMemberIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleMember(m.id)}
                      className={`px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-xs transition ${
                        isSelected ? 'bg-amber-500/10 text-white' : 'text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                        <span className="font-bold">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">({m.member_number})</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-900/50">
                        {m.days_inactive || 0} দিন নিষ্ক্রিয়
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>রিয়েল-টাইম নোটিফিকেশন ও নোটিশ বোর্ডে পোস্ট হবে</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedMemberIds.length === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'প্রেরণ করা হচ্ছে...' : `নোটিশ পাঠান (${selectedMemberIds.length})`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
