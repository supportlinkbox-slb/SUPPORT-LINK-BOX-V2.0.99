import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  MemberProfile,
  DailyLink,
  ScheduledLink,
  SupportRecord,
  AllDoneRecord,
  PointTransaction,
  LinkReport,
  NoticeItem,
  PunishmentRecord,
  AuditLog,
  SystemConfig,
  UserRole,
  MemberStatus,
  PostType,
  LinkCategory,
} from '../types';
import {
  DEFAULT_SYSTEM_CONFIG,
  SEED_MEMBERS,
  SEED_DAILY_LINKS,
  SEED_NOTICES,
} from '../data/seedData';
import {
  getBangladeshDateString,
  isWithinSubmissionWindow,
  isWithinAllDoneWindow,
  canEditSubmission,
  getBangladeshNow,
  getBangladeshTomorrowDateString,
  canScheduleForTomorrow,
} from '../utils/bangladeshTime';
import {
  isSupabaseConfigured,
  supabase,
  authApi,
  membersApi,
  dailyLinksApi,
  scheduledLinksApi,
  supportApi,
  allDoneApi,
  configApi,
  pointsApi,
  allDoneAdminApi,
  reportsApi,
  formatSupabaseError,
} from '../lib/supabase';
import { openFacebookPostExternally, isValidFacebookUrl } from '../utils/facebookLinks';
import { getBengaliSupportErrorMessage } from '../utils/bengaliErrors';

interface AppContextType {
  // Config & Status
  isConfigured: boolean;
  systemConfig: SystemConfig;
  todayDate: string;
  submissionStatus: { isOpen: boolean; message: string };
  allDoneStatus: { isOpen: boolean; isLate: boolean; message: string };

