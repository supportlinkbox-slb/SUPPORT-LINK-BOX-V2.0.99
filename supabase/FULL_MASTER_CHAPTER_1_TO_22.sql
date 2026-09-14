-- ====================================================================
-- SUPPORT LINK BOX: COMPLETE A-TO-Z MASTER PRODUCTION SQL MIGRATION
-- COVERS CHAPTER 01 THROUGH CHAPTER 22
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase
-- Authoritative Single Source of Truth
-- ====================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- CHAPTER 01 — FOUNDATION, ENUMS & DOMAINS
-- ====================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('DEVELOPER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE', 'FROZEN', 'SUSPENDED', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN 
    BEGIN
        ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'PENDING';
        ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'REMOVED';
    EXCEPTION WHEN duplicate_object THEN null;
    END;
END $$;

DO $$ BEGIN
    CREATE TYPE post_type AS ENUM ('Photo', 'Video');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE link_category AS ENUM ('NORMAL', 'VIP', 'ADMIN', 'NOTICE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Optional Communities Registry
CREATE TABLE IF NOT EXISTS public.communities (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    name VARCHAR(100) NOT NULL DEFAULT 'Support Link Box Official',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.communities (id, name, description)
VALUES ('main', 'Support Link Box Official', 'Primary community partition')
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- CHAPTER 02, 03, 04, 05 — CORE PRODUCTION DATA TABLES
-- ====================================================================

-- Table 1: members (Authoritative identity mapping: members.auth_user_id -> auth.users.id)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    member_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'MEMBER',
    status member_status NOT NULL DEFAULT 'ACTIVE',
    facebook_name VARCHAR(100),
    facebook_url TEXT,
    profile_photo_url TEXT,
    points BIGINT NOT NULL DEFAULT 0,
    weekly_points BIGINT NOT NULL DEFAULT 0,
    total_links_submitted INTEGER NOT NULL DEFAULT 0,
    total_supports_given INTEGER NOT NULL DEFAULT 0,
    total_all_done INTEGER NOT NULL DEFAULT 0,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    community VARCHAR(100) NOT NULL DEFAULT 'Support Link Box Official',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 2: daily_links (Atomic link submissions & serial numbering)
CREATE TABLE IF NOT EXISTS public.daily_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    serial_number INTEGER NOT NULL,
    serial_display VARCHAR(10) NOT NULL,
    part_number INTEGER NOT NULL DEFAULT 1,
    owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    owner_name VARCHAR(100) NOT NULL,
    owner_member_number VARCHAR(20) NOT NULL,
    owner_photo_url TEXT,
    owner_facebook_url TEXT,
    submitted_by_admin_id UUID REFERENCES public.members(id),
    post_type post_type NOT NULL DEFAULT 'Photo',
    category link_category NOT NULL DEFAULT 'NORMAL',
    caption TEXT,
    instruction TEXT,
    fb_link TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    can_edit_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
    is_approved BOOLEAN NOT NULL DEFAULT true,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    total_supports_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_daily_serial_per_community UNIQUE (community_id, date, serial_number)
);

-- Table 3: support_records (1 valid support per supporter per link per day)
CREATE TABLE IF NOT EXISTS public.support_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    link_id UUID NOT NULL REFERENCES public.daily_links(id) ON DELETE CASCADE,
    supporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    supporter_member_number VARCHAR(20) NOT NULL,
    link_owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    supported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    points_awarded INTEGER NOT NULL DEFAULT 1,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_support_per_member_per_link UNIQUE (link_id, supporter_id)
);

-- Table 4: all_done (All Done completion & fastest ranking)
CREATE TABLE IF NOT EXISTS public.all_done (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supported_links_count INTEGER NOT NULL DEFAULT 0,
    total_daily_links INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT true,
    fastest_rank INTEGER,
    base_points INTEGER NOT NULL DEFAULT 5,
    speed_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_alldone_per_member_per_date UNIQUE (community_id, date, member_id)
);

-- Table 5: alt_id_disclosures (Alternative Facebook accounts used for support)
CREATE TABLE IF NOT EXISTS public.alt_id_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    alt_fb_name VARCHAR(100) NOT NULL,
    alt_fb_link TEXT NOT NULL,
    reason TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: point_transactions (Immutable financial-grade points ledger)
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    reference_id TEXT,
    description TEXT,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 7: reports (Link problem reporting)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    link_id UUID NOT NULL REFERENCES public.daily_links(id) ON DELETE CASCADE,
    link_serial INTEGER NOT NULL,
    link_owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    link_owner_name VARCHAR(100) NOT NULL,
    reporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    reporter_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    screenshot_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    resolved_by UUID REFERENCES public.members(id),
    resolved_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 8: report_replies (Threaded discussions on link reports)
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role user_role NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 9: scheduled_links (Future automated link queue)
CREATE TABLE IF NOT EXISTS public.scheduled_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    category link_category NOT NULL DEFAULT 'NORMAL',
    post_type post_type NOT NULL DEFAULT 'Photo',
    caption TEXT,
    instruction TEXT,
    fb_link TEXT NOT NULL,
    is_executed BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 10: announcements (Broadcasts from Admin & Developers)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    author_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    pinned_order INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 11: announcement_reads (Tracking member read receipts)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_read_receipt UNIQUE (announcement_id, member_id)
);

