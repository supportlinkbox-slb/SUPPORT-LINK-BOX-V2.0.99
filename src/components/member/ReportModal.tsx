import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { DailyLink, ReportCategory } from '../../types';
import { useApp } from '../../context/AppContext';

interface ReportModalProps {
  link: DailyLink | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ link, isOpen, onClose }) => {
  const { submitReport } = useApp();

  const [category, setCategory] = useState<ReportCategory>('link_not_working');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !link) return null;

  const categories: { id: ReportCategory; label: string }[] = [
    { id: 'link_not_working', label: 'Link not working (লিংক ওপেন হচ্ছে না)' },
    { id: 'comments_disabled', label: 'Comments disabled (কমেন্ট বন্ধ আছে)' },
    { id: 'post_not_public', label: 'Post not public (পোস্ট পাবলিক নেই / অনলি ফ্রেন্ডস)' },
    { id: 'react_comment_disabled', label: 'React & Comment both disabled (রিয়েক্ট ও কমেন্ট উভয়ই বন্ধ)' },
    { id: 'adult_post', label: 'Adult Post (অনুপযুক্ত / অ্যাডাল্ট পোস্ট)' },
    { id: 'political_post', label: 'Political Post (রাজনৈতিক বিতর্কিত পোস্ট)' },
    { id: 'other', label: 'Other issue (অন্যান্য সমস্যা)' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await submitReport({
      link_id: link.id,
      category,
      description: description.trim() || 'No description provided',
      screenshot_url: screenshotUrl.trim() || undefined,
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-red-950/40 p-4 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">লিংক সংক্রান্ত অভিযোগ জানান</h3>
              <p className="text-[11px] text-slate-400">লিংক #{link.serial_display} • {link.owner_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="text-base font-bold text-white">রিপোর্ট জমা নেওয়া হয়েছে</div>
            <p className="text-xs text-slate-400">এডমিন ও লিংক মালিক দ্রুত তদন্ত করে ব্যবস্থা গ্রহণ করবেন।</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                সমস্যার ধরণ নির্বাচন করুন:
              </label>
              <div className="space-y-1.5">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      category === cat.id
                        ? 'bg-red-500/10 border-red-500/40 text-red-300 font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_cat"
                      value={cat.id}
                      checked={category === cat.id}
                      onChange={() => setCategory(cat.id)}
                      className="text-red-500 focus:ring-0"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                বিস্তারিত বিবরণ (ঐচ্ছিক):
              </label>
              <textarea
                rows={3}
                placeholder="সমস্যাটি স্পষ্টভাবে বুঝিয়ে লিখুন..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                স্ক্রিনশট ইমেজ লিংক (ঐচ্ছিক):
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'পাঠানো হচ্ছে...' : 'রিপোর্ট সাবমিট করুন'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
