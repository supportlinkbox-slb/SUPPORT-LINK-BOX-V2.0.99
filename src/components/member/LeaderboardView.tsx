import React, { useState, useMemo } from 'react';
import { Trophy, Award, Medal, Crown, Calendar, Sparkles, AlertCircle, Search, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LeaderboardView: React.FC = () => {
  const { members } = useApp();

  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME' | 'HISTORICAL'>('WEEKLY');
  const [selectedWeek, setSelectedWeek] = useState<string>('Week 52 (Current)');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter out frozen members for active leaderboard rankings
  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status !== 'FROZEN');
  }, [members]);

  // Compute lists for each period
  const displayList = useMemo(() => {
    let list = [...activeMembers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.member_number.toLowerCase().includes(q)
      );
    }

    if (period === 'DAILY') {
      return list.sort((a, b) => (b.daily_points ?? 0) - (a.daily_points ?? 0) || b.points - a.points);
    } else if (period === 'WEEKLY' || period === 'HISTORICAL') {
      return list.sort((a, b) => b.weekly_points - a.weekly_points || b.points - a.points);
    } else if (period === 'MONTHLY') {
      return list.sort((a, b) => (b.monthly_points ?? b.points) - (a.monthly_points ?? a.points));
    } else {
      // ALL_TIME
      return list.sort((a, b) => b.points - a.points);
    }
  }, [activeMembers, period, searchQuery]);

  // SLB-BUG-07 FIX: Strictly filter podium candidates (must be ACTIVE and have >= 17 weekly points if WEEKLY)
  const podiumList = useMemo(() => {
    return displayList.filter((m) => {
      if (m.status !== 'ACTIVE') return false;
      if (period === 'WEEKLY' || period === 'HISTORICAL') {
        return (m.weekly_points ?? 0) >= 17;
      }
      return true;
    });
  }, [displayList, period]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
              নিয়মিত সাপোর্ট ও All Done দিয়ে লিডারবোর্ডে স্থান নিশ্চিত করুন। টাই-ব্রেকিংয়ে ১ম স্থান অর্জনের সংখ্যা গণনা করা হবে।
            </p>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setPeriod('DAILY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'DAILY'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              দৈনিক
            </button>
            <button
              onClick={() => setPeriod('WEEKLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'WEEKLY'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সাপ্তাহিক
            </button>
            <button
              onClick={() => setPeriod('MONTHLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'MONTHLY'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              মাসিক
            </button>
            <button
              onClick={() => setPeriod('ALL_TIME')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'ALL_TIME'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সর্বমোট
            </button>
            <button
              onClick={() => setPeriod('HISTORICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === 'HISTORICAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              আর্কাইভ
            </button>
          </div>
        </div>

        {/* Historical Week Selector & Search Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {period === 'HISTORICAL' ? (
            <div className="flex items-center gap-3">
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
          ) : (
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>সাপ্তাহিক কোয়ালিফিকেশন মিনিমাম পয়েন্ট: <strong className="text-amber-300">১৭ পয়েন্ট</strong></span>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="মেম্বার বা আইডি সার্চ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 2nd Place */}
        {podiumList[1] && (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-2 md:order-1 shadow-lg">
            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-sm flex items-center justify-center mb-2">
              2
            </div>
            <img
              src={podiumList[1].profile_photo_url}
              alt={podiumList[1].name}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-300 mb-2 shadow-md"
            />
            <div className="font-bold text-sm text-white">{podiumList[1].name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{podiumList[1].member_number}</div>
            <div className="mt-3 text-base font-black font-mono text-slate-200 bg-slate-800/80 px-4 py-1 rounded-xl border border-slate-700">
              {period === 'DAILY'
                ? `${podiumList[1].daily_points ?? 0} pts`
                : period === 'WEEKLY' || period === 'HISTORICAL'
                ? `${podiumList[1].weekly_points} pts`
                : `${podiumList[1].points} pts`}
            </div>
          </div>
        )}

        {/* 1st Place Champion */}
        {podiumList[0] && (
          <div className="bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 text-center flex flex-col items-center justify-between order-1 md:order-2 shadow-2xl relative">
            <Crown className="w-8 h-8 text-amber-400 -mt-2 animate-bounce" />
            <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center mb-2 shadow-lg">
              1
            </div>
            <img
              src={podiumList[0].profile_photo_url}
              alt={podiumList[0].name}
              className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 mb-2 shadow-xl"
            />
            <div className="font-black text-base text-white">{podiumList[0].name}</div>
            <div className="text-xs text-amber-400 font-mono">{podiumList[0].member_number}</div>
            <div className="mt-3 text-lg font-black font-mono text-amber-300 bg-amber-950/80 px-5 py-1.5 rounded-2xl border border-amber-500/50 shadow-inner">
              {period === 'DAILY'
                ? `${podiumList[0].daily_points ?? 0} pts`
                : period === 'WEEKLY' || period === 'HISTORICAL'
                ? `${podiumList[0].weekly_points} pts`
                : `${podiumList[0].points} pts`}
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {podiumList[2] && (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-3 shadow-lg">
            <div className="w-8 h-8 rounded-full bg-amber-700 text-white font-black text-sm flex items-center justify-center mb-2">
              3
            </div>
            <img
              src={podiumList[2].profile_photo_url}
              alt={podiumList[2].name}
              className="w-16 h-16 rounded-full object-cover border-2 border-amber-700 mb-2 shadow-md"
            />
            <div className="font-bold text-sm text-white">{podiumList[2].name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{podiumList[2].member_number}</div>
            <div className="mt-3 text-base font-black font-mono text-amber-500 bg-slate-800/80 px-4 py-1 rounded-xl border border-slate-700">
              {period === 'DAILY'
                ? `${podiumList[2].daily_points ?? 0} pts`
                : period === 'WEEKLY' || period === 'HISTORICAL'
                ? `${podiumList[2].weekly_points} pts`
                : `${podiumList[2].points} pts`}
            </div>
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {displayList.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            কোনো মেম্বারের তথ্য পাওয়া যায়নি
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {displayList.map((member, index) => {
              const pointsValue =
                period === 'DAILY'
                  ? member.daily_points ?? 0
                  : period === 'WEEKLY' || period === 'HISTORICAL'
                  ? member.weekly_points
                  : member.points;

              // Chapter 11 Disqualification rule: < 17 weekly points
              const isDisqualified = (period === 'WEEKLY' || period === 'HISTORICAL') && member.weekly_points < 17;

              return (
                <div
                  key={member.id}
                  className="py-3.5 flex items-center justify-between gap-4 px-3 hover:bg-slate-800/40 rounded-xl transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
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
                      className="w-10 h-10 shrink-0 rounded-full object-cover border border-slate-700"
                    />

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
                        <span className="truncate">{member.name}</span>
                        {member.role !== 'MEMBER' && (
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {member.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                        <span>{member.member_number}</span>
                        <span>•</span>
                        <span>{member.total_supports_given} supports</span>
                        {member.streak_days ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <Flame className="w-3 h-3 text-amber-500" />
                              {member.streak_days}d streak
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {isDisqualified && (
                      <span className="text-[10px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800 whitespace-nowrap">
                        Disqualified (&lt;17 pts)
                      </span>
                    )}
                    <span className="text-sm font-mono font-black text-amber-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 whitespace-nowrap">
                      {pointsValue} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

