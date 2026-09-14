import React, { useState } from 'react';
import { AlertTriangle, Pin, Bell, ShieldAlert, Plus, Trash2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NoticeType } from '../../types';
import { formatToBDT } from '../../utils/bangladeshTime';

export const NoticeSection: React.FC = () => {
  const { notices, addNotice, deleteNotice, currentUser, members } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NoticeType>('GENERAL_ANNOUNCEMENT');
  const [daysFilter, setDaysFilter] = useState<number | undefined>(undefined);
  const [isPinned, setIsPinned] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addNotice({
      title: title.trim(),
      content: content.trim(),
      type,
      created_by_name: currentUser?.name || 'Admin',
      is_pinned: isPinned,
      days_inactive_filter: daysFilter,
    });
    setModalOpen(false);
    setTitle('');
    setContent('');
  };

  const getNoticeBadge = (t: NoticeType) => {
    switch (t) {
      case 'KICKOUT_WARNING':
        return <span className="bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 KICKOUT WARNING</span>;
      case 'ALERT_WARNING':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">⚠️ ALERT WARNING</span>;
      case 'SIMPLE_WARNING':
        return <span className="bg-yellow-950 text-yellow-300 border border-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">⚡ SIMPLE WARNING</span>;
      default:
        return <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">📢 ANNOUNCEMENT</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-amber-400 font-bold uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>অফিসিয়াল নোটিশ ও সতর্কবার্তা</span>
          </div>
          <h1 className="text-2xl font-black text-white">Community Notices</h1>
          <p className="text-xs text-slate-400 mt-1">
            কমিউনিটির গুরুত্বপূর্ণ নিয়মাবলী, নোটিশ ও ইন-অ্যাক্টিভ সতর্কবার্তা
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন নোটিশ দিন</span>
          </button>
        )}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`bg-slate-900 border rounded-2xl p-5 shadow-lg relative ${
              notice.is_pinned ? 'border-cyan-500/40 bg-cyan-950/10' : 'border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                {getNoticeBadge(notice.type)}
                {notice.is_pinned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800">
                    <Pin className="w-3 h-3" />
                    <span>PINNED</span>
                  </span>
                )}
                {notice.days_inactive_filter && (
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">
                    {notice.days_inactive_filter} Days Inactive Warning
                  </span>
                )}
              </div>

              {isAdmin && (
                <button
                  onClick={() => deleteNotice(notice.id)}
                  className="text-slate-500 hover:text-red-400 p-1"
                  title="ডিলিট নোটিশ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <h3 className="text-base font-bold text-white mb-2">{notice.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {notice.content}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>প্রকাশক: {notice.created_by_name}</span>
              <span>{formatToBDT(notice.created_at, true)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Creating Notice */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4">
            <h2 className="text-base font-bold text-white">নতুন নোটিশ প্রকাশ করুন</h2>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">নোটিশের ধরণ:</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="GENERAL_ANNOUNCEMENT">সাধারণ ঘোষণা (General Announcement)</option>
                  <option value="SIMPLE_WARNING">সাধারণ সতর্কবার্তা (Simple Warning)</option>
                  <option value="ALERT_WARNING">গুরুতর সতর্কবার্তা (Alert Warning - Inactive)</option>
                  <option value="KICKOUT_WARNING">বহিষ্কার নোটিশ (Kickout Warning)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">শিরোনাম:</label>
                <input
                  type="text"
                  required
                  placeholder="নোটিশ শিরোনাম লিখুন..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">বিস্তারিত নোটিশ বক্তব্য:</label>
                <textarea
                  rows={4}
                  required
                  placeholder="বক্তব্য লিখুন..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded text-cyan-500"
                  />
                  <span>উপরে পিন করে রাখুন (Pinned)</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  প্রকাশ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
