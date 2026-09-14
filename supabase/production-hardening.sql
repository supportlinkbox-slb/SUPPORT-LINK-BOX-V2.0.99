-- ====================================================================
-- SUPPORT LINK BOX: CHAPTER 01 — FOUNDATION & SYSTEM ARCHITECTURE
-- Production Hardening & Architectural Grounding Migration
-- Target Timezone: Asia/Dhaka (BDT = UTC+6)
-- Engine: PostgreSQL 15+ / Supabase
-- ====================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS & DOMAINS
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

-- 2. CRITICAL DATA TABLES (ALL 18 REQUIRED APPLICATION TABLES)

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
    CONSTRAINT unique_supporter_per_link_per_day UNIQUE (community_id, date, link_id, supporter_id)
);

-- Table 4: all_done (All Done completion & fastest ranking)
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
    base_points INTEGER NOT NULL DEFAULT 3,
    bonus_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    alternative_id_used BOOLEAN NOT NULL DEFAULT false,
    alternative_id_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_all_done_per_community_day UNIQUE (community_id, date, member_id)
);

-- Table 5: alt_id_disclosures (Alternative Facebook accounts used for support)
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

-- Table 6: point_transactions (Immutable financial-grade points ledger)
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
    sender_role user_role NOT NULL DEFAULT 'MEMBER',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 9: scheduled_links (Future automated link queue)
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

-- Table 10: announcements (Broadcasts from Admin & Developers)
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

-- Table 11: announcement_reads (Tracking member read receipts)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_announcement_read UNIQUE (announcement_id, member_id)
);

-- Table 12: notices (Warnings, notices & alerts)
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

-- Table 13: notifications (Database event-driven alerts for members)
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

-- Table 14: audit_logs (Tamper-resistant append-only operational log)
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

-- Table 15: settings (System-wide configuration, window schedules in BDT)
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
    base_all_done_points INTEGER NOT NULL DEFAULT 3,
    community_name VARCHAR(100) NOT NULL DEFAULT 'Support Link Box Official',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    timezone_label VARCHAR(10) NOT NULL DEFAULT 'BDT',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Table 16: points_history (Historical daily snapshots per member)
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

-- Table 17: member_daily_summary (Pre-aggregated daily activity summary)
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

-- Table 18: archive_batches (Historical cold-storage batches)
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

-- Compatibility views for smooth transition from previous naming
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.members;
CREATE OR REPLACE VIEW public.all_done_records AS SELECT * FROM public.all_done;
CREATE OR REPLACE VIEW public.point_ledger AS SELECT * FROM public.point_transactions;
CREATE OR REPLACE VIEW public.link_reports AS SELECT * FROM public.reports;
CREATE OR REPLACE VIEW public.report_messages AS SELECT * FROM public.report_replies;
CREATE OR REPLACE VIEW public.system_configs AS SELECT * FROM public.settings;

-- 3. INDEXING FOUNDATION
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_member_number ON public.members(member_number);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.members(role);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_community_id ON public.members(community_id);

CREATE INDEX IF NOT EXISTS idx_daily_links_comm_date ON public.daily_links(community_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_links_comm_date_serial ON public.daily_links(community_id, date, serial_number);
CREATE INDEX IF NOT EXISTS idx_daily_links_comm_date_owner ON public.daily_links(community_id, date, owner_id);

CREATE INDEX IF NOT EXISTS idx_support_records_comm_date ON public.support_records(community_id, date);
CREATE INDEX IF NOT EXISTS idx_support_records_supporter ON public.support_records(supporter_id);
CREATE INDEX IF NOT EXISTS idx_support_records_link ON public.support_records(link_id);
CREATE INDEX IF NOT EXISTS idx_support_records_comm_date_supporter ON public.support_records(community_id, date, supporter_id);

CREATE INDEX IF NOT EXISTS idx_all_done_comm_date ON public.all_done(community_id, date);
CREATE INDEX IF NOT EXISTS idx_all_done_member ON public.all_done(member_id);
CREATE INDEX IF NOT EXISTS idx_all_done_comm_date_member ON public.all_done(community_id, date, member_id);

CREATE INDEX IF NOT EXISTS idx_point_transactions_member ON public.point_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON public.point_transactions(date);
CREATE INDEX IF NOT EXISTS idx_point_transactions_activity ON public.point_transactions(activity_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_reports_member ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_link ON public.reports(link_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 4. SERVER-SIDE TIMEZONE & IDENTITY HELPER FUNCTIONS

-- BDT Date & Time helpers
CREATE OR REPLACE FUNCTION public.get_bangladesh_now()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
    SELECT (NOW() AT TIME ZONE 'Asia/Dhaka');
$$;

CREATE OR REPLACE FUNCTION public.get_bangladesh_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
$$;

-- Server-Authoritative Identity Helpers
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

CREATE OR REPLACE FUNCTION public.is_current_user_developer()
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
    RETURN (v_role = 'DEVELOPER');
END;
$$;

-- 5. ATOMIC BUSINESS STORED PROCEDURES (RPCS)

-- A. Submit Daily Link (Server-assigned serial, locking & atomic points)
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
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
    v_next_serial INTEGER;
    v_serial_display VARCHAR(10);
    v_part_number INTEGER;
    v_link_id UUID;
    v_existing_count INTEGER;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Member profile not provisioned.';
    END IF;

    IF v_member.status = 'SUSPENDED' OR v_member.status = 'FROZEN' THEN
        RAISE EXCEPTION 'MEMBER_INACTIVE: Account is currently %.', v_member.status;
    END IF;

    -- Normal members: 1 link per day limit
    IF v_member.role = 'MEMBER' AND p_category = 'NORMAL' THEN
        SELECT COUNT(*) INTO v_existing_count 
        FROM public.daily_links 
        WHERE community_id = v_member.community_id AND date = v_today AND owner_id = v_member.id;

        IF v_existing_count >= 1 THEN
            RAISE EXCEPTION 'LINK_ALREADY_SUBMITTED: You have already submitted a link for today.';
        END IF;
    END IF;

    -- Concurrency-safe serial numbering with advisory transaction lock
    PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_member.community_id || '_' || v_today::text));

    SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today;

    v_serial_display := LPAD(v_next_serial::text, 2, '0');
    v_part_number := CEIL(v_next_serial::numeric / 20.0);

    -- Insert authoritative record
    INSERT INTO public.daily_links (
        community_id,
        date,
        serial_number,
        serial_display,
        part_number,
        owner_id,
        owner_name,
        owner_member_number,
        owner_photo_url,
        owner_facebook_url,
        post_type,
        category,
        caption,
        instruction,
        fb_link,
        submitted_at,
        can_edit_until
    ) VALUES (
        v_member.community_id,
        v_today,
        v_next_serial,
        v_serial_display,
        v_part_number,
        v_member.id,
        v_member.name,
        v_member.member_number,
        v_member.profile_photo_url,
        v_member.facebook_url,
        p_post_type,
        p_category,
        p_caption,
        p_instruction,
        p_fb_link,
        NOW(),
        NOW() + INTERVAL '2 minutes'
    ) RETURNING id INTO v_link_id;

    -- Record point transactions (+5 submission, +2 on-time bonus)
    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES 
        (v_member.id, 'DAILY_LINK_SUBMIT', 5, v_today, v_link_id::text, 'Daily Link Submission #' || v_serial_display),
        (v_member.id, 'ON_TIME_SUBMISSION', 2, v_today, v_link_id::text, 'On-time link submission bonus');

    -- Update member aggregated points
    UPDATE public.members
    SET points = points + 7,
        weekly_points = weekly_points + 7,
        total_links_submitted = total_links_submitted + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

    -- Append audit log
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_member.id, v_auth_uid, v_member.name, v_member.role, 'SUBMIT_DAILY_LINK', 'DAILY_LINK', v_link_id::text, 'Submitted #' || v_serial_display);

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_link_id,
        'serial_number', v_next_serial,
        'serial_display', v_serial_display,
        'part_number', v_part_number
    );
