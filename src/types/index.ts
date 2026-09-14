export type UserRole = 'DEVELOPER' | 'ADMIN' | 'MEMBER';

export type MemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'FROZEN' | 'SUSPENDED' | 'REMOVED';

export type PostType = 'Photo' | 'Video';

export type LinkCategory = 'NORMAL' | 'VIP' | 'ADMIN' | 'NOTICE';

export interface MemberProfile {
  id: string; // member UUID
  auth_user_id?: string; // auth.users.id reference
  member_number: string; // e.g. "SLB-101"
  name: string;
  username: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  facebook_name?: string;
  facebook_url?: string;
  profile_photo_url?: string;
  points: number;
  weekly_points: number;
  total_links_submitted: number;
  total_supports_given: number;
  total_all_done: number;
  community_id?: string;
  community: string;
  joined_at: string;
  last_active_at: string;
  days_inactive?: number;
  is_verified?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
}

export type LinkStatus = 'active' | 'removed';

export type SupportLinkStatus = 'CURRENT' | 'PENDING' | 'SUPPORTED' | 'REMOVED' | 'SKIPPED';

export type SupportVerificationState = 'pending' | 'verified' | 'rejected' | 'unknown';

export interface SupportVerificationResult {
  success: boolean;
  status: 'RECORDED' | 'ALREADY_SUPPORTED' | 'REJECTED';
  code?: string;
  supportRecordId?: string;
  linkId?: string;
  supportedAt?: string;
  pointsAwarded?: number;
  message?: string;
}

export interface SupportSessionState {
  currentLinkId: string | null;
  currentLinkNumber: number | null;
  lastVisitedAt?: string;
  isCompleted: boolean;
}

export interface SupportProgress {
  totalApplicable: number;
  totalSupported: number;
  remainingPending: number;
  progressPercent: number;
  currentPartNumber: number;
  allSupportCompleted: boolean;
}

export type ScheduleStatus =
  | 'pending'
  | 'processing'
  | 'executed'
  | 'canceled'
  | 'failed'
  | 'skipped';

export interface ScheduledLink {
  id: string;
  community_id?: string;
  owner_id: string;
  owner_name?: string;
  owner_member_number?: string;
  target_date: string; // YYYY-MM-DD in BDT
  target_time?: string; // e.g. "10:00"
  post_type: PostType;
  category?: LinkCategory;
  caption: string;
  instruction: string;
  fb_link: string;
  status: ScheduleStatus;
  is_published?: boolean;
  published_link_id?: string;
  scheduled_by_admin_id?: string;
  created_at: string;
  updated_at?: string;
  executed_at?: string;
  canceled_at?: string;
  error_message?: string;
  execution_attempts?: number;
}

export interface DailyLink {
  id: string;
  serial_number: number; // 1, 2, 3...
  link_number?: number; // Alias for serial_number
  serial_display: string; // "01", "02", "15"
  part_number: number; // Part 1: 1-20, Part 2: 21-40...
  community_id?: string;
  owner_id: string;
  owner_name: string;
  owner_member_number: string;
  owner_photo_url?: string;
  owner_facebook_url?: string;
  submitted_by_admin_id?: string;
  date: string; // YYYY-MM-DD in BDT
  post_type: PostType;
  category: LinkCategory;
  caption: string;
  instruction: string;
  fb_link: string;
  submitted_at: string;
  can_edit_until: string; // 2 min from submission
  editable_until?: string; // Alias for can_edit_until
  is_approved: boolean;
  total_supports_count: number;
  is_pinned?: boolean;
  status?: LinkStatus;
  removed_at?: string;
  removed_by_id?: string;
  removed_reason?: string;
}

export interface SupportRecord {
  id: string;
  link_id: string;
  supporter_id: string;
  supporter_member_number: string;
  link_owner_id: string;
  date: string; // YYYY-MM-DD in BDT
  supported_at: string;
  points_awarded: number;
  is_verified: boolean;
}

export interface AllDoneRecord {
  id: string;
  date: string; // YYYY-MM-DD in BDT
  member_id: string;
  member_name: string;
  member_number: string;
  member_photo_url?: string;
  completed_at: string; // BDT timestamp
  fastest_rank: number | null; // 1 to 5, or null for 6+
  base_points: number; // 3
  bonus_points: number; // 10, 8, 6, 4, 2, or 0
  total_points: number;
  status: 'VERIFIED' | 'REVOKED' | 'UNDER_REVIEW';
  alternative_id_used?: boolean;
  alternative_id_details?: {
    account_name: string;
    account_link?: string;
    note?: string;
  };
}

export interface ReportReply {
  id: string;
  report_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'DEVELOPER' | 'ADMIN' | 'MEMBER';
  message: string;
  created_at: string;
}

export interface Report {
  id: string;
  community_id: string;
  link_id: string;
  link_serial: number;
  link_owner_id: string;
  link_owner_name: string;
  reporter_id: string;
  reporter_name: string;
  category: 'LINK_NOT_WORKING' | 'COMMENTS_DISABLED' | 'POST_NOT_PUBLIC' | 'REACT_COMMENT_DISABLED' | 'ADULT_POST' | 'POLITICAL_POST';
  description: string;
  screenshot_url?: string;
  status: 'PENDING' | 'IN_DISCUSSION' | 'RESOLVED' | 'DISMISSED';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  messages?: ReportReply[];
}

