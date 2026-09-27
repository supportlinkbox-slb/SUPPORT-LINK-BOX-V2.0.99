import React, { useState } from 'react';
import { Sparkles, Clock, CheckCircle2, AlertCircle, X, Shield } from 'lucide-react';
import { FESTIVAL_THEMES, FestivalThemeType } from '../../types/festivalTheme';
import { useApp } from '../../context/AppContext';

interface FestivalThemeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FestivalThemeManagerModal: React.FC<FestivalThemeManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeFestivalTheme, setActiveFestivalThemeState, currentUser } = useApp();

  const [selectedThemeId, setSelectedThemeId] = useState<FestivalThemeType>(
    activeFestivalTheme.isActive ? activeFestivalTheme.themeId : 'JUMMAH'
  );
  const [durationHours, setDurationHours] = useState<number>(
    activeFestivalTheme.durationHours || 24
  );
  const [customGreeting, setCustomGreeting] = useState<string>(
    activeFestivalTheme.customGreeting || ''
  );
  const [customSubtitle, setCustomSubtitle] = useState<string>(
    activeFestivalTheme.customSubtitle || ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const isDevOrAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

  if (!isDevOrAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center max-w-sm">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-white font-bold">অনুমতি নেই</h3>
          <p className="text-xs text-slate-400 mt-1">শুধুমাত্র এডমিন থিম কন্ট্রোল করতে পারেন।</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-800 rounded-xl text-xs text-white"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    );
  }

  const handleApplyTheme = () => {
    const now = new Date();
    const expires = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    setActiveFestivalThemeState({
      themeId: selectedThemeId,
      activatedAt: now.toISOString(),
      durationHours: durationHours,
      expiresAt: expires.toISOString(),
      customGreeting: customGreeting.trim() || undefined,
      customSubtitle: customSubtitle.trim() || undefined,
      isActive: true,
    });

    // Reset popup flag for fresh celebration popup
    if (typeof window !== 'undefined') {
      const themeMeta = FESTIVAL_THEMES[selectedThemeId];
      localStorage.removeItem(`slb_theme_seen_${selectedThemeId}_${themeMeta.badge}`);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleDisableTheme = () => {
    setActiveFestivalThemeState({
      themeId: 'DEFAULT',
      activatedAt: new Date().toISOString(),
      durationHours: 0,
      expiresAt: new Date().toISOString(),
      isActive: false,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const themeList = Object.values(FESTIVAL_THEMES).filter((t) => t.id !== 'DEFAULT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>উৎসব ও বিশেষ দিবস থিম কন্ট্রোলার</span>
                {activeFestivalTheme.isActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    একটি থিম বর্তমানে সক্রিয়
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                নির্দিষ্ট ঘণ্টার জন্য পুরো প্ল্যাটফর্মে উৎসবের শুভেচ্ছা ও রঙিন থিম সক্রিয় করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Success Notification */}
        {savedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>থিম সফলভাবে সংরক্ষিত ও প্রয়োগ করা হয়েছে!</span>
          </div>
        )}

        {/* Theme Cards Grid */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">উপলক্ষ / উৎসব নির্বাচন করুন:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {themeList.map((t) => {
              const isSelected = selectedThemeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedThemeId(t.id)}
                  className={`p-3 rounded-2xl text-left border transition relative flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/50'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl select-none">{t.icon}</span>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{t.name}</span>
                      </div>
                      <span className="text-[10px] text-amber-400/90 font-mono block mt-0.5">
                        {t.badge}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration Select */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>থিম সক্রিয় থাকার সময়সীমা (টাইমার):</span>
            <span className="text-amber-400 font-mono text-[11px] font-bold">
              {durationHours} ঘণ্টা পর স্বয়ংক্রিয় বন্ধ হবে
            </span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {[2, 6, 12, 24, 48, 72].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setDurationHours(hrs)}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                  durationHours === hrs
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {hrs} ঘণ্টা
              </button>
            ))}
          </div>
        </div>

        {/* Optional Custom Greetings */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              কাস্টম শুভেচ্ছা শিরোনাম (ঐচ্ছিক):
            </label>
            <input
              type="text"
              value={customGreeting}
              onChange={(e) => setCustomGreeting(e.target.value)}
              placeholder={FESTIVAL_THEMES[selectedThemeId].greetingTitle}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              কাস্টম বার্তা / বিবরণ (ঐচ্ছিক):
            </label>
            <input
              type="text"
              value={customSubtitle}
              onChange={(e) => setCustomSubtitle(e.target.value)}
              placeholder={FESTIVAL_THEMES[selectedThemeId].greetingSubtitle}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
          {activeFestivalTheme.isActive ? (
            <button
              type="button"
              onClick={handleDisableTheme}
              className="px-4 py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold rounded-xl transition"
            >
              থিম নিষ্ক্রিয় (বন্ধ) করুন
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleApplyTheme}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>থিম চালু করুন</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