END;
$$;

-- B. Record Verified Link Support (+1 Point, Self-Support & Duplicate Guarded)
CREATE OR REPLACE FUNCTION public.rpc_record_link_support(p_link_id UUID)
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
    v_record_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_supporter FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Supporter profile not found.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINK_NOT_FOUND: Target link not found.';
    END IF;

    -- Rule: Self support strictly disallowed
    IF v_link.owner_id = v_supporter.id THEN
        RAISE EXCEPTION 'SELF_SUPPORT_FORBIDDEN: You cannot support your own link.';
    END IF;

    -- Duplicate check
    IF EXISTS (
        SELECT 1 FROM public.support_records 
        WHERE link_id = p_link_id AND supporter_id = v_supporter.id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_SUPPORTED', 'message', 'Already supported this link.');
    END IF;

    -- Insert support record
    INSERT INTO public.support_records (
        community_id,
        link_id,
        supporter_id,
        supporter_member_number,
        link_owner_id,
        date,
        supported_at,
        points_awarded
    ) VALUES (
        v_link.community_id,
        p_link_id,
        v_supporter.id,
        v_supporter.member_number,
        v_link.owner_id,
        v_today,
        NOW(),
        1
    ) RETURNING id INTO v_record_id;

    -- Update link total supports count
    UPDATE public.daily_links
    SET total_supports_count = total_supports_count + 1
    WHERE id = p_link_id;

    -- Award +1 point to supporter
    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_supporter.id, 'SUPPORT_COMPLETE', 1, v_today, p_link_id::text, 'Supported link #' || v_link.serial_display);

    UPDATE public.members
    SET points = points + 1,
        weekly_points = weekly_points + 1,
        total_supports_given = total_supports_given + 1,
        last_active_at = NOW()
    WHERE id = v_supporter.id;

    RETURN jsonb_build_object('success', true, 'support_id', v_record_id);
END;
$$;

