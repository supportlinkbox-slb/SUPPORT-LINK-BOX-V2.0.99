import React, { useState } from 'react';
import { ShieldAlert, LogOut, Clock, Ban, UserX, PlayCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MemberProfile } from '../../types';
import { supabase } from '../../lib/supabase';
import { DemoAdModal } from '../common/DemoAdModal';

interface StatusGateScreenProps {
  user: MemberProfile;
}

export const StatusGateScreen: React.FC<StatusGateScreenProps> = ({ user }) => {
  const { logout, updateMemberStatus } = useApp();
  const [isAdOpen, setIsAdOpen] = useState(false);

  const handleAdCompleted = async () => {
    // Invoke server-side ad recovery RPC instead of direct client-side status update
    try {
      const { error } = await supabase.rpc('rpc_complete_ad_recovery', { p_member_id: user.id });
      if (error) {
        alert('রিকভারিতে সমস্যা হয়েছে: ' + error.message);
      } else {
        alert('আপনার রিকভারি সফল হয়েছে। পেজ রিফ্রেশ করুন।');
        window.location.reload();
      }
    } catch {
      alert('সার্ভার রিকভারি রেসপন্স দিতে পারেনি। এডমিনের সাথে যোগাযোগ করুন।');
    }
  };

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
          badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const statusInfo = getStatusDetails();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto shadow-inner">
          {statusInfo.icon}
        </div>

        <div className="space-y-2">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${statusInfo.badgeColor}`}
          >
            {user.status}
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight">{statusInfo.title}</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{statusInfo.description}</p>
        </div>

        {/* Member Profile Summary Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-500">নাম:</span>
            <span className="text-slate-200 font-bold">{user.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-500">আইডি নম্বর:</span>
            <span className="text-cyan-400 font-mono font-bold">{user.member_number}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-500">ইমেইল:</span>
            <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]">
              {user.email}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">রোল:</span>
            <span className="text-slate-300 font-semibold">{user.role}</span>
          </div>
        </div>

        {/* Support Helpline & Action */}
        <div className="space-y-3 pt-2">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-left">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              এডমিন সহায়তা কেন্দ্র
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              আপনার অ্যাকাউন্টটি দ্রুত সক্রিয় বা যাচাই করতে নিচের যে কোনো একটি মাধ্যমে সরাসরি
              এডমিনের সাথে যোগাযোগ করতে পারেন:
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold text-center text-[11px] hover:bg-blue-600 hover:text-white transition"
              >
                ফেসবুক ইনবক্স
              </a>
              <a
                href="https://wa.me/8801700000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-bold text-center text-[11px] hover:bg-emerald-600 hover:text-white transition"
              >
                হোয়াটসঅ্যাপ সাপোর্ট
              </a>
            </div>
          </div>
        </div>

        {(user.status === 'SUSPENDED' || user.status === 'FROZEN' || user.status === 'INACTIVE') && (
          <button
            onClick={() => setIsAdOpen(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
          >
            <PlayCircle className="w-4 h-4 fill-slate-950" />
            <span>রিকভারি ধাপ সম্পন্ন করুন</span>
          </button>
        )}

        <button
          onClick={logout}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700"
        >
          <LogOut className="w-4 h-4" />
          <span>অন্য অ্যাকাউন্টে লগইন করুন (Logout)</span>
        </button>
      </div>

      <DemoAdModal
        isOpen={isAdOpen}
        onClose={() => setIsAdOpen(false)}
        onAdCompleted={handleAdCompleted}
        adTitle="অ্যাকাউন্ট রি-অ্যাক্টিভেশন"
        durationSeconds={15}
      />
    </div>
  );
};
