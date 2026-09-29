import React, { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { getActiveMonetagLink } from '../../utils/monetag';

export const AdSlot = memo(({ className = '' }: { className?: string }) => (
  <a
    href={getActiveMonetagLink()}
    target="_blank"
    rel="noopener noreferrer sponsored"
    className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 min-h-[72px] ${className}`}
  >
    <div className="min-w-0">
      <span className="text-[9px] text-slate-500">স্পন্সরড</span>
      <p className="text-xs text-slate-300 truncate">স্পন্সরড কন্টেন্ট দেখুন</p>
    </div>
    <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
  </a>
));