-- C. Atomic All Done Submission (Verification, Fastest Rank, & Points Award)
CREATE OR REPLACE FUNCTION public.rpc_submit_all_done(
    p_alternative_id_used BOOLEAN DEFAULT false,
    p_alternative_id_details JSONB DEFAULT NULL
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
    v_total_required_links INTEGER;
    v_supported_count INTEGER;
    v_existing_all_done_count INTEGER;
    v_rank INTEGER := NULL;
    v_base_points INTEGER := 3;
    v_bonus_points INTEGER := 0;
    v_total_points INTEGER;
    v_all_done_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Member profile not found.';
    END IF;

    -- Duplicate check
    IF EXISTS (
        SELECT 1 FROM public.all_done 
        WHERE community_id = v_member.community_id AND date = v_today AND member_id = v_member.id
    ) THEN
        RAISE EXCEPTION 'ALL_DONE_ALREADY_SUBMITTED: You have already submitted All Done for today.';
    END IF;

    -- Verify support obligations: all links of today except own
    SELECT COUNT(*) INTO v_total_required_links
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today AND owner_id <> v_member.id;

    SELECT COUNT(DISTINCT link_id) INTO v_supported_count
    FROM public.support_records
    WHERE community_id = v_member.community_id AND date = v_today AND supporter_id = v_member.id;

    IF v_supported_count < v_total_required_links THEN
        RAISE EXCEPTION 'SUPPORT_REQUIREMENTS_INCOMPLETE: Cannot submit All Done! You have supported % of % required links.', v_supported_count, v_total_required_links;
    END IF;

    -- Concurrency-safe rank determination
    PERFORM pg_advisory_xact_lock(hashtext('slb_alldone_rank_' || v_member.community_id || '_' || v_today::text));

    SELECT COUNT(*) INTO v_existing_all_done_count
    FROM public.all_done
    WHERE community_id = v_member.community_id AND date = v_today;

    IF v_existing_all_done_count = 0 THEN
        v_rank := 1; v_bonus_points := 10;
    ELSIF v_existing_all_done_count = 1 THEN
        v_rank := 2; v_bonus_points := 8;
    ELSIF v_existing_all_done_count = 2 THEN
        v_rank := 3; v_bonus_points := 6;
    ELSIF v_existing_all_done_count = 3 THEN
        v_rank := 4; v_bonus_points := 4;
    ELSIF v_existing_all_done_count = 4 THEN
        v_rank := 5; v_bonus_points := 2;
    ELSE
        v_rank := NULL; v_bonus_points := 0;
    END IF;

    v_total_points := v_base_points + v_bonus_points;

    -- Insert All Done record
    INSERT INTO public.all_done (
        community_id,
        date,
        member_id,
        member_name,
        member_number,
        member_photo_url,
        completed_at,
        fastest_rank,
        base_points,
        bonus_points,
        total_points,
        status,
        alternative_id_used,
        alternative_id_details
    ) VALUES (
        v_member.community_id,
        v_today,
        v_member.id,
        v_member.name,
        v_member.member_number,
        v_member.profile_photo_url,
        NOW(),
        v_rank,
        v_base_points,
        v_bonus_points,
        v_total_points,
        'VERIFIED',
        p_alternative_id_used,
        p_alternative_id_details
    ) RETURNING id INTO v_all_done_id;

    -- Record point ledger entries
    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'ALL_DONE', v_base_points, v_today, v_all_done_id::text, 'Daily All Done completed');

    IF v_bonus_points > 0 THEN
        INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
        VALUES (v_member.id, 'FASTEST_ALL_DONE', v_bonus_points, v_today, v_all_done_id::text, 'Fastest All Done Rank #' || v_rank);
    END IF;

    -- Update member profile
    UPDATE public.members
    SET points = points + v_total_points,
        weekly_points = weekly_points + v_total_points,
        total_all_done = total_all_done + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_member.id, v_auth_uid, v_member.name, v_member.role, 'SUBMIT_ALL_DONE', 'ALL_DONE', v_all_done_id::text, 'Completed All Done. Rank: ' || COALESCE(v_rank::text, 'Standard'));

    RETURN jsonb_build_object(
        'success', true,
        'all_done_id', v_all_done_id,
        'fastest_rank', v_rank,
        'bonus_points', v_bonus_points,
        'total_points', v_total_points
    );
END;
$$;

