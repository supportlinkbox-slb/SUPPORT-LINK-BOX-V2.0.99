import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Save, AlertTriangle, Image, Video, Loader2 } from 'lucide-react';
import { DailyLink, PostType } from '../../types';
import { useApp } from '../../context/AppContext';
import { getRemainingEditSeconds } from '../../utils/bangladeshTime';
import { isValidFacebookUrl } from '../../utils/facebookLinks';

interface LinkEditModalProps {
  link: DailyLink | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LinkEditModal: React.FC<LinkEditModalProps> = ({ link, isOpen, onClose }) => {
  const { currentUser, editDailyLink, deleteDailyLink } = useApp();

  const [postType, setPostType] = useState<PostType>('Photo');
  const [caption, setCaption] = useState('');
  const [instruction, setInstruction] = useState('');
  const [fbLink, setFbLink] = useState('');
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  useEffect(() => {
    if (link) {
      setPostType(link.post_type || 'Photo');
      setCaption(link.caption || '');
      setInstruction(link.instruction || '');
      setFbLink(link.fb_link || '');
    }
  }, [link]);

  useEffect(() => {
    if (!link || isAdmin) return;
    const tick = () => {
      const sec = getRemainingEditSeconds(link.submitted_at);
      setRemainingSec(sec);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [link, isAdmin]);

  if (!isOpen || !link) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isValidFacebookUrl(fbLink)) {
      setErrorMsg('অনুগ্রহ করে সঠিক ফেসবুক পোস্টের লিংক দিন (যেমন: https://www.facebook.com/...)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await editDailyLink(link.id, {
        post_type: postType,
        caption,
        instruction,
        fb_link: fbLink,
      });
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update link');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('আপনি কি নিশ্চিত এই লিংকটি ডিলিট করতে চান? লিংক মুছে ফেললে এর সিরিয়াল নম্বর সংরক্ষিত থাকবে কিন্তু লিংকটি তালিকা থেকে সরানো হবে।')) return;
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await deleteDailyLink(link.id);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to delete link');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs px-2 py-0.5 rounded border border-cyan-500/30">
              #{link.serial_display}
            </span>
            <h3 className="text-sm font-bold text-white">লিংক এডিট / ডিলিট</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAdmin && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 text-xs flex items-center justify-between text-amber-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>অবশিষ্ট এডিট সময়:</span>
            </span>
            <span className="font-mono font-bold text-sm text-amber-400">
              {Math.floor(remainingSec / 60)}:
              {String(remainingSec % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-4 space-y-3">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Post Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">পোস্ট টাইপ</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPostType('Photo')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${
                  postType === 'Photo'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>Photo Post</span>
              </button>
              <button
                type="button"
                onClick={() => setPostType('Video')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${
                  postType === 'Video'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video Post</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">ফেসবুক লিংক</label>
            <input
              type="url"
              value={fbLink}
              onChange={(e) => setFbLink(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">ক্যাপশন</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">নির্দেশনা</label>
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting || (!isAdmin && remainingSec <= 0)}
              onClick={handleDelete}
              className="px-3.5 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ডিলিট</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (!isAdmin && remainingSec <= 0)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-cyan-600/20"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