-- Table 12: notices (Warnings, notices & alerts)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    target_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'NOTICE',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 13: notifications (Database event-driven alerts for members)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 14: audit_logs (Tamper-resistant append-only operational log)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    actor_name VARCHAR(100) NOT NULL,
    actor_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id TEXT,
    target_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 15: settings (System-wide configuration, window schedules in BDT)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) UNIQUE NOT NULL DEFAULT 'main',
    submission_start TIME NOT NULL DEFAULT '10:00:00',
    submission_end TIME NOT NULL DEFAULT '16:50:00',
    support_start TIME NOT NULL DEFAULT '17:00:00',
    support_end TIME NOT NULL DEFAULT '23:59:59',
    alldone_start TIME NOT NULL DEFAULT '17:00:00',
    alldone_end TIME NOT NULL DEFAULT '23:59:59',
    alldone_target_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    daily_link_points INTEGER NOT NULL DEFAULT 5,
    on_time_bonus_points INTEGER NOT NULL DEFAULT 2,
    support_point_per_link INTEGER NOT NULL DEFAULT 1,
    alldone_base_points INTEGER NOT NULL DEFAULT 5,
    rank_bonus_1 INTEGER NOT NULL DEFAULT 10,
    rank_bonus_2 INTEGER NOT NULL DEFAULT 8,
    rank_bonus_3 INTEGER NOT NULL DEFAULT 6,
    rank_bonus_4 INTEGER NOT NULL DEFAULT 4,
    rank_bonus_5 INTEGER NOT NULL DEFAULT 2,
    is_system_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settings (community_id)
VALUES ('main')
ON CONFLICT (community_id) DO NOTHING;

-- Table 16: points_history (Historical daily snapshots per member)
CREATE TABLE IF NOT EXISTS public.points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    date DATE NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    breakdown JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_point_history_per_member_date UNIQUE (member_id, date)
);

-- Table 17: member_daily_summary (Pre-aggregated daily activity summary)
CREATE TABLE IF NOT EXISTS public.member_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    date DATE NOT NULL,
    link_submitted BOOLEAN NOT NULL DEFAULT false,
    link_submitted_at TIMESTAMPTZ,
    link_on_time BOOLEAN NOT NULL DEFAULT false,
    supports_given INTEGER NOT NULL DEFAULT 0,
    all_done_completed BOOLEAN NOT NULL DEFAULT false,
    all_done_at TIMESTAMPTZ,
    fastest_rank INTEGER,
    total_points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_daily_summary_per_member_date UNIQUE (member_id, date)
);

-- Table 18: archive_batches (Historical cold-storage batches)
CREATE TABLE IF NOT EXISTS public.archive_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    source_table VARCHAR(100) NOT NULL,
    archive_type VARCHAR(50) NOT NULL DEFAULT 'RETENTION_CLEANUP',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    records_count INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    storage_path TEXT,
    checksum VARCHAR(64),
    error_message TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_by UUID REFERENCES public.members(id),
    executed_by_admin_id UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- CHAPTER 12, 13, 18, 21, 22 — EXTENDED DOMAIN TABLES
-- ====================================================================

-- Table 19: member_punishments (Disciplinary system, Ch 12)
CREATE TABLE IF NOT EXISTS public.member_punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    punishment_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    detected_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    detected_by_admin UUID REFERENCES public.members(id),
    original_all_done_id UUID,
    missing_support_count INTEGER DEFAULT 0,
    extra_free_support_days INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Table 20: fake_all_done_incidents (Fake All Done audit & penalty, Ch 13)
