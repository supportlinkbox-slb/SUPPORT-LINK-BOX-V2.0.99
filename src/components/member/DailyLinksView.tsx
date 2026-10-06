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
import { openFacebookPostExternally } from '../../utils/facebookLinks';
import { LinkEditModal } from './LinkEditModal';
import { ReportModal } from './ReportModal';
import { ScheduleModal } from './ScheduleModal';
import { AdSlot } from '../common/AdSlot';

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
    pendingRequiredSupportCount,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState<number | 'ALL'>('ALL');
  const [postTypeFilter, setPostTypeFilter] = useState<'ALL' | 'Video' | 'Image'>('ALL');
  const [editingLink, setEditingLink] = useState<DailyLink | null>(null);
  const [reportingLink, setReportingLink] = useState<DailyLink | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Filter links by today's date and active status
  const todaysLinks = dailyLinks
    .filter((l) => l.date === todayDate && (l.status ?? 'active') === 'active')
    .sort((a, b) => {
      // 1. Pinned links first (Chapter 8 Rule)
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // 2. Then by serial number ASC
      return a.serial_number - b.serial_number;
    });

  // Calculate distinct parts available for today
  const availableParts = Array.from(new Set(todaysLinks.map((l) => l.part_number))).sort(
    (a, b) => a - b
  );

  // Filtered links based on search & selectors
  const filteredLinks = todaysLinks.filter((link) => {
    // 1. Part filter
    if (selectedPart !== 'ALL' && link.part_number !== selectedPart) return false;
    // 2. Post type filter
    if (postTypeFilter !== 'ALL' && link.post_type !== postTypeFilter) return false;
    // 3. Search query (Serial, Owner Name, Member ID, Caption)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSerial = link.serial_display.toLowerCase().includes(q);
      const matchName = link.owner_name.toLowerCase().includes(q);
      const matchMemberId = link.owner_member_number.toLowerCase().includes(q);
      const matchCaption = link.caption?.toLowerCase().includes(q);
      return matchSerial || matchName || matchMemberId || matchCaption;
    }
    return true;
  });

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <div className="space-y-6">
      {/* 🚀 TOP HEADER SPONSOR BANNER (Clean top space) */}
      <AdSlot />

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
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 active:scale-95"
            >
              <Flame className="w-4 h-4 fill-slate-950" />
              <span>সাপোর্ট সেশন প্লেলিস্ট</span>
            </button>

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3.5 py-2.5 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>আগাম সিডিউল</span>
              {scheduledLinks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-500 text-[10px] font-mono font-black text-white">
                  {scheduledLinks.length}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSubmitModal}
              className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>নতুন লিংক জমা</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="সিরিয়াল (#01), নাম, মেম্বার আইডি বা ক্যাপশন খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Post Type Selector (ALL / Video / Image) */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setPostTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                postTypeFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সকল ধরন
            </button>
            <button
              onClick={() => setPostTypeFilter('Video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                postTypeFilter === 'Video'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>ভিডিও</span>
            </button>
            <button
              onClick={() => setPostTypeFilter('Image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                postTypeFilter === 'Image'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Image className="w-3.5 h-3.5" />
              <span>ছবি/পোস্ট</span>
            </button>
          </div>
        </div>

        {/* 20-Link Part Badges Navigation (Chapter 8 Rule) */}
        {availableParts.length > 1 && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 text-[11px] font-semibold whitespace-nowrap">
              পার্ট ফিল্টার:
            </span>
            <button
              onClick={() => setSelectedPart('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedPart === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
            >
              সকল পার্ট ({todaysLinks.length})
            </button>

            {availableParts.map((partNum) => {
              const startNum = (partNum - 1) * 20 + 1;
              const endNum = partNum * 20;
              const partCount = todaysLinks.filter((l) => l.part_number === partNum).length;

              return (
                <button
                  key={partNum}
                  onClick={() => setSelectedPart(partNum)}
                  className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    selectedPart === partNum
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Part {partNum} (#{startNum}-#{endNum}) [{partCount}]
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Cards Grid */}
      {filteredLinks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
          <LinkIcon className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="font-semibold text-slate-300">কোনো সাপোর্ট লিংক পাওয়া যায়নি।</p>
          <p className="text-[11px] text-slate-500 mt-1">অনুসন্ধান বা ফিল্টার পরিবর্তন করে আবার দেখুন।</p>
          <button
            onClick={onOpenSubmitModal}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
          >
            প্রথম লিংক জমা দিন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link, idx) => {
            const isSupported = isLinkSupported(link.id);
            const isOwnLink = link.owner_id === currentUser?.id;
            const canEdit = isAdmin || (isOwnLink && canEditSubmission(link.can_edit_until, link.submitted_at)); // SLB-FIX-M6
            const shouldShowAdAfter = (idx + 1) % 8 === 0;

            return (
              <React.Fragment key={link.id}>
                <div
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
                      {link.caption || 'ক্যাপশন দেওয়া হয়নি'}
                    </p>
                    {link.instruction && (
                      <p className="text-[11px] text-cyan-300/90 italic line-clamp-1 border-t border-slate-800/60 pt-1">
                        📌 {link.instruction}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Support Counts & Action Buttons */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1 font-mono">
                      <span>সাপোর্ট প্রাপ্ত:</span>
                      <strong className="text-white font-bold">{link.total_supports_count || 0}</strong>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatToBDT(link.submitted_at, false)} BDT
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => setEditingLink(link)}
                          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                          title="লিংক এডিট করুন"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setReportingLink(link)}
                        className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition"
                        title="সমস্যা রিপোর্ট করুন"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        openFacebookPostExternally(link.fb_link);
                        if (!isOwnLink && !isSupported) {
                          supportLink(link);
                        }
                      }}
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

              {/* 💰 Inline Non-Intrusive Sponsored Card between links */}
              {shouldShowAdAfter && (
                <AdSlot />
              )}
            </React.Fragment>
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

      {/* 💰 BOTTOM FOOTER SPONSOR BANNER */}
      <AdSlot />
    </div>
  );
};
