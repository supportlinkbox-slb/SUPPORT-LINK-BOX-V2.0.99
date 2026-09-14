import React, { useState } from 'react';
import { Trophy, Award, Medal, Crown, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LeaderboardView: React.FC = () => {
  const { members } = useApp();

  const [period, setPeriod] = useState<'WEEKLY' | 'LIFETIME' | 'HISTORICAL'>('WEEKLY');
  const [selectedWeek, setSelectedWeek] = useState<string>('Week 52 (Current)');

  // Sort members based on weekly points or lifetime points
  const activeMembers = members.filter((m) => m.status !== 'FROZEN');

  const sortedWeekly = [...activeMembers].sort((a, b) => b.weekly_points - a.weekly_points);
  const sortedLifetime = [...activeMembers].sort((a, b) => b.points - a.points);

  const displayList = period === 'WEEKLY' ? sortedWeekly : sortedLifetime;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Support Champions
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Official Leaderboard
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              নিয়মিত সাপোর্ট দিয়ে লিডারবোর্ডে শীর্ষস্থান দখল করুন। টাই-ব্রেকিংয়ে ১ম স্থান অর্জনের সংখ্যা গণনা করা হবে।
            </p>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setPeriod('WEEKLY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'WEEKLY'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সাপ্তাহিক র‍্যাংক
            </button>
            <button
              onClick={() => setPeriod('LIFETIME')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'LIFETIME'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              লাইফটাইম র‍্যাংক
            </button>
            <button
              onClick={() => setPeriod('HISTORICAL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'HISTORICAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              আগের সপ্তাহগুলো
            </button>
          </div>
        </div>

        {/* Historical Week Selector */}
        {period === 'HISTORICAL' && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-3">
            <span className="text-xs text-slate-400">আর্কাইভ সপ্তাহ নির্বাচন করুন:</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-white"
            >
              <option value="Week 52 (Current)">52nd Week (Current Ongoing)</option>
              <option value="Week 51">51st Week (Archived)</option>
              <option value="Week 50">50th Week (Archived)</option>
              <option value="Week 49">49th Week (Archived)</option>
            </select>
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 2nd Place */}
        {displayList[1] && (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-2 md:order-1 shadow-lg">
            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-sm flex items-center justify-center mb-2">
              2
            </div>
            <img
              src={displayList[1].profile_photo_url}
              alt={displayList[1].name}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-300 mb-2 shadow-md"
            />
            <div className="font-bold text-sm text-white">{displayList[1].name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{displayList[1].member_number}</div>
            <div className="mt-3 text-base font-black font-mono text-slate-200 bg-slate-800/80 px-4 py-1 rounded-xl border border-slate-700">
              {period === 'WEEKLY' ? `${displayList[1].weekly_points} pts` : `${displayList[1].points} pts`}
            </div>
          </div>
        )}

        {/* 1st Place Champion */}
        {displayList[0] && (
          <div className="bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 text-center flex flex-col items-center justify-between order-1 md:order-2 shadow-2xl relative">
            <Crown className="w-8 h-8 text-amber-400 -mt-2 animate-bounce" />
            <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center mb-2 shadow-lg">
              1
            </div>
            <img
              src={displayList[0].profile_photo_url}
              alt={displayList[0].name}
              className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 mb-2 shadow-xl"
            />
            <div className="font-black text-base text-white">{displayList[0].name}</div>
            <div className="text-xs text-amber-400 font-mono">{displayList[0].member_number}</div>
            <div className="mt-3 text-lg font-black font-mono text-amber-300 bg-amber-950/80 px-5 py-1.5 rounded-2xl border border-amber-500/50 shadow-inner">
              {period === 'WEEKLY' ? `${displayList[0].weekly_points} pts` : `${displayList[0].points} pts`}
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {displayList[2] && (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-3 shadow-lg">
            <div className="w-8 h-8 rounded-full bg-amber-700 text-white font-black text-sm flex items-center justify-center mb-2">
              3
            </div>
            <img
              src={displayList[2].profile_photo_url}
              alt={displayList[2].name}
              className="w-16 h-16 rounded-full object-cover border-2 border-amber-700 mb-2 shadow-md"
            />
            <div className="font-bold text-sm text-white">{displayList[2].name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{displayList[2].member_number}</div>
            <div className="mt-3 text-base font-black font-mono text-amber-500 bg-slate-800/80 px-4 py-1 rounded-xl border border-slate-700">
              {period === 'WEEKLY' ? `${displayList[2].weekly_points} pts` : `${displayList[2].points} pts`}
            </div>
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="divide-y divide-slate-800">
          {displayList.map((member, index) => {
            const pointsValue = period === 'WEEKLY' ? member.weekly_points : member.points;
            const isDisqualified = period === 'WEEKLY' && member.weekly_points < 10;

            return (
              <div
                key={member.id}
                className="py-3.5 flex items-center justify-between gap-4 px-3 hover:bg-slate-800/40 rounded-xl transition"
              >
                <div className="flex items-center gap-3.5">
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
                    src={member.profile_photo_url}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />

                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{member.name}</span>
                      {member.role !== 'MEMBER' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {member.role}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {member.member_number} • {member.total_supports_given} supports given
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isDisqualified && (
                    <span className="text-[10px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                      Disqualified (&lt;10 pts)
                    </span>
                  )}
                  <span className="text-sm font-mono font-black text-amber-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                    {pointsValue} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
