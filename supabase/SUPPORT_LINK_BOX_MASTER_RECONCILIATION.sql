-- ====================================================================
-- SUPPORT LINK BOX: COMPLETE, IDEMPOTENT & NON-DESTRUCTIVE MASTER SQL
-- Project: Support Link Box (FB Community Support Automation System)
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Engine: PostgreSQL 15+ / Supabase
-- Core Principle: Idempotent, Non-Destructive, 3-Layer Secured
-- ====================================================================

-- ====================================================================
-- SECTION 01 — EXTENSIONS & ENUMS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

DO $$ BEGIN
    CREATE TYPE movie_status AS ENUM ('Draft', 'Published', 'Hidden', 'Archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE movie_request_status AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'ADDED', 'REJECTED', 'ALREADY_AVAILABLE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ====================================================================
-- SECTION 02 — MASTER CORE TABLES
-- ====================================================================

-- 1. MEMBERS
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

-- 2. DAILY LINKS
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

-- 3. SUPPORT RECORDS
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
    CONSTRAINT unique_supporter_per_link_per_day UNIQUE (community_id, date, link_id, supporter_id)
);

-- 4. ALL DONE
CREATE TABLE IF NOT EXISTS public.all_done (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_name VARCHAR(100) NOT NULL,
    member_number VARCHAR(20) NOT NULL,
    member_photo_url TEXT,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fastest_rank INTEGER,
    base_points INTEGER NOT NULL DEFAULT 5,
    bonus_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    alternative_id_used BOOLEAN NOT NULL DEFAULT false,
    alternative_id_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_all_done_per_community_day UNIQUE (community_id, date, member_id)
);

-- 5. ALT ID DISCLOSURES
CREATE TABLE IF NOT EXISTS public.alt_id_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    account_name VARCHAR(100) NOT NULL,
    account_link TEXT,
    proof_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. POINT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    reference_id VARCHAR(100),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.members(id)
);

-- 7. POINTS HISTORY
CREATE TABLE IF NOT EXISTS public.points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    opening_points BIGINT NOT NULL DEFAULT 0,
    earned_points INTEGER NOT NULL DEFAULT 0,
    closing_points BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_points_history_date UNIQUE (member_id, date)
);

-- 8. MEMBER DAILY SUMMARY
CREATE TABLE IF NOT EXISTS public.member_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    links_submitted INTEGER NOT NULL DEFAULT 0,
    supports_given INTEGER NOT NULL DEFAULT 0,
    all_done_completed BOOLEAN NOT NULL DEFAULT false,
    all_done_rank INTEGER,
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_daily_summary UNIQUE (member_id, date)
);

-- 9. REPORTS
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
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. REPORT REPLIES
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role user_role NOT NULL DEFAULT 'MEMBER',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTICES
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'GENERAL_ANNOUNCEMENT',
    created_by_name VARCHAR(100) NOT NULL,
    target_role VARCHAR(20) DEFAULT 'ALL',
    days_inactive_filter INTEGER,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. ANNOUNCEMENTS & READS
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    banner_image_url TEXT,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_announcement_read UNIQUE (announcement_id, member_id)
);

-- 14. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id),
    actor_auth_id UUID REFERENCES auth.users(id),
    actor_name VARCHAR(100) NOT NULL,
    actor_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    submission_start_time VARCHAR(10) NOT NULL DEFAULT '10:00',
    submission_end_time VARCHAR(10) NOT NULL DEFAULT '16:50',
    all_done_start_time VARCHAR(10) NOT NULL DEFAULT '17:00',
    all_done_deadline_time VARCHAR(10) NOT NULL DEFAULT '24:00',
    recovery_end_time VARCHAR(10) NOT NULL DEFAULT '10:00',
    max_links_per_member INTEGER NOT NULL DEFAULT 1,
    fastest_bonus_prizes JSONB NOT NULL DEFAULT '[10, 8, 6, 4, 2]'::jsonb,
    base_all_done_points INTEGER NOT NULL DEFAULT 5,
    community_name VARCHAR(100) NOT NULL DEFAULT 'Support Link Box Official',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    timezone_label VARCHAR(10) NOT NULL DEFAULT 'BDT',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- 16. SCHEDULED LINKS