-- D. Protected Role Management (Chapter 04 Authoritative Access Control)
CREATE OR REPLACE FUNCTION public.change_member_role(
    p_target_id UUID,
    p_new_role user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_old_role user_role;
BEGIN
    IF v_actor_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_actor_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'DEVELOPER' AND v_actor.role <> 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin or Developer role required.';
    END IF;

    IF v_actor.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active account required.';
    END IF;

    -- Row lock target to prevent race conditions
    SELECT * INTO v_target FROM public.members WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Target member not found.';
    END IF;

    v_old_role := v_target.role;

    -- Community isolation: Admin cannot manage members of another community
    IF v_actor.role <> 'DEVELOPER' AND v_actor.community_id <> v_target.community_id THEN
        RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED: Cannot manage members of another community.';
    END IF;

    -- Developer Protection: Cannot be demoted or modified by normal Admin
    IF v_target.role = 'DEVELOPER' AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be modified by Admins.';
    END IF;

    -- Developer Protection: Normal Admin cannot create/promote to Developer
    IF p_new_role = 'DEVELOPER' AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'DEVELOPER_PROTECTED: Only Developers can establish Developer role.';
    END IF;

    -- Set internal session flag to allow trigger to permit authoritative role change
    PERFORM set_config('slb.internal_role_change', 'true', true);

    UPDATE public.members
    SET role = p_new_role,
        updated_at = NOW()
    WHERE id = p_target_id;

    -- Audit record for role change
    INSERT INTO public.audit_logs (
        actor_id,
        actor_auth_id,
        actor_name,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_actor.id,
        v_actor_auth_uid,
        v_actor.name,
        v_actor.role,
        'ROLE_CHANGED',
        'MEMBER',
        p_target_id::text,
        'Role changed from ' || v_old_role || ' to ' || p_new_role || ' (Community: ' || v_target.community_id || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'old_role', v_old_role,
        'new_role', p_new_role
    );
END;
$$;

-- Alias for backward-compatibility
CREATE OR REPLACE FUNCTION public.rpc_update_member_role(
    p_target_id UUID,
    p_new_role user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.change_member_role(p_target_id, p_new_role);
END;
$$;

-- E. Protected Member Status Management (Developer Protected & Community Isolated)
CREATE OR REPLACE FUNCTION public.set_member_status_secure(
    p_target_id UUID,
    p_new_status member_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_old_status member_status;
BEGIN
    IF v_actor_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_actor_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'DEVELOPER' AND v_actor.role <> 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin or Developer role required.';
    END IF;

    IF v_actor.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active account required.';
    END IF;

    -- Row lock target to prevent race condition
    SELECT * INTO v_target FROM public.members WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Target member not found.';
    END IF;

    v_old_status := v_target.status;

    -- Community isolation: Admin cannot manage members of another community
    IF v_actor.role <> 'DEVELOPER' AND v_actor.community_id <> v_target.community_id THEN
        RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED: Cannot manage members of another community.';
    END IF;

    -- Developer Protection: Developer accounts cannot be frozen or suspended
    IF v_target.role = 'DEVELOPER' THEN
        RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be frozen or suspended.';
    END IF;

    -- Prevent self-suspension/freezing
    IF v_actor.id = p_target_id AND (p_new_status = 'SUSPENDED' OR p_new_status = 'FROZEN') THEN
        RAISE EXCEPTION 'FORBIDDEN: Self-suspension or freezing is not permitted.';
    END IF;

    -- Set internal session flag to allow trigger to permit authoritative status change
    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_target_id;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_auth_id,
        actor_name,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_actor.id,
        v_actor_auth_uid,
        v_actor.name,
        v_actor.role,
        'STATUS_CHANGED',
        'MEMBER',
        p_target_id::text,
        'Status changed from ' || v_old_status || ' to ' || p_new_status || ' (Community: ' || v_target.community_id || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'old_status', v_old_status,
        'new_status', p_new_status
    );
END;
$$;

-- Alias for backward-compatibility
CREATE OR REPLACE FUNCTION public.rpc_update_member_status(
    p_target_id UUID,
    p_new_status member_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.set_member_status_secure(p_target_id, p_new_status);
END;
$$;

-- Trigger: Direct Table Write Protection (Section 22, 23, 25, 42, 55)
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'DEVELOPER' THEN
            RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: auth_user_id is immutable.';
    END IF;

    IF NEW.member_number IS DISTINCT FROM OLD.member_number THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: member_number is immutable.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF current_setting('slb.internal_role_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct role update is prohibited. Use change_member_role() RPC.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF current_setting('slb.internal_status_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct status update is prohibited. Use set_member_status_secure() RPC.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_security_guard ON public.members;
CREATE TRIGGER trg_members_security_guard
    BEFORE UPDATE OR DELETE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.trg_protect_member_security_fields();

-- F. Safe Profile Fetch for Authenticated User
CREATE OR REPLACE FUNCTION public.rpc_get_current_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile', to_jsonb(v_member)
    );
END;
$$;

-- G. Secure Developer Bootstrap
CREATE OR REPLACE FUNCTION public.rpc_bootstrap_developer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_auth_email TEXT;
    v_existing_dev_count INTEGER;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;

    -- Bootstrap permitted for designated project email or if no developer exists yet
    SELECT COUNT(*) INTO v_existing_dev_count FROM public.members WHERE role = 'DEVELOPER';

    IF v_auth_email = 'supportlinkbox@gmail.com' OR v_existing_dev_count = 0 THEN
        UPDATE public.members
        SET role = 'DEVELOPER'
        WHERE auth_user_id = v_auth_uid;

        INSERT INTO public.audit_logs (actor_auth_id, actor_name, actor_role, action, target_type, details)
        VALUES (v_auth_uid, COALESCE(v_auth_email, 'Developer'), 'DEVELOPER', 'BOOTSTRAP_DEVELOPER', 'MEMBER', 'Elevated to protected Developer role');

        RETURN jsonb_build_object('success', true, 'message', 'Developer role successfully assigned.');
    ELSE
        RAISE EXCEPTION 'Bootstrap not permitted.';
    END IF;
END;
$$;

-- 6. AUTOMATIC MEMBER PROVISIONING TRIGGER ON USER SIGNUP (CHAPTER 02)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_int INTEGER;
    v_member_num VARCHAR(20);
    v_initial_role user_role := 'MEMBER';
    v_norm_email VARCHAR(150);
    v_name VARCHAR(100);
    v_username VARCHAR(50);
BEGIN
    -- Normalize email
    v_norm_email := LOWER(TRIM(NEW.email));

    -- Server-generated safe sequential member number
    SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::integer), 100) + 1
    INTO v_next_int FROM public.members;
    v_member_num := 'SLB-' || LPAD(v_next_int::text, 3, '0');

    -- Auto-assign Developer role ONLY for designated developer email
    -- Chapter 2 Rule 14 & 15: All other public registrations MUST be 'MEMBER'
    IF v_norm_email = 'supportlinkbox@gmail.com' THEN
        v_initial_role := 'DEVELOPER';
    ELSE
        v_initial_role := 'MEMBER';
    END IF;

    -- Extract safe display names
    v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(v_norm_email, '@', 1));
    v_username := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4));

    -- Insert into members table. Note: All privileged fields (role, points, etc.) are strictly server-enforced
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
        profile_photo_url,
        points,
        weekly_points,
        total_links_submitted,
        total_supports_given,
        total_all_done,
        community_id
    ) VALUES (
        NEW.id,
        v_member_num,
        v_name,
        v_username,
        v_norm_email,
        v_initial_role,
        'ACTIVE',
        NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_url'), ''),
        COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'),
        0,
        0,
        0,
        0,
        0,
        'main'
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES ON ALL TABLES
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

-- Members Policies
DROP POLICY IF EXISTS "Members readable by authenticated" ON public.members;
CREATE POLICY "Members readable by authenticated"
    ON public.members FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Members updateable by owner" ON public.members;
CREATE POLICY "Members updateable by owner"
    ON public.members FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Daily Links Policies
DROP POLICY IF EXISTS "Daily links readable by all authenticated" ON public.daily_links;
CREATE POLICY "Daily links readable by all authenticated"
    ON public.daily_links FOR SELECT
    TO authenticated
    USING (true);

-- Support Records Policies
DROP POLICY IF EXISTS "Support records readable by all authenticated" ON public.support_records;
CREATE POLICY "Support records readable by all authenticated"
    ON public.support_records FOR SELECT
    TO authenticated
    USING (true);

-- All Done Policies
DROP POLICY IF EXISTS "All Done records viewable by community" ON public.all_done;
CREATE POLICY "All Done records viewable by community"
    ON public.all_done FOR SELECT
    TO authenticated
    USING (true);

-- Point Transactions Policies (Read own, admins read all)
DROP POLICY IF EXISTS "Point transactions readable by owner or admin" ON public.point_transactions;
CREATE POLICY "Point transactions readable by owner or admin"
    ON public.point_transactions FOR SELECT
    TO authenticated
    USING (
        member_id = public.get_current_member_id() 
        OR public.is_current_user_admin_or_dev()
    );

-- Audit Logs Policies (Read only by Admin / Developer)
DROP POLICY IF EXISTS "Audit logs readable only by Admin or Developer" ON public.audit_logs;
CREATE POLICY "Audit logs readable only by Admin or Developer"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_current_user_admin_or_dev());

