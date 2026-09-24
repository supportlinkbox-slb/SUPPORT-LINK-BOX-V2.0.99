import React, { useState } from 'react';
import { MessageSquare, Copy, Check, ChevronDown, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'অসাধারণ কাজ, শুভকামনা রইলো! ❤️',
  'মাশাল্লাহ, খুবই সুন্দর পোস্ট! 🔥',
  'পূর্ণ সাপোর্ট রইলো ভাই, এগিয়ে যান! 👍',
  'অনেক সুন্দর শেয়ার, ধন্যবাদ আপনাকে! 🌟',
  'দারুণ কন্টেন্ট, অল দ্যা বেস্ট! 👏',
  'লাইক ও কমেন্ট করে সাপোর্ট জানিয়ে দিলাম। ✅',
];

export const CommentSuggestionsDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 shadow"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>কমেন্ট আইডিয়া / সাজেশন</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl z-30 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>এক ক্লিকে কপি করুন:</span>
            </span>
            <button onClick={() => setIsOpen(false)} className="text-[10px] text-slate-500 hover:text-white">
              বন্ধ করুন
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {SUGGESTIONS.map((text, idx) => (
              <div
                key={idx}
                onClick={() => handleCopy(text, idx)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 cursor-pointer transition flex items-center justify-between text-xs text-slate-200 group"
              >
                <span className="line-clamp-1">{text}</span>
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
