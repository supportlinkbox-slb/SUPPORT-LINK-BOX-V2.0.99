import React from 'react';
import { ShieldAlert, LogOut, Clock, Ban, UserX } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MemberProfile } from '../../types';

interface StatusGateScreenProps {
  user: MemberProfile;
}

export const StatusGateScreen: React.FC<StatusGateScreenProps> = ({ user }) => {
  const { logout } = useApp();

  const getStatusDetails = () => {
    switch (user.status) {
      case 'PENDING':
        return {
          icon: <Clock className="w-8 h-8 text-amber-400" />,
          title: 'অ্যাকাউন্ট অনুমোদনের অপেক্ষায় (Pending)',
          description: 'আপনার অ্যাকাউন্টটি সফলভাবে তৈরি হয়েছে এবং বর্তমানে এডমিন অ্যাপ্রুভালের অপেক্ষায় রয়েছে। অনুমোদন পাওয়ার পর আপনি প্ল্যাটফর্মের সমস্ত কার্যক্রমে অংশ নিতে পারবেন।',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'SUSPENDED':
      case 'FROZEN':
        return {
          icon: <Ban className="w-8 h-8 text-red-400" />,
          title: 'অ্যাকাউন্ট স্থগিত রয়েছে (Suspended)',
          description: 'নীতিমালা লঙ্ঘনের কারণে আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। বিস্তারিত জানতে অনুগ্রহ করে কর্তৃপক্ষের সাথে যোগাযোগ করুন।',
          badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
      case 'REMOVED':
      case 'INACTIVE':
        return {
          icon: <UserX className="w-8 h-8 text-slate-400" />,
          title: 'অ্যাকাউন্ট নিষ্ক্রিয় বা অপসারিত (Inactive / Removed)',
          description: 'আপনার অ্যাকাউন্টটি বর্তমানে নিষ্ক্রিয় অবস্থায় রয়েছে।',
          badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        };
      default:
        return {
          icon: <ShieldAlert className="w-8 h-8 text-amber-400" />,
          title: 'অ্যাক্সেস সীমিত',
          description: `আপনার অ্যাকাউন্ট স্ট্যাটাস: ${user.status}`,
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-lg ${details.badgeColor}`}>
          {details.icon}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">{details.title}</h1>
          <p className="text-xs text-slate-300 leading-relaxed px-2">
            {details.description}
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">মেম্বার নম্বর:</span>
            <span className="text-slate-200 font-mono font-bold">{user.member_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">নাম:</span>
            <span className="text-slate-200 font-medium">{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ইমেইল:</span>
            <span className="text-slate-200 font-medium">{user.email}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700"
        >
          <LogOut className="w-4 h-4" />
          <span>অন্য অ্যাকাউন্টে লগইন করুন (Logout)</span>
        </button>
      </div>
    </div>
  );
};
