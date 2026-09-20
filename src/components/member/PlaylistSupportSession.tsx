import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Flame,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Image,
  Video,
  List,
  RotateCw,
  HelpCircle,
  Flag,
  Trophy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyLink, SupportLinkStatus } from '../../types';
import { openFacebookPostExternally, isValidFacebookUrl } from '../../utils/facebookLinks';
import { getBengaliSupportErrorMessage } from '../../utils/bengaliErrors';
import { formatToBDT } from '../../utils/bangladeshTime';
import { supportApi } from '../../lib/supabase';
import { ReportModal } from './ReportModal';

interface PlaylistSupportSessionProps {
  onGoToAllDone: () => void;
}

const STORAGE_SESSION_LINK_KEY = 'slb_support_session_current_link_id';

export const PlaylistSupportSession: React.FC<PlaylistSupportSessionProps> = ({ onGoToAllDone }) => {
  const {
    dailyLinks,
    todayDate,
    currentUser,
    isLinkSupported,
    supportLink,
    canSupportLink,
    pendingRequiredSupportCount,
    allDoneStatus,
    isAllDoneSubmittedToday,
    userAllDoneRecord,
    submitAllDone,
    refreshData,
  } = useApp();

  // Filter only active links for today, sorted by serial_number ASC (Chapter 8 Rule)
  const activeTodaysLinks = useMemo(() => {
    return dailyLinks
      .filter((l) => l.date === todayDate && (l.status ?? 'active') === 'active')
      .sort((a, b) => a.serial_number - b.serial_number);
  }, [dailyLinks, todayDate]);

  // Selected link ID stored locally for session continuity across app switch & reload
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_SESSION_LINK_KEY);
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportingLink, setReportingLink] = useState<DailyLink | null>(null);

  // All Done Submission inside Link Box / Support Session state
  const [isAllDoneSubmitting, setIsAllDoneSubmitting] = useState<boolean>(false);
  const [altIdOpen, setAltIdOpen] = useState<boolean>(false);
  const [altName, setAltName] = useState<string>('');
  const [altLink, setAltLink] = useState<string>('');
  const [altNote, setAltNote] = useState<string>('');
  const [allDoneSuccessMsg, setAllDoneSuccessMsg] = useState<string | null>(null);
  const [allDoneErrorMsg, setAllDoneErrorMsg] = useState<string | null>(null);

  // Track the link ID opened in Facebook for post-return confirmation
  const openedLinkIdRef = useRef<string | null>(null);
  const lastReturnCheckTimeRef = useRef<number>(0);

  // Helper: Find first applicable pending link
  const findFirstPendingLinkId = useCallback(() => {
    for (const link of activeTodaysLinks) {
      if (canSupportLink(link) && !isLinkSupported(link.id)) {
        return link.id;
      }
    }
    return activeTodaysLinks[0]?.id || null;
  }, [activeTodaysLinks, canSupportLink, isLinkSupported]);

  // Determine current active link (with validation against removed/stale links)
  const currentLink = useMemo(() => {
    if (!selectedLinkId) return null;
    return activeTodaysLinks.find((l) => l.id === selectedLinkId) || null;
  }, [activeTodaysLinks, selectedLinkId]);

  // Initialize or restore position when links load
  useEffect(() => {
    if (activeTodaysLinks.length === 0) return;

    if (!selectedLinkId || !activeTodaysLinks.some((l) => l.id === selectedLinkId)) {
      const firstPendingId = findFirstPendingLinkId();
      setSelectedLinkId(firstPendingId);
      if (firstPendingId) {
        sessionStorage.setItem(STORAGE_SESSION_LINK_KEY, firstPendingId);
      }
    }
  }, [activeTodaysLinks, selectedLinkId, findFirstPendingLinkId]);

  // Persist position whenever selectedLinkId changes
  useEffect(() => {
    if (selectedLinkId) {
      sessionStorage.setItem(STORAGE_SESSION_LINK_KEY, selectedLinkId);
    }
  }, [selectedLinkId]);

  // Advance to next pending link in queue
  const advanceToNextPending = useCallback(
    (fromLinkId: string) => {
      const fromIndex = activeTodaysLinks.findIndex((l) => l.id === fromLinkId);
      if (fromIndex === -1) return;

      // Look forward
      for (let i = fromIndex + 1; i < activeTodaysLinks.length; i++) {
        const candidate = activeTodaysLinks[i];
        if (canSupportLink(candidate) && !isLinkSupported(candidate.id)) {
          setSelectedLinkId(candidate.id);
          return;
        }
      }
      // Wrap around look from start
      for (let i = 0; i < fromIndex; i++) {
        const candidate = activeTodaysLinks[i];
        if (canSupportLink(candidate) && !isLinkSupported(candidate.id)) {
          setSelectedLinkId(candidate.id);
          return;
        }
      }
    },
    [activeTodaysLinks, canSupportLink, isLinkSupported]
  );

  // Post-Facebook Return Handler (Pageshow, VisibilityChange, Focus)
  const handleReturnFromFacebook = useCallback(async () => {
    const now = Date.now();
    // Throttle checks (avoid rapid loop within 1.5s)
    if (now - lastReturnCheckTimeRef.current < 1500) return;
    lastReturnCheckTimeRef.current = now;

    const targetLinkId = openedLinkIdRef.current;
    if (!targetLinkId) return;

    // Trigger state refresh from server
    await refreshData();

    // Chapter 9 verification abstraction hook
    try {
      const verifyRes = await supportApi.verifySupportStatus(targetLinkId);
      if (verifyRes.success && verifyRes.data?.is_supported) {
        setStatusNotice('ফেসবুক থেকে সফলভাবে ফিরে এসেছেন! পরবর্তী পেন্ডিং লিংক লোড করা হলো।');
        advanceToNextPending(targetLinkId);
      }
    } catch {
      // Graceful fallback
    } finally {
      openedLinkIdRef.current = null;
      setTimeout(() => setStatusNotice(null), 4000);
    }
  }, [advanceToNextPending, refreshData]);

  // Attach multi-signal return listeners (visibilitychange, pageshow, focus)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleReturnFromFacebook();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) {
        handleReturnFromFacebook();
      }
    };

    const onFocus = () => {
      handleReturnFromFacebook();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, [handleReturnFromFacebook]);

  // Support Action execution
  const handleSupportNowClick = async () => {
    if (!currentLink || isProcessing) return;
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('অনুগ্রহ করে লগইন করুন।');
      return;
    }

    if (!canSupportLink(currentLink)) {
      setErrorMessage('নিজের লিংকে সাপোর্ট দেওয়া যাবে না।');
      return;
    }

    if (!isValidFacebookUrl(currentLink.fb_link)) {
      setErrorMessage('ফেসবুক পোস্ট লিংকটি সঠিক নয়।');
      return;
    }

    setIsProcessing(true);
    openedLinkIdRef.current = currentLink.id;

    try {
      // 1. Open Facebook externally
      openFacebookPostExternally(currentLink.fb_link);

      // 2. Authoritative Atomic RPC call
      const res = await supportLink(currentLink);
      if (!res.success) {
        setErrorMessage(getBengaliSupportErrorMessage(res.error));
      } else {
        advanceToNextPending(currentLink.id);
      }
    } catch (err: any) {
      setErrorMessage(getBengaliSupportErrorMessage(err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigation handlers (pure navigation, no side-effects)
  const currentIndex = currentLink ? activeTodaysLinks.findIndex((l) => l.id === currentLink.id) : 0;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedLinkId(activeTodaysLinks[currentIndex - 1].id);
      setErrorMessage(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < activeTodaysLinks.length - 1) {
      setSelectedLinkId(activeTodaysLinks[currentIndex + 1].id);
      setErrorMessage(null);
    }
  };

  const handlePlaylistItemClick = (link: DailyLink) => {
    setSelectedLinkId(link.id);
    setErrorMessage(null);
  };

  // Progress and stats calculations
  const totalApplicable = activeTodaysLinks.filter((l) => l.owner_id !== currentUser?.id).length;
  const totalSupported = activeTodaysLinks.filter((l) => l.owner_id !== currentUser?.id && isLinkSupported(l.id)).length;
  const progressPercent = totalApplicable > 0 ? Math.round((totalSupported / totalApplicable) * 100) : 100;
  const allSupportCompleted = pendingRequiredSupportCount === 0 && totalApplicable > 0;

  const handleAllDoneSubmit = async () => {
    setAllDoneErrorMsg(null);
    setAllDoneSuccessMsg(null);
    setIsAllDoneSubmitting(true);

    const altDetails = altIdOpen && altName.trim()
      ? { account_name: altName.trim(), account_link: altLink.trim(), note: altNote.trim() }
      : undefined;

    const res = await submitAllDone(altDetails);
    setIsAllDoneSubmitting(false);

    if (res.success) {
      setAllDoneSuccessMsg(
        `অভিনন্দন! আপনার All Done সফলভাবে সম্পন্ন হয়েছে। ${
          res.rank ? `আপনি #${res.rank} তম দ্রুততম হয়েছেন! মোট পয়েন্ট: +${res.points}` : `মোট পয়েন্ট: +${res.points}`
        }`
      );
    } else {
      setAllDoneErrorMsg(res.error || 'All Done সম্পন্ন করা যায়নি।');
    }
  };

  if (activeTodaysLinks.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-white max-w-4xl mx-auto shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <Flame className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">আজকের কোন সাপোর্ট লিংক পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          আজকের দিনের সক্রিয় কোনো লিংক এখনো যুক্ত হয়নি অথবা সকল লিংক ফিল্টার করা হয়েছে। নতুন লিংক যুক্ত হলে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
        </p>
      </div>
    );
  }

  const isCurrentSupported = currentLink ? isLinkSupported(currentLink.id) : false;
  const isCurrentOwn = currentLink?.owner_id === currentUser?.id;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Session Header Card & Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Flame className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white">আজকের Support Session</h1>
                <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-full font-mono">
                  {todayDate}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                সাপোর্ট দিন • স্বয়ংক্রিয়ভাবে পরবর্তী লিংকে নিয়ে যাবে
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-left sm:text-right">
              <div className="text-xs font-bold text-white">
                {totalSupported} / {totalApplicable} টি সাপোর্ট সম্পন্ন
              </div>
              <div className="text-[11px] font-mono text-cyan-400">
                {allSupportCompleted ? (
                  <span className="text-emerald-400 font-bold">সকল সাপোর্ট সম্পন্ন! 🎉</span>
                ) : (
                  <span>{pendingRequiredSupportCount} টি বাকি</span>
                )}
              </div>
            </div>

            {/* All Done Header Button: Strictly visible ONLY when all support completed AND 17:00 BDT reached AND not submitted yet */}
            {allSupportCompleted && allDoneStatus.isOpen && !isAllDoneSubmittedToday && (
              <button
                onClick={handleAllDoneSubmit}
                disabled={isAllDoneSubmitting}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 transition transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 fill-slate-950" />
                <span>{isAllDoneSubmitting ? 'সাবমিট হচ্ছে...' : 'All Done সাবমিট করুন (+5)'}</span>
              </button>
            )}

            {isAllDoneSubmittedToday && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>All Done সম্পন্ন</span>
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Dynamic Status Notices & Alerts */}
      {allDoneSuccessMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{allDoneSuccessMsg}</span>
        </div>
      )}

      {allDoneErrorMsg && (
        <div className="p-4 bg-red-950/80 border border-red-700 text-red-300 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="font-semibold">{allDoneErrorMsg}</span>
        </div>
      )}

      {statusNotice && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-2xl flex items-center justify-between animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusNotice}</span>
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Link Focus Area */}
      {currentLink ? (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Header of Current Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-mono font-black text-xl">
                #{currentLink.serial_display}
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>{currentLink.owner_name}</span>
                  {isCurrentOwn && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-semibold border border-purple-500/30">
                      আপনার নিজের লিংক
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  আইডি: {currentLink.owner_member_number} • Part {currentLink.part_number} (20 per part)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-800 text-slate-300 flex items-center gap-1.5 border border-slate-700/60">
                {currentLink.post_type === 'Video' ? (
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Image className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{currentLink.post_type}</span>
              </span>

              {isCurrentSupported && (
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>সাপোর্ট সম্পন্ন</span>
                </span>
              )}

              {/* Report button hook */}
              <button
                onClick={() => setReportingLink(currentLink)}
                title="সমস্যা রিপোর্ট করুন"
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition border border-slate-700/60"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Caption & Instruction Sections */}
          <div className="space-y-3.5 mb-8">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                পোস্ট ক্যাপশন
              </div>
              <p className="text-sm text-slate-100 font-medium leading-relaxed break-words whitespace-pre-wrap">
                {currentLink.caption || 'ক্যাপশন দেওয়া হয়নি'}
              </p>
            </div>

            <div className="bg-cyan-950/20 border border-cyan-900/40 rounded-2xl p-4.5">
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                সাপোর্টের নির্দেশনা
              </div>
              <p className="text-xs sm:text-sm text-cyan-200 font-medium leading-relaxed break-words">
                {currentLink.instruction || 'লাইক ও প্রাসঙ্গিক কমেন্ট করুন'}
              </p>
            </div>
          </div>

          {/* Primary Action Button Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-800">
            {/* Nav Arrows */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>আগের লিংক</span>
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex >= activeTodaysLinks.length - 1}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
              >
                <span>পরের লিংক</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent External Facebook Support Button */}
            <button
              onClick={handleSupportNowClick}
              disabled={isProcessing || isCurrentOwn}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 shadow-2xl transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isCurrentSupported
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : isCurrentOwn
                  ? 'bg-slate-850 text-slate-500 border border-slate-800'
                  : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-cyan-500/25'
              }`}
            >
              {isProcessing && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>
                {isCurrentSupported
                  ? 'ফেসবুকে পুনরায় দেখুন'
                  : isCurrentOwn
                  ? 'নিজের লিংকে সাপোর্ট প্রযোজ্য নয়'
                  : "SUPPORT NOW / LET'S GO"}
              </span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : isAllDoneSubmittedToday && userAllDoneRecord ? (
        /* State 1: Already Submitted Today */
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-800/80 rounded-3xl p-8 sm:p-10 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">আজকের All Done সম্পন্ন হয়েছে!</h2>
          <p className="text-xs text-slate-300 font-mono">
            সাবমিশন সময়: {formatToBDT(userAllDoneRecord.completed_at, true)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {userAllDoneRecord.fastest_rank ? (
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>Rank #{userAllDoneRecord.fastest_rank} Fastest</span>
              </span>
            ) : null}
            <span className="bg-emerald-500/20 text-emerald-400 font-bold text-xs px-3.5 py-1.5 rounded-full border border-emerald-500/30">
              +{userAllDoneRecord.total_points} Points Awarded
            </span>
          </div>
        </div>
      ) : allSupportCompleted && !allDoneStatus.isOpen ? (
        /* State 2: All Support Complete, but Time Window Not Started (Before 17:00 BDT) */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">আজকের সকল Support সম্পন্ন হয়েছে! 🎉</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            আপনি আজকের জন্য প্রয়োজনীয় সকল লিংকে সফলভাবে সাপোর্ট প্রদান করেছেন। All Done সাবমিশন শুরু হবে বিকাল ৫:০০ (১৭:০০ BDT)-এ। নির্ধারিত সময় হলে এই পেজে স্বয়ংক্রিয়ভাবে All Done সাবমিট বাটন প্রদর্শিত হবে।
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950 border border-slate-800 text-cyan-300 text-xs font-mono">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>All Done সময়সূচি: বিকাল ৫:০০ - রাত ১২:০০ টা (BDT)</span>
          </div>
        </div>
      ) : allSupportCompleted && allDoneStatus.isOpen ? (
        /* State 3: All Support Complete + 17:00 BDT Reached -> Render All Done Submission Form */
        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">All Done সাবমিট করুন</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              আপনার সকল সাপোর্ট সম্পন্ন হয়েছে। এখনই All Done সাবমিট করে পয়েন্ট এবং দ্রুততম সাবমিশনের বোনাস অর্জন করুন!
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-4">
            {/* Optional Alternative ID Disclosure */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden text-left">
              <button
                type="button"
                onClick={() => setAltIdOpen(!altIdOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>আপনি কি অন্য আইডি দিয়ে সাপোর্ট দিয়েছেন?</span>
                </span>
                <span className="text-[11px] text-cyan-400 underline">
                  {altIdOpen ? 'লুকান' : 'তথ্য দিন'}
                </span>
              </button>

              {altIdOpen && (
                <div className="px-4 pb-4 space-y-2.5 pt-1 border-t border-slate-850">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      যে ফেসবুক অ্যাকাউন্ট দিয়ে সাপোর্ট দিয়েছেন তার নাম:
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: MD Hasan Alternative"
                      value={altName}
                      onChange={(e) => setAltName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ঐ অ্যাকাউন্টের ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক):
                    </label>
                    <input
                      type="url"
                      placeholder="https://facebook.com/..."
                      value={altLink}
                      onChange={(e) => setAltLink(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Primary Submit Button */}
            <button
              onClick={handleAllDoneSubmit}
              disabled={isAllDoneSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5"
            >
              {isAllDoneSubmitting ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 fill-slate-950" />
              )}
              <span>{isAllDoneSubmitting ? 'সাবমিট ও ভেরিফাই হচ্ছে...' : 'ALL DONE নিশ্চিত করুন (+5 Points)'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* State 4: Support Incomplete */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">সাপোর্ট এখনও বাকি আছে</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            আপনার এখনও {pendingRequiredSupportCount} টি লিংকে সাপোর্ট দেওয়া বাকি রয়েছে। নিচে প্লে-লিস্ট থেকে লিংকে ক্লিক করে সাপোর্ট সম্পন্ন করুন।
          </p>
        </div>
      )}

      {/* Playlist Grid of Today's Links */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">আজকের সকল লিংকের প্লে-লিস্ট</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            মোট {activeTodaysLinks.length} টি সক্রিয় লিংক
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {activeTodaysLinks.map((link, idx) => {
            const isSupported = isLinkSupported(link.id);
            const isCurrent = link.id === selectedLinkId;
            const isOwn = link.owner_id === currentUser?.id;

            return (
              <button
                key={link.id}
                onClick={() => handlePlaylistItemClick(link)}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 relative ${
                  isCurrent
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/40 font-bold shadow-lg shadow-cyan-500/10'
                    : isSupported
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/50'
                    : isOwn
                    ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-850'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="font-mono text-xs font-bold">#{link.serial_display}</span>
                  {isSupported && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[10px] truncate max-w-full text-slate-400 font-medium">
                  {isOwn ? 'আমার পোস্ট' : link.owner_name.split(' ')[0]}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">P{link.part_number}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Modal Hook (Chapter 15 context readiness) */}
      <ReportModal
        link={reportingLink}
        isOpen={Boolean(reportingLink)}
        onClose={() => setReportingLink(null)}
      />
    </div>
  );
};
