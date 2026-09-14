import React, { useState } from 'react';
import { X, Link as LinkIcon, AlertCircle, Clock, Image, Video, CheckCircle, Shield, UserCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isValidFacebookUrl } from '../../utils/facebookLinks';

interface LinkSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetMemberId?: string;
}

export const LinkSubmissionModal: React.FC<LinkSubmissionModalProps> = ({
  isOpen,
  onClose,
  defaultTargetMemberId,
}) => {
  const { currentUser, submitDailyLink, members, dailyLinks, todayDate } = useApp();

  const [postType, setPostType] = useState<'Photo' | 'Video'>('Photo');
  const [caption, setCaption] = useState('');
  const [instruction, setInstruction] = useState('');
  const [fbLink, setFbLink] = useState('');
  const [category, setCategory] = useState<'NORMAL' | 'VIP' | 'ADMIN' | 'NOTICE'>('NORMAL');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Admin on behalf of member state
  const isPrivileged = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';
  const [submitOnBehalf, setSubmitOnBehalf] = useState(Boolean(defaultTargetMemberId));
  const [selectedMemberId, setSelectedMemberId] = useState<string>(defaultTargetMemberId || '');
  const [memberSearch, setMemberSearch] = useState('');

  if (!isOpen) return null;

  const targetMember = submitOnBehalf && selectedMemberId
    ? members.find((m) => m.id === selectedMemberId)
    : currentUser;

  // Filter active members for admin dropdown
  const filteredCandidateMembers = members.filter((m) => {
    if (m.status !== 'ACTIVE') return false;
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Double-click protection

    setErrorMessage('');
    setSuccessMessage('');

    if (!currentUser) {
      setErrorMessage('অনুগ্রহ করে প্রথমে লগইন করুন।');
      return;
    }

    if (submitOnBehalf && !selectedMemberId) {
      setErrorMessage('অনুগ্রহ করে যে সদস্যের পক্ষে লিংক জমা দেবেন তাকে নির্বাচন করুন।');
      return;
    }

    if (!fbLink.trim()) {
      setErrorMessage('ফেসবুক পোস্ট লিংক দিন।');
      return;
    }

    if (!isValidFacebookUrl(fbLink)) {
      setErrorMessage('সঠিক ফেসবুক পোস্ট লিংক দিন (যেমন: https://www.facebook.com/...)');
      return;
    }

    setLoading(true);
    const result = await submitDailyLink({
      post_type: postType,
      caption: caption.trim() || 'No caption provided',
      instruction: instruction.trim() || 'Like and Comment',
      fb_link: fbLink.trim(),
      category: isPrivileged ? category : 'NORMAL',
      target_member_id: submitOnBehalf && selectedMemberId ? selectedMemberId : undefined,
    });

    setLoading(false);

    if (result.success) {
      const serial = result.link?.serial_display || 'XX';
      const msg = submitOnBehalf && targetMember
        ? `${targetMember.name} (#${targetMember.member_number})-এর লিংক #${serial} সফলভাবে জমা হয়েছে!`
        : `আপনার লিংক #${serial} সফলভাবে জমা হয়েছে! (+৭ পয়েন্ট যোগ হয়েছে)`;
      setSuccessMessage(msg);
      setTimeout(() => {
        onClose();
        setCaption('');
        setInstruction('');
        setFbLink('');
        setSuccessMessage('');
        setSubmitOnBehalf(false);
        setSelectedMemberId('');
      }, 1500);
    } else {
      setErrorMessage(result.error || 'লিংক জমা দিতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">আজকের লিংক জমা দিন</h2>
              <p className="text-xs text-slate-400">প্রতিদিন ১টি লিংক (সকাল ১০:০০ - বিকাল ৪:৫০ BDT)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Bar */}
        <div className="bg-slate-950/60 px-5 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>জমা দেওয়ার পর</span>
            <span className="text-amber-400 font-bold">২ মিনিট পর্যন্ত</span>
            <span>এডিট ও ডিলিট করা যাবে</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            +5 Submit + 2 On-Time
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Admin On Behalf Mode Selector */}
          {isPrivileged && (
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>লিংক জমার মোড (Admin / Dev):</span>
                </span>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-purple-900">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitOnBehalf(false);
                      setSelectedMemberId('');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      !submitOnBehalf
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    আমার লিংক
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitOnBehalf(true)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      submitOnBehalf
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    সদস্যের পক্ষে
                  </button>
                </div>
              </div>

              {submitOnBehalf && (
                <div className="space-y-2 pt-1 border-t border-purple-900/40">
                  <label className="block text-[11px] text-purple-200 font-medium">
                    উদ্দিষ্ট সদস্য নির্বাচন করুন:
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="সদস্য নম্বর বা নাম দিয়ে খুঁজুন..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-800/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 mb-1.5"
                    />
                  </div>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-800/60 rounded-xl px-3 py-2 text-xs text-purple-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- সদস্য নির্বাচন করুন ({filteredCandidateMembers.length} জন সক্রিয়) --</option>
                    {filteredCandidateMembers.map((m) => {
                      const hasSubmitted = dailyLinks.some(
                        (l) => l.date === todayDate && l.owner_id === m.id && l.category === 'NORMAL'
                      );
                      return (
                        <option key={m.id} value={m.id}>
                          {m.member_number} - {m.name} {hasSubmitted ? '(আজকের লিংক জমা আছে)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Member Identity (Auto-filled & Locked) */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={targetMember?.profile_photo_url || currentUser?.profile_photo_url}
                alt={targetMember?.name}
                className="w-9 h-9 rounded-full object-cover border border-slate-700"
              />
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {targetMember?.name}
                  {submitOnBehalf && (
                    <span className="ml-2 text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.2 rounded border border-purple-700">
                      ON BEHALF
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-cyan-400 font-mono">
                  {targetMember?.member_number} • {targetMember?.role}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded">
              মালিকানা নিশ্চিত
            </span>
          </div>

          {/* Special Category for Admin/Dev */}
          {isPrivileged && (
            <div>
              <label className="block text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>লিংক ক্যাটাগরি:</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-purple-800/60 rounded-xl px-3 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-500"
              >
                <option value="NORMAL">NORMAL (সাধারণ লিংক)</option>
                <option value="VIP">VIP (ভিআইপি লিংক)</option>
                <option value="ADMIN">ADMIN (অফিসিয়াল এডমিন লিংক)</option>
                <option value="NOTICE">NOTICE (জরুরি নোটিশ লিংক)</option>
              </select>
            </div>
          )}

          {/* Post Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">পোস্টের ধরণ:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPostType('Photo')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  postType === 'Photo'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>ছবি / ফটো পোস্ট</span>
              </button>

              <button
                type="button"
                onClick={() => setPostType('Video')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  postType === 'Video'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>ভিডিও / রিলস</span>
              </button>
            </div>
          </div>

          {/* Facebook Post Link */}
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
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ক্যাপশন (সংক্ষিপ্ত বিবরণ)
            </label>
            <input
              type="text"
              placeholder="যেমন: নতুন পোস্ট সবার ভালোবাসার অপেক্ষায়"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Instruction */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              সাপোর্টের নির্দেশনা
            </label>
            <input
              type="text"
              placeholder="যেমন: লাভ রিয়েক্ট ও পোস্ট সম্পর্কিত কমেন্ট করবেন"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{loading ? 'জমা দেওয়া হচ্ছে...' : 'নিশ্চিত ও জমা দিন (+৭ পয়েন্ট)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