CREATE TABLE IF NOT EXISTS public.fake_all_done_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    all_done_id UUID NOT NULL REFERENCES public.all_done(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    review_status TEXT DEFAULT 'PENDING_REVIEW',
    reason TEXT,
    required_support_count INTEGER,
    verified_support_count INTEGER,
    missing_support_count INTEGER,
    confirmed_by UUID REFERENCES public.members(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 21: media_items (Movie & Media Hub, Ch 18)
CREATE TABLE IF NOT EXISTS public.media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT NOT NULL DEFAULT 'MOVIE',
    category TEXT NOT NULL DEFAULT 'ENTERTAINMENT',
    storage_bucket TEXT,
    storage_path TEXT,
    external_url TEXT,
    thumbnail_path TEXT,
    duration_seconds INT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    visibility TEXT NOT NULL DEFAULT 'COMMUNITY',
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 22: movie_access_tokens (Protected link delivery & anti-leak tokens, Ch 22)
CREATE TABLE IF NOT EXISTS public.movie_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    media_id UUID REFERENCES public.media_items(id) ON DELETE CASCADE NOT NULL,
    resolution TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 23: leaderboard_results (Finalized weekly & monthly leaderboard, Ch 21)
CREATE TABLE IF NOT EXISTS public.leaderboard_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    period_type TEXT NOT NULL, -- 'WEEKLY', 'MONTHLY'
    period_id TEXT NOT NULL, -- '2026-W37', '2026-09'
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    rank INT NOT NULL,
    points INT NOT NULL,
    link_days INT DEFAULT 0,
    fast_support_days INT DEFAULT 0,
    qualification_status TEXT DEFAULT 'QUALIFIED',
    reward_status TEXT DEFAULT 'NONE',
    finalized_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, period_type, period_id, member_id)
);