-- Reports Policies (Reporter or Admin/Dev can read)
DROP POLICY IF EXISTS "Reports viewable by reporter or admin" ON public.reports;
CREATE POLICY "Reports viewable by reporter or admin"
    ON public.reports FOR SELECT
    TO authenticated
    USING (
        reporter_id = public.get_current_member_id()
        OR link_owner_id = public.get_current_member_id()
        OR public.is_current_user_admin_or_dev()
    );

DROP POLICY IF EXISTS "Reports insertable by authenticated members" ON public.reports;
CREATE POLICY "Reports insertable by authenticated members"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = public.get_current_member_id());

-- Report Replies
DROP POLICY IF EXISTS "Replies readable by report participants or admin" ON public.report_replies;
CREATE POLICY "Replies readable by report participants or admin"
    ON public.report_replies FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Replies insertable by authenticated" ON public.report_replies;
CREATE POLICY "Replies insertable by authenticated"
    ON public.report_replies FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = public.get_current_member_id());

-- Notices Policies
DROP POLICY IF EXISTS "Notices viewable by authenticated users" ON public.notices;
CREATE POLICY "Notices viewable by authenticated users"
    ON public.notices FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Notices manageable by admin" ON public.notices;
CREATE POLICY "Notices manageable by admin"
    ON public.notices FOR ALL
    TO authenticated
    USING (public.is_current_user_admin_or_dev());

-- Announcements Policies
DROP POLICY IF EXISTS "Announcements viewable by all authenticated" ON public.announcements;
CREATE POLICY "Announcements viewable by all authenticated"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (true);

-- Notifications Policies
DROP POLICY IF EXISTS "Notifications viewable only by owner" ON public.notifications;
CREATE POLICY "Notifications viewable only by owner"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (member_id = public.get_current_member_id());

-- Settings Policies (Read-only for normal members, updateable by admin/dev)
DROP POLICY IF EXISTS "Settings viewable by all authenticated" ON public.settings;
CREATE POLICY "Settings viewable by all authenticated"
    ON public.settings FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Settings updateable by admin" ON public.settings;
CREATE POLICY "Settings updateable by admin"
    ON public.settings FOR UPDATE
    TO authenticated
    USING (public.is_current_user_admin_or_dev());

-- ====================================================================
-- 7. CLEANUP & DEPRECATION OF INSECURE LEGACY FUNCTIONS (Section 55/85)
-- ====================================================================
DROP FUNCTION IF EXISTS public.award_member_points_atomic;
DROP FUNCTION IF EXISTS public.award_points;
DROP FUNCTION IF EXISTS public.admin_set_member_points;
DROP FUNCTION IF EXISTS public.insert_daily_link;
DROP FUNCTION IF EXISTS public.assign_serial_number;

-- ====================================================================
-- 8. CHAPTER 07 — LINK EDIT, DELETE & SCHEDULING SYSTEM (Authoritative RPCs)
-- ====================================================================

-- 8.1 Schema Adjustments for Soft Deletion & Extended Scheduled Links
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS removed_by_id UUID REFERENCES public.members(id);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS removed_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_daily_links_active ON public.daily_links(community_id, date, status);

-- Enhance scheduled_links table
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS target_time VARCHAR(10) DEFAULT '10:00';
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS category link_category NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS scheduled_by_admin_id UUID REFERENCES public.members(id);
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS execution_attempts INTEGER NOT NULL DEFAULT 0;

-- Ensure uniqueness per member per target day for normal scheduled links
CREATE UNIQUE INDEX IF NOT EXISTS unique_scheduled_member_target_date 
ON public.scheduled_links(community_id, owner_id, target_date)
WHERE (status = 'pending' AND category = 'NORMAL');

CREATE INDEX IF NOT EXISTS idx_scheduled_links_due 
ON public.scheduled_links(status, target_date, target_time);

