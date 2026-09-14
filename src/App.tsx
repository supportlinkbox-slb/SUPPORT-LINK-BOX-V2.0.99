import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { DailyLinksView } from './components/member/DailyLinksView';
import { PlaylistSupportSession } from './components/member/PlaylistSupportSession';
import { AllDoneSection } from './components/alldone/AllDoneSection';
import { LeaderboardView } from './components/member/LeaderboardView';
import { NoticeSection } from './components/announcements/NoticeSection';
import { ReportsAdminView } from './components/admin/ReportsAdminView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MemberProfileView } from './components/member/MemberProfileView';
import { SpecialSupportDutyBanner } from './components/member/SpecialSupportDutyBanner';
import { LinkSubmissionModal } from './components/member/LinkSubmissionModal';
import { AuthModal } from './components/auth/AuthModal';
import { Flame, CheckCircle2, Shield, Heart } from 'lucide-react';

function MainContent() {
  const [currentTab, setCurrentTab] = useState<string>('links');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { currentUser, authLoading, pendingRequiredSupportCount, isAllDoneSubmittedToday } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-xl animate-pulse mb-4">
          SLB
        </div>
        <div className="text-slate-400 text-xs font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>সেশন ও ডেটা লোড হচ্ছে...</span>
        </div>
      </div>
    );
  }

  const canAccessAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenSubmitModal={() => setSubmitModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Active Special Support Duty Warning (if penalized) */}
        <SpecialSupportDutyBanner />

        {/* Tab Routing */}
        {currentTab === 'links' && (
          <DailyLinksView
            onOpenSubmitModal={() => setSubmitModalOpen(true)}
            onGoToSupportSession={() => setCurrentTab('support')}
          />
        )}

        {currentTab === 'support' && (
          <PlaylistSupportSession
            onGoToAllDone={() => setCurrentTab('alldone')}
          />
        )}

        {currentTab === 'alldone' && <AllDoneSection />}

        {currentTab === 'leaderboard' && <LeaderboardView />}

        {currentTab === 'notices' && <NoticeSection />}

        {currentTab === 'reports' && (
          canAccessAdmin ? (
            <ReportsAdminView />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-3">
              <Shield className="w-12 h-12 text-amber-400 mx-auto" />
              <h2 className="text-lg font-bold text-white">অ্যাক্সেস সংরক্ষিত</h2>
              <p className="text-xs text-slate-400">রিপোর্ট ম্যানেজমেন্ট দেখতে অ্যাডমিন অথবা ডেভেলপার হিসেবে লগইন প্রয়োজন।</p>
            </div>
          )
        )}

        {currentTab === 'profile' && (
          currentUser ? (
            <MemberProfileView />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mx-auto flex items-center justify-center">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white mb-1">প্রোফাইল দেখতে লগইন প্রয়োজন</h2>
                <p className="text-xs text-slate-400">আপনার নিজস্ব পোস্ট, হিস্টোরি ও পয়েন্ট দেখতে অনুগ্রহ করে লগইন করুন।</p>
              </div>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
              >
                লগইন বা রেজিস্টার করুন
              </button>
            </div>
          )
        )}

        {currentTab === 'admin' && (
          canAccessAdmin ? (
            <AdminDashboard />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-3">
              <Shield className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-lg font-bold text-white">অ্যাডমিন অ্যাক্সেস সীমাবদ্ধ</h2>
              <p className="text-xs text-slate-400">এই প্যানেল শুধুমাত্র অ্যাডমিন ও সিস্টেম ডেভেলপারদের জন্য সংরক্ষিত।</p>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-400">
          <span>SUPPORT LINK BOX OFFICIAL</span>
          <span>•</span>
          <span>BD Standard Time (UTC+6, Asia/Dhaka)</span>
        </div>
        <p className="max-w-md mx-auto text-slate-500 text-[11px]">
          বাংলাদেশ ফেসবুক ক্রিয়েটর ও মেম্বার এনগেজমেন্ট প্ল্যাটফর্ম। সকল ডেটা Supabase অথোরিটেটিভ সিকিউরিটি ও আরপিসি দ্বারা পরিচালিত।
        </p>
        <div className="pt-2 text-[10px] text-slate-600 flex items-center justify-center gap-1">
          <span>Built with craftsmanship for production readiness</span>
        </div>
      </footer>

      {/* Modals */}
      <LinkSubmissionModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
