import React from 'react';
import {
  Link as LinkIcon,
  Flame,
  Award,
  Plus,
  User,
  Settings,
  Film,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface BottomNavBarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSubmitModal: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenSubmitModal,
}) => {
  const { currentUser, pendingRequiredSupportCount, isAllDoneSubmittedToday } = useApp();

  const canAccessAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 pt-1.5 pb-2 shadow-2xl transition-all">
      <div className="grid grid-cols-5 items-center justify-between max-w-md mx-auto">
        {/* Tab 1: Home Dashboard */}
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition ${
            currentTab === 'home' || currentTab === 'links'
              ? 'text-cyan-400 bg-cyan-500/10 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate">হোম</span>
        </button>

        {/* Tab 2: Support Session */}
        <button
          onClick={() => setCurrentTab('support')}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition relative ${
            currentTab === 'support'
              ? 'text-amber-400 bg-amber-500/10 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Flame className="w-5 h-5" />
            {pendingRequiredSupportCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow">
                {pendingRequiredSupportCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate">সাপোর্ট</span>
        </button>

        {/* Tab 3: Floating Submit Link Action */}
        <div className="flex justify-center -mt-5">
          <button
            onClick={onOpenSubmitModal}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/40 border-2 border-slate-900 active:scale-95 transition"
            title="লিংক জমা দিন"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 4: Leaderboard */}
        <button
          onClick={() => setCurrentTab('leaderboard')}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition ${
            currentTab === 'leaderboard'
              ? 'text-cyan-400 bg-cyan-500/10 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate">লিডারবোর্ড</span>
        </button>

        {/* Tab 5: Profile & Settings */}
        <button
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition ${
            currentTab === 'profile'
              ? 'text-purple-400 bg-purple-500/10 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate">প্রোফাইল</span>
        </button>
      </div>
    </div>
  );
};
