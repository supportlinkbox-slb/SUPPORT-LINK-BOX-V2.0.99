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
import { LoginPage } from './components/auth/LoginPage';
import { StatusGateScreen } from './components/auth/StatusGateScreen';
import { Flame, CheckCircle2, Shield, Heart } from 'lucide-react';

function MainContent() {
  const [currentTab, setCurrentTab] = useState<string>('links');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  const { currentUser, authLoading } = useApp();

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

  // Complete Pre-Login Application Lock: Render ONLY Login Page if not authenticated
  if (!currentUser) {
    return <LoginPage />;
  }

  // Status Gate: Render status notice if member is PENDING, SUSPENDED, REMOVED, or INACTIVE
  if (currentUser.status !== 'ACTIVE') {
    return <StatusGateScreen user={currentUser} />;
  }

  const canAccessAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
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
          <MemberProfileView />
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