  // Auth & Profile
  currentUser: MemberProfile | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authReady: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    pass: string;
    name: string;
    facebookUrl: string;
    profilePhotoUrl?: string;
    facebookIdentityKey?: string;
    facebookIdentityType?: 'numeric_id' | 'username';
  }) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    needsEmailConfirmation?: boolean;
  }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Daily Links
  dailyLinks: DailyLink[];
  submitDailyLink: (linkData: {
    post_type: 'Photo' | 'Video';
    caption: string;
    instruction: string;
    fb_link: string;
    category?: 'NORMAL' | 'VIP' | 'ADMIN' | 'NOTICE';
    target_member_id?: string;
  }) => Promise<{ success: boolean; error?: string; link?: DailyLink }>;
  editDailyLink: (
    linkId: string,
    data: Partial<DailyLink>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteDailyLink: (linkId: string) => Promise<{ success: boolean; error?: string }>;

  // Scheduled Links (Chapter 07)
  scheduledLinks: ScheduledLink[];
  createScheduledLink: (params: {
    target_date: string;
    post_type: PostType;
    caption: string;
    instruction: string;
    fb_link: string;
    category?: LinkCategory;
    target_member_id?: string;
  }) => Promise<{ success: boolean; error?: string; schedule?: ScheduledLink }>;
  editScheduledLink: (
    scheduleId: string,
    data: {
      post_type: PostType;
      caption: string;
      instruction: string;
      fb_link: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  cancelScheduledLink: (
    scheduleId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  executeDueScheduledLinks: () => Promise<{ success: boolean; executedCount?: number; error?: string }>;

  // Support Session & Facebook Workflow
  supportedLinkIds: Set<string>;
  supportLink: (link: DailyLink) => Promise<{ success: boolean; error?: string }>;
  isLinkSupported: (linkId: string) => boolean;
  canSupportLink: (link: DailyLink) => boolean;
  currentSupportLinkIndex: number;
  setCurrentSupportLinkIndex: (index: number) => void;
  pendingRequiredSupportCount: number;

  // All Done
  allDoneRecords: AllDoneRecord[];
  isAllDoneSubmittedToday: boolean;
  userAllDoneRecord: AllDoneRecord | null;
  submitAllDone: (alternativeDetails?: {
    account_name: string;
    account_link?: string;
    note?: string;
  }) => Promise<{ success: boolean; error?: string; rank?: number | null; points?: number }>;

  // Point Ledger & History
  pointLedger: PointTransaction[];

  // Reports
  reports: LinkReport[];
  submitReport: (report: {
    link_id: string;
    category: any;
    description: string;
    screenshot_url?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateReportStatus: (reportId: string, status: any) => void;
  sendReportMessage: (reportId: string, message: string) => void;
  createReportReply: (reportId: string, message: string) => Promise<{ success: boolean; error?: string }>;

  // Audit Logs
  auditLogs: AuditLog[];
  refreshData: () => Promise<void>;

  // Notices
  notices: NoticeItem[];
  addNotice: (notice: Omit<NoticeItem, 'id' | 'created_at'>) => void;
  deleteNotice: (noticeId: string) => void;

  // Punishments & Recovery
  punishments: PunishmentRecord[];
  activePenalty: PunishmentRecord | null;
  verifyFakeAllDone: (
    allDoneRecordId: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  resolvePunishment: (punishmentId: string) => void;

  // Members Management
  members: MemberProfile[];
  updateMemberRole: (
    targetId: string,
    newRole: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  updateMemberStatus: (
    targetId: string,
    newStatus: MemberStatus,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  approveMember: (targetId: string) => Promise<{ success: boolean; error?: string }>;
  rejectMember: (targetId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  adminRestoreMember: (targetId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberProfile: (
    targetId: string,
    profile: {
      name?: string;
      facebook_name?: string;
      facebook_url?: string;
      profile_photo_url?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  
  // Chapter 11 Points & Leaderboard
  getDailyLeaderboard: (date: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getMemberPointHistory: (memberId: string) => Promise<{ success: boolean; data?: PointTransaction[]; error?: string }>;

  // Chapter 13 Fake All Done
  pendingReviews: any[];
  getPendingReviews: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  confirmFakeAllDone: (incidentId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  addAuditLog: (
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const todayDate = getBangladeshDateString();

  // Core State
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [members, setMembers] = useState<MemberProfile[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('slb_members');
    return saved ? JSON.parse(saved) : SEED_MEMBERS;
  });

  const [currentUser, setCurrentUser] = useState<MemberProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [dailyLinks, setDailyLinks] = useState<DailyLink[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('slb_daily_links');
    return saved ? JSON.parse(saved) : SEED_DAILY_LINKS;
  });

  const [supportedLinkIds, setSupportedLinkIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`slb_supported_${todayDate}_${currentUser?.id || 'guest'}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [allDoneRecords, setAllDoneRecords] = useState<AllDoneRecord[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('slb_all_done_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [pointLedger, setPointLedger] = useState<PointTransaction[]>(() => {
    const saved = localStorage.getItem('slb_point_ledger');
    return saved ? JSON.parse(saved) : [];
  });

  const [reports, setReports] = useState<LinkReport[]>(() => {
    const saved = localStorage.getItem('slb_reports');
    return saved ? JSON.parse(saved) : [];
  });

  const [scheduledLinks, setScheduledLinks] = useState<ScheduledLink[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('slb_scheduled_links');
    return saved ? JSON.parse(saved) : [];
  });

  const [notices, setNotices] = useState<NoticeItem[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('slb_notices');
    return saved ? JSON.parse(saved) : SEED_NOTICES;
  });

  const [punishments, setPunishments] = useState<PunishmentRecord[]>(() => {
    const saved = localStorage.getItem('slb_punishments');
    return saved ? JSON.parse(saved) : [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('slb_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  const [currentSupportLinkIndex, setCurrentSupportLinkIndex] = useState<number>(0);

  // Sync to local storage when Supabase is NOT configured (Preview Mode)
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`slb_supported_${todayDate}_${currentUser.id}`);
      setSupportedLinkIds(saved ? new Set(JSON.parse(saved)) : new Set());
    } else {
      setSupportedLinkIds(new Set());
    }
  }, [currentUser, todayDate]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_daily_links', JSON.stringify(dailyLinks));
  }, [dailyLinks]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_all_done_records', JSON.stringify(allDoneRecords));
  }, [allDoneRecords]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_point_ledger', JSON.stringify(pointLedger));
  }, [pointLedger]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_notices', JSON.stringify(notices));
  }, [notices]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_punishments', JSON.stringify(punishments));
  }, [punishments]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('slb_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Supabase Data Hydration
  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      const [linksRes, allDoneRes, noticesRes, auditRes, schedRes, pendingReviewsRes] = await Promise.all([
        dailyLinksApi.getTodayLinks(todayDate),
        allDoneApi.getTodayAllDone(todayDate),
        configApi.getNotices(),
        configApi.getAuditLogs(),
        scheduledLinksApi.getMyScheduledLinks(),
        allDoneAdminApi.getPendingReviews(),
      ]);

      if (linksRes.success && linksRes.data) setDailyLinks(linksRes.data);
      if (allDoneRes.success && allDoneRes.data) setAllDoneRecords(allDoneRes.data);
      if (noticesRes.success && noticesRes.data) setNotices(noticesRes.data);
      if (auditRes.success && auditRes.data) setAuditLogs(auditRes.data);
      if (schedRes.success && schedRes.data) setScheduledLinks(schedRes.data);
      if (pendingReviewsRes.success && pendingReviewsRes.data) setPendingReviews(pendingReviewsRes.data);

      const profRes = await membersApi.getCurrentProfile();
      if (profRes.success && profRes.data) {
        if (profRes.data.status === 'ACTIVE') {
          setCurrentUser(profRes.data);
          const suppRes = await supportApi.getTodaySupportRecords(todayDate, profRes.data.id);
          if (suppRes.success && suppRes.data) {
            setSupportedLinkIds(new Set(suppRes.data.map((r) => r.link_id)));
          }
        } else {
          setCurrentUser(profRes.data); // Kept for status screen gate
        }

        // Section 46: Only load full member directory if user has admin/developer privileges
        if (profRes.data.role === 'ADMIN' || profRes.data.role === 'DEVELOPER') {
          const membersRes = await membersApi.getAllMembers();
          if (membersRes.success && membersRes.data) setMembers(membersRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to refresh data from Supabase:', err);
    }
  }, [todayDate]);

  // Supabase Auth and Realtime Subscription Setup (Chapter 03)
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      setAuthReady(true);
      return;
    }

    async function initSession() {
      try {
        setAuthLoading(true);
        const session = await authApi.getSession();
        if (session?.user && isMounted) {
          const profRes = await membersApi.getCurrentProfile();
          if (profRes.success && profRes.data && isMounted) {
            setCurrentUser(profRes.data);
            if (profRes.data.status === 'ACTIVE') {
              const suppRes = await supportApi.getTodaySupportRecords(todayDate, profRes.data.id);
              if (suppRes.success && suppRes.data && isMounted) {
                setSupportedLinkIds(new Set(suppRes.data.map((r) => r.link_id)));
              }
            }
          } else if (isMounted) {
            setCurrentUser(null);
          }
        } else if (isMounted) {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
          setAuthReady(true);
        }
      }
    }

    initSession();
    refreshData();

    // Supabase Auth State Change Listener (Multi-tab synchronization & token refresh)
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setSupportedLinkIds(new Set());
      } else if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        if (session?.user) {
          const profRes = await membersApi.getCurrentProfile();
          if (profRes.success && profRes.data && isMounted) {
            setCurrentUser(profRes.data);
            if (profRes.data.status === 'ACTIVE') {
              const suppRes = await supportApi.getTodaySupportRecords(todayDate, profRes.data.id);
              if (suppRes.success && suppRes.data && isMounted) {
                setSupportedLinkIds(new Set(suppRes.data.map((r) => r.link_id)));
              }
            }
          }
        }
      }
    });

    // Supabase Realtime Channel
    const channel = supabase
      .channel('slb-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_links' },
        () => {
          dailyLinksApi.getTodayLinks(todayDate).then((res) => {
            if (res.success && res.data) setDailyLinks(res.data);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'all_done' },
        () => {
          allDoneApi.getTodayAllDone(todayDate).then((res) => {
            if (res.success && res.data) setAllDoneRecords(res.data);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => {
          membersApi.getAllMembers().then((res) => {
            if (res.success && res.data) setMembers(res.data);
          });
          membersApi.getCurrentProfile().then((res) => {
            if (res.success && res.data) setCurrentUser(res.data);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices' },
        () => {
          configApi.getNotices().then((res) => {
            if (res.success && res.data) setNotices(res.data);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_links' },
        () => {
          scheduledLinksApi.getMyScheduledLinks().then((res) => {
            if (res.success && res.data) setScheduledLinks(res.data);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_records' },
        () => {
          if (currentUser) {
            supportApi.getTodaySupportRecords(todayDate, currentUser.id).then((res) => {
              if (res.success && res.data) {
                setSupportedLinkIds(new Set(res.data.map((r) => r.link_id)));
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [todayDate, refreshData]);

  // Window status checks
  const submissionStatus = isWithinSubmissionWindow(
    systemConfig.submission_start_time,
    systemConfig.submission_end_time
  );

  const allDoneStatus = isWithinAllDoneWindow(
    systemConfig.all_done_start_time,
    systemConfig.all_done_deadline_time
  );

  // Helper: Log audit
  const addAuditLog = (action: string, targetType: string, targetId: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: `audit-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.name,
      actor_role: currentUser.role,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Auth Methods (Chapter 03)
  const login = async (email: string, pass: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured) {
      const res = await authApi.signIn(trimmedEmail, pass);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      const prof = await membersApi.getCurrentProfile();

      if (!prof.success || !prof.data) {
        await authApi.signOut();
        return {
          success: false,
          error:
            'আপনার Authentication Account পাওয়া গেছে, কিন্তু Database-এ Member Profile নিবন্ধিত নেই। Admin-এর সাথে যোগাযোগ করুন।',
        };
      }

      // Chapter 03 Section 2 & 4: Login Status Rules
      if (prof.data.status === 'PENDING') {
        await authApi.signOut();
        return {
          success: false,
          error:
            'আপনার Registration সফলভাবে সম্পন্ন হয়েছে। বর্তমানে আপনার Account Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
        };
      }
      if (prof.data.status === 'REJECTED') {
        await authApi.signOut();
        return {
          success: false,
          error: 'আপনার রেজিস্ট্রেশন আবেদন অনুমোদিত হয়নি। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।',
        };
      }
      if (prof.data.status === 'SUSPENDED' || prof.data.status === 'FROZEN') {
        await authApi.signOut();
        return {
          success: false,
          error: 'আপনার অ্যাকাউন্ট বর্তমানে স্থগিত রয়েছে। বিস্তারিত জানতে কর্তৃপক্ষের সাথে যোগাযোগ করুন।',
        };
      }
      if (prof.data.status === 'INACTIVE' || prof.data.status === 'REMOVED') {
        await authApi.signOut();
        return {
          success: false,
          error: 'আপনার অ্যাকাউন্ট বর্তমানে নিষ্ক্রিয় করা হয়েছে।',
        };
      }

      setCurrentUser(prof.data);
      await refreshData();
      return { success: true };
    }

    // Live Preview fallback mode
    const found = members.find((m) => m.email.toLowerCase() === trimmedEmail);
    if (!found) {
      return { success: false, error: 'কোন ইউজার খুঁজে পাওয়া যায়নি। ইমেইল চেক করুন।' };
    }
    if (found.status === 'PENDING') {
      return {
        success: false,
        error:
          'আপনার Registration সফলভাবে সম্পন্ন হয়েছে। বর্তমানে আপনার Account Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
      };
    }
    if (found.status === 'REJECTED') {
      return {
        success: false,
        error: 'আপনার রেজিস্ট্রেশন আবেদন অনুমোদিত হয়নি।',
      };
    }
    if (found.status === 'SUSPENDED' || found.status === 'FROZEN') {
      return {
        success: false,
        error: 'আপনার অ্যাকাউন্ট বর্তমানে স্থগিত রয়েছে।',
      };
    }
    if (found.status === 'INACTIVE' || found.status === 'REMOVED') {
      return {
        success: false,
        error: 'আপনার অ্যাকাউন্ট বর্তমানে নিষ্ক্রিয় করা হয়েছে।',
      };
    }
    setCurrentUser(found);
    return { success: true };
  };

    const register = async (data: {
    email: string;
    pass: string;
    name: string;
    facebookUrl: string;
    profilePhotoUrl?: string;
    facebookIdentityKey?: string;
    facebookIdentityType?: 'numeric_id' | 'username';
    tokenHash?: string;
  }) => {
    if (isSupabaseConfigured) {
      const res = await authApi.signUp({
        email: data.email,
        password: data.pass,
        name: data.name,
        facebookUrl: data.facebookUrl,
        profilePhotoUrl: data.profilePhotoUrl,
        facebookIdentityKey: data.facebookIdentityKey,
        facebookIdentityType: data.facebookIdentityType,
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
      
      if (res.data?.session && data.tokenHash) {
         // User just signed up and has a session. Consume the invite token before signing out.
         const consumeRes = await supabase.rpc('consume_invite_token_tx', { p_token_hash: data.tokenHash });
         if (consumeRes.error || !consumeRes.data?.success) {
            console.error('Invite consume error:', consumeRes.error || consumeRes.data?.reason);
         }
      }


            // No Auto Login - enforce signout
      if (res.data?.session) {
        await authApi.signOut();
      }

      if (res.data?.needsEmailConfirmation) {
        return {
          success: true,
          needsEmailConfirmation: true,
          message:
            'আপনার Email-এ Confirmation link পাঠানো হয়েছে। অনুগ্রহ করে Email চেক করে অ্যাকাউন্ট নিশ্চিত করুন।',
        };
      }

      // Enforce Chapter 03 Section 21: Auto-login after registration is strictly forbidden!
      if (res.data?.session) {
        await authApi.signOut();
        return {
          success: true,
          message:
            'Registration সফল হয়েছে। আপনার Account এখন Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
        };
      }

      await refreshData();
      return {
        success: true,
        message:
          'Registration সফল হয়েছে। আপনার Account এখন Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
      };
    }

    // Live Preview fallback mode
    const existing = members.find(
      (m) => m.email.toLowerCase() === data.email.toLowerCase()
    );
    if (existing) {
      return { success: false, error: 'এই Email দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে।' };
    }

    const newNumber = `SLB-${100 + members.length + 1}`;
    const newProfile: MemberProfile = {
      id: `user-${Date.now()}`,
      member_number: newNumber,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'MEMBER',
      status: 'PENDING',
      facebook_url: data.facebookUrl.trim(),
      facebook_profile_url: data.facebookUrl.trim(),
      facebook_identity_key: data.facebookIdentityKey,
      facebook_identity_type: data.facebookIdentityType,
      profile_photo_url:
        data.profilePhotoUrl ||
        `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      points: 0,
      weekly_points: 0,
      total_links_submitted: 0,
      total_supports_given: 0,
      total_all_done: 0,
      community: 'Support Link Box Official',
      joined_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      is_verified: false,
    };

    setMembers((prev) => [...prev, newProfile]);

    return {
      success: true,
      message:
        'Registration সফল হয়েছে। আপনার Account এখন Admin Approval-এর অপেক্ষায় আছে। Admin Approval না পাওয়া পর্যন্ত আপনি System-এ Login করতে পারবেন না।',
    };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await authApi.signOut();
    }
    setCurrentUser(null);
    setSupportedLinkIds(new Set());
  };

  const resetPassword = async (email: string) => {
    return await authApi.resetPasswordForEmail(email);
  };

  const updatePassword = async (newPassword: string) => {
    return await authApi.updatePassword(newPassword);
  };

  // Daily Links Methods
  const submitDailyLink = async (linkData: {
    post_type: 'Photo' | 'Video';
    caption: string;
    instruction: string;
    fb_link: string;
    category?: 'NORMAL' | 'VIP' | 'ADMIN' | 'NOTICE';
    target_member_id?: string;
  }): Promise<{ success: boolean; error?: string; link?: DailyLink }> => {
    if (!currentUser) return { success: false, error: 'অনুগ্রহ করে প্রথমে লগইন করুন।' };

    if (currentUser.status === 'SUSPENDED' || currentUser.status === 'FROZEN' || currentUser.status === 'REMOVED') {
      return { success: false, error: `আপনার অ্যাকাউন্ট বর্তমানে ${currentUser.status} থাকায় লিংক জমা দেওয়া সম্ভব নয়।` };
    }

    const isAdminOrDev = currentUser.role === 'ADMIN' || currentUser.role === 'DEVELOPER';

    // Verify Facebook URL
    if (!isValidFacebookUrl(linkData.fb_link)) {
      return { success: false, error: 'সঠিক ফেসবুক পোস্ট লিংক দিন (যেমন: https://www.facebook.com/...)' };
    }

    // Determine category authorization
    let requestedCategory = linkData.category || 'NORMAL';
    if (!isAdminOrDev && requestedCategory !== 'NORMAL') {
      requestedCategory = 'NORMAL';
    }

    // Determine owner vs admin submission
    let owner = currentUser;
    let submittedByAdminId: string | undefined = undefined;

    if (linkData.target_member_id && linkData.target_member_id !== currentUser.id) {
      if (!isAdminOrDev) {
        return { success: false, error: 'সদস্যের পক্ষে লিংক জমা দেওয়ার অনুমতি শুধুমাত্র এডমিনের রয়েছে।' };
      }
      const target = members.find((m) => m.id === linkData.target_member_id);
      if (!target) {
        return { success: false, error: 'নির্দিষ্ট সদস্যকে খুঁজে পাওয়া যায়নি।' };
      }
      if (target.status === 'SUSPENDED' || target.status === 'REMOVED') {
        return { success: false, error: `উক্ত সদস্যের অ্যাকাউন্ট বর্তমানে ${target.status} থাকায় লিংক জমা দেওয়া যাবে না।` };
      }
      owner = target;
      submittedByAdminId = currentUser.id;
    }

    // Submission Window check:
    // Normal member submitting NORMAL category must be within 10:00 to 16:50 BDT window
    const isSpecialCategory = requestedCategory === 'VIP' || requestedCategory === 'ADMIN' || requestedCategory === 'NOTICE';
    const isExemptFromWindow = isAdminOrDev || isSpecialCategory;

    if (!isExemptFromWindow) {
      const now = getBangladeshNow();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = (systemConfig.submission_start_time || '10:00').split(':').map(Number);
      const [endH, endM] = (systemConfig.submission_end_time || '16:50').split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutes < startMinutes) {
        return { success: false, error: 'লিংক জমা দেওয়ার সময় এখনো শুরু হয়নি।' };
      }
      if (currentMinutes > endMinutes) {
        return { success: false, error: 'আজকের লিংক জমা দেওয়ার সময় শেষ হয়েছে।' };
      }
    }

    // Supabase RPC submission
    if (isSupabaseConfigured) {
      const res = await dailyLinksApi.submitDailyLink({
        post_type: linkData.post_type,
        caption: linkData.caption.trim() || 'No caption provided',
        instruction: linkData.instruction.trim() || 'Like and Comment',
        fb_link: linkData.fb_link.trim(),
        category: requestedCategory,
        target_member_id: submittedByAdminId ? owner.id : undefined,
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshData();
      return { success: true, link: res.data?.link };
    }

    // Live Preview fallback mode
    if (requestedCategory === 'NORMAL') {
      const alreadySubmitted = dailyLinks.some(
        (l) => l.date === todayDate && l.owner_id === owner.id && l.category === 'NORMAL'
      );
      if (alreadySubmitted) {
        return {
          success: false,
          error: submittedByAdminId
            ? 'এই সদস্যের আজকের জন্য একটি লিংক ইতোমধ্যে জমা দেওয়া হয়েছে।'
            : 'আজকের জন্য আপনার একটি লিংক ইতোমধ্যে জমা দেওয়া হয়েছে।',
        };
      }
    }

    const todaysLinks = dailyLinks.filter((l) => l.date === todayDate);
    const nextSerial = todaysLinks.length + 1;
    const serialDisplay = String(nextSerial).padStart(2, '0');
    const partNumber = Math.ceil(nextSerial / 20);
    const nowIso = new Date().toISOString();
    const canEditUntilIso = new Date(Date.now() + 120000).toISOString();

    const newLink: DailyLink = {
      id: `link-${Date.now()}`,
      serial_number: nextSerial,
      link_number: nextSerial,
      serial_display: serialDisplay,
      part_number: partNumber,
      owner_id: owner.id,
      owner_name: owner.name,
      owner_member_number: owner.member_number,
      owner_photo_url: owner.profile_photo_url,
      owner_facebook_url: owner.facebook_url,
      submitted_by_admin_id: submittedByAdminId,
      date: todayDate,
      post_type: linkData.post_type,
      category: requestedCategory,
      caption: linkData.caption.trim() || 'No caption provided',
      instruction: linkData.instruction.trim() || 'Like and Comment',
      fb_link: linkData.fb_link.trim(),
      submitted_at: nowIso,
      can_edit_until: canEditUntilIso,
      editable_until: canEditUntilIso,
      is_approved: true,
      total_supports_count: 0,
    };

    setDailyLinks((prev) => [...prev, newLink]);

    // Points for owner
    const pointTx: PointTransaction = {
      id: `pt-${Date.now()}-link`,
      member_id: owner.id,
      activity_type: 'DAILY_LINK_SUBMIT',
      points: 5,
      date: todayDate,
      reference_id: newLink.id,
      description: `Daily Link Submission #${serialDisplay}`,
      created_at: nowIso,
    };
    const onTimeTx: PointTransaction = {
      id: `pt-${Date.now()}-ontime`,
      member_id: owner.id,
      activity_type: 'ON_TIME_SUBMISSION',
      points: 2,
      date: todayDate,
      reference_id: newLink.id,
      description: 'On-time link submission bonus',
      created_at: nowIso,
    };
    setPointLedger((prev) => [onTimeTx, pointTx, ...prev]);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === owner.id
          ? {
              ...m,
              points: m.points + 7,
              weekly_points: m.weekly_points + 7,
              total_links_submitted: m.total_links_submitted + 1,
            }
          : m
      )
    );

    if (currentUser.id === owner.id) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              points: prev.points + 7,
              weekly_points: prev.weekly_points + 7,
              total_links_submitted: prev.total_links_submitted + 1,
            }
          : null
      );
    }

    if (submittedByAdminId) {
      addAuditLog(
        'DAILY_LINK_SUBMITTED_BY_ADMIN',
        'DAILY_LINK',
        newLink.id,
        `Admin ${currentUser.name} submitted link #${serialDisplay} for ${owner.name} (${owner.member_number})`
      );
    } else {
      addAuditLog(
        'DAILY_LINK_SUBMITTED',
        'DAILY_LINK',
        newLink.id,
        `Submitted link #${serialDisplay} (${requestedCategory})`
      );
    }

    return { success: true, link: newLink };
  };

  const editDailyLink = async (linkId: string, data: Partial<DailyLink>) => {
    const link = dailyLinks.find((l) => l.id === linkId);
    if (!link) return { success: false, error: 'Link not found' };
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';
    if (!isAdmin && !canEditSubmission(link.can_edit_until)) {
      return { success: false, error: '২ মিনিটের এডিট উইন্ডো শেষ হয়ে গেছে।' };
    }

    if (isSupabaseConfigured) {
      const res = await dailyLinksApi.editLinkSecure({
        link_id: linkId,
        post_type: data.post_type || link.post_type,
        caption: data.caption || link.caption,
        instruction: data.instruction || link.instruction,
        fb_link: data.fb_link || link.fb_link,
      });
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }

    setDailyLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, ...data } : l)));
    addAuditLog('EDIT_LINK', 'DAILY_LINK', linkId, `Edited link #${link.serial_display}`);
    return { success: true };
  };

  const deleteDailyLink = async (linkId: string) => {
    const link = dailyLinks.find((l) => l.id === linkId);
    if (!link) return { success: false, error: 'Link not found' };
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';
    if (!isAdmin && !canEditSubmission(link.can_edit_until)) {
      return { success: false, error: '২ মিনিটের ডিলিট উইন্ডো শেষ হয়ে গেছে।' };
    }

    if (isSupabaseConfigured) {
      const res = await dailyLinksApi.removeLinkSecure({
        link_id: linkId,
        reason: 'ব্যবহারকারীর অনুরোধে অপসারিত',
      });
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }

    // Retain serial number continuity by marking status as removed
    setDailyLinks((prev) =>
      prev.map((l) =>
        l.id === linkId
          ? {
              ...l,
              status: 'removed',
              removed_at: new Date().toISOString(),
              removed_by_id: currentUser?.id,
              removed_reason: 'Removed by user',
            }
          : l
      )
    );
    addAuditLog('DELETE_LINK', 'DAILY_LINK', linkId, `Removed link #${link.serial_display}`);
    return { success: true };
  };

  // Scheduled Links Implementations (Chapter 07)
  const createScheduledLink = async (params: {
    target_date: string;
    post_type: PostType;
    caption: string;
    instruction: string;
    fb_link: string;
    category?: LinkCategory;
    target_member_id?: string;
  }) => {
    if (!currentUser) return { success: false, error: 'লগইন আবশ্যক।' };

    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEVELOPER';
    const tomorrowDate = getBangladeshTomorrowDateString();

    // Client-side guard for 1-day early rule (Admins exempt)
    if (params.target_date === tomorrowDate && !isAdmin) {
      const scheduleRule = canScheduleForTomorrow();
      if (!scheduleRule.isAllowed) {
        return { success: false, error: scheduleRule.message };
      }
    }

    if (isSupabaseConfigured) {
      const res = await scheduledLinksApi.createScheduledLinkSecure({
        target_date: params.target_date,
        post_type: params.post_type,
        caption: params.caption,
        instruction: params.instruction,
        fb_link: params.fb_link,
        category: params.category || 'NORMAL',
        target_member_id: params.target_member_id,
      });

      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }

    // Local state fallback
    const targetOwner = params.target_member_id
      ? members.find((m) => m.id === params.target_member_id) || currentUser
      : currentUser;

    const existingPending = scheduledLinks.find(
      (s) => s.owner_id === targetOwner.id && s.target_date === params.target_date && s.status === 'pending'
    );
    if (existingPending) {
      return { success: false, error: 'এই দিনের জন্য ইতোমধ্যে একটি লিংক Scheduled আছে।' };
    }

    const newSchedule: ScheduledLink = {
      id: `sched-${Date.now()}`,
      owner_id: targetOwner.id,
      owner_name: targetOwner.name,
      owner_member_number: targetOwner.member_number,
      target_date: params.target_date,
      target_time: '10:00',
      post_type: params.post_type,
      category: params.category || 'NORMAL',
      caption: params.caption.trim() || 'No caption provided',
      instruction: params.instruction.trim() || 'Like and Comment',
      fb_link: params.fb_link.trim(),
      status: 'pending',
      scheduled_by_admin_id: targetOwner.id !== currentUser.id ? currentUser.id : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setScheduledLinks((prev) => [newSchedule, ...prev]);
    addAuditLog(
      'SCHEDULE_CREATED',
      'SCHEDULED_LINK',
      newSchedule.id,
      `Scheduled link for ${params.target_date} (Owner: ${targetOwner.name})`
    );
    return { success: true, schedule: newSchedule };
  };

  const editScheduledLink = async (
    scheduleId: string,
    data: {
      post_type: PostType;
      caption: string;
      instruction: string;
      fb_link: string;
    }
  ) => {
    if (isSupabaseConfigured) {
      const res = await scheduledLinksApi.editScheduledLinkSecure({
        schedule_id: scheduleId,
        ...data,
      });
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }

    setScheduledLinks((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              ...data,
              updated_at: new Date().toISOString(),
            }
          : s
      )
    );
    addAuditLog('SCHEDULE_EDITED', 'SCHEDULED_LINK', scheduleId, 'Updated scheduled link details');
    return { success: true };
  };

  const cancelScheduledLink = async (scheduleId: string, reason?: string) => {
    if (isSupabaseConfigured) {
      const res = await scheduledLinksApi.cancelScheduledLinkSecure({
        schedule_id: scheduleId,
        reason,
      });
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true };
    }

    setScheduledLinks((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              error_message: reason || 'User canceled',
            }
          : s
      )
    );
    addAuditLog('SCHEDULE_CANCELED', 'SCHEDULED_LINK', scheduleId, reason || 'Canceled scheduled link');
    return { success: true };
  };

  const executeDueScheduledLinks = async () => {
    if (isSupabaseConfigured) {
      const res = await scheduledLinksApi.runDueScheduledLinksSecure();
      if (!res.success) return { success: false, error: res.error };
      await refreshData();
      return { success: true, executedCount: res.data?.executed_count || 0 };
    }

    // Local mode execution for due scheduled links
    const dueSchedules = scheduledLinks.filter(
      (s) => s.status === 'pending' && s.target_date <= todayDate
    );

    let executed = 0;
    for (const schedule of dueSchedules) {
      const owner = members.find((m) => m.id === schedule.owner_id);
      if (!owner || owner.status !== 'ACTIVE') {
        setScheduledLinks((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, status: 'skipped', error_message: 'Owner inactive' } : s))
        );
        continue;
      }

      // Check if user already submitted for today
      const alreadyHasLink = dailyLinks.some(
        (l) => l.owner_id === schedule.owner_id && l.date === todayDate && (l.status ?? 'active') === 'active'
      );
      if (alreadyHasLink && schedule.category === 'NORMAL') {
        setScheduledLinks((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, status: 'skipped', error_message: 'Already submitted today' } : s))
        );
        continue;
      }

      const todaysLinks = dailyLinks.filter((l) => l.date === todayDate);
      const nextSerial = todaysLinks.length + 1;
      const serialDisplay = String(nextSerial).padStart(2, '0');
      const partNumber = Math.ceil(nextSerial / 20);
      const nowIso = new Date().toISOString();

      const newLink: DailyLink = {
        id: `link-sched-${Date.now()}-${executed}`,
        serial_number: nextSerial,
        link_number: nextSerial,
        serial_display: serialDisplay,
        part_number: partNumber,
        owner_id: owner.id,
        owner_name: owner.name,
        owner_member_number: owner.member_number,
        owner_photo_url: owner.profile_photo_url,
        owner_facebook_url: owner.facebook_url,
        submitted_by_admin_id: schedule.scheduled_by_admin_id,
        date: todayDate,
        post_type: schedule.post_type,
        category: schedule.category || 'NORMAL',
        caption: schedule.caption,
        instruction: schedule.instruction,
        fb_link: schedule.fb_link,
        submitted_at: nowIso,
        can_edit_until: new Date(Date.now() + 120000).toISOString(),
        editable_until: new Date(Date.now() + 120000).toISOString(),
        is_approved: true,
        total_supports_count: 0,
        status: 'active',
      };

      setDailyLinks((prev) => [...prev, newLink]);
      setScheduledLinks((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? { ...s, status: 'executed', is_published: true, published_link_id: newLink.id, executed_at: nowIso }
            : s
        )
      );

      // Points
      setMembers((prev) =>
        prev.map((m) =>
          m.id === owner.id
            ? {
                ...m,
                points: m.points + 7,
                weekly_points: m.weekly_points + 7,
                total_links_submitted: m.total_links_submitted + 1,
              }
            : m
        )
      );
      executed++;
    }

    return { success: true, executedCount: executed };
  };

  // Support Session & Facebook Workflow (Chapter 08)
  const isLinkSupported = (linkId: string) => supportedLinkIds.has(linkId);

  const canSupportLink = (link: DailyLink) => {
    if (!currentUser) return false;
    if ((link.status ?? 'active') === 'removed') return false;
    return link.owner_id !== currentUser.id;
  };

  const prepareNextPendingLink = (currentLinkId: string) => {
    const activeTodaysLinks = dailyLinks
      .filter((l) => l.date === todayDate && (l.status ?? 'active') === 'active')
      .sort((a, b) => a.serial_number - b.serial_number);
    const currentIndex = activeTodaysLinks.findIndex((l) => l.id === currentLinkId);
    for (let i = currentIndex + 1; i < activeTodaysLinks.length; i++) {
      const candidate = activeTodaysLinks[i];
      if (canSupportLink(candidate) && !supportedLinkIds.has(candidate.id)) {
        setCurrentSupportLinkIndex(i);
        return;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      const candidate = activeTodaysLinks[i];
      if (canSupportLink(candidate) && !supportedLinkIds.has(candidate.id)) {
        setCurrentSupportLinkIndex(i);
        return;
      }
    }
  };

  const supportLink = async (link: DailyLink) => {
    if (!currentUser) return { success: false, error: 'অনুগ্রহ করে লগইন করুন।' };
    if (!canSupportLink(link)) {
      return { success: false, error: 'নিজের লিংকে সাপোর্ট দেওয়া যাবে না।' };
    }

    if (isSupabaseConfigured) {
      const res = await supportApi.recordSupport(link.id);
      if (!res.success) {
        const mappedError = getBengaliSupportErrorMessage(res.error);
        return { success: false, error: mappedError };
      }

      // Handle recorded or already supported safely (Idempotency)
      const updatedSupported = new Set(supportedLinkIds);
      updatedSupported.add(link.id);
      setSupportedLinkIds(updatedSupported);
      prepareNextPendingLink(link.id);
      await refreshData();
      return { success: true };
    }

    // Live Preview fallback mode
    if (supportedLinkIds.has(link.id)) {
      prepareNextPendingLink(link.id);
      return { success: true };
    }

    const updatedSupported = new Set(supportedLinkIds);
    updatedSupported.add(link.id);
    setSupportedLinkIds(updatedSupported);
    localStorage.setItem(
      `slb_supported_${todayDate}_${currentUser.id}`,
      JSON.stringify(Array.from(updatedSupported))
    );

    const pointTx: PointTransaction = {
      id: `pt-${Date.now()}-supp`,
      member_id: currentUser.id,
      activity_type: 'SUPPORT_COMPLETE',
      points: 1,
      date: todayDate,
      reference_id: link.id,
      description: `Supported link #${link.serial_display}`,
      created_at: new Date().toISOString(),
    };
    setPointLedger((prev) => [pointTx, ...prev]);

    setDailyLinks((prev) =>
      prev.map((l) =>
        l.id === link.id ? { ...l, total_supports_count: l.total_supports_count + 1 } : l
      )
    );

    setMembers((prev) =>
      prev.map((m) =>
        m.id === currentUser.id
          ? {
              ...m,
              points: m.points + 1,
              weekly_points: m.weekly_points + 1,
              total_supports_given: m.total_supports_given + 1,
            }
          : m
      )
    );

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            points: prev.points + 1,
            weekly_points: prev.weekly_points + 1,
            total_supports_given: prev.total_supports_given + 1,
          }
        : null
    );

    prepareNextPendingLink(link.id);
    return { success: true };
  };

  const requiredSupportLinks = dailyLinks.filter(
    (l) => l.date === todayDate && (l.status ?? 'active') === 'active' && l.owner_id !== currentUser?.id
  );
  const completedSupportCount = requiredSupportLinks.filter((l) =>
    supportedLinkIds.has(l.id)
  ).length;
  const pendingRequiredSupportCount = Math.max(
    0,
    requiredSupportLinks.length - completedSupportCount
  );

  // All Done Verification
  const userAllDoneRecord =
    allDoneRecords.find((r) => r.date === todayDate && r.member_id === currentUser?.id) || null;
  const isAllDoneSubmittedToday = Boolean(userAllDoneRecord);

  const submitAllDone = async (alternativeDetails?: {
    account_name: string;
    account_link?: string;
    note?: string;
  }) => {
    if (!currentUser) return { success: false, error: 'অনুগ্রহ করে প্রথমে লগইন করুন।' };

    if (isAllDoneSubmittedToday) {
      return { success: false, error: 'আপনি ইতিমধ্যে আজকের All Done সম্পন্ন করেছেন।' };
    }

    if (pendingRequiredSupportCount > 0) {
      return {
        success: false,
        error: `All Done সম্ভব নয়! আপনার এখনও ${pendingRequiredSupportCount} টি লিংকে সাপোর্ট দেওয়া বাকি আছে।`,
      };
    }

    if (isSupabaseConfigured) {
      const res = await allDoneApi.submitAllDone({
        alternative_id_used: Boolean(alternativeDetails?.account_name),
        alternative_id_details: alternativeDetails,
      });
      if (!res.success) {
        // Map server error codes to Bengali
        const mappedError = getBengaliSupportErrorMessage(res.error);
        return { success: false, error: mappedError };
      }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      await refreshData();
      return {
        success: true,
        rank: res.data?.fastest_rank,
        points: res.data?.total_points,
      };
    }

    // Live Preview fallback mode
    const todaysAllDone = allDoneRecords.filter((r) => r.date === todayDate);
    const position = todaysAllDone.length + 1;

    let rank: number | null = null;
    let bonusPoints = 0;
    if (position === 1) {
      rank = 1;
      bonusPoints = 10;
    } else if (position === 2) {
      rank = 2;
      bonusPoints = 8;
    } else if (position === 3) {
      rank = 3;
      bonusPoints = 6;
    } else if (position === 4) {
      rank = 4;
      bonusPoints = 4;
    } else if (position === 5) {
      rank = 5;
      bonusPoints = 2;
    }

    const basePoints = systemConfig.base_all_done_points;
    const totalAward = basePoints + bonusPoints;

    const newRecord: AllDoneRecord = {
      id: `alldone-${Date.now()}`,
      date: todayDate,
      member_id: currentUser.id,
      member_name: currentUser.name,
      member_number: currentUser.member_number,
      member_photo_url: currentUser.profile_photo_url,
      completed_at: new Date().toISOString(),
      fastest_rank: rank,
      base_points: basePoints,
      bonus_points: bonusPoints,
      total_points: totalAward,
      status: 'VERIFIED',
      alternative_id_used: Boolean(alternativeDetails?.account_name),
      alternative_id_details: alternativeDetails,
    };

    setAllDoneRecords((prev) => [...prev, newRecord]);

    const pointTxBase: PointTransaction = {
      id: `pt-${Date.now()}-ad`,
      member_id: currentUser.id,
      activity_type: 'ALL_DONE',
      points: basePoints,
      date: todayDate,
      reference_id: newRecord.id,
      description: 'Daily All Done completed',
      created_at: new Date().toISOString(),
    };

    const newPointTxs: PointTransaction[] = [pointTxBase];

    if (bonusPoints > 0) {
      newPointTxs.push({
        id: `pt-${Date.now()}-bonus`,
        member_id: currentUser.id,
        activity_type: 'FASTEST_ALL_DONE',
        points: bonusPoints,
        date: todayDate,
        reference_id: newRecord.id,
        description: `Fastest All Done bonus (Rank #${rank})`,
        created_at: new Date().toISOString(),
      });
    }

    setPointLedger((prev) => [...newPointTxs, ...prev]);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === currentUser.id
          ? {
              ...m,
              points: m.points + totalAward,
              weekly_points: m.weekly_points + totalAward,
              total_all_done: m.total_all_done + 1,
            }
          : m
      )
    );

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            points: prev.points + totalAward,
            weekly_points: prev.weekly_points + totalAward,
            total_all_done: prev.total_all_done + 1,
          }
        : null
    );

    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    addAuditLog('ALL_DONE', 'ALL_DONE_RECORD', newRecord.id, `Submitted All Done with rank: ${rank || 'None'}`);
    return { success: true, rank, points: totalAward };
  };

  // Reports
  const submitReport = async (reportData: {
    link_id: string;
    category: any;
    description: string;
    screenshot_url?: string;
  }) => {
    const res = await reportsApi.createReport(
      reportData.link_id,
      reportData.category,
      reportData.description,
      reportData.screenshot_url
    );
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const createReportReply = async (reportId: string, message: string) => {
    const res = await reportsApi.createReply(reportId, message);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const updateReportStatus = (reportId: string, status: any) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status, updated_at: new Date().toISOString() } : r))
    );
  };

  const sendReportMessage = (reportId: string, message: string) => {
    if (!currentUser) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      report_id: reportId,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_role: currentUser.role,
      message,
      created_at: new Date().toISOString(),
    };
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              messages: [...(r.messages || []), newMsg],
              updated_at: new Date().toISOString(),
            }
          : r
      )
    );
  };

  // Notices
  const addNotice = async (noticeData: Omit<NoticeItem, 'id' | 'created_at'>) => {
    if (isSupabaseConfigured) {
      await supabase.from('notices').insert({
        title: noticeData.title,
        content: noticeData.content,
        type: noticeData.type,
        created_by_name: noticeData.created_by_name,
        target_role: noticeData.target_role,
        days_inactive_filter: noticeData.days_inactive_filter,
        is_pinned: noticeData.is_pinned,
      });
      await refreshData();
      return;
    }

    const newNotice: NoticeItem = {
      ...noticeData,
      id: `notice-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setNotices((prev) => [newNotice, ...prev]);
    addAuditLog('CREATE_NOTICE', 'NOTICE', newNotice.id, `Created notice: ${newNotice.title}`);
  };

  const deleteNotice = async (noticeId: string) => {
    if (isSupabaseConfigured) {
      await supabase.from('notices').delete().eq('id', noticeId);
      await refreshData();
      return;
    }

    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    addAuditLog('DELETE_NOTICE', 'NOTICE', noticeId, 'Deleted notice');
  };

  // Fake All Done & Penalty Verification (Admin)
  const verifyFakeAllDone = async (allDoneRecordId: string, reason: string) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'এডমিন অনুমতি প্রয়োজন।' };
    }

    const targetRecord = allDoneRecords.find((r) => r.id === allDoneRecordId);
    if (!targetRecord) return { success: false, error: 'All done record not found' };

    setAllDoneRecords((prev) =>
      prev.map((r) => (r.id === allDoneRecordId ? { ...r, status: 'REVOKED' } : r))
    );

    const penaltyPoints = targetRecord.total_points;
    const reversalTx: PointTransaction = {
      id: `pt-${Date.now()}-rev`,
      member_id: targetRecord.member_id,
      activity_type: 'PENALTY_REVERSAL',
      points: -penaltyPoints,
      date: todayDate,
      reference_id: allDoneRecordId,
      description: `Revoked Fake All Done: -${penaltyPoints} points`,
      created_at: new Date().toISOString(),
      created_by: currentUser.id,
    };
    setPointLedger((prev) => [reversalTx, ...prev]);

    const punishment: PunishmentRecord = {
      id: `punish-${Date.now()}`,
      member_id: targetRecord.member_id,
      member_name: targetRecord.member_name,
      member_number: targetRecord.member_number,
      punishment_type: 'FAKE_ALL_DONE',
      reason,
      detected_date: todayDate,
      detected_by_admin: currentUser.name,
      original_all_done_id: allDoneRecordId,
      missing_support_count: 5,
      extra_free_support_days: 1,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    setPunishments((prev) => [punishment, ...prev]);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === targetRecord.member_id
          ? {
              ...m,
              points: Math.max(0, m.points - penaltyPoints),
              weekly_points: Math.max(0, m.weekly_points - penaltyPoints),
            }
          : m
      )
    );

    addAuditLog('FAKE_ALL_DONE_PENALTY', 'MEMBER', targetRecord.member_id, `Imposed fake all done penalty: ${reason}`);
    return { success: true };
  };

  const resolvePunishment = (punishmentId: string) => {
    setPunishments((prev) =>
      prev.map((p) =>
        p.id === punishmentId
          ? { ...p, status: 'COMPLETED', resolved_at: new Date().toISOString() }
          : p
      )
    );
    addAuditLog('RESOLVE_PUNISHMENT', 'PUNISHMENT', punishmentId, 'Resolved punishment duty');
  };

  const activePenalty =
    punishments.find(
      (p) => p.member_id === currentUser?.id && (p.status === 'PENDING' || p.status === 'IN_PROGRESS')
    ) || null;

  // Member Management (Roles & Status)
  const updateMemberRole = async (targetId: string, newRole: UserRole) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.updateRole(targetId, newRole);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshData();
      return { success: true };
    }

    const target = members.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Target member not found' };

    if (target.role === 'DEVELOPER' && currentUser.role !== 'DEVELOPER') {
      return { success: false, error: 'ডেভেলপার অ্যাকাউন্ট সুরক্ষিত। এডমিনরা পরিবর্তন করতে পারবে না।' };
    }

    setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, role: newRole } : m)));

    if (currentUser.id === targetId) {
      setCurrentUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }

    addAuditLog('UPDATE_ROLE', 'MEMBER', targetId, `Changed role of ${target.name} to ${newRole}`);
    return { success: true };
  };

  const updateMemberStatus = async (
    targetId: string,
    newStatus: MemberStatus,
    reason?: string
  ) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.updateStatus(targetId, newStatus, reason);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshData();
      return { success: true };
    }

    const target = members.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Member not found' };

    if (target.role === 'DEVELOPER') {
      return { success: false, error: 'ডেভেলপার অ্যাকাউন্ট ফ্রিজ বা সাসপেন্ড করা যাবে না।' };
    }

    setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, status: newStatus } : m)));

    addAuditLog(
      'UPDATE_STATUS',
      'MEMBER',
      targetId,
      `Changed status of ${target.name} to ${newStatus}${reason ? `. Reason: ${reason}` : ''}`
    );
    return { success: true };
  };

  const approveMember = async (targetId: string) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.approveMember(targetId);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshData();
      return { success: true };
    }

    const target = members.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Member not found' };

    setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, status: 'ACTIVE' } : m)));
    addAuditLog('MEMBER_APPROVED', 'MEMBER', targetId, `Approved member ${target.name} (${target.member_number})`);
    return { success: true };
  };

  const rejectMember = async (targetId: string, reason?: string) => {
    if (!currentUser || currentUser.role === 'MEMBER') {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.rejectMember(targetId, reason);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshData();
      return { success: true };
    }

    const target = members.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Member not found' };

    setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, status: 'REMOVED' } : m)));
    addAuditLog('MEMBER_REJECTED', 'MEMBER', targetId, `Rejected registration of ${target.name}. Reason: ${reason || 'No reason provided'}`);
    return { success: true };
  };

  const adminRestoreMember = async (targetId: string, reason: string) => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'DEVELOPER')) {
      return { success: false, error: 'Admin permission required' };
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('admin_restore_member_secure', {
        p_member_id: targetId,
        p_reason: reason,
      });
      if (error) return { success: false, error: error.message };
      await refreshData();
      return { success: true };
    }

    setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, status: 'ACTIVE' } : m)));
    addAuditLog('ADMIN_STATUS_RESTORE', 'MEMBER', targetId, `Restored member. Reason: ${reason}`);
    return { success: true };
  };

  const updateMemberProfile = async (
    targetId: string,
    profile: {
      name?: string;
      facebook_name?: string;
      facebook_url?: string;
      profile_photo_url?: string;
    }
  ) => {
    if (!currentUser) {
      return { success: false, error: 'লগইন আবশ্যক।' };
    }

    if (isSupabaseConfigured) {
      const res = await membersApi.updateProfile(targetId, profile);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      if (currentUser.id === targetId && res.data) {
        setCurrentUser(res.data);
      }
      await refreshData();
      return { success: true };
    }

    const target = members.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Member not found' };

    const updatedProfile: MemberProfile = {
      ...target,
      name: profile.name?.trim() || target.name,
      facebook_name: profile.facebook_name !== undefined ? profile.facebook_name.trim() : target.facebook_name,
      facebook_url: profile.facebook_url !== undefined ? profile.facebook_url.trim() : target.facebook_url,
      profile_photo_url: profile.profile_photo_url !== undefined ? profile.profile_photo_url.trim() : target.profile_photo_url,
    };

    setMembers((prev) => prev.map((m) => (m.id === targetId ? updatedProfile : m)));

    if (currentUser.id === targetId) {
      setCurrentUser(updatedProfile);
    }

    addAuditLog('MEMBER_PROFILE_UPDATED', 'MEMBER', targetId, `Profile updated for ${target.member_number}`);
    return { success: true };
  };

  const getDailyLeaderboard = async (date: string) => {
    return await pointsApi.getDailyLeaderboard(date);
  };

  const getMemberPointHistory = async (memberId: string) => {
    return await pointsApi.getMemberPointHistory(memberId);
  };

  const getPendingReviews = async () => {
    return await allDoneAdminApi.getPendingReviews();
  };

  const confirmFakeAllDone = async (incidentId: string, reason: string) => {
    const res = await allDoneAdminApi.confirmFakeAllDone(incidentId, reason);
    if (res.success) {
      addAuditLog('FAKE_ALL_DONE_CONFIRMED', 'MEMBER', incidentId, `Confirmed Fake All Done. Reason: ${reason}`);
      await refreshData();
    }
    return res;
  };

  return (
    <AppContext.Provider
      value={{
        isConfigured: isSupabaseConfigured,
        systemConfig,
        todayDate,
        submissionStatus,
        allDoneStatus,
        currentUser,
        isAuthenticated: Boolean(currentUser),
        authLoading,
        authReady,
        login,
        register,
        logout,
        resetPassword,
        updatePassword,
        dailyLinks,
        submitDailyLink,
        editDailyLink,
        deleteDailyLink,
        scheduledLinks,
        createScheduledLink,
        editScheduledLink,
        cancelScheduledLink,
        executeDueScheduledLinks,
        supportedLinkIds,
        supportLink,
        isLinkSupported,
        canSupportLink,
        currentSupportLinkIndex,
        setCurrentSupportLinkIndex,
        pendingRequiredSupportCount,
        allDoneRecords,
        isAllDoneSubmittedToday,
        userAllDoneRecord,
        submitAllDone,
        pointLedger,
        reports,
        submitReport,
        updateReportStatus,
        sendReportMessage,
        notices,
        addNotice,
        deleteNotice,
        punishments,
        activePenalty,
        verifyFakeAllDone,
        resolvePunishment,
        members,
        updateMemberRole,
        updateMemberStatus,
        approveMember,
        rejectMember,
        adminRestoreMember,
        updateMemberProfile,
        getDailyLeaderboard,
        getMemberPointHistory,
        pendingReviews,
        getPendingReviews,
        confirmFakeAllDone,
        createReportReply,
        addAuditLog,
        auditLogs,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
