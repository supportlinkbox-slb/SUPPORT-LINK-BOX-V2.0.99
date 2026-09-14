import React from 'react';
import { CheckCircle2, Trophy, Clock, User, ShieldAlert, Award } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatToBDT } from '../../utils/bangladeshTime';

export const DailyAllDoneBox: React.FC = () => {
  const { allDoneRecords, todayDate } = useApp();

  const todaysRecords = allDoneRecords.filter((r) => r.date === todayDate);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Today's Verified All Done Box</span>
          </h2>
          <p className="text-xs text-slate-400">
            আজকের সকল ভেরিফাইড অল ডান তালিকা ও পয়েন্ট অর্জন
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-cyan-400 border border-slate-700">
          মোট জমা: {todaysRecords.length} জন
        </span>
      </div>

      {todaysRecords.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Clock className="w-10 h-10 mx-auto text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">এখনও কেউ অল ডান জমা দেয়নি</div>
          <p className="text-xs text-slate-500">
            বিকাল ৫:০০ টার পর থেকে প্রথম ৫ জনের জন্য রয়েছে বিশেষ ফাস্টেস্ট বোনাস!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {todaysRecords.map((record, index) => {
            const isTop5 = record.fastest_rank && record.fastest_rank <= 5;
            const rankLabel =
              record.fastest_rank === 1
                ? '🥇 1st'
                : record.fastest_rank === 2
                ? '🥈 2nd'
                : record.fastest_rank === 3
                ? '🥉 3rd'
                : record.fastest_rank
                ? `#${record.fastest_rank}`
                : null;

            return (
              <div
                key={record.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition"
              >
                {/* Left: Rank, Avatar, Name */}
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      index === 0
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : index === 1
                        ? 'bg-slate-300 text-slate-950'
                        : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </span>

                  <img
                    src={record.member_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={record.member_name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{record.member_name}</span>
                      {record.status === 'REVOKED' ? (
                        <span className="text-[10px] font-bold bg-red-950 text-red-300 px-1.5 py-0.2 rounded border border-red-800">
                          REVOKED (বাতিল)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800/60">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {record.member_number} • {formatToBDT(record.completed_at)}
                    </div>
                  </div>
                </div>

                {/* Right: Fastest Badge & Points */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {rankLabel && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      <span>{rankLabel} Fastest</span>
                    </span>
                  )}

                  {record.alternative_id_used && (
                    <span
                      className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40"
                      title={`Alternative Account: ${record.alternative_id_details?.account_name}`}
                    >
                      অন্য আইডি
                    </span>
                  )}

                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-lg">
                    +{record.total_points} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
