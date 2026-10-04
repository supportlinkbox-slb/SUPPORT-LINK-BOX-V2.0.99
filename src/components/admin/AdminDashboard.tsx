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
  ChevronLeft,
  Filter,
  Eye,
  Info,
  UserPlus,
  Settings,
  Bell,
  PlusCircle,
  Sparkles,
  Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MemberProfile, UserRole, MemberStatus } from '../../types';
import { MemberDetailsModal } from './MemberDetailsModal';
import { MemberActionConfirmModal, ActionModalState } from './MemberActionConfirmModal';
import { RejectMemberModal } from './RejectMemberModal';;
import { formatToBDT } from '../../utils/bangladeshTime';
import { AdminInviteMember } from './AdminInviteMember';
import { AdminInviteList } from './AdminInviteList';
import { AdminSettingsPanel } from './AdminSettingsPanel';
import { AdminNoticeGeneratorModal } from './AdminNoticeGeneratorModal';
import { LinkSubmissionModal } from '../member/LinkSubmissionModal';
import { FestivalThemeManagerModal } from './FestivalThemeManagerModal';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    members,
    dailyLinks,
    reports,
    allDoneRecords,
    auditLogs,
    refreshData,
    fetchPaginatedMembers,
    approveMember,
    rejectMember,
    blacklistMember,
    updateMemberRole,
    updateMemberStatus,
    deleteDailyLink,
    verifyFakeAllDone,
    todayDate,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'MEMBERS' | 'TODAYS_LINKS' | 'SUPPORT_MATRIX' | 'OVERVIEW' | 'INVITE' | 'SETTINGS'>('REQUESTS');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Server-side Pagination & Search State for Members (Scales seamlessly up to 10,000+ members)
  const [memberPage, setMemberPage] = useState<number>(1);
  const [memberPageSize] = useState<number>(15);
  const [paginatedMembers, setPaginatedMembers] = useState<MemberProfile[]>([]);
  const [memberTotalCount, setMemberTotalCount] = useState<number>(0);
  const [memberTotalPages, setMemberTotalPages] = useState<number>(1);
  const [isMemberLoading, setIsMemberLoading] = useState<boolean>(false);

  // Modals state
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState<ActionModalState | null>(null);
  const [rejectModalMember, setRejectModalMember] = useState<MemberProfile | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isNoticeGeneratorOpen, setIsNoticeGeneratorOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [submitLinkTargetMemberId, setSubmitLinkTargetMemberId] = useState<string | null>(null);

  const pendingMembers = useMemo(() => {
    return members.filter((m) => m.status === 'PENDING');
  }, [members]);

  // Load paginated members from server with debounce on search
  useEffect(() => {
    let isCurrent = true;
    const loadMembers = async () => {
      setIsMemberLoading(true);
      try {
        const res = await fetchPaginatedMembers({
          search: searchQuery,
          role: roleFilter as any,
          status: statusFilter as any,
          page: memberPage,
          pageSize: memberPageSize,
        });
        if (isCurrent && res.success && res.members) {
          setPaginatedMembers(res.members);
          setMemberTotalCount(res.totalCount || 0);
          setMemberTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        console.error('Failed to load paginated members:', err);
      } finally {
        if (isCurrent) setIsMemberLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadMembers();
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery, statusFilter, roleFilter, memberPage, memberPageSize, fetchPaginatedMembers, members]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setMemberPage(1);
  }, [searchQuery, statusFilter, roleFilter]);

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
    setRejectModalMember(target);
  };

  const handleRejectMember = async (memberId: string, reasonCode: string | null, customReason: string) => {
    setIsProcessingAction(true);
    try {
      const res = await rejectMember(memberId, reasonCode, customReason);
      if (!res.success) throw new Error(res.error || 'Reject failed');
      setRejectModalMember(null);
      setIsDetailsOpen(false);
      await refreshData();
    } catch (err: any) {
      alert('Reject ব্যর্থ: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBlacklistMember = async (memberId: string, email: string, fbLink: string, reason: string) => {
    setIsProcessingAction(true);
    try {
      const res = await blacklistMember(memberId, email, fbLink, reason);
      if (!res.success) throw new Error(res.error || 'Blacklist failed');
      setRejectModalMember(null);
      setIsDetailsOpen(false);
      await refreshData();
      alert('ব্ল্যাকলিস্ট সম্পন্ন ✅');
    } catch (err: any) {
      alert('Blacklist ব্যর্থ: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsProcessingAction(false);
    }
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
            onClick={() => setIsThemeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 hover:from-amber-500 hover:to-orange-500 text-amber-300 hover:text-slate-950 text-xs font-bold rounded-xl border border-amber-500/40 transition shadow-sm cursor-pointer"
            title="উৎসব ও বিশেষ দিবস থিম সেটিংস"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>উৎসব থিম</span>
          </button>
          <button
            onClick={() => setIsNoticeGeneratorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold rounded-xl border border-amber-500/30 transition shadow-sm cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>নোটিশ জেনারেটর</span>
          </button>
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

      {/* Admin Module Control Grid (Clean Grid Layout - No Horizontal Sliding Required) */}
      <div className="space-y-2 pt-1">
        <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
          <span>অ্যাডমিন ম্যানেজমেন্ট প্যানেল (Admin Control Hub)</span>
          <span className="text-[10px] text-cyan-400 font-mono">SELECT MODULE</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          {/* Module 1: Requests */}
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'REQUESTS'
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'REQUESTS' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400 group-hover:bg-slate-700'}`}>
                <UserCheck className="w-4 h-4" />
              </div>
              {pendingMembers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-bounce">
                  {pendingMembers.length}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-black truncate">অনুরোধ</div>
              <div className="text-[10px] text-slate-400 truncate">রেজিস্ট্রেশন আবেদন</div>
            </div>
          </button>

          {/* Module 2: Members Directory */}
          <button
            onClick={() => setActiveTab('MEMBERS')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'MEMBERS'
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'MEMBERS' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400 group-hover:bg-slate-700'}`}>
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {members.length}
              </span>
            </div>
            <div>
              <div className="text-xs font-black truncate">সদস্য তালিকা</div>
              <div className="text-[10px] text-slate-400 truncate">সকল মেম্বার</div>
            </div>
          </button>

          {/* Module 3: Today's Links Manager */}
          <button
            onClick={() => setActiveTab('TODAYS_LINKS')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'TODAYS_LINKS'
                ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'TODAYS_LINKS' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-emerald-400 group-hover:bg-slate-700'}`}>
                <LinkIcon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                {dailyLinks.length}
              </span>
            </div>
            <div>
              <div className="text-xs font-black truncate">আজকের লিংকস</div>
              <div className="text-[10px] text-slate-400 truncate">এডিট/সিরিয়াল/ডিলিট</div>
            </div>
          </button>

          {/* Module 4: Live Support Matrix & Punishments */}
          <button
            onClick={() => setActiveTab('SUPPORT_MATRIX')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'SUPPORT_MATRIX'
                ? 'bg-gradient-to-br from-red-950 via-slate-900 to-slate-900 border-red-500 text-white shadow-lg shadow-red-500/20 ring-1 ring-red-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'SUPPORT_MATRIX' ? 'bg-red-500 text-white font-bold' : 'bg-slate-800 text-red-400 group-hover:bg-slate-700'}`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xs font-black truncate">সাপোর্ট ম্যাট্রিক্স</div>
              <div className="text-[10px] text-slate-400 truncate">ফেইক অল ডান / শাস্তি</div>
            </div>
          </button>

          {/* Module 5: Operational Overview */}
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'OVERVIEW'
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'OVERVIEW' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400 group-hover:bg-slate-700'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xs font-black truncate">সারসংক্ষেপ</div>
              <div className="text-[10px] text-slate-400 truncate">অপারেশন ওভারভিউ</div>
            </div>
          </button>

          {/* Module 6: Admin Invite */}
          <button
            onClick={() => setActiveTab('INVITE')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'INVITE'
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'INVITE' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400 group-hover:bg-slate-700'}`}>
                <UserPlus className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xs font-black truncate">ইনভাইট</div>
              <div className="text-[10px] text-slate-400 truncate">সদস্য টোকেন</div>
            </div>
          </button>

          {/* Module 7: System Settings */}
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between space-y-2 group ${
              activeTab === 'SETTINGS'
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl transition ${activeTab === 'SETTINGS' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400 group-hover:bg-slate-700'}`}>
                <Settings className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xs font-black truncate">সেটিংস</div>
              <div className="text-[10px] text-slate-400 truncate">সিস্টেম কনফিগ</div>
            </div>
          </button>
        </div>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
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
                  {isMemberLoading ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>সার্ভার থেকে সদস্য তালিকা লোড হচ্ছে...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        কোনো সদস্যের রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    paginatedMembers.map((member) => (
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
                          <div className="flex items-center justify-end gap-1.5">
                            {member.status === 'ACTIVE' && (
                              <button
                                onClick={() => setSubmitLinkTargetMemberId(member.id)}
                                className="px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900 text-purple-300 text-xs font-bold rounded-lg border border-purple-800/60 transition"
                                title="সদস্যের পক্ষে লিংক জমা দিন"
                              >
                                লিংক জমা
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedMember(member);
                                setIsDetailsOpen(true);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition"
                            >
                              ম্যানেজ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination Footer */}
            <div className="p-3.5 bg-slate-950/40 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>
                  মোট সদস্য: <strong className="text-white font-mono">{memberTotalCount}</strong> জন
                </span>
                <span className="text-slate-600">|</span>
                <span>
                  পৃষ্ঠা: <strong className="text-cyan-400 font-mono">{memberPage}</strong> /{' '}
                  <span className="font-mono">{memberTotalPages}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberPage((prev) => Math.max(1, prev - 1))}
                  disabled={memberPage <= 1 || isMemberLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-800 transition flex items-center gap-1 font-bold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>পূর্ববর্তী</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberPage((prev) => Math.min(memberTotalPages, prev + 1))}
                  disabled={memberPage >= memberTotalPages || isMemberLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-800 transition flex items-center gap-1 font-bold"
                >
                  <span>পরবর্তী</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
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

      {/* TAB 7: TODAY'S LINKS MANAGER */}
      {activeTab === 'TODAYS_LINKS' && (() => {
        // Date & Day formatting for export
        const dateStr = todayDate || new Date().toISOString().slice(0, 10);
        const ddmmYy = (() => {
          try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
            }
          } catch {}
          return dateStr;
        })();

        const banglaDay = (() => {
          try {
            const dateObj = new Date(dateStr);
            const dayIndex = dateObj.getDay();
            const banglaDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
            return banglaDays[dayIndex];
          } catch {
            return 'বৃহস্পতিবার';
          }
        })();

        const getEmojiNumber = (num: number): string => {
          const emojiDigits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
          return num
            .toString()
            .split('')
            .map((digit) => emojiDigits[parseInt(digit)])
            .join('');
        };

        // Plain Text generation for Link List
        const linkListText = (() => {
          const maxSerial = dailyLinks.reduce((max, l) => l.serial_number > max ? l.serial_number : max, 0);
          const lines: string[] = [];
          lines.push(`📅তারিখ : ${ddmmYy}`);
          lines.push(`📆বার : ${banglaDay}`);
          lines.push(`যারা লিংক দিয়েছেন তাদের তালিকা`);
          lines.push(`                    👇👇👇`);
          
          if (maxSerial === 0) {
            lines.push(`(কোন লিংক পাওয়া যায়নি)`);
          } else {
            for (let i = 1; i <= maxSerial; i++) {
              const link = dailyLinks.find((l) => l.serial_number === i);
              let displayName = '🚫 𝙉𝙊 𝙋𝙊𝙎𝙏 🚫';
              if (link && link.status !== 'removed') {
                displayName = `@${link.owner_name}`;
              }
              lines.push(`${getEmojiNumber(i)}➤${displayName}`);
            }
          }
          return lines.join('\n');
        })();

        // Plain Text generation for All Done List (link serial order)
        const allDoneListText = (() => {
          const maxSerial = dailyLinks.reduce((max, l) => l.serial_number > max ? l.serial_number : max, 0);
          const lines: string[] = [];
          lines.push(`📅তারিখ : ${ddmmYy}`);
          lines.push(`📆বার : ${banglaDay}`);
          lines.push(`যারা সাপোর্ট করেছেন তাদের তালিকা`);
          lines.push(`                    👇👇👇`);
          
          if (maxSerial === 0) {
            lines.push(`(কোন লিংক পাওয়া যায়নি)`);
          } else {
            for (let i = 1; i <= maxSerial; i++) {
              const link = dailyLinks.find((l) => l.serial_number === i);
              let lineContent = '';
              
              if (!link || link.status === 'removed') {
                lineContent = '🚫 𝙉𝙊 𝙋𝙊𝙎𝙏 🚫';
              } else {
                const adRecord = allDoneRecords.find((r) => r.member_id === link.owner_id && r.status !== 'REVOKED');
                if (adRecord) {
                  if (adRecord.alternative_id_used && adRecord.alternative_id_details?.account_name) {
                    lineContent = `@${link.owner_name} (${adRecord.alternative_id_details.account_name})`;
                  } else {
                    lineContent = `@${link.owner_name}`;
                  }
                } else {
                  lineContent = '';
                }
              }
              lines.push(`${getEmojiNumber(i)}➤${lineContent}`);
            }
          }
          return lines.join('\n');
        })();

        const [copiedLink, setCopiedLink] = React.useState(false);
        const [copiedAllDone, setCopiedAllDone] = React.useState(false);

        const copyTextToClipboard = (text: string, setCopied: (v: boolean) => void) => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        const exportLinkListToCSV = () => {
          const headers = ['Serial Number', 'Member Number', 'Member Name', 'Facebook Link', 'Submitted At', 'Category'];
          const maxSerial = dailyLinks.reduce((max, l) => l.serial_number > max ? l.serial_number : max, 0);
          const rows: string[] = [];
          
          for (let i = 1; i <= maxSerial; i++) {
            const link = dailyLinks.find((l) => l.serial_number === i);
            if (link && link.status !== 'removed') {
              rows.push(`"${i}","${link.owner_member_number}","${link.owner_name}","${link.fb_link}","${link.submitted_at}","${link.category}"`);
            } else {
              rows.push(`"${i}","","🚫 𝙉𝙊 𝙋𝙊𝙎𝙏 🚫","","",""`);
            }
          }
          
          const content = [headers.join(','), ...rows].join('\n');
          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.setAttribute('download', `link_list_${dateStr}.csv`);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        };

        const exportAllDoneListToCSV = () => {
          const headers = ['Serial Number', 'Member Number', 'Member Name', 'Completed At', 'Status', 'Alternative ID Used', 'Alternative ID Name'];
          const maxSerial = dailyLinks.reduce((max, l) => l.serial_number > max ? l.serial_number : max, 0);
          const rows: string[] = [];
          
          for (let i = 1; i <= maxSerial; i++) {
            const link = dailyLinks.find((l) => l.serial_number === i);
            if (!link || link.status === 'removed') {
              rows.push(`"${i}","","🚫 𝙉𝙊 𝙋𝙊𝙎𝙏 🚫","","","",""`);
            } else {
              const adRecord = allDoneRecords.find((r) => r.member_id === link.owner_id && r.status !== 'REVOKED');
              if (adRecord) {
                rows.push(`"${i}","${adRecord.member_number}","${link.owner_name}","${adRecord.completed_at}","${adRecord.status}","${adRecord.alternative_id_used ? 'Yes' : 'No'}","${adRecord.alternative_id_details?.account_name || ''}"`);
              } else {
                rows.push(`"${i}","${link.owner_member_number}","${link.owner_name}","","Pending All Done","",""`);
              }
            }
          }
          
          const content = [headers.join(','), ...rows].join('\n');
          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.setAttribute('download', `all_done_list_${dateStr}.csv`);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-emerald-400" />
                  <span>আজকের লিংকস ম্যানেজমেন্ট ({dailyLinks.length})</span>
                </h3>
                <p className="text-xs text-slate-400">সকলের জমা দেওয়া লিংকের তালিকা, এডিট, ডিলিট ও অ্যাডমিন অ্যাকশন।</p>
              </div>
              <button
                onClick={() => setSubmitLinkTargetMemberId(currentUser?.id || '')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>লিংক জমা দিন (Admin / Member)</span>
              </button>
            </div>

            {/* Link List & All Done List Format Exporter section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-950/40 p-4 rounded-3xl border border-slate-800/80">
              {/* Column 1: Today's Link list */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    আজকের লিংক লিস্ট (Link List)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyTextToClipboard(linkListText, setCopiedLink)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-slate-700"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedLink ? 'Copied!' : 'কপি করুন'}</span>
                    </button>
                    <button
                      onClick={exportLinkListToCSV}
                      className="px-2.5 py-1.5 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-emerald-800"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>এক্সপোর্ট শিট</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={linkListText}
                  className="w-full h-48 bg-slate-950 text-slate-300 font-mono text-xs rounded-xl p-3 border border-slate-800 focus:outline-none resize-none"
                />
              </div>

              {/* Column 2: Today's All Done List */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    আজকের অল ডান লিস্ট (All Done List)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyTextToClipboard(allDoneListText, setCopiedAllDone)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-slate-700"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedAllDone ? 'Copied!' : 'কপি করুন'}</span>
                    </button>
                    <button
                      onClick={exportAllDoneListToCSV}
                      className="px-2.5 py-1.5 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-cyan-800"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>এক্সপোর্ট শিট</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={allDoneListText}
                  className="w-full h-48 bg-slate-950 text-slate-300 font-mono text-xs rounded-xl p-3 border border-slate-800 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">#Serial</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Post Link</th>
                    <th className="p-3">Submitted At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dailyLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 font-mono font-bold text-cyan-400">#{link.serial_display} (P{link.part_number})</td>
                      <td className="p-3 font-bold text-white">{link.owner_name} ({link.owner_member_number})</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          link.category === 'VIP' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                          link.category === 'ADMIN' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {link.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <a href={link.fb_link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 max-w-[200px] truncate">
                          <span className="truncate">{link.fb_link}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{formatToBDT(link.submitted_at)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={async () => {
                            if (confirm(`আপনি কি সত্যিই #${link.serial_display} লিংকটি ডিলিট করতে চান?`)) {
                              await deleteDailyLink(link.id);
                            }
                          }}
                          className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-300 rounded-lg text-[11px] font-bold border border-red-800 transition"
                        >
                          ডিলিট
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB 8: LIVE SUPPORT MATRIX & FAKE ALL DONE MANAGER */}
      {activeTab === 'SUPPORT_MATRIX' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <span>লাইভ সাপোর্ট ম্যাট্রিক্স ও ফেইক অল ডান মনিটরিং</span>
              </h3>
              <p className="text-xs text-slate-400">আজকের কোন মেম্বার কতটি লিংকে সাপোর্ট দিয়েছে ও ফেইক অল ডান পেনাল্টি ইন্টারফেস।</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* All Done Submissions Review & Punishment */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">আজকের All Done জমাদানকারীগণ ({allDoneRecords.length})</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {allDoneRecords.map((ad) => (
                  <div key={ad.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{ad.member_name}</span>
                        <span className="text-[10px] font-mono text-cyan-400">({ad.member_number})</span>
                        {ad.fastest_rank && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px]">#{ad.fastest_rank}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">সময়: {formatToBDT(ad.completed_at)} • পয়েন্ট: +{ad.total_points}</div>
                    </div>
                    {ad.status !== 'REVOKED' ? (
                      <button
                        onClick={async () => {
                          const reason = prompt(`${ad.member_name}-এর বিরুদ্ধে ফেইক অল ডানের কারণ বা নোট লিখুন:`);
                          if (reason) {
                            await verifyFakeAllDone(ad.id, reason);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[11px] shadow transition"
                      >
                        ফেইক অল ডান (Punish)
                      </button>
                    ) : (
                      <span className="px-2 py-1 rounded bg-red-950 text-red-400 border border-red-800 font-bold text-[10px]">
                        REVOKED & PENALIZED
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Member Support Matrix */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">আজকের সাপোর্ট এক্টিভিটি ট্র্যাকার</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {members.filter(m => m.status === 'ACTIVE').map((m) => {
                  const ad = allDoneRecords.find(a => a.member_id === m.id);
                  return (
                    <div key={m.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-white">{m.name} ({m.member_number})</div>
                        <div className="text-[11px] text-slate-400">মোট পয়েন্ট: {m.points} • সাপ্তাহিক: {m.weekly_points}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${ad ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                        {ad ? 'ALL DONE DONE' : 'PENDING'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM SETTINGS PANEL */}
      {activeTab === 'SETTINGS' && <AdminSettingsPanel />}

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
          onRequestSubmitLink={(m) => {
            setIsDetailsOpen(false);
            setSelectedMember(null);
            setSubmitLinkTargetMemberId(m.id);
          }}
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

      <RejectMemberModal
        member={rejectModalMember}
        onClose={() => setRejectModalMember(null)}
        onReject={handleRejectMember}
        onBlacklist={handleBlacklistMember}
        isProcessing={isProcessingAction}
      />

      {/* Admin Inactivity Notice Generator Modal */}
      {isNoticeGeneratorOpen && (
        <AdminNoticeGeneratorModal
          isOpen={isNoticeGeneratorOpen}
          onClose={() => setIsNoticeGeneratorOpen(false)}
        />
      )}

      {/* Admin Festival Theme Manager Modal */}
      {isThemeModalOpen && (
        <FestivalThemeManagerModal
          isOpen={isThemeModalOpen}
          onClose={() => setIsThemeModalOpen(false)}
        />
      )}

      {/* Admin On-Behalf Link Submission Modal */}
      {submitLinkTargetMemberId !== null && (
        <LinkSubmissionModal
          isOpen={submitLinkTargetMemberId !== null}
          onClose={() => setSubmitLinkTargetMemberId(null)}
          defaultTargetMemberId={submitLinkTargetMemberId || undefined}
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