-- 8.2 RPC: edit_daily_link_secure
-- Enforces 2-minute server-calculated window for normal members, unrestricted for Admins/Devs
CREATE OR REPLACE FUNCTION public.edit_daily_link_secure(
    p_link_id UUID,
    p_post_type post_type,
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT
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
    v_now TIMESTAMPTZ := NOW();
    v_is_privileged BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Actor profile not provisioned.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINK_NOT_FOUND: Target link not found.';
    END IF;

    IF v_link.status = 'removed' THEN
        RAISE EXCEPTION 'LINK_REMOVED: This link has already been removed.';
    END IF;

    v_is_privileged := (v_actor.role = 'ADMIN' OR v_actor.role = 'DEVELOPER');

    -- Community isolation
    IF v_link.community_id <> v_actor.community_id AND NOT v_is_privileged THEN
        RAISE EXCEPTION 'COMMUNITY_MISMATCH: Unauthorized cross-community access.';
    END IF;

    -- Authorization & 2-Minute Window Check
    IF NOT v_is_privileged THEN
        IF v_link.owner_id <> v_actor.id THEN
            RAISE EXCEPTION 'FORBIDDEN: You cannot edit another member''s link.';
        END IF;

        -- Strictly check server-calculated timestamp
        IF v_now > v_link.can_edit_until THEN
            RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED: 2-minute edit window expired at %', v_link.can_edit_until;
        END IF;
    END IF;

    -- Validate Facebook URL
    IF p_fb_link IS NULL OR (
        p_fb_link NOT LIKE 'https://%facebook.com/%' AND
        p_fb_link NOT LIKE 'https://%fb.watch/%' AND
        p_fb_link NOT LIKE 'https://%fb.me/%' AND
        p_fb_link NOT LIKE 'https://%m.facebook.com/%'
    ) THEN
        RAISE EXCEPTION 'INVALID_URL: Must be an authorized Facebook post link.';
    END IF;

    -- Atomically update content fields ONLY (link_number, serial, owner, category, points remain immutable)
    UPDATE public.daily_links
    SET post_type = p_post_type,
        caption = TRIM(COALESCE(p_caption, '')),
        instruction = TRIM(COALESCE(p_instruction, 'Like and Comment')),
        fb_link = TRIM(p_fb_link)
    WHERE id = p_link_id;

    -- Audit history
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_actor.id, 
        v_auth_uid, 
        v_actor.name, 
        v_actor.role, 
        'LINK_EDITED', 
        'DAILY_LINK', 
        p_link_id::text, 
        'Edited link #' || v_link.serial_display || ' (Owner: ' || v_link.owner_name || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'link_id', p_link_id,
        'serial_number', v_link.serial_number,
        'serial_display', v_link.serial_display
    );
END;
$$;

-- 8.3 RPC: remove_daily_link_secure
-- Performs controlled soft-deletion (status = 'removed') retaining audit and support references
CREATE OR REPLACE FUNCTION public.remove_daily_link_secure(
    p_link_id UUID,
    p_reason TEXT DEFAULT 'Removed by user request'
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
    v_now TIMESTAMPTZ := NOW();
    v_is_privileged BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Actor profile not provisioned.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINK_NOT_FOUND: Target link not found.';
    END IF;

    IF v_link.status = 'removed' THEN
        RAISE EXCEPTION 'ALREADY_REMOVED: This link is already removed.';
    END IF;

    v_is_privileged := (v_actor.role = 'ADMIN' OR v_actor.role = 'DEVELOPER');

    -- Community isolation
    IF v_link.community_id <> v_actor.community_id AND NOT v_is_privileged THEN
        RAISE EXCEPTION 'COMMUNITY_MISMATCH: Unauthorized cross-community access.';
    END IF;

    -- Authorization & 2-Minute Window Check
    IF NOT v_is_privileged THEN
        IF v_link.owner_id <> v_actor.id THEN
            RAISE EXCEPTION 'FORBIDDEN: You cannot remove another member''s link.';
        END IF;

        IF v_now > v_link.can_edit_until THEN
            RAISE EXCEPTION 'DELETE_WINDOW_EXPIRED: 2-minute deletion window expired at %', v_link.can_edit_until;
        END IF;
    END IF;

    -- Soft delete: mark removed and keep historical link_number intact
    UPDATE public.daily_links
    SET status = 'removed',
        removed_at = v_now,
        removed_by_id = v_actor.id,
        removed_reason = COALESCE(p_reason, 'No reason specified')
    WHERE id = p_link_id;

    -- Audit history
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_actor.id, 
        v_auth_uid, 
        v_actor.name, 
        v_actor.role, 
        'LINK_REMOVED', 
        'DAILY_LINK', 
        p_link_id::text, 
        'Removed link #' || v_link.serial_display || '. Reason: ' || COALESCE(p_reason, 'None')
    );

    RETURN jsonb_build_object(
        'success', true,
        'link_id', p_link_id,
        'serial_number', v_link.serial_number,
        'serial_display', v_link.serial_display
    );
END;
$$;

