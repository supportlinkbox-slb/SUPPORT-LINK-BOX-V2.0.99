-- ============================================================================
-- RECONCILE_SCHEMA_V18: unify competing table definitions (v18 audit fix)
-- Adds every column referenced by functions/indexes/seeds that the
-- first-created table definition is missing. Idempotent (IF NOT EXISTS).
-- RUN ORDER: immediately after PART_1_SCHEMA_TABLES_INDEXES.sql, before PART_2.
-- ============================================================================

-- Table: public.all_done
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS base_points INTEGER DEFAULT 3;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_name VARCHAR(100);
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_number VARCHAR(20);
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_photo_url TEXT;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS speed_points INTEGER DEFAULT 0;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS supported_links_count INTEGER DEFAULT 0;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS total_daily_links INTEGER DEFAULT 0;
-- Table: public.announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main';
-- Table: public.archive_batches
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS community_id VARCHAR(50);
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'COMPLETED';
-- Table: public.audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_auth_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_member_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS table_name TEXT;
-- Table: public.daily_links
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_facebook_url TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_member_number VARCHAR(20);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_name VARCHAR(100);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_photo_url TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS submitted_by_admin_id UUID;
-- Table: public.leaderboard_results
ALTER TABLE public.leaderboard_results ADD COLUMN IF NOT EXISTS community_id VARCHAR(50);
ALTER TABLE public.leaderboard_results ADD COLUMN IF NOT EXISTS period_id TEXT;
-- Table: public.media_items
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS community_id VARCHAR(50);
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
-- Table: public.member_punishments
ALTER TABLE public.member_punishments ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE public.member_punishments ADD COLUMN IF NOT EXISTS issued_by TEXT;
ALTER TABLE public.member_punishments ADD COLUMN IF NOT EXISTS penalty_type VARCHAR(50);
-- Table: public.members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS community VARCHAR(100) DEFAULT 'Support Link Box Official';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_name VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS username VARCHAR(50);
-- Table: public.notices
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS level VARCHAR(20) DEFAULT 'NOTICE';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_member_id UUID;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'GENERAL_ANNOUNCEMENT';
-- Table: public.notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
-- Table: public.report_replies
ALTER TABLE public.report_replies ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main';
ALTER TABLE public.report_replies ADD COLUMN IF NOT EXISTS sender_name VARCHAR(100);
ALTER TABLE public.report_replies ADD COLUMN IF NOT EXISTS sender_role user_role DEFAULT 'MEMBER';
ALTER TABLE public.report_replies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Table: public.reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_member_id UUID;
-- Table: public.scheduled_links
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS is_executed BOOLEAN DEFAULT false;
-- Table: public.settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS base_all_done_points INTEGER DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS community_name VARCHAR(100) DEFAULT 'Support Link Box Official';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS max_links_per_member INTEGER DEFAULT 1;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS recovery_end_time VARCHAR(10) DEFAULT '10:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Dhaka';
-- Table: public.support_records
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS link_owner_id UUID;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 1;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS supporter_member_number VARCHAR(20);
-- Table: public.vip_reward_entitlements
ALTER TABLE public.vip_reward_entitlements ADD COLUMN IF NOT EXISTS period_id TEXT;
ALTER TABLE public.vip_reward_entitlements ADD COLUMN IF NOT EXISTS period_type TEXT;
-- Table: public.announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

DO $$ BEGIN RAISE NOTICE 'RECONCILE_SCHEMA_V18: schema unified'; END $$;

-- v18 fix round 2: columns needed by EARLIER files than the ones that add them
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_member_id UUID;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_key TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_type VARCHAR(20);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS timezone_label VARCHAR(10) DEFAULT 'BDT';