-- Table 24: vip_reward_entitlements (Top 3 Weekly/Monthly VIP privileges, Ch 21)
CREATE TABLE IF NOT EXISTS public.vip_reward_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    period_type TEXT NOT NULL,
    period_id TEXT NOT NULL,
    rank INT NOT NULL,
    qualification_status TEXT NOT NULL,
    status TEXT DEFAULT 'EARNED',
    submitted_link_id UUID REFERENCES public.daily_links(id) ON DELETE SET NULL,
    published_link_id UUID REFERENCES public.daily_links(id) ON DELETE SET NULL,
    approved_by_admin_id UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- CHAPTER 06 & PERFORMANCE — COMPREHENSIVE INDEXING FOUNDATION
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_community_id ON public.members(community_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.members(role);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_points_desc ON public.members(points DESC);

CREATE INDEX IF NOT EXISTS idx_daily_links_lookup ON public.daily_links(community_id, date, serial_number);
CREATE INDEX IF NOT EXISTS idx_daily_links_owner ON public.daily_links(owner_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_links_created ON public.daily_links(date DESC, serial_number ASC);

CREATE INDEX IF NOT EXISTS idx_support_records_link ON public.support_records(link_id, supporter_id);
CREATE INDEX IF NOT EXISTS idx_support_records_supporter_date ON public.support_records(supporter_id, date);

CREATE INDEX IF NOT EXISTS idx_all_done_lookup ON public.all_done(community_id, date, member_id);
CREATE INDEX IF NOT EXISTS idx_all_done_fastest ON public.all_done(date, fastest_rank) WHERE fastest_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_point_transactions_member_date ON public.point_transactions(member_id, date);
CREATE INDEX IF NOT EXISTS idx_point_transactions_activity_date ON public.point_transactions(activity_type, date);

CREATE INDEX IF NOT EXISTS idx_reports_community_status ON public.reports(community_id, status);
CREATE INDEX IF NOT EXISTS idx_report_replies_report ON public.report_replies(report_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_scheduled_links_queue ON public.scheduled_links(community_id, target_date, is_executed);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(community_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_target ON public.notices(target_member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_member ON public.notifications(member_id, is_read);

CREATE INDEX IF NOT EXISTS idx_audit_logs_community_created ON public.audit_logs(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_member ON public.audit_logs(target_member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_items_community_status ON public.media_items(community_id, status);
CREATE INDEX IF NOT EXISTS idx_movie_access_tokens_hash ON public.movie_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_leaderboard_results_period ON public.leaderboard_results(community_id, period_type, period_id);
CREATE INDEX IF NOT EXISTS idx_vip_rewards_member ON public.vip_reward_entitlements(member_id, period_type, period_id);

-- ====================================================================
-- SERVER-SIDE TIMEZONE & IDENTITY HELPER FUNCTIONS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_current_bdt_date()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date;
$$;

CREATE OR REPLACE FUNCTION public.get_current_bdt_time()
RETURNS TIME
LANGUAGE sql
STABLE
AS $$
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::time;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_member()
RETURNS public.members
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member public.members;
BEGIN
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = auth.uid();
    RETURN v_member;
END;
$$;

-- ====================================================================
-- CHAPTER 02 — AUTOMATIC MEMBER PROVISIONING TRIGGER ON USER SIGNUP
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member_number VARCHAR(20);
    v_base_name VARCHAR(100);
    v_username VARCHAR(50);
    v_count INTEGER;
    v_role user_role := 'MEMBER';
BEGIN
    SELECT COUNT(*) + 1 INTO v_count FROM public.members;
    v_member_number := 'M-' || LPAD(v_count::text, 4, '0');

    v_base_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    v_username := LOWER(REGEXP_REPLACE(v_base_name, '[^a-zA-Z0-9]', '', 'g')) || '_' || v_count::text;

    IF v_count = 1 OR NEW.email = 'supportlinkbox@gmail.com' THEN
        v_role := 'DEVELOPER';
    END IF;

    INSERT INTO public.members (
        auth_user_id,
        member_number,
        name,
        username,
        email,
        role,
        status,
        facebook_name,
        facebook_url,
        community_id,
        community
    ) VALUES (
        NEW.id,
        v_member_number,
        v_base_name,
        v_username,
        NEW.email,
        v_role,
        'ACTIVE',
        v_base_name,
        COALESCE(NEW.raw_user_meta_data->>'facebook_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'community_id', 'main'),
        'Support Link Box Official'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- CHAPTER 07 & 08 — ATOMIC BUSINESS STORED PROCEDURES (RPCS)
-- ====================================================================

-- 1. SUBMIT DAILY LINK SECURE
CREATE OR REPLACE FUNCTION public.submit_daily_link_secure(
    p_fb_link TEXT,
    p_post_type post_type DEFAULT 'Photo',
    p_category link_category DEFAULT 'NORMAL',
    p_caption TEXT DEFAULT NULL,
    p_instruction TEXT DEFAULT NULL,
    p_target_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_target_member public.members%ROWTYPE;
    v_settings public.settings%ROWTYPE;
    v_today DATE;
    v_now_time TIME;
    v_next_serial INTEGER;
    v_new_link_id UUID;
    v_is_on_time BOOLEAN := false;
    v_earned_points INTEGER := 0;
    v_clean_url TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.'; END IF;
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
    IF v_member.status <> 'ACTIVE' THEN RAISE EXCEPTION 'FORBIDDEN: Account is %.', v_member.status; END IF;

    IF p_target_member_id IS NOT NULL AND p_target_member_id <> v_member.id THEN
        IF v_member.role <> 'ADMIN' AND v_member.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Only Admins can submit on behalf of members.';
        END IF;
        SELECT * INTO v_target_member FROM public.members WHERE id = p_target_member_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_MEMBER_NOT_FOUND'; END IF;
    ELSE
        v_target_member := v_member;
    END IF;

    v_today := public.get_current_bdt_date();
    v_now_time := public.get_current_bdt_time();
    SELECT * INTO v_settings FROM public.settings WHERE community_id = v_target_member.community_id;

    IF v_member.role = 'MEMBER' THEN
        IF v_now_time < v_settings.submission_start OR v_now_time > v_settings.submission_end THEN
            RAISE EXCEPTION 'WINDOW_CLOSED: Submissions open % to % BDT.', v_settings.submission_start, v_settings.submission_end;
        END IF;
        IF EXISTS (SELECT 1 FROM public.daily_links WHERE community_id = v_target_member.community_id AND date = v_today AND owner_id = v_target_member.id) THEN
            RAISE EXCEPTION 'DUPLICATE_SUBMISSION: Daily link already submitted.';
        END IF;
    END IF;

    v_clean_url := TRIM(p_fb_link);
    IF v_clean_url NOT SIMILAR TO 'https?://(www\.|web\.|m\.)?(facebook\.com|fb\.watch)/.+' THEN
        RAISE EXCEPTION 'INVALID_URL: Must be a valid Facebook link.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_target_member.community_id || '_' || v_today::text));

    SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
    FROM public.daily_links
    WHERE community_id = v_target_member.community_id AND date = v_today;

    v_is_on_time := (v_now_time >= v_settings.submission_start AND v_now_time <= v_settings.submission_end);

    INSERT INTO public.daily_links (
        community_id, date, serial_number, serial_display, owner_id, owner_name,
        owner_member_number, owner_photo_url, owner_facebook_url,
        submitted_by_admin_id, post_type, category, caption, instruction, fb_link,
        can_edit_until
    ) VALUES (
        v_target_member.community_id, v_today, v_next_serial,
        '#' || LPAD(v_next_serial::text, 2, '0'),
        v_target_member.id, v_target_member.name, v_target_member.member_number,
        v_target_member.profile_photo_url, v_target_member.facebook_url,
        CASE WHEN v_member.id <> v_target_member.id THEN v_member.id ELSE NULL END,
        p_post_type, p_category, p_caption, p_instruction, v_clean_url,
        NOW() + INTERVAL '2 minutes'
    ) RETURNING id INTO v_new_link_id;

    v_earned_points := v_settings.daily_link_points;
    IF v_is_on_time THEN v_earned_points := v_earned_points + v_settings.on_time_bonus_points; END IF;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_target_member.id, 'LINK_SUBMIT', v_earned_points, v_today, v_new_link_id::text,
            'Daily Link #' || v_next_serial || ' (' || CASE WHEN v_is_on_time THEN '+2 On-Time Bonus' ELSE 'Standard' END || ')');

    UPDATE public.members
    SET points = points + v_earned_points,
        weekly_points = weekly_points + v_earned_points,
        total_links_submitted = total_links_submitted + 1,
        last_active_at = NOW()
    WHERE id = v_target_member.id;

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_new_link_id,
        'serial_number', v_next_serial,
        'points_awarded', v_earned_points
    );
END;
$$;

-- 2. SUPPORT LINK SECURE
CREATE OR REPLACE FUNCTION public.support_link_secure(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_settings public.settings%ROWTYPE;
    v_today DATE;
    v_points INTEGER := 1;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
    IF v_member.status <> 'ACTIVE' THEN RAISE EXCEPTION 'FORBIDDEN: Status is %.', v_member.status; END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;
    IF v_link.owner_id = v_member.id THEN RAISE EXCEPTION 'INVALID_ACTION: Self-support not allowed.'; END IF;
    IF v_link.community_id <> v_member.community_id THEN RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED'; END IF;

    v_today := public.get_current_bdt_date();
    SELECT * INTO v_settings FROM public.settings WHERE community_id = v_member.community_id;
    v_points := COALESCE(v_settings.support_point_per_link, 1);

    BEGIN
        INSERT INTO public.support_records (
            community_id, link_id, supporter_id, supporter_member_number,
            link_owner_id, date, points_awarded
        ) VALUES (
            v_member.community_id, v_link.id, v_member.id, v_member.member_number,
            v_link.owner_id, v_today, v_points
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'DUPLICATE_SUPPORT: Already supported.';
    END;

    UPDATE public.daily_links SET total_supports_count = total_supports_count + 1 WHERE id = v_link.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'SUPPORT_GIVEN', v_points, v_today, v_link.id::text, 'Supported Link #' || v_link.serial_display);

    UPDATE public.members
    SET points = points + v_points,
        weekly_points = weekly_points + v_points,
        total_supports_given = total_supports_given + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

    RETURN jsonb_build_object('success', true, 'points_awarded', v_points);
END;
$$;

-- 3. SUBMIT ALL DONE SECURE
CREATE OR REPLACE FUNCTION public.submit_all_done_secure()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_settings public.settings%ROWTYPE;
    v_today DATE;
    v_now_time TIME;
    v_total_links INTEGER;
    v_supported_links INTEGER;
    v_fastest_rank INTEGER := NULL;
    v_speed_bonus INTEGER := 0;
    v_total_points INTEGER := 0;
    v_alldone_count_today INTEGER;
    v_alldone_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
    IF v_member.status <> 'ACTIVE' THEN RAISE EXCEPTION 'FORBIDDEN: Status is %.', v_member.status; END IF;

    v_today := public.get_current_bdt_date();
    v_now_time := public.get_current_bdt_time();
    SELECT * INTO v_settings FROM public.settings WHERE community_id = v_member.community_id;

    IF v_now_time < v_settings.alldone_start THEN
        RAISE EXCEPTION 'WINDOW_NOT_OPEN: All Done starts at % BDT.', v_settings.alldone_start;
    END IF;

    IF EXISTS (SELECT 1 FROM public.all_done WHERE community_id = v_member.community_id AND date = v_today AND member_id = v_member.id) THEN
        RAISE EXCEPTION 'DUPLICATE_ALL_DONE: Already completed All Done today.';
    END IF;

    SELECT COUNT(*) INTO v_total_links
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today AND owner_id <> v_member.id;

    SELECT COUNT(*) INTO v_supported_links
    FROM public.support_records
    WHERE community_id = v_member.community_id AND date = v_today AND supporter_id = v_member.id;

    IF v_supported_links < v_total_links THEN
        RAISE EXCEPTION 'INCOMPLETE_SUPPORT: Supported % of % required links.', v_supported_links, v_total_links;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('slb_alldone_rank_' || v_member.community_id || '_' || v_today::text));

    SELECT COUNT(*) INTO v_alldone_count_today
    FROM public.all_done
    WHERE community_id = v_member.community_id AND date = v_today;

    IF v_alldone_count_today < 5 THEN
        v_fastest_rank := v_alldone_count_today + 1;
        CASE v_fastest_rank
            WHEN 1 THEN v_speed_bonus := v_settings.rank_bonus_1;
            WHEN 2 THEN v_speed_bonus := v_settings.rank_bonus_2;
            WHEN 3 THEN v_speed_bonus := v_settings.rank_bonus_3;
            WHEN 4 THEN v_speed_bonus := v_settings.rank_bonus_4;
            WHEN 5 THEN v_speed_bonus := v_settings.rank_bonus_5;
        END CASE;
    END IF;

    v_total_points := v_settings.alldone_base_points + v_speed_bonus;

    INSERT INTO public.all_done (
        community_id, member_id, date, supported_links_count, total_daily_links,
        fastest_rank, base_points, speed_points, total_points
    ) VALUES (
        v_member.community_id, v_member.id, v_today, v_supported_links, v_total_links,
        v_fastest_rank, v_settings.alldone_base_points, v_speed_bonus, v_total_points
    ) RETURNING id INTO v_alldone_id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'ALL_DONE', v_total_points, v_today, v_alldone_id::text,
            'All Done Completed' || CASE WHEN v_fastest_rank IS NOT NULL THEN ' [Rank #' || v_fastest_rank || ' (+' || v_speed_bonus || ' pts)]' ELSE '' END);

    UPDATE public.members
    SET points = points + v_total_points,
        weekly_points = weekly_points + v_total_points,
        total_all_done = total_all_done + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

    RETURN jsonb_build_object(
        'success', true,
        'rank', v_fastest_rank,
        'points_awarded', v_total_points
    );
END;
$$;

-- 4. LINK EDIT & DELETE SECURE (CHAPTER 07)
CREATE OR REPLACE FUNCTION public.edit_daily_link_secure(
    p_link_id UUID,
    p_new_fb_link TEXT,
    p_new_caption TEXT DEFAULT NULL,
    p_new_instruction TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_clean_url TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;

    IF v_actor.role = 'MEMBER' THEN
        IF v_link.owner_id <> v_actor.id THEN RAISE EXCEPTION 'FORBIDDEN: Cannot edit another member link.'; END IF;
        IF NOW() > v_link.can_edit_until THEN RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED: 2-minute edit window passed.'; END IF;
    ELSE
        IF v_link.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Cross-community edit denied.';
        END IF;
    END IF;

    v_clean_url := TRIM(p_new_fb_link);
    IF v_clean_url NOT SIMILAR TO 'https?://(www\.|web\.|m\.)?(facebook\.com|fb\.watch)/.+' THEN
        RAISE EXCEPTION 'INVALID_URL: Must be a valid Facebook link.';
    END IF;

    UPDATE public.daily_links
    SET fb_link = v_clean_url,
        caption = COALESCE(p_new_caption, caption),
        instruction = COALESCE(p_new_instruction, instruction)
    WHERE id = p_link_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_daily_link_secure(
    p_link_id UUID,
    p_reason TEXT DEFAULT 'User deleted'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;

    IF v_actor.role = 'MEMBER' THEN
        IF v_link.owner_id <> v_actor.id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
        IF NOW() > v_link.can_edit_until THEN RAISE EXCEPTION 'WINDOW_EXPIRED: Cannot delete after 2 minutes.'; END IF;
    ELSE
        IF v_link.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Cross-community deletion denied.';
        END IF;
    END IF;

    DELETE FROM public.daily_links WHERE id = p_link_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'LINK_REMOVED', 'DAILY_LINK', p_link_id::text, 'Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. POINTS ADJUSTMENT SECURE (CHAPTER 11)
CREATE OR REPLACE FUNCTION public.admin_adjust_points_secure(
    p_member_id UUID,
    p_points INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_date DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF v_target.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community access denied.';
    END IF;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, description, created_by)
    VALUES (p_member_id, 'ADMIN_ADJUSTMENT', p_points, v_date, 'Manual Admin Adjustment: ' || p_reason, v_actor.id);

    UPDATE public.members
    SET points = points + p_points,
        weekly_points = weekly_points + p_points
    WHERE id = p_member_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'ADMIN_ADJUST_POINTS', 'MEMBER', p_member_id::text, 
            'Adjusted ' || p_points || ' points for ' || v_target.member_number || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. RECOVERY & RESTORE MEMBER SECURE (CHAPTER 12)
CREATE OR REPLACE FUNCTION public.admin_restore_member_secure(
    p_member_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF v_target.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community access denied.';
    END IF;

    UPDATE public.members SET status = 'ACTIVE' WHERE id = p_member_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'ADMIN_STATUS_RESTORE', 'MEMBER', p_member_id::text, 
            'Restored member ' || v_target.member_number || ' to ACTIVE. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. CONFIRM FAKE ALL DONE SECURE (CHAPTER 13)
CREATE OR REPLACE FUNCTION public.confirm_fake_all_done_secure(
    p_incident_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_incident public.fake_all_done_incidents%ROWTYPE;
    v_all_done public.all_done%ROWTYPE;
    v_tx RECORD;
    v_reversed_points INTEGER := 0;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    SELECT * INTO v_incident FROM public.fake_all_done_incidents WHERE id = p_incident_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
    IF v_incident.review_status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

    SELECT * INTO v_all_done FROM public.all_done WHERE id = v_incident.all_done_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ALL_DONE_NOT_FOUND'; END IF;

    UPDATE public.all_done SET status = 'REVOKED' WHERE id = v_all_done.id;

    FOR v_tx IN 
        SELECT id, points FROM public.point_transactions 
        WHERE member_id = v_incident.member_id 
          AND reference_id = v_all_done.id::text
          AND (activity_type = 'ALL_DONE' OR activity_type = 'FASTEST_ALL_DONE')
    LOOP
        INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description, created_by)
        VALUES (v_incident.member_id, 'PENALTY_REVERSAL', -v_tx.points, (NOW() AT TIME ZONE 'Asia/Dhaka')::date,
                v_all_done.id::text, 'Reversal of Fake All Done: ' || p_reason, v_actor.id);
        v_reversed_points := v_reversed_points + v_tx.points;
    END LOOP;

    UPDATE public.members 
    SET points = points - v_reversed_points,
        weekly_points = weekly_points - v_reversed_points
    WHERE id = v_incident.member_id;

    INSERT INTO public.member_punishments (member_id, community_id, punishment_type, reason, detected_date, detected_by_admin, original_all_done_id)
    VALUES (v_incident.member_id, v_incident.community_id, 'FAKE_ALL_DONE_PENALTY', p_reason, (NOW() AT TIME ZONE 'Asia/Dhaka')::date, v_actor.id, v_all_done.id);

    UPDATE public.fake_all_done_incidents 
    SET review_status = 'CONFIRMED_FAKE', reason = p_reason, confirmed_by = v_actor.id, confirmed_at = v_now 
    WHERE id = p_incident_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'FAKE_ALL_DONE_CONFIRMED', 'MEMBER', v_incident.member_id::text, 
            'Confirmed Fake All Done. Points reversed: ' || v_reversed_points || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. CREATE REPORT SECURE (CHAPTER 15)
CREATE OR REPLACE FUNCTION public.create_report_secure(
    p_link_id UUID,
    p_category TEXT,
    p_description TEXT,
    p_screenshot_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_reporter public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_report_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_reporter FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;

    IF v_link.community_id <> v_reporter.community_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community report denied.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.reports 
        WHERE link_id = p_link_id AND reporter_id = v_reporter.id 
        AND status IN ('PENDING', 'IN_DISCUSSION')
    ) THEN
        RAISE EXCEPTION 'REPORT_DUPLICATE: An active report already exists.';
    END IF;

    INSERT INTO public.reports (
        community_id, link_id, link_serial, link_owner_id, link_owner_name,
        reporter_id, reporter_name, category, description, screenshot_url, status
    ) VALUES (
        v_reporter.community_id, p_link_id, v_link.serial_number, v_link.owner_id, v_link.owner_name,
        v_reporter.id, v_reporter.name, p_category, p_description, p_screenshot_path, 'PENDING'
    ) RETURNING id INTO v_report_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_reporter.id, v_reporter.name, v_reporter.role, 'REPORT_CREATED', 'REPORT', v_report_id::text, 
            'Reported link #' || v_link.serial_display || ' for category: ' || p_category);

    RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- 9. CREATE REPORT REPLY SECURE (CHAPTER 15)
CREATE OR REPLACE FUNCTION public.create_report_reply_secure(
    p_report_id UUID,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_sender public.members%ROWTYPE;
    v_report public.reports%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_sender FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;

    IF NOT (
        v_sender.id = v_report.reporter_id OR 
        v_sender.id = v_report.link_owner_id OR
        (v_sender.role IN ('ADMIN', 'DEVELOPER') AND v_sender.community_id = v_report.community_id)
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Unauthorized to reply.';
    END IF;

    INSERT INTO public.report_replies (report_id, sender_id, sender_name, sender_role, message)
    VALUES (p_report_id, v_sender.id, v_sender.name, v_sender.role, p_message);

    UPDATE public.reports SET status = 'IN_DISCUSSION', updated_at = NOW() WHERE id = p_report_id AND status = 'PENDING';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. GET MEMBER HISTORY SECURE (CHAPTER 16)
CREATE OR REPLACE FUNCTION public.get_member_history_secure(
    p_target_member_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    event_type TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    SELECT * INTO v_target FROM public.members WHERE id = p_target_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    IF NOT (
        v_actor.id = p_target_member_id OR
        (v_actor.role IN ('ADMIN', 'DEVELOPER') AND v_actor.community_id = v_target.community_id)
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Unauthorized access.';
    END IF;

    RETURN QUERY
    SELECT 'AUDIT'::TEXT, jsonb_build_object('action', action, 'details', details), created_at
    FROM public.audit_logs
    WHERE target_member_id = p_target_member_id
    UNION ALL
    SELECT 'POINT'::TEXT, jsonb_build_object('points', points, 'activity', activity_type, 'description', description), created_at
    FROM public.point_transactions
    WHERE member_id = p_target_member_id
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ====================================================================
-- CHAPTER 09, 10, 18, 19, 21, 22 — ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alt_id_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fake_all_done_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_reward_entitlements ENABLE ROW LEVEL SECURITY;

-- Members Policies
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
CREATE POLICY "members_select_policy" ON public.members
    FOR SELECT TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "members_update_own" ON public.members;
CREATE POLICY "members_update_own" ON public.members
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Daily Links Policies
DROP POLICY IF EXISTS "daily_links_select" ON public.daily_links;
CREATE POLICY "daily_links_select" ON public.daily_links
    FOR SELECT TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));

-- Support Records Policies
DROP POLICY IF EXISTS "support_records_select" ON public.support_records;
CREATE POLICY "support_records_select" ON public.support_records
    FOR SELECT TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));

-- All Done Policies
DROP POLICY IF EXISTS "all_done_select" ON public.all_done;
CREATE POLICY "all_done_select" ON public.all_done
    FOR SELECT TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));

-- Point Transactions Policies
DROP POLICY IF EXISTS "point_tx_select" ON public.point_transactions;
CREATE POLICY "point_tx_select" ON public.point_transactions
    FOR SELECT TO authenticated
    USING (
        member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
        OR (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- Media Items Policies (Ch 18)
DROP POLICY IF EXISTS "media_items_admin" ON public.media_items;
CREATE POLICY "media_items_admin" ON public.media_items
    FOR ALL TO authenticated
    USING (
        community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid())
        AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

DROP POLICY IF EXISTS "media_items_select_member" ON public.media_items;
CREATE POLICY "media_items_select_member" ON public.media_items
    FOR SELECT TO authenticated
    USING (
        status = 'PUBLISHED'
        AND community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid())
    );

-- Movie Access Tokens (Ch 22)
DROP POLICY IF EXISTS "movie_tokens_own" ON public.movie_access_tokens;
CREATE POLICY "movie_tokens_own" ON public.movie_access_tokens
    FOR SELECT TO authenticated
    USING (member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- Archive Batches Policies (Ch 19)
DROP POLICY IF EXISTS "archive_batches_admin" ON public.archive_batches;
CREATE POLICY "archive_batches_admin" ON public.archive_batches
    FOR ALL TO authenticated
    USING (
        community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid())
        AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- Leaderboard Results & VIP (Ch 21)
DROP POLICY IF EXISTS "leaderboard_admin" ON public.leaderboard_results;
CREATE POLICY "leaderboard_admin" ON public.leaderboard_results
    FOR ALL TO authenticated
    USING (
        community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid())
        AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

DROP POLICY IF EXISTS "leaderboard_select" ON public.leaderboard_results;
CREATE POLICY "leaderboard_select" ON public.leaderboard_results
    FOR SELECT TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "vip_rewards_select_own" ON public.vip_reward_entitlements;
CREATE POLICY "vip_rewards_select_own" ON public.vip_reward_entitlements
    FOR SELECT TO authenticated
    USING (member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "vip_rewards_admin" ON public.vip_reward_entitlements;
CREATE POLICY "vip_rewards_admin" ON public.vip_reward_entitlements
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- ====================================================================
-- CHAPTER 11 — VIEWS FOR LEADERBOARD PERFORMANCE
-- ====================================================================

CREATE OR REPLACE VIEW public.daily_leaderboard_view AS
SELECT
    member_id,
    date,
    SUM(points) as total_points,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id::text FROM public.all_done WHERE fastest_rank = 1) THEN 1 END) as first_place_count,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id::text FROM public.all_done WHERE fastest_rank = 2) THEN 1 END) as second_place_count,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id::text FROM public.all_done WHERE fastest_rank = 3) THEN 1 END) as third_place_count
FROM public.point_transactions
GROUP BY member_id, date;

-- ====================================================================
-- END OF MASTER CONSOLIDATED MIGRATION (CHAPTERS 01-22)
-- ====================================================================
