import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  X,
  Sparkles,
  Link as LinkIcon,
  Video,
  Image,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScheduledLink, PostType } from '../../types';
import {
  getBangladeshTomorrowDateString,
  canScheduleForTomorrow,
  formatToBDT,
} from '../../utils/bangladeshTime';
import { isValidFacebookUrl } from '../../utils/facebookLinks';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    scheduledLinks,
    createScheduledLink,
    cancelScheduledLink,
    editScheduledLink,
    executeDueScheduledLinks,
  } = useApp();

  const tomorrowDate = getBangladeshTomorrowDateString();
  const scheduleCheck = canScheduleForTomorrow();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  const [postType, setPostType] = useState<PostType>('Photo');
  const [caption, setCaption] = useState('');
  const [instruction, setInstruction] = useState('');
  const [fbLink, setFbLink] = useState('');
  const [targetDate, setTargetDate] = useState(tomorrowDate);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Filter schedules for user or all for admins
  const mySchedules = scheduledLinks.filter((s) =>
    isAdmin ? true : s.owner_id === currentUser?.id
  );

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fbLink.trim()) {
      setErrorMsg('অনুগ্রহ করে ফেসবুক পোস্ট লিংক প্রদান করুন।');
      return;
    }

    if (!isValidFacebookUrl(fbLink)) {
      setErrorMsg('সঠিক ফেসবুক লিংক দিন (যেমন: https://www.facebook.com/...)');
      return;
    }

    if (!isAdmin && targetDate === tomorrowDate && !scheduleCheck.isAllowed) {
      setErrorMsg(scheduleCheck.message);
      return;
    }

    setIsSubmitting(true);

    if (editingScheduleId) {
      const res = await editScheduledLink(editingScheduleId, {
        post_type: postType,
        caption: caption.trim() || 'No caption',
        instruction: instruction.trim() || 'Like and Comment',
        fb_link: fbLink.trim(),
      });
      setIsSubmitting(false);
      if (res.success) {
        setSuccessMsg('শিডিউল সফলভাবে আপডেট করা হয়েছে!');
        setEditingScheduleId(null);
        setCaption('');
        setInstruction('');
        setFbLink('');
      } else {
        setErrorMsg(res.error || 'শিডিউল এডিট ব্যর্থ হয়েছে।');
      }
    } else {
      const res = await createScheduledLink({
        target_date: targetDate,
        post_type: postType,
        caption: caption.trim() || 'No caption',
        instruction: instruction.trim() || 'Like and Comment',
        fb_link: fbLink.trim(),
      });
      setIsSubmitting(false);
      if (res.success) {
        setSuccessMsg('পরবর্তী দিনের লিংক সফলভাবে শিডিউল করা হয়েছে!');
        setCaption('');
        setInstruction('');
        setFbLink('');
      } else {
        setErrorMsg(res.error || 'শিডিউল তৈরি ব্যর্থ হয়েছে।');
      }
    }
  };

  const handleStartEdit = (s: ScheduledLink) => {
    setEditingScheduleId(s.id);
    setPostType(s.post_type);
    setCaption(s.caption);
    setInstruction(s.instruction);
    setFbLink(s.fb_link);
    setTargetDate(s.target_date);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancelEdit = () => {
    setEditingScheduleId(null);
    setCaption('');
    setInstruction('');
    setFbLink('');
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (window.confirm('আপনি কি এই শিডিউলটি বাতিল করতে চান?')) {
      const res = await cancelScheduledLink(scheduleId, 'User canceled');
      if (res.success) {
        setSuccessMsg('শিডিউল লিংক বাতিল করা হয়েছে।');
      } else {
        setErrorMsg(res.error || 'শিডিউল বাতিল করা যায়নি।');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">আগাম লিংক শিডিউলিং (Scheduling)</h2>
              <p className="text-xs text-slate-400">
                পরবর্তী দিনের সাপোর্ট লিংক আগে থেকেই প্রস্তুত ও শিডিউল করে রাখুন
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

        {/* Schedule Opening Notice */}
        <div
          className={`px-5 py-3 border-b text-xs flex items-center justify-between ${
            scheduleCheck.isAllowed || isAdmin
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {isAdmin
                ? 'এডমিন এক্সেস: যেকোনো সময়ের জন্য আনলিমিটেড শিডিউল প্রস্তুত করতে পারবেন।'
                : scheduleCheck.message}
            </span>
          </div>
          <span className="font-mono font-bold text-[11px] bg-slate-950/60 px-2 py-0.5 rounded">
            আগামীকাল: {tomorrowDate}
          </span>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCreateOrEdit} className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {editingScheduleId ? 'শিডিউল এডিট করুন' : 'নতুন শিডিউল যোগ করুন'}
              </span>
              {editingScheduleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  বাতিল করুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  তারিখ (Target Date)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  disabled={!isAdmin && Boolean(editingScheduleId)}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  পোস্ট টাইপ (Post Type)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostType('Photo')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                      postType === 'Photo'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <Image className="w-3.5 h-3.5" />
                    <span>ছবি (Photo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('Video')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                      postType === 'Video'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>ভিডিও / রিলস</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ফেসবুক পোস্ট লিংক <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://www.facebook.com/..."
                value={fbLink}
                onChange={(e) => setFbLink(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ক্যাপশন</label>
                <input
                  type="text"
                  placeholder="পোস্ট ক্যাপশন"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  সাপোর্ট নির্দেশনা
                </label>
                <input
                  type="text"
                  placeholder="যেমন: Love React and Relevant Comment"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (!isAdmin && !scheduleCheck.isAllowed && !editingScheduleId)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>
                {editingScheduleId ? 'শিডিউল সংরক্ষণ করুন' : 'শিডিউল নিশ্চিত করুন'}
              </span>
            </button>
          </form>

          {/* List of active schedules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                আপনার শিডিউল তালিকা ({mySchedules.length})
              </h3>
              {isAdmin && (
                <button
                  onClick={() => executeDueScheduledLinks()}
                  className="text-[11px] px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-300 font-medium transition"
                >
                  Run Due Schedules Now
                </button>
              )}
            </div>

            {mySchedules.length === 0 ? (
              <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500">
                কোনো শিডিউল করা লিংক পাওয়া যায়নি।
              </div>
            ) : (
              <div className="space-y-2.5">
                {mySchedules.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-purple-800">
                          {s.target_date}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {s.post_type}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            s.status === 'executed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : s.status === 'pending'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {s.status}
                        </span>
                        {isAdmin && (
                          <span className="text-[10px] text-slate-400">
                            ({s.owner_name})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white font-medium truncate">{s.caption || 'No caption'}</p>
                      <a
                        href={s.fb_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-cyan-400 hover:underline truncate block"
                      >
                        {s.fb_link}
                      </a>
                    </div>

                    {s.status === 'pending' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(s)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-300 transition"
                          title="এডিট"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancelSchedule(s.id)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition"
                          title="বাতিল করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
