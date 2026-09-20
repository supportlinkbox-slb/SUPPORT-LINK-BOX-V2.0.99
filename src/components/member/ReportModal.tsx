import React, { useState, useRef } from 'react';
import { X, ShieldAlert, Send, CheckCircle2, Upload, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { DailyLink, ReportCategory } from '../../types';
import { useApp } from '../../context/AppContext';
import { reportsApi } from '../../lib/supabase';

interface ReportModalProps {
  link: DailyLink | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ link, isOpen, onClose }) => {
  const { submitReport } = useApp();

  const [category, setCategory] = useState<ReportCategory>('LINK_NOT_WORKING');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [generatedSerial, setGeneratedSerial] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !link) return null;

  const categories: { id: ReportCategory; label: string }[] = [
    { id: 'LINK_NOT_WORKING', label: 'Link not working (লিংক ওপেন হচ্ছে না)' },
    { id: 'COMMENTS_DISABLED', label: 'Comments disabled (কমেন্ট বন্ধ আছে)' },
    { id: 'POST_NOT_PUBLIC', label: 'Post not public (পোস্ট পাবলিক নেই / অনলি ফ্রেন্ডস)' },
    { id: 'REACTION_COMMENT_DISABLED', label: 'React & Comment both disabled (রিয়েক্ট ও কমেন্ট উভয়ই বন্ধ)' },
    { id: 'ADULT_POST', label: 'Adult Post (অনুপযুক্ত / অ্যাডাল্ট পোস্ট)' },
    { id: 'POLITICAL_POST', label: 'Political Post (রাজনৈতিক বিতর্কিত পোস্ট)' },
    { id: 'other', label: 'Other issue (অন্যান্য সমস্যা)' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMessage(null);
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('ফাইলের সাইজ সর্বোচ্চ ৫ MB হতে পারবে।');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('কেবলমাত্র PNG, JPG অথবা WEBP ফরম্যাটের ছবি আপলোড করুন।');
      return;
    }

    setFileToUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    let finalScreenshotUrl = screenshotUrl.trim();

    if (fileToUpload) {
      setUploading(true);
      const uploadRes = await reportsApi.uploadScreenshot(fileToUpload);
      setUploading(false);

      if (uploadRes.success && uploadRes.data?.publicUrl) {
        finalScreenshotUrl = uploadRes.data.publicUrl;
      } else if (!uploadRes.success) {
        setErrorMessage(uploadRes.error || 'স্ক্রিনশট আপলোড করতে সমস্যা হয়েছে।');
        setSubmitting(false);
        return;
      }
    }

    const res = await submitReport({
      link_id: link.id,
      category,
      description: description.trim() || 'No description provided',
      screenshot_url: finalScreenshotUrl || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setGeneratedSerial(res.data?.report_serial || null);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setGeneratedSerial(null);
        setFileToUpload(null);
        setDescription('');
        setScreenshotUrl('');
        onClose();
      }, 2500);
    } else {
      setErrorMessage(res.error || 'রিপোর্ট জমা দেওয়া সম্ভব হয়নি।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-red-950/40 p-4 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">লিংক সংক্রান্ত অভিযোগ জানান</h3>
              <p className="text-[11px] text-slate-400">
                লিংক #{link.serial_display} • {link.owner_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-base font-bold text-white">রিপোর্ট জমা নেওয়া হয়েছে</div>
            {generatedSerial && (
              <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-mono font-bold text-red-400 border border-red-900/40">
                Tracking ID: {generatedSerial}
              </div>
            )}
            <p className="text-xs text-slate-400">এডমিন ও লিংক মালিকের কাছে স্বয়ংক্রিয় নোটিফিকেশন পাঠানো হয়েছে।</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                সমস্যার ধরণ নির্বাচন করুন:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                প্রমাণ / স্ক্রিনশট সংযুক্ত করুন (সর্বোচ্চ ৫ MB):
              </label>
              <div className="flex flex-col gap-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-3 text-center cursor-pointer bg-slate-950 hover:bg-slate-900/50 transition flex items-center justify-center gap-2 text-xs text-slate-400"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{fileToUpload ? fileToUpload.name : 'ছবি সিলেক্ট করতে ক্লিক করুন (PNG/JPG/WEBP)'}</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[10px] text-slate-500 uppercase font-bold">অথবা লিংক দিন</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <div className="relative">
                  <ImageIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={screenshotUrl}
                    onChange={(e) => setScreenshotUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || uploading}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{uploading ? 'আপলোড হচ্ছে...' : submitting ? 'পাঠানো হচ্ছে...' : 'রিপোর্ট সাবমিট করুন'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
