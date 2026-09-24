import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Clock, ShieldAlert, Sparkles, X, Volume2, VolumeX } from 'lucide-react';

interface DemoAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
  adTitle?: string;
  durationSeconds?: number;
}

export const DemoAdModal: React.FC<DemoAdModalProps> = ({
  isOpen,
  onClose,
  onAdCompleted,
  adTitle = 'স্পন্সরড ভিডিও বিজ্ঞাপন (Reactivation Ad)',
  durationSeconds = 15,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(durationSeconds);
      setIsPlaying(false);
      setIsCompleted(false);
      return;
    }

    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      setIsCompleted(true);
      setIsPlaying(false);
    }

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, timeLeft, durationSeconds]);

  if (!isOpen) return null;

  const handleStartAd = () => {
    setIsPlaying(true);
    setTimeLeft(durationSeconds);
  };

  const handleClaimReward = () => {
    onAdCompleted();
    onClose();
  };

  const progressPercent = Math.round(((durationSeconds - timeLeft) / durationSeconds) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
              SPONSORED AD
            </span>
            <h3 className="text-xs font-bold text-white line-clamp-1">{adTitle}</h3>
          </div>
          {isCompleted && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Video Player Canvas (Demo Ad Screen) */}
        <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col items-center justify-center text-center p-6 space-y-4 shadow-inner">
          {/* Simulated Video Content Background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/40 via-slate-950 to-indigo-950/40 opacity-90"></div>

          {!isPlaying && !isCompleted && (
            <div className="relative z-10 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 animate-pulse">
                <Play className="w-8 h-8 fill-amber-400 ml-1" />
              </div>
              <h4 className="text-sm font-bold text-white">বিজ্ঞাপন দেখে একাউন্ট রিকভার করুন</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {durationSeconds} সেকেন্ডের ভিডিও বিজ্ঞাপনটি সম্পূর্ণ দেখলে আপনার পেন্ডিং রিকভারি টাস্ক ভেরিফাই হবে।
              </p>
              <button
                onClick={handleStartAd}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/30"
              >
                বিজ্ঞাপন শুরু করুন (Watch Ad)
              </button>
            </div>
          )}

          {isPlaying && (
            <div className="relative z-10 space-y-3 w-full">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto animate-spin">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{timeLeft}s</div>
              <p className="text-xs text-slate-300">বিজ্ঞাপন চলছে, অনুগ্রহ করে অপেক্ষা করুন...</p>

              {/* Mute Button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-lg bg-slate-900/80 text-slate-400 hover:text-white mx-auto block"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="relative z-10 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white">বিজ্ঞাপন দেখা সম্পন্ন হয়েছে!</h4>
              <p className="text-xs text-emerald-400 font-medium">
                আপনার রিকভারি ভেরিফিকেশন সফল হয়েছে। এখন একাউন্ট আনলক করতে পারবেন।
              </p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Footer Action */}
        {isCompleted ? (
          <button
            onClick={handleClaimReward}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>রিকভারি সম্পন্ন ও একাউন্ট আনলক করুন</span>
          </button>
        ) : (
          <p className="text-[11px] text-slate-500 text-center">
            * বিজ্ঞাপন মাঝপথে বন্ধ করলে রিকভারি সম্পন্ন হবে না।
          </p>
        )}
      </div>
    </div>
  );
};
