import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Award,
  Calendar,
  ExternalLink,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Clock,
  Activity,
  History,
  Loader2,
  Check,
  Facebook,
  Link as LinkIcon,
  ShieldAlert,
} from 'lucide-react';
import { MemberProfile, UserRole, MemberStatus, AuditLog, DailyLink, AllDoneRecord } from '../../types';
import { formatToBDT } from '../../utils/bangladeshTime';
import { useApp } from '../../context/AppContext';

interface MemberDetailsModalProps {
  member: MemberProfile | null;
  isOpen?: boolean;
  onClose: () => void;
  currentUser: MemberProfile | null;
  onRequestRoleChange: (member: MemberProfile, newRole: UserRole) => void;
  onRequestStatusChange: (member: MemberProfile, newStatus: MemberStatus) => void;
  onRequestApprove: (member: MemberProfile) => void;
  onRequestReject: (member: MemberProfile) => void;
}

export const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({
  member,
  isOpen = true,
  onClose,
  currentUser,
  onRequestRoleChange,
  onRequestStatusChange,
  onRequestApprove,
  onRequestReject,
}) => {
  const { updateMemberProfile, auditLogs, dailyLinks, allDoneRecords, punishments } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'history' | 'edit'>('overview');
  
  // Profile edit form state (allowlisted fields only)
  const [editName, setEditName] = useState('');
  const [editFbName, setEditFbName] = useState('');
  const [editFbUrl, setEditFbUrl] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setEditName(member.name || '');
      setEditFbName(member.facebook_name || '');
      setEditFbUrl(member.facebook_url || '');
      setEditPhotoUrl(member.profile_photo_url || '');
      setActiveTab('overview');
      setEditError(null);
      setSaveSuccess(false);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const isDev = member.role === 'DEVELOPER';
  const isPending = member.status === 'PENDING';
  const isActive = member.status === 'ACTIVE';
  const isFrozen = member.status === 'FROZEN';
  const isSuspended = member.status === 'SUSPENDED';
  const isRemoved = member.status === 'REMOVED';

  // Member activity statistics
  const memberLinks = dailyLinks.filter((l) => l.owner_id === member.id);
  const memberAllDone = allDoneRecords.filter((r) => r.member_id === member.id);
  const memberPunishments = (punishments || []).filter((p) => p.member_id === member.id);
  const memberLogs = auditLogs.filter(
    (l) => l.target_id === member.id || l.details?.includes(member.member_number)
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setSaveSuccess(false);

    if (!editName.trim()) {
      setEditError('সদস্যের নাম আবশ্যক।');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateMemberProfile(member.id, {
        name: editName.trim(),
        facebook_name: editFbName.trim(),
        facebook_url: editFbUrl.trim(),
        profile_photo_url: editPhotoUrl.trim(),
      });

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setEditError(res.error || 'প্রোফাইল আপডেট করতে সমস্যা হয়েছে।');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={member.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}
                alt={member.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50"
              />
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                  isActive
                    ? 'bg-emerald-500'
                    : isFrozen
                    ? 'bg-cyan-500'
                    : isPending
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                title={`Status: ${member.status}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {member.name}
                </h3>
                {isDev && (
                  <span className="bg-purple-900/80 text-purple-300 border border-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    DEVELOPER
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                <span className="font-mono text-cyan-400 font-bold">{member.member_number}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">{member.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>ওভারভিউ ও পরিচয়</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>অ্যাক্টিভিটি ও পয়েন্ট ({member.points})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>অডিট ও হিস্টোরি ({memberLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'edit'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>প্রোফাইল সম্পাদনা</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Primary Identity Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400 font-medium">রোল (Role)</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-white">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>{member.role}</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400 font-medium">স্ট্যাটাস (Status)</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isActive
                          ? 'bg-emerald-950 text-emerald-300'
                          : isFrozen
                          ? 'bg-cyan-950 text-cyan-300'
                          : isPending
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-red-950 text-red-300'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-400 font-medium">কমিউনিটি কোড</div>
                  <div className="mt-1 font-mono font-bold text-sm text-cyan-300">
                    {member.community_id ? member.community_id.slice(0, 12) : 'Default Community'}
                  </div>
                </div>
              </div>

              {/* Facebook Identity & Join Date */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-2.5">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Facebook className="w-3.5 h-3.5 text-blue-400" />
                  <span>ফেসবুক আইডেন্টিটি</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">অ্যাকাউন্টের নাম: </span>
                    <span className="font-semibold text-white">
                      {member.facebook_name || 'দেওয়া হয়নি'}
                    </span>
                  </div>
                  {member.facebook_url && (
                    <a
                      href={member.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <span>প্রোফাইল লিংক খুলুন</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>যোগদানের তারিখ:</span>
                  </span>
                  <span className="font-mono text-slate-300">{formatToBDT(member.joined_at)}</span>
                </div>
              </div>

              {/* Administrative Action Center for this Member */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-900/40 space-y-3">
                <div className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
                  <span>এডমিন কন্ট্রোল অ্যাকশন</span>
                  {isDev && <span className="text-[10px] text-amber-400 font-mono">Protected Account</span>}
                </div>

                {isDev ? (
                  <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/40 text-xs text-purple-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>এই সদস্য একজন ডেভেলপার। তার ভূমিকা বা স্ট্যাটাস অপরিবর্তনীয় ও সুরক্ষিত।</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Pending Approval Controls */}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => onRequestApprove(member)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>অনুমোদন করুন (Approve)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestReject(member)}
                          className="px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-200 text-xs font-bold transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>প্রত্যাখ্যান করুন (Reject)</span>
                        </button>
                      </>
                    )}

                    {/* Role Promotion / Demotion */}
                    {member.role === 'MEMBER' && !isPending && (
                      <button
                        type="button"
                        onClick={() => onRequestRoleChange(member, 'ADMIN')}
                        className="px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-semibold transition"
                      >
                        Make Admin
                      </button>
                    )}
                    {member.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => onRequestRoleChange(member, 'MEMBER')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        Demote to Member
                      </button>
                    )}

                    {/* Status Management */}
                    {isActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => onRequestStatusChange(member, 'FROZEN')}
                          className="px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 hover:bg-cyan-900 text-xs font-semibold transition border border-cyan-800/60"
                        >
                          Freeze Account
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestStatusChange(member, 'SUSPENDED')}
                          className="px-3 py-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 text-xs font-semibold transition border border-red-800/60"
                        >
                          Suspend Account
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestStatusChange(member, 'REMOVED')}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-red-400 hover:bg-slate-700 text-xs font-semibold transition"
                        >
                          Remove Member
                        </button>
                      </>
                    )}

                    {(isFrozen || isSuspended || isRemoved) && (
                      <button
                        type="button"
                        onClick={() => onRequestStatusChange(member, 'ACTIVE')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>সচল করুন (Restore Active)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVITY & POINTS */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">সর্বমোট পয়েন্ট</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">{member.points}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">সাপ্তাহিক পয়েন্ট</div>
                  <div className="text-xl font-bold font-mono text-purple-400 mt-1">{member.weekly_points}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">জমা দেওয়া লিংক</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{member.total_links_submitted || memberLinks.length}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">সাপোর্ট প্রদান</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{member.total_supports_given || 0}</div>
                </div>
              </div>

              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
                <div className="text-xs font-bold text-slate-300">সাম্প্রতিক জমাকৃত লিংকসমূহ</div>
                {memberLinks.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center">কোন লিংক জমা পাওয়া যায়নি।</div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {memberLinks.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 text-xs border border-slate-800"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-cyan-400 font-bold">#{l.serial_display}</span>
                          <span className="text-slate-300 truncate">{l.caption}</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-400 font-mono ml-2 whitespace-nowrap">
                          {l.total_supports_count} supports
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
                <div className="text-xs font-bold text-slate-300">All Done ইতিহাস</div>
                {memberAllDone.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center">কোন All Done রেকর্ড পাওয়া যায়নি।</div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {memberAllDone.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 text-xs border border-slate-800"
                      >
                        <div className="font-mono text-slate-300">{r.date}</div>
                        <div className="text-right text-[11px] font-mono text-amber-400 font-bold">
                          +{r.total_points} pts {r.fastest_rank ? `(Rank #${r.fastest_rank})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT & HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Disciplinary / Punishment History */}
              {memberPunishments.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    <span>শাস্তি ও পেনাল্টি রেকর্ড ({memberPunishments.length})</span>
                  </div>
                  <div className="space-y-2">
                    {memberPunishments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-red-950/30 border border-red-800/50 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-red-300 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                            {p.punishment_type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            তারিখ: {p.detected_date}
                          </span>
                        </div>
                        <div className="text-slate-200 text-xs font-medium">{p.reason}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 pt-1 border-t border-red-900/30 font-mono">
                          <span>মিসিং সাপোর্ট: {p.missing_support_count}</span>
                          <span>•</span>
                          <span>স্ট্যাটাস: <strong className="text-amber-300">{p.status}</strong></span>
                          <span>•</span>
                          <span>সনাক্তকারী: {p.detected_by_admin}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-400">
                এই সদস্যের সাথে সম্পর্কিত সিকিউরিটি, রোল ও স্ট্যাটাস অডিট লগ:
              </div>

              {memberLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                  কোন সম্পর্কিত অডিট রেকর্ড পাওয়া যায়নি।
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {memberLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatToBDT(log.created_at)}
                        </span>
                      </div>
                      <div className="text-slate-300 text-xs mt-1">{log.details}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                        <span>Actor: {log.actor_name}</span>
                        <span>•</span>
                        <span>Role: {log.actor_role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EDIT PROFILE (Allowlisted Fields Only) */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-blue-300">
                নিরাপত্তা নীতি অনুযায়ী শুধুমাত্র ডিসপ্লে নাম, ফেসবুক তথ্য ও ছবি লিঙ্ক সম্পাদনা করা যাবে। সদস্য নম্বর বা পয়েন্ট ব্যালেন্স সরাসরি পরিবর্তন করা যাবে না।
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>সদস্য প্রোফাইল সফলভাবে আপডেট হয়েছে!</span>
                </div>
              )}

              {editError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    পূর্ণ নাম (Full Name) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ফেসবুক আইডির নাম (Facebook Name)
                  </label>
                  <input
                    type="text"
                    value={editFbName}
                    onChange={(e) => setEditFbName(e.target.value)}
                    placeholder="e.g. Tanvir Hasan"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ফেসবুক প্রোফাইল URL (Facebook Profile URL)
                  </label>
                  <input
                    type="url"
                    value={editFbUrl}
                    onChange={(e) => setEditFbUrl(e.target.value)}
                    placeholder="https://facebook.com/username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    প্রোফাইল ছবি URL (Profile Photo URL)
                  </label>
                  <input
                    type="url"
                    value={editPhotoUrl}
                    onChange={(e) => setEditPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>পরিবর্তন সংরক্ষণ করুন</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