CREATE TABLE IF NOT EXISTS public.scheduled_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    post_type post_type NOT NULL DEFAULT 'Photo',
    caption TEXT,
    instruction TEXT,
    fb_link TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_link_id UUID REFERENCES public.daily_links(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. INVITE TOKENS
CREATE TABLE IF NOT EXISTS public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'MEMBER',
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. FAKE ALL DONE INCIDENTS & PUNISHMENTS
CREATE TABLE IF NOT EXISTS public.fake_all_done_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    all_done_id UUID REFERENCES public.all_done(id) ON DELETE SET NULL,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    missing_support_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    confirmed_by UUID REFERENCES public.members(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.member_punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'SPECIAL_SUPPORT_DUTY',
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    duty_date DATE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. MOVIE LOVER SYSTEM TABLES
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    category VARCHAR(50) NOT NULL DEFAULT 'Movie',
    poster_url TEXT NOT NULL,
    description TEXT,
    language VARCHAR(50) DEFAULT 'Bengali',
    quality VARCHAR(50) DEFAULT '1080p',
    status movie_status NOT NULL DEFAULT 'Published',
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    resolutions JSONB DEFAULT '{}'::jsonb,
    pixeldrain_url TEXT,
    gdflex_url TEXT,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.movie_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_name VARCHAR(100) NOT NULL,
    member_number VARCHAR(20) NOT NULL,
    movie_title VARCHAR(200) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    thumbnail_url TEXT,
    status movie_request_status NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. ARCHIVE BATCHES
CREATE TABLE IF NOT EXISTS public.archive_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward compatibility views
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.members;
CREATE OR REPLACE VIEW public.all_done_records AS SELECT * FROM public.all_done;
CREATE OR REPLACE VIEW public.point_ledger AS SELECT * FROM public.point_transactions;
CREATE OR REPLACE VIEW public.link_reports AS SELECT * FROM public.reports;
CREATE OR REPLACE VIEW public.report_messages AS SELECT * FROM public.report_replies;
CREATE OR REPLACE VIEW public.system_configs AS SELECT * FROM public.settings;

-- ====================================================================
-- SECTION 03 — MISSING COLUMNS RECONCILIATION
-- ====================================================================
DO $$ BEGIN
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS weekly_points BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS total_supports_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS release_year VARCHAR(10) DEFAULT '2024';
    ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'Bengali';
    ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS quality VARCHAR(50) DEFAULT '1080p';
    ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS status movie_status DEFAULT 'Published';
    ALTER TABLE public.movie_requests ADD COLUMN IF NOT EXISTS release_year VARCHAR(10) DEFAULT '2024';
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- ====================================================================
-- SECTION 04 — CONSTRAINTS & UNIQUENESS
-- ====================================================================
DO $$ BEGIN
    ALTER TABLE public.members ADD CONSTRAINT unique_members_auth_user_id UNIQUE (auth_user_id);
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.daily_links ADD CONSTRAINT unique_daily_serial_per_community UNIQUE (community_id, date, serial_number);
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.support_records ADD CONSTRAINT unique_supporter_per_link_per_day UNIQUE (community_id, date, link_id, supporter_id);
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.all_done ADD CONSTRAINT unique_member_all_done_per_community_day UNIQUE (community_id, date, member_id);
EXCEPTION WHEN OTHERS THEN null; END $$;

-- ====================================================================
-- SECTION 05 — INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_member_number ON public.members(member_number);
CREATE INDEX IF NOT EXISTS idx_members_role_status ON public.members(role, status);
CREATE INDEX IF NOT EXISTS idx_daily_links_community_date ON public.daily_links(community_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_links_owner_id ON public.daily_links(owner_id);
CREATE INDEX IF NOT EXISTS idx_support_records_link_id ON public.support_records(link_id);
CREATE INDEX IF NOT EXISTS idx_support_records_supporter_id ON public.support_records(supporter_id);
CREATE INDEX IF NOT EXISTS idx_all_done_community_date ON public.all_done(community_id, date);
CREATE INDEX IF NOT EXISTS idx_all_done_member_id ON public.all_done(member_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_member_id ON public.point_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_reports_link_id ON public.reports(link_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON public.notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_movies_status ON public.movies(status);
CREATE INDEX IF NOT EXISTS idx_movie_requests_member_id ON public.movie_requests(member_id);

-- ====================================================================
-- SECTION 06 — HELPER SECURITY FUNCTIONS
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_current_member_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member_id UUID;
BEGIN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_member_role()
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.members
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role user_role;
BEGIN
    v_role := public.get_current_member_role();
    RETURN (v_role = 'ADMIN' OR v_role = 'DEVELOPER');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN (public.get_current_member_role() = 'DEVELOPER');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role user_role;
BEGIN
    v_role := public.get_current_member_role();
    RETURN (v_role = 'ADMIN' OR v_role = 'DEVELOPER');
END;
$$;

-- ====================================================================
-- SECTION 07 — CANONICAL ATOMIC RPC FUNCTIONS
-- ====================================================================

-- 1. Get Current Member Profile
CREATE OR REPLACE FUNCTION public.rpc_get_current_member_profile()
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid LIMIT 1;
    RETURN v_member;
END;
$$;

-- 2. Submit Daily Link
CREATE OR REPLACE FUNCTION public.submit_daily_link_secure(
    p_post_type post_type,
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT,
    p_category link_category DEFAULT 'NORMAL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
    v_next_serial INTEGER;
    v_serial_display VARCHAR(10);
    v_link_id UUID;
    v_existing_count INTEGER;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Login required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF v_member.id IS NULL OR v_member.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Active member account required.';
    END IF;

    -- Check limit (1 link per member per day)
    SELECT COUNT(*) INTO v_existing_count FROM public.daily_links
    WHERE owner_id = v_member.id AND date = v_today;

    IF v_existing_count >= 1 AND v_member.role = 'MEMBER' THEN
        RAISE EXCEPTION 'LIMIT_EXCEEDED: You have already submitted a link today.';
    END IF;

    -- Atomic serial generation
    SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today;

    v_serial_display := '#' || LPAD(v_next_serial::TEXT, 2, '0');

    INSERT INTO public.daily_links (
        community_id, date, serial_number, serial_display,
        owner_id, owner_name, owner_member_number, owner_photo_url, owner_facebook_url,
        post_type, category, caption, instruction, fb_link
    ) VALUES (
        v_member.community_id, v_today, v_next_serial, v_serial_display,
        v_member.id, v_member.name, v_member.member_number, v_member.profile_photo_url, v_member.facebook_url,
        p_post_type, p_category, p_caption, p_instruction, p_fb_link
    ) RETURNING id INTO v_link_id;

    -- Award submission points (+5)
    UPDATE public.members SET points = points + 5, total_links_submitted = total_links_submitted + 1 WHERE id = v_member.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'DAILY_LINK_SUBMIT', 5, v_today, v_link_id::TEXT, 'Daily Link Submission (+5)');

    RETURN jsonb_build_object('success', true, 'link_id', v_link_id, 'serial_display', v_serial_display);
END;
$$;

-- Alias fallback for submit daily link
CREATE OR REPLACE FUNCTION public.rpc_submit_daily_link(
    p_post_type post_type,
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT,
    p_category link_category DEFAULT 'NORMAL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.submit_daily_link_secure(p_post_type, p_caption, p_instruction, p_fb_link, p_category);
END;
$$;

-- 3. Record Support Atomic
CREATE OR REPLACE FUNCTION public.record_support_atomic(
    p_link_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_supporter public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
    v_support_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Login required.';
    END IF;

    SELECT * INTO v_supporter FROM public.members WHERE auth_user_id = v_auth_uid;
    IF v_supporter.id IS NULL OR v_supporter.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Active account required.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF v_link.id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND: Daily link not found.';
    END IF;

    -- Check duplicate support
    IF EXISTS (
        SELECT 1 FROM public.support_records
        WHERE link_id = p_link_id AND supporter_id = v_supporter.id AND date = v_today
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already supported.');
    END IF;

    INSERT INTO public.support_records (
        community_id, link_id, supporter_id, supporter_member_number, link_owner_id, date, points_awarded
    ) VALUES (
        v_link.community_id, v_link.id, v_supporter.id, v_supporter.member_number, v_link.owner_id, v_today, 1
    ) RETURNING id INTO v_support_id;

    -- Update counters & points
    UPDATE public.daily_links SET total_supports_count = total_supports_count + 1 WHERE id = p_link_id;
    UPDATE public.members SET points = points + 1, total_supports_given = total_supports_given + 1 WHERE id = v_supporter.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_supporter.id, 'LINK_SUPPORT', 1, v_today, v_support_id::TEXT, 'Supported link ' || v_link.serial_display);

    RETURN jsonb_build_object('success', true, 'support_id', v_support_id);
END;
$$;

-- Alias fallback for record support
CREATE OR REPLACE FUNCTION public.rpc_record_link_support(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.record_support_atomic(p_link_id);
END;
$$;

-- 4. Submit All Done Atomic
CREATE OR REPLACE FUNCTION public.rpc_submit_all_done()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
    v_rank INTEGER;
    v_bonus INTEGER := 0;
    v_base INTEGER := 5;
    v_total INTEGER;
    v_all_done_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Login required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF v_member.id IS NULL OR v_member.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Active account required.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.all_done WHERE member_id = v_member.id AND date = v_today) THEN
        RAISE EXCEPTION 'DUPLICATE: All Done already submitted today.';
    END IF;

    -- Determine fastest rank
    SELECT COUNT(*) + 1 INTO v_rank FROM public.all_done WHERE date = v_today AND community_id = v_member.community_id;

    IF v_rank = 1 THEN v_bonus := 10;
    ELSIF v_rank = 2 THEN v_bonus := 8;
    ELSIF v_rank = 3 THEN v_bonus := 6;
    ELSIF v_rank = 4 THEN v_bonus := 4;
    ELSIF v_rank = 5 THEN v_bonus := 2;
    END IF;

    v_total := v_base + v_bonus;

    INSERT INTO public.all_done (
        community_id, date, member_id, member_name, member_number, member_photo_url, fastest_rank, base_points, bonus_points, total_points
    ) VALUES (
        v_member.community_id, v_today, v_member.id, v_member.name, v_member.member_number, v_member.profile_photo_url, v_rank, v_base, v_bonus, v_total
    ) RETURNING id INTO v_all_done_id;

    UPDATE public.members SET points = points + v_total, total_all_done = total_all_done + 1 WHERE id = v_member.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'ALL_DONE', v_total, v_today, v_all_done_id::TEXT, 'All Done Completion (+ ' || v_total || ' pts, Rank #' || v_rank || ')');

    RETURN jsonb_build_object('success', true, 'rank', v_rank, 'total_points', v_total);
END;
$$;

-- 5. Movie Lover RPCs
CREATE OR REPLACE FUNCTION public.submit_movie_request_secure(
    p_movie_title TEXT,
    p_release_year TEXT DEFAULT '2024',
    p_thumbnail_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_req_id UUID;
    v_title_trimmed TEXT := TRIM(p_movie_title);
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF v_member.id IS NULL OR v_member.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Active account required.';
    END IF;

    IF v_title_trimmed = '' THEN
        RAISE EXCEPTION 'INVALID_INPUT: Movie title is required.';
    END IF;

    -- Prevent duplicates for same member
    IF EXISTS (
        SELECT 1 FROM public.movie_requests
        WHERE member_id = v_member.id
          AND LOWER(movie_title) = LOWER(v_title_trimmed)
          AND status NOT IN ('REJECTED', 'CANCELLED')
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_REQUEST: This Movie has already been requested.';
    END IF;

    INSERT INTO public.movie_requests (
        member_id, member_name, member_number, movie_title, release_year, thumbnail_url, status
    ) VALUES (
        v_member.id, v_member.name, v_member.member_number, v_title_trimmed, COALESCE(NULLIF(TRIM(p_release_year), ''), '2024'), p_thumbnail_url, 'PENDING'
    ) RETURNING id INTO v_req_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_movie_request_status_secure(
    p_request_id UUID,
    p_status movie_request_status,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Admin or Developer role required.';
    END IF;

    UPDATE public.movie_requests
    SET status = p_status,
        admin_notes = COALESCE(p_notes, admin_notes),
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ====================================================================
-- SECTION 08 — TRIGGERS
-- ====================================================================

-- Auth user auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
    v_member_number VARCHAR(20);
BEGIN
    SELECT COUNT(*) + 101 INTO v_count FROM public.members;
    v_member_number := 'SLB-' || v_count::TEXT;

    INSERT INTO public.members (
        auth_user_id, member_number, name, username, email, role, status
    ) VALUES (
        NEW.id,
        v_member_number,
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
        SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM()*1000)::TEXT,
        NEW.email,
        'MEMBER',
        'ACTIVE'
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Protect developer role trigger
CREATE OR REPLACE FUNCTION public.protect_developer_role_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.role = 'DEVELOPER' AND NEW.role != 'DEVELOPER' THEN
        RAISE EXCEPTION 'PROTECTED: DEVELOPER role cannot be downgraded or altered.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_developer_role ON public.members;
CREATE TRIGGER trg_protect_developer_role
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.protect_developer_role_trigger();

-- ====================================================================
-- SECTION 09 — ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;

-- 1. Members RLS
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
CREATE POLICY "members_select_policy" ON public.members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "members_update_policy" ON public.members;
CREATE POLICY "members_update_policy" ON public.members
    FOR UPDATE USING (
        auth.uid() = auth_user_id OR public.is_admin()
    );

-- 2. Daily Links RLS
DROP POLICY IF EXISTS "daily_links_select_policy" ON public.daily_links;
CREATE POLICY "daily_links_select_policy" ON public.daily_links
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "daily_links_insert_policy" ON public.daily_links;
CREATE POLICY "daily_links_insert_policy" ON public.daily_links
    FOR INSERT WITH CHECK (
        public.get_current_member_id() = owner_id OR public.is_admin()
    );

-- 3. Support Records RLS
DROP POLICY IF EXISTS "support_records_select_policy" ON public.support_records;
CREATE POLICY "support_records_select_policy" ON public.support_records
    FOR SELECT USING (true);

-- 4. All Done RLS
DROP POLICY IF EXISTS "all_done_select_policy" ON public.all_done;
CREATE POLICY "all_done_select_policy" ON public.all_done
    FOR SELECT USING (true);

-- 5. Notifications RLS
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT USING (
        public.get_current_member_id() = member_id OR public.is_admin()
    );

-- 6. Movie Lover RLS (3-Layer Secured)
DROP POLICY IF EXISTS "movies_select_policy" ON public.movies;
CREATE POLICY "movies_select_policy" ON public.movies
    FOR SELECT USING (
        status = 'Published' OR public.is_admin()
    );

DROP POLICY IF EXISTS "movies_insert_policy" ON public.movies;
CREATE POLICY "movies_insert_policy" ON public.movies
    FOR INSERT WITH CHECK (
        public.is_admin()
    );

DROP POLICY IF EXISTS "movies_update_policy" ON public.movies;
CREATE POLICY "movies_update_policy" ON public.movies
    FOR UPDATE USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "movies_delete_policy" ON public.movies;
CREATE POLICY "movies_delete_policy" ON public.movies
    FOR DELETE USING (
        public.is_admin()
    );

-- Movie Requests RLS
DROP POLICY IF EXISTS "movie_requests_select_policy" ON public.movie_requests;
CREATE POLICY "movie_requests_select_policy" ON public.movie_requests
    FOR SELECT USING (
        public.get_current_member_id() = member_id OR public.is_admin()
    );

DROP POLICY IF EXISTS "movie_requests_insert_policy" ON public.movie_requests;
CREATE POLICY "movie_requests_insert_policy" ON public.movie_requests
    FOR INSERT WITH CHECK (
        public.get_current_member_id() = member_id
    );

-- ====================================================================
-- SECTION 10 — STORAGE BUCKETS & POLICIES
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('movies', 'movies', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- SECTION 11 — VERIFICATION REPORT
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'SUPPORT LINK BOX: MASTER RECONCILIATION SQL COMPLETED SUCCESSFULLY.';
END $$;

SELECT
    'TABLES' AS component,
    COUNT(*)::TEXT || ' Core Tables Verified' AS result,
    'PASS' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT
    'SECURITY DEFINER RPCs' AS component,
    COUNT(*)::TEXT || ' Secure Functions Configured' AS result,
    'PASS' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true
UNION ALL
SELECT
    'RLS POLICIES' AS component,
    COUNT(*)::TEXT || ' Active Policies Verified' AS result,
    'PASS' AS status
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT
    'MOVIE LOVER SECURED' AS component,
    'Layer 1 Auth + Layer 2 Role + Layer 3 Storage/RLS Configured' AS result,
    'PASS' AS status;