-- 8.4 RPC: create_scheduled_link_secure
-- Validates one-day-early rule (opens 12:00 PM BDT), derives owner, does NOT assign serial number yet
CREATE OR REPLACE FUNCTION public.create_scheduled_link_secure(
    p_target_date DATE,
    p_post_type post_type,
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT,
    p_category link_category DEFAULT 'NORMAL',
    p_target_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target_member public.members%ROWTYPE;
    v_now_bdt TIMESTAMP := (NOW() AT TIME ZONE 'Asia/Dhaka');
    v_today_bdt DATE := v_now_bdt::date;
    v_tomorrow_bdt DATE := (v_today_bdt + INTERVAL '1 day')::date;
    v_current_minutes INTEGER;
    v_is_privileged BOOLEAN;
    v_schedule_id UUID;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Actor profile not provisioned.';
    END IF;

    v_is_privileged := (v_actor.role = 'ADMIN' OR v_actor.role = 'DEVELOPER');

    -- Resolve target member
    IF p_target_member_id IS NOT NULL AND p_target_member_id <> v_actor.id THEN
        IF NOT v_is_privileged THEN
            RAISE EXCEPTION 'FORBIDDEN: Only Admins can schedule links on behalf of other members.';
        END IF;
        SELECT * INTO v_target_member FROM public.members WHERE id = p_target_member_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'TARGET_NOT_FOUND: Target member profile not found.';
        END IF;
    ELSE
        v_target_member := v_actor;
    END IF;

    IF v_target_member.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'MEMBER_INACTIVE: Target account is %.', v_target_member.status;
    END IF;

    -- Business Rule: Target date must be future date
    IF p_target_date <= v_today_bdt THEN
        RAISE EXCEPTION 'INVALID_TARGET_DATE: Scheduled link target date must be in the future.';
    END IF;

    -- One-Day-Early Rule: Scheduling for tomorrow opens at 12:00 PM BDT today
    IF p_target_date = v_tomorrow_bdt AND NOT v_is_privileged THEN
        v_current_minutes := EXTRACT(HOUR FROM v_now_bdt) * 60 + EXTRACT(MINUTE FROM v_now_bdt);
        IF v_current_minutes < (12 * 60) THEN
            RAISE EXCEPTION 'SCHEDULE_WINDOW_NOT_OPEN: Scheduling for tomorrow opens at 12:00 PM BDT today.';
        END IF;
    END IF;

    -- Check duplicate pending schedule
    IF EXISTS (
        SELECT 1 FROM public.scheduled_links
        WHERE community_id = v_target_member.community_id
          AND owner_id = v_target_member.id
          AND target_date = p_target_date
          AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_SCHEDULE: A pending scheduled link already exists for this date.';
    END IF;

    -- Validate Facebook URL
    IF p_fb_link IS NULL OR (
        p_fb_link NOT LIKE 'https://%facebook.com/%' AND
        p_fb_link NOT LIKE 'https://%fb.watch/%' AND
        p_fb_link NOT LIKE 'https://%fb.me/%' AND
        p_fb_link NOT LIKE 'https://%m.facebook.com/%'
    ) THEN
        RAISE EXCEPTION 'INVALID_URL: Must be an authorized Facebook post link.';
    END IF;

    INSERT INTO public.scheduled_links (
        community_id,
        owner_id,
        target_date,
        target_time,
        post_type,
        category,
        caption,
        instruction,
        fb_link,
        status,
        scheduled_by_admin_id,
        created_at,
        updated_at
    ) VALUES (
        v_target_member.community_id,
        v_target_member.id,
        p_target_date,
        '10:00',
        p_post_type,
        CASE WHEN v_is_privileged THEN p_category ELSE 'NORMAL' END,
        TRIM(COALESCE(p_caption, '')),
        TRIM(COALESCE(p_instruction, 'Like and Comment')),
        TRIM(p_fb_link),
        'pending',
        CASE WHEN v_actor.id <> v_target_member.id THEN v_actor.id ELSE NULL END,
        NOW(),
        NOW()
    ) RETURNING id INTO v_schedule_id;

    -- Audit history
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_actor.id, 
        v_auth_uid, 
        v_actor.name, 
        v_actor.role, 
        'SCHEDULE_CREATED', 
        'SCHEDULED_LINK', 
        v_schedule_id::text, 
        'Scheduled link for ' || p_target_date::text || ' (Owner: ' || v_target_member.name || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'schedule_id', v_schedule_id,
        'target_date', p_target_date,
        'status', 'pending'
    );
END;
$$;

-- 8.5 RPC: edit_scheduled_link_secure
CREATE OR REPLACE FUNCTION public.edit_scheduled_link_secure(
    p_schedule_id UUID,
    p_post_type post_type,
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_schedule public.scheduled_links%ROWTYPE;
    v_is_privileged BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Actor profile not provisioned.';
    END IF;

    SELECT * INTO v_schedule FROM public.scheduled_links WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SCHEDULE_NOT_FOUND: Scheduled link not found.';
    END IF;

    IF v_schedule.status <> 'pending' THEN
        RAISE EXCEPTION 'NOT_PENDING: Only pending scheduled links can be edited. Current status: %', v_schedule.status;
    END IF;

    v_is_privileged := (v_actor.role = 'ADMIN' OR v_actor.role = 'DEVELOPER');

    IF NOT v_is_privileged AND v_schedule.owner_id <> v_actor.id THEN
        RAISE EXCEPTION 'FORBIDDEN: You cannot edit another member''s scheduled link.';
    END IF;

    -- Validate Facebook URL
    IF p_fb_link IS NULL OR (
        p_fb_link NOT LIKE 'https://%facebook.com/%' AND
        p_fb_link NOT LIKE 'https://%fb.watch/%' AND
        p_fb_link NOT LIKE 'https://%fb.me/%' AND
        p_fb_link NOT LIKE 'https://%m.facebook.com/%'
    ) THEN
        RAISE EXCEPTION 'INVALID_URL: Must be an authorized Facebook post link.';
    END IF;

    UPDATE public.scheduled_links
    SET post_type = p_post_type,
        caption = TRIM(COALESCE(p_caption, '')),
        instruction = TRIM(COALESCE(p_instruction, 'Like and Comment')),
        fb_link = TRIM(p_fb_link),
        updated_at = NOW()
    WHERE id = p_schedule_id;

    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_actor.id, 
        v_auth_uid, 
        v_actor.name, 
        v_actor.role, 
        'SCHEDULE_EDITED', 
        'SCHEDULED_LINK', 
        p_schedule_id::text, 
        'Edited scheduled link for ' || v_schedule.target_date::text
    );

    RETURN jsonb_build_object('success', true, 'schedule_id', p_schedule_id);
END;
$$;

-- 8.6 RPC: cancel_scheduled_link_secure
CREATE OR REPLACE FUNCTION public.cancel_scheduled_link_secure(
    p_schedule_id UUID,
    p_reason TEXT DEFAULT 'Canceled by user request'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_schedule public.scheduled_links%ROWTYPE;
    v_is_privileged BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Actor profile not provisioned.';
    END IF;

    SELECT * INTO v_schedule FROM public.scheduled_links WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SCHEDULE_NOT_FOUND: Scheduled link not found.';
    END IF;

    IF v_schedule.status <> 'pending' THEN
        RAISE EXCEPTION 'NOT_PENDING: Only pending scheduled links can be canceled. Current status: %', v_schedule.status;
    END IF;

    v_is_privileged := (v_actor.role = 'ADMIN' OR v_actor.role = 'DEVELOPER');

    IF NOT v_is_privileged AND v_schedule.owner_id <> v_actor.id THEN
        RAISE EXCEPTION 'FORBIDDEN: You cannot cancel another member''s scheduled link.';
    END IF;

    UPDATE public.scheduled_links
    SET status = 'canceled',
        canceled_at = NOW(),
        updated_at = NOW(),
        error_message = COALESCE(p_reason, 'User canceled')
    WHERE id = p_schedule_id;

    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_actor.id, 
        v_auth_uid, 
        v_actor.name, 
        v_actor.role, 
        'SCHEDULE_CANCELED', 
        'SCHEDULED_LINK', 
        p_schedule_id::text, 
        'Canceled schedule for ' || v_schedule.target_date::text || '. Reason: ' || COALESCE(p_reason, 'None')
    );

    RETURN jsonb_build_object('success', true, 'schedule_id', p_schedule_id);
END;
$$;

-- 8.7 RPC: run_due_scheduled_links_secure
-- Server-side scheduled executor running atomically with row locking (FOR UPDATE SKIP LOCKED)
-- Assigns link_number atomically only upon execution, updates member points and audit history
CREATE OR REPLACE FUNCTION public.run_due_scheduled_links_secure()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_today_bdt DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
    v_schedule RECORD;
    v_owner public.members%ROWTYPE;
    v_next_serial INTEGER;
    v_serial_display VARCHAR(10);
    v_part_number INTEGER;
    v_link_id UUID;
    v_executed_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    FOR v_schedule IN
        SELECT * FROM public.scheduled_links
        WHERE status = 'pending'
          AND target_date <= v_today_bdt
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Re-verify owner status at execution time
        SELECT * INTO v_owner FROM public.members WHERE id = v_schedule.owner_id;
        
        IF NOT FOUND OR v_owner.status <> 'ACTIVE' THEN
            UPDATE public.scheduled_links
            SET status = 'skipped',
                updated_at = NOW(),
                error_message = 'Owner is inactive or removed at execution time.'
            WHERE id = v_schedule.id;
            
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Check if owner already has a normal link submitted for today
        IF v_schedule.category = 'NORMAL' AND EXISTS (
            SELECT 1 FROM public.daily_links
            WHERE community_id = v_schedule.community_id
              AND date = v_today_bdt
              AND owner_id = v_schedule.owner_id
              AND category = 'NORMAL'
              AND status = 'active'
        ) THEN
            UPDATE public.scheduled_links
            SET status = 'skipped',
                updated_at = NOW(),
                error_message = 'Daily link already exists for today.'
            WHERE id = v_schedule.id;
            
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Atomically assign next serial number using advisory transaction lock
        PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_schedule.community_id || '_' || v_today_bdt::text));

        SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
        FROM public.daily_links
        WHERE community_id = v_schedule.community_id AND date = v_today_bdt;

        v_serial_display := LPAD(v_next_serial::text, 2, '0');
        v_part_number := CEIL(v_next_serial::numeric / 20.0);

        -- Insert authoritative daily link
        INSERT INTO public.daily_links (
            community_id,
            date,
            serial_number,
            serial_display,
            part_number,
            owner_id,
            owner_name,
            owner_member_number,
            owner_photo_url,
            owner_facebook_url,
            post_type,
            category,
            caption,
            instruction,
            fb_link,
            submitted_at,
            can_edit_until,
            submitted_by_admin_id,
            status
        ) VALUES (
            v_schedule.community_id,
            v_today_bdt,
            v_next_serial,
            v_serial_display,
            v_part_number,
            v_owner.id,
            v_owner.name,
            v_owner.member_number,
            v_owner.profile_photo_url,
            v_owner.facebook_url,
            v_schedule.post_type,
            v_schedule.category,
            v_schedule.caption,
            v_schedule.instruction,
            v_schedule.fb_link,
            NOW(),
            NOW() + INTERVAL '2 minutes',
            v_schedule.scheduled_by_admin_id,
            'active'
        ) RETURNING id INTO v_link_id;

        -- Mark scheduled link executed
        UPDATE public.scheduled_links
        SET status = 'executed',
            is_published = true,
            published_link_id = v_link_id,
            executed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_schedule.id;

        -- Award submission points (+5 submission, +2 on-time bonus)
        INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
        VALUES 
            (v_owner.id, 'DAILY_LINK_SUBMIT', 5, v_today_bdt, v_link_id::text, 'Scheduled Link Execution #' || v_serial_display),
            (v_owner.id, 'ON_TIME_SUBMISSION', 2, v_today_bdt, v_link_id::text, 'On-time scheduled execution bonus');

        UPDATE public.members
        SET points = points + 7,
            weekly_points = weekly_points + 7,
            total_links_submitted = total_links_submitted + 1,
            last_active_at = NOW()
        WHERE id = v_owner.id;

        -- Audit entry
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_owner.id, 
            'System Scheduler', 
            'DEVELOPER', 
            'SCHEDULE_EXECUTED', 
            'DAILY_LINK', 
            v_link_id::text, 
            'Executed scheduled link #' || v_serial_display || ' for ' || v_owner.name
        );

        v_executed_count := v_executed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'executed_count', v_executed_count,
        'skipped_count', v_skipped_count
    );
END;
$$;

-- 8.8 Scheduled Links RLS Policies
ALTER TABLE public.scheduled_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scheduled links viewable by owner or admin" ON public.scheduled_links;
CREATE POLICY "Scheduled links viewable by owner or admin"
    ON public.scheduled_links FOR SELECT
    TO authenticated
    USING (
        owner_id = public.get_current_member_id()
        OR public.is_current_user_admin_or_dev()
    );

-- Block direct INSERT/UPDATE/DELETE on scheduled_links from client, mandate RPCs
DROP POLICY IF EXISTS "No direct insert on scheduled_links" ON public.scheduled_links;
DROP POLICY IF EXISTS "No direct update on scheduled_links" ON public.scheduled_links;
DROP POLICY IF EXISTS "No direct delete on scheduled_links" ON public.scheduled_links;