export type PointActivityType =
  | 'DAILY_LINK_SUBMIT'
  | 'ON_TIME_SUBMISSION'
  | 'SUPPORT_COMPLETE'
  | 'SUPPORT_SESSION'
  | 'ALL_DONE'
  | 'FASTEST_ALL_DONE'
  | 'ADMIN_ADJUSTMENT'
  | 'PENALTY_REVERSAL';

export interface PointTransaction {
  id: string;
  member_id: string;
  activity_type: PointActivityType;
  points: number;
  date: string;
  reference_id?: string;
  description: string;
  created_at: string;
  created_by?: string;
}

export type ReportCategory =
  | 'link_not_working'
  | 'comments_disabled'
  | 'post_not_public'
  | 'react_comment_disabled'
  | 'adult_post'
  | 'political_post'
  | 'other';

export type ReportStatus = 'PENDING' | 'IN_DISCUSSION' | 'RESOLVED' | 'DISMISSED';

export interface LinkReport {
  id: string;
  link_id: string;
  link_serial: number;
  link_owner_id: string;
  link_owner_name: string;
  reporter_id: string;
  reporter_name: string;
  category: ReportCategory;
  description: string;
  screenshot_url?: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  messages?: ReportMessage[];
}

export interface ReportMessage {
  id: string;
  report_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  message: string;
  created_at: string;
}

export type NoticeType = 'SIMPLE_WARNING' | 'ALERT_WARNING' | 'KICKOUT_WARNING' | 'GENERAL_ANNOUNCEMENT';

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  type: NoticeType;
  created_at: string;
  created_by_name: string;
  target_role?: UserRole | 'ALL';
  target_member_ids?: string[];
  days_inactive_filter?: number;
  is_pinned: boolean;
}

export interface PunishmentRecord {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string;
  punishment_type: 'FAKE_ALL_DONE' | 'MISSED_DEADLINE' | 'DISRUPTIVE_BEHAVIOR';
  reason: string;
  detected_date: string;
  detected_by_admin: string;
  original_all_done_id?: string;
  missing_support_count: number;
  extra_free_support_days: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  created_at: string;
  resolved_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target_type: string;
  target_id?: string;
  target_member_id?: string; // Added
  details: string;
  created_at: string;
  ip_address?: string;
}

export type MemberHistoryCategory =
  | 'AUTH'
  | 'MEMBER'
  | 'ROLE'
  | 'LINK'
  | 'SUPPORT'
  | 'ALL_DONE'
  | 'POINT'
  | 'REPORT'
  | 'NOTICE'
  | 'PUNISHMENT'
  | 'RECOVERY'
  | 'ADMIN'
  | 'ARCHIVE'
  | 'EXPORT';

export interface MemberHistoryItem {
  id: string;
  category: MemberHistoryCategory;
  action: string;
  description: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export type MediaType = 'MOVIE' | 'VIDEO' | 'TUTORIAL' | 'TRAINING' | 'OTHER';
export type MediaStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type MediaVisibility = 'COMMUNITY' | 'ADMINS_ONLY' | 'PRIVATE';

export interface MediaItem {
  id: string;
  community_id: string;
  title: string;
  description?: string;
  media_type: MediaType;
  category: string;
  storage_bucket?: string;
  storage_path?: string;
  external_url?: string;
  thumbnail_path?: string;
  duration_seconds?: number;
  status: MediaStatus;
  visibility: MediaVisibility;
  is_featured: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MovieAccessToken {
  id: string;
  token_hash: string;
  member_id: string;
  community_id: string;
  media_id: string;
  resolution: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string;
  created_at: string;
}

export type PeriodType = 'WEEKLY' | 'MONTHLY';
export type QualificationStatus = 'QUALIFIED' | 'DISQUALIFIED';
export type RewardStatus = 'NONE' | 'ELIGIBLE' | 'CLAIMED' | 'PUBLISHED';

export interface LeaderboardResult {
  id: string;
  community_id: string;
  period_type: PeriodType;
  period_id: string;
  start_at: string;
  end_at: string;
  member_id: string;
  rank: number;
  points: number;
  link_days: number;
  fast_support_days: number;
  qualification_status: QualificationStatus;
  reward_status: RewardStatus;
  finalized_at: string;
}

export interface VipRewardEntitlement {
  id: string;
  member_id: string;
  period_type: PeriodType;
  period_id: string;
  rank: number;
  qualification_status: QualificationStatus;
  status: 'EARNED' | 'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  submitted_link_id?: string;
  published_link_id?: string;
  approved_by_admin_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemConfig {
  submission_start_time: string; // "10:00"
  submission_end_time: string; // "16:50"
  all_done_start_time: string; // "17:00"
  all_done_deadline_time: string; // "24:00"
  recovery_end_time: string; // "10:00"
  max_links_per_member: number;
  fastest_bonus_prizes: number[]; // [10, 8, 6, 4, 2]
  base_all_done_points: number; // 3
  community_name: string;
  timezone: string; // "Asia/Dhaka" (BDT = UTC+6)
}
