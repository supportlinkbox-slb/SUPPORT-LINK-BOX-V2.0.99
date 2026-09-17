import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  FileSpreadsheet,
  AlertOctagon,
  ShieldAlert,
  History,
  CheckCircle2,
  XCircle,
  Lock,
  Search,
  Loader2,
  TrendingUp,
  Link as LinkIcon,
  AlertTriangle,
  RefreshCcw,
  UserCheck,
  UserX,
  ExternalLink,
  ChevronRight,
  Filter,
  Eye,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MemberProfile, UserRole, MemberStatus } from '../../types';
import { MemberDetailsModal } from './MemberDetailsModal';
import { MemberActionConfirmModal, ActionModalState } from './MemberActionConfirmModal';
import { formatToBDT } from '../../utils/bangladeshTime';
import { AdminInviteMember } from './AdminInviteMember';
import { AdminInviteList } from './AdminInviteList';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    members,
    dailyLinks,
    reports,
    allDoneRecords,
    auditLogs,
    refreshData,
    approveMember,
    rejectMember,
    updateMemberRole,
    updateMemberStatus,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'MEMBERS' | 'OVERVIEW' | 'INVITE'>('REQUESTS');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals state
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState<ActionModalState | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const pendingMembers = useMemo(() => {
    return members.filter((m) => m.status === 'PENDING');
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.member_number.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [members, searchQuery, statusFilter, roleFilter]);

  const handleRefresh = async () => {
    setLoading(true);
    await refreshData();
    setLoading(false);
  };

  // Open confirm modal for quick actions
  const openApproveConfirm = (target: MemberProfile) => {
    setConfirmModalState({
      isOpen: true,
      type: 'APPROVE',
      target,
      title: 'সদস্য অনুমোদন (Approve Registration)',
      message: `আপনি কি ${target.name} (${target.member_number})-এর রেজিস্ট্রেশন অনুমোদন করে অ্যাকাউন্টটি Active করতে চান?`,
      confirmBtnText: 'অনুমোদন করুন (Approve)',
      isDanger: false,
      requiresReason: false,
    });
  };

  const openRejectConfirm = (target: MemberProfile) => {
    setConfirmModalState({
      isOpen: true,
      type: 'REJECT',
      target,
      title: 'রেজিস্ট্রেশন বাতিল (Reject Registration)',
      message: `আপনি কি ${target.name} (${target.member_number})-এর রেজিস্ট্রেশন আবেদন বাতিল করতে চান?`,
      warning: 'আবেদন বাতিল করা হলে এই ব্যবহারকারী সিস্টেমে লগইন করতে পারবেন না।',
      confirmBtnText: 'বাতিল করুন (Reject)',
      isDanger: true,
      requiresReason: true,
    });
  };

  const openRoleChangeConfirm = (target: MemberProfile, newRole: UserRole) => {
    setConfirmModalState({
      isOpen: true,
      type: 'ROLE',
      target,
      newRole,
      title: `পদবী পরিবর্তন (${newRole})`,
      message: `${target.name}-এর ভূমিকা ${target.role} থেকে পরিবর্তন করে ${newRole} করতে যাচ্ছেন।`,
      confirmBtnText: 'রোল পরিবর্তন করুন',
      isDanger: newRole === 'ADMIN' || newRole === 'DEVELOPER',
      requiresReason: false,
    });
  };

  const openStatusChangeConfirm = (target: MemberProfile, newStatus: MemberStatus) => {
    setConfirmModalState({
      isOpen: true,
      type: 'STATUS',
      target,
      newStatus,
      title: `স্ট্যাটাস পরিবর্তন (${newStatus})`,
      message: `${target.name}-এর অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করে ${newStatus} করতে যাচ্ছেন।`,
      confirmBtnText: 'স্ট্যাটাস আপডেট করুন',
      isDanger: newStatus === 'SUSPENDED' || newStatus === 'FROZEN' || newStatus === 'REMOVED',
      requiresReason: newStatus === 'SUSPENDED' || newStatus === 'FROZEN' || newStatus === 'REMOVED',
    });
  };

  const handleExecuteModalConfirm = async (reason: string) => {
    if (!confirmModalState) return;
    setIsProcessingAction(true);
    try {
      if (confirmModalState.type === 'APPROVE') {
        await approveMember(confirmModalState.target.id);
      } else if (confirmModalState.type === 'REJECT') {
        await rejectMember(confirmModalState.target.id, reason);
      } else if (confirmModalState.type === 'ROLE' && confirmModalState.newRole) {
        await updateMemberRole(confirmModalState.target.id, confirmModalState.newRole);
      } else if (confirmModalState.type === 'STATUS' && confirmModalState.newStatus) {
        await updateMemberStatus(confirmModalState.target.id, confirmModalState.newStatus, reason);
      }
      setConfirmModalState(null);
      setIsDetailsOpen(false);
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Chapter 03 Security
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            সদস্য রেজিস্ট্রেশন অনুমোদন ও কেন্দ্রীয় অপারেশন ম্যানেজমেন্ট
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Members"
          value={members.filter((m) => m.status === 'ACTIVE').length}
          subtitle="সক্রিয় সদস্য"
          color="cyan"
          icon={<Users className="w-5 h-5" />}
        />
        <KPICard
          title="Registration Requests"
          value={pendingMembers.length}
          subtitle="অনুমোদনের অপেক্ষায়"
          color="amber"
          badge={pendingMembers.length > 0 ? 'Action Required' : undefined}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <KPICard
          title="Today's Links"
          value={dailyLinks.length}
          subtitle="আজকের জমা লিংক"
          color="emerald"
          icon={<LinkIcon className="w-5 h-5" />}
        />
        <KPICard
          title="Pending Reports"
          value={reports.filter((r) => r.status === 'PENDING').length}
          subtitle="অমীমাংসিত রিপোর্ট"
          color="red"
          icon={<ShieldAlert className="w-5 h-5" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'REQUESTS'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Registration Requests (অনুরোধ)</span>
          {pendingMembers.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
              {pendingMembers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'MEMBERS'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>All Members Directory (সদস্য তালিকা)</span>
          <span className="text-slate-500 text-[11px]">({members.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
            activeTab === 'OVERVIEW'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Operational Overview (সারসংক্ষেপ)</span>
        </button>
        <button
          onClick={() => setActiveTab('INVITE')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'INVITE'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Admin Invite (নতুন সদস্য)</span>
        </button>
      </div>

      {/* TAB 1: REGISTRATION REQUESTS */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4">
          {pendingMembers.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">কোন পেন্ডিং রেজিস্ট্রেশন আবেদন নেই</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                বর্তমানে সকল রেজিস্ট্রেশন অনুমোদিত অথবা প্রক্রিয়াজাত রয়েছে। নতুন কেউ রেজিস্টার করলে এখানে প্রদর্শিত হবে।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 transition shadow-lg shadow-amber-500/5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <img
                        src={member.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{member.name}</h3>
                          <span className="text-xs text-cyan-400 font-mono">{member.member_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            PENDING APPROVAL
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>Email: <strong className="text-slate-200">{member.email}</strong></span>
                          <span>•</span>
                          <span>Member No: <strong className="text-slate-200">{member.member_number}</strong></span>
                          {member.joined_at && (
                            <>
                              <span>•</span>
                              <span>আবেদন: {formatToBDT(member.joined_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setIsDetailsOpen(true);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>বিস্তারিত</span>
                      </button>
                      <button
                        onClick={() => openRejectConfirm(member)}
                        className="px-3.5 py-2 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>বাতিল (Reject)</span>
                      </button>
                      <button
                        onClick={() => openApproveConfirm(member)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>অনুমোদন (Approve)</span>
                      </button>
                    </div>
                  </div>

                  {/* Facebook Profile & Identity details */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Facebook নাম:</span>
                      <span className="font-semibold text-slate-200">{member.facebook_name || 'দেওয়া হয়নি'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Facebook Identity Key:</span>
                      <span className="font-mono text-cyan-400 font-semibold">{member.facebook_identity_key || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Facebook Profile Link:</span>
                      {member.facebook_url || member.facebook_profile_url ? (
                        <a
                          href={member.facebook_url || member.facebook_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 truncate font-medium"
                        >
                          <span className="truncate">{member.facebook_url || member.facebook_profile_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-500">দেওয়া হয়নি</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL MEMBERS DIRECTORY */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-4">
          {/* Filters and search */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="নাম, ইউজারনেম, মেম্বার নাম্বার বা ইমেইল দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="ACTIVE">ACTIVE (সক্রিয়)</option>
                <option value="PENDING">PENDING (অনুমোদনাধীন)</option>
                <option value="REJECTED">REJECTED (বাতিল)</option>
                <option value="SUSPENDED">SUSPENDED (স্থগিত)</option>
                <option value="FROZEN">FROZEN (হিমায়িত)</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">সকল পদবী</option>
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MEMBER">MEMBER</option>
              </select>
            </div>
          </div>

          {/* Members Table / Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Member</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Points</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                            alt={member.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{member.name}</span>
                              <span className="text-[10px] font-mono text-cyan-400 font-normal">
                                ({member.member_number})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            member.role === 'DEVELOPER'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : member.role === 'ADMIN'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : member.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : member.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-200">
                        {member.points} pts
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {member.joined_at ? formatToBDT(member.joined_at).split(',')[0] : 'N/A'}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setIsDetailsOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition"
                        >
                          ম্যানেজ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN INVITE */}
      {activeTab === 'INVITE' && (
        <div className="space-y-6">
          <AdminInviteMember />
          <AdminInviteList />
        </div>
      )}

      {/* TAB 3: OPERATIONAL OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>নিরাপত্তা ও অথেন্টিকেশন স্ট্যাটাস</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl">
                <span>Chapter 03 Identity Standard</span>
                <span className="text-emerald-400 font-bold">Active & Enforced</span>
              </li>
              <li className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl">
                <span>Facebook Identity Key Validation</span>
                <span className="text-emerald-400 font-bold">Strict Regex Active</span>
              </li>
              <li className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl">
                <span>Registration Auto-Login Barrier</span>
                <span className="text-emerald-400 font-bold">Section 21 Enforced</span>
              </li>
              <li className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl">
                <span>Developer Protected Account</span>
                <span className="text-purple-400 font-bold font-mono">Murad Shihab Khan</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>সাম্প্রতিক অডিট লগ (Audit Logs)</span>
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-950 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {formatToBDT(log.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Member Details Modal */}
      {isDetailsOpen && selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedMember(null);
          }}
          currentUser={currentUser}
          onRequestRoleChange={openRoleChangeConfirm}
          onRequestStatusChange={openStatusChangeConfirm}
          onRequestApprove={openApproveConfirm}
          onRequestReject={openRejectConfirm}
        />
      )}

      {/* Confirm Action Modal */}
      {confirmModalState && (
        <MemberActionConfirmModal
          modalState={confirmModalState}
          onClose={() => setConfirmModalState(null)}
          onConfirm={handleExecuteModalConfirm}
          isProcessing={isProcessingAction}
        />
      )}
    </div>
  );
};

const KPICard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  badge?: string;
  icon?: React.ReactNode;
}> = ({ title, value, subtitle, color, badge, icon }) => {
  const colorClasses: Record<string, string> = {
    cyan: 'border-cyan-800/80 text-cyan-400 bg-cyan-950/20',
    red: 'border-red-800/80 text-red-400 bg-red-950/20',
    emerald: 'border-emerald-800/80 text-emerald-400 bg-emerald-950/20',
    amber: 'border-amber-800/80 text-amber-400 bg-amber-950/20',
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border ${
        colorClasses[color] || 'border-slate-800 bg-slate-900'
      } relative overflow-hidden`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">{value}</div>
      {subtitle && <div className="text-[11px] text-slate-400 mt-1">{subtitle}</div>}
      {badge && (
        <span className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
          {badge}
        </span>
      )}
    </div>
  );
};

