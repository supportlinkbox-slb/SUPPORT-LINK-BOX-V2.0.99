import React, { useState } from 'react';
import {
  Link as LinkIcon,
  ExternalLink,
  CheckCircle2,
  Clock,
  Edit,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Flame,
  Image,
  Video,
  Pin,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { DailyLink } from '../../types';
import { useApp } from '../../context/AppContext';
import { canEditSubmission, formatToBDT } from '../../utils/bangladeshTime';
import { LinkEditModal } from './LinkEditModal';
import { ReportModal } from './ReportModal';
import { ScheduleModal } from './ScheduleModal';

interface DailyLinksViewProps {
  onOpenSubmitModal: () => void;
  onGoToSupportSession: () => void;
}

export const DailyLinksView: React.FC<DailyLinksViewProps> = ({
  onOpenSubmitModal,
  onGoToSupportSession,
}) => {
  const {
    dailyLinks,
    scheduledLinks,
    todayDate,
    currentUser,
    isLinkSupported,
    supportLink,
    canSupportLink,
    pendingRequiredSupportCount,
    submissionStatus,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState<number | 'ALL' | 'MY'>('ALL');
  const [editingLink, setEditingLink] = useState<DailyLink | null>(null);
  const [reportingLink, setReportingLink] = useState<DailyLink | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Filter links for today and sort strictly by serial_number ASC (Section 26)
  // Chapter 7: Exclude soft-removed links from display
  const todaysLinks = dailyLinks
    .filter((l) => l.date === todayDate && (l.status ?? 'active') === 'active')
    .sort((a, b) => a.serial_number - b.serial_number);

  // Determine parts
  const totalParts = Math.max(1, Math.ceil(todaysLinks.length / 20));
  const partsList = Array.from({ length: totalParts }, (_, i) => i + 1);

  // Filter based on search and selected part
  const filteredLinks = todaysLinks.filter((link) => {
    const matchesSearch =
      link.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.owner_member_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(link.serial_number).includes(searchQuery);

    if (!matchesSearch) return false;

    if (selectedPart === 'MY') {
      return link.owner_id === currentUser?.id;
    }
    if (selectedPart !== 'ALL') {
      return link.part_number === selectedPart;
    }
    return true;
  });

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-cyan-500/20 text-cyan-300 font-mono text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                {todayDate} (BDT)
              </span>
              <span className="text-xs text-slate-400">
                মোট লিংক: <span className="text-white font-bold">{todaysLinks.length} টি</span>
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Today's Support Link Box
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              প্রতিদিনের অফিশিয়াল সাপোর্ট লিংক তালিকা। ফেসবুক অ্যাপ বা ব্রাউজারে লিংক ওপেন করে রিয়েক্ট ও কমেন্ট করে সাপোর্ট নিশ্চিত করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onGoToSupportSession}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-orange-500/20 transition flex items-center gap-2 transform hover:-translate-y-0.5"
            >
              <Flame className="w-4 h-4 fill-slate-950" />
              <span>সাপোর্ট সেশন শুরু করুন</span>
              {pendingRequiredSupportCount > 0 && (
                <span className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {pendingRequiredSupportCount} বাকি
                </span>
              )}
            </button>

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 hover:text-white border border-purple-500/40 font-bold text-xs transition flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>শিডিউল ({scheduledLinks.filter(s => s.status === 'pending').length})</span>
            </button>

            <button
              onClick={onOpenSubmitModal}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>লিংক জমা দিন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Part Filtering & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Parts Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedPart('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedPart === 'ALL'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            সব লিংক ({todaysLinks.length})
          </button>

          {partsList.map((part) => (
            <button
              key={part}
              onClick={() => setSelectedPart(part)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedPart === part
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Part {part} ({(part - 1) * 20 + 1}-{Math.min(part * 20, todaysLinks.length || part * 20)})
            </button>
          ))}

          {currentUser && (
            <button
              onClick={() => setSelectedPart('MY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedPart === 'MY'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-slate-800/80 text-purple-300 hover:bg-slate-700'
              }`}
            >
              আমার লিংক
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="সিরিয়াল, নাম বা মেম্বার আইডি..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Links Grid */}
      {filteredLinks.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <LinkIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">
            {searchQuery ? 'সার্চ ফিল্টারের সাথে কোনো লিংক মিলছে না' : 'আজ এখনো কোনো লিংক জমা হয়নি।'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'অনুগ্রহ করে ভিন্ন কোনো নাম বা সিরিয়াল দিয়ে চেষ্টা করুন।'
              : 'সকাল ১০:০০ থেকে বিকাল ৪:৫০ এর মধ্যে আপনার ফেসবুক লিংক জমা দিন।'}
          </p>
          <button
            onClick={onOpenSubmitModal}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
          >
            প্রথম লিংক জমা দিন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link) => {
            const isSupported = isLinkSupported(link.id);
            const isOwnLink = link.owner_id === currentUser?.id;
            const canEdit = isAdmin || (isOwnLink && canEditSubmission(link.can_edit_until || link.submitted_at));

            return (
              <div
                key={link.id}
                className={`bg-slate-900 border rounded-2xl p-4 shadow-md transition hover:border-slate-700 flex flex-col justify-between ${
                  link.is_pinned
                    ? 'border-purple-500/50 bg-purple-950/20'
                    : isSupported
                    ? 'border-emerald-800/50 bg-slate-900/90'
                    : 'border-slate-800'
                }`}
              >
                {/* Card Top: Serial Badge & Post Type & Category */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-700 text-white font-mono font-black text-xs flex flex-col items-center justify-center shadow-md leading-tight">
                          <span className="text-[9px] text-cyan-200 uppercase font-sans font-bold">LINK</span>
                          <span>#{link.serial_display}</span>
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            {link.owner_name}
                          </span>
                          {isOwnLink && (
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-semibold">
                              YOU
                            </span>
                          )}
                          {link.submitted_by_admin_id && (
                            <span className="text-[9px] bg-purple-900/60 text-purple-300 px-1 py-0.2 rounded border border-purple-800">
                              Admin Sub
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Member #{link.owner_member_number} • Part {link.part_number}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {link.category !== 'NORMAL' && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            link.category === 'ADMIN'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : link.category === 'VIP'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-red-950 text-red-300 border-red-800'
                          }`}
                        >
                          {link.category}
                        </span>
                      )}

                      <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                        {link.post_type === 'Video' ? (
                          <Video className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <Image className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>{link.post_type}</span>
                      </span>
                    </div>
                  </div>

                  {/* Caption & Instructions */}
                  <div className="space-y-1.5 my-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-xs text-slate-200 line-clamp-2 font-medium">
                      {link.caption}
                    </p>
                    <p className="text-[11px] text-cyan-400/90 italic flex items-center gap-1">
                      <span>নির্দেশনা:</span>
                      <span className="text-slate-300">{link.instruction}</span>
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Support Status & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    {isSupported ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-800/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>সাপোর্ট সম্পন্ন</span>
                      </span>
                    ) : isOwnLink ? (
                      <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded">
                        আপনার নিজের লিংক
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>সাপোর্ট বাকি</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Report link button */}
                    {!isOwnLink && (
                      <button
                        onClick={() => setReportingLink(link)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition"
                        title="সমস্যা রিপোর্ট করুন"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Edit button if within grace period */}
                    {canEdit && (
                      <button
                        onClick={() => setEditingLink(link)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition"
                        title="এডিট / ডিলিট"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Primary Action: Support Now (External Facebook Workflow) */}
                    <button
                      onClick={() => supportLink(link)}
                      disabled={isOwnLink}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                        isSupported
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : isOwnLink
                          ? 'opacity-40 bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-500/20'
                      }`}
                    >
                      <span>{isSupported ? 'পুনরায় দেখুন' : 'Support Now'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <LinkEditModal
        link={editingLink}
        isOpen={Boolean(editingLink)}
        onClose={() => setEditingLink(null)}
      />

      {/* Report Modal */}
      <ReportModal
        link={reportingLink}
        isOpen={Boolean(reportingLink)}
        onClose={() => setReportingLink(null)}
      />

      {/* Schedule Modal (Chapter 07) */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />
    </div>
  );
};
