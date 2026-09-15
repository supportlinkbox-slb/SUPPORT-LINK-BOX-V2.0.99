-- ====================================================================
-- SUPPORT LINK BOX: COMPLETE PRODUCTION DATABASE SCHEMA & RPC FUNCTIONS
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Engine: PostgreSQL 15+ / Supabase
-- Refer to /supabase/production-hardening.sql for the canonical migration
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS
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

-- 2. MEMBER TABLE (public.members with auth_user_id mapping)
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

-- 3. DAILY LINKS TABLE
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

-- 4. SUPPORT RECORDS TABLE
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

-- 5. ALL DONE TABLE
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

-- 6. ALT ID DISCLOSURES
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

-- 7. POINT TRANSACTIONS TABLE
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

-- 8. REPORTS TABLE
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

-- 9. REPORT REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role user_role NOT NULL DEFAULT 'MEMBER',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SCHEDULED LINKS
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

-- 11. ANNOUNCEMENTS
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

-- 12. ANNOUNCEMENT READS
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_announcement_read UNIQUE (announcement_id, member_id)
);

-- 13. NOTICES
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

-- 14. NOTIFICATIONS
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

-- 15. AUDIT LOGS
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

-- 16. SETTINGS
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

-- 17. POINTS HISTORY
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

-- 18. MEMBER DAILY SUMMARY & ARCHIVE BATCHES
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

-- 19. ATOMIC RPC FUNCTIONS
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

    IF v_member.role = 'MEMBER' AND p_category = 'NORMAL' THEN
        SELECT COUNT(*) INTO v_existing_count 
        FROM public.daily_links 
        WHERE community_id = v_member.community_id AND date = v_today AND owner_id = v_member.id;

        IF v_existing_count >= 1 THEN
            RAISE EXCEPTION 'LINK_ALREADY_SUBMITTED: You have already submitted a link for today.';
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_member.community_id || '_' || v_today::text));

    SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today;

    v_serial_display := LPAD(v_next_serial::text, 2, '0');
    v_part_number := CEIL(v_next_serial::numeric / 20.0);

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

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES 
        (v_member.id, 'DAILY_LINK_SUBMIT', 5, v_today, v_link_id::text, 'Daily Link Submission #' || v_serial_display),
        (v_member.id, 'ON_TIME_SUBMISSION', 2, v_today, v_link_id::text, 'On-time link submission bonus');

    UPDATE public.members
    SET points = points + 7,
        weekly_points = weekly_points + 7,
        total_links_submitted = total_links_submitted + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

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

    IF v_link.owner_id = v_supporter.id THEN
        RAISE EXCEPTION 'SELF_SUPPORT_FORBIDDEN: You cannot support your own link.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.support_records 
        WHERE link_id = p_link_id AND supporter_id = v_supporter.id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_SUPPORTED', 'message', 'Already supported this link.');
    END IF;

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

    UPDATE public.daily_links
    SET total_supports_count = total_supports_count + 1
    WHERE id = p_link_id;

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

    IF EXISTS (
        SELECT 1 FROM public.all_done 
        WHERE community_id = v_member.community_id AND date = v_today AND member_id = v_member.id
    ) THEN
        RAISE EXCEPTION 'ALL_DONE_ALREADY_SUBMITTED: You have already submitted All Done for today.';
    END IF;

    SELECT COUNT(*) INTO v_total_required_links
    FROM public.daily_links
    WHERE community_id = v_member.community_id AND date = v_today AND owner_id <> v_member.id;

    SELECT COUNT(DISTINCT link_id) INTO v_supported_count
    FROM public.support_records
    WHERE community_id = v_member.community_id AND date = v_today AND supporter_id = v_member.id;

    IF v_supported_count < v_total_required_links THEN
        RAISE EXCEPTION 'SUPPORT_REQUIREMENTS_INCOMPLETE: Cannot submit All Done! You have supported % of % required links.', v_supported_count, v_total_required_links;
    END IF;

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

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'ALL_DONE', v_base_points, v_today, v_all_done_id::text, 'Daily All Done completed');

    IF v_bonus_points > 0 THEN
        INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
        VALUES (v_member.id, 'FASTEST_ALL_DONE', v_bonus_points, v_today, v_all_done_id::text, 'Fastest All Done Rank #' || v_rank);
    END IF;

    UPDATE public.members
    SET points = points + v_total_points,
        weekly_points = weekly_points + v_total_points,
        total_all_done = total_all_done + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

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

CREATE OR REPLACE FUNCTION public.set_member_status_secure(
    p_target_id UUID,
    p_new_status member_status,
    p_reason TEXT DEFAULT NULL
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
    v_reason_text TEXT;
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
    IF v_actor.id = p_target_id AND (p_new_status = 'SUSPENDED' OR p_new_status = 'FROZEN' OR p_new_status = 'REMOVED') THEN
        RAISE EXCEPTION 'FORBIDDEN: Self-suspension, freezing or removal is not permitted.';
    END IF;

    -- Set internal session flag to allow trigger to permit authoritative status change
    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_target_id;

    v_reason_text := COALESCE(NULLIF(TRIM(p_reason), ''), 'Status updated via admin console');

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
        CASE 
            WHEN p_new_status = 'SUSPENDED' THEN 'MEMBER_SUSPENDED'
            WHEN p_new_status = 'FROZEN' THEN 'MEMBER_FROZEN'
            WHEN p_new_status = 'REMOVED' THEN 'MEMBER_REMOVED'
            WHEN p_new_status = 'ACTIVE' AND v_old_status = 'SUSPENDED' THEN 'MEMBER_UNSUSPENDED'
            ELSE 'STATUS_CHANGED'
        END,
        'MEMBER',
        p_target_id::text,
        'Status changed from ' || v_old_status || ' to ' || p_new_status || '. Reason: ' || v_reason_text || ' (Community: ' || v_target.community_id || ')'
    );

    -- If suspended or restored, notify the member
    IF p_new_status = 'SUSPENDED' THEN
        INSERT INTO public.notifications (
            member_id,
            title,
            message,
            type
        ) VALUES (
            p_target_id,
            'অ্যাকাউন্ট সাময়িক স্থগিত (Suspended)',
            'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। কারণ: ' || v_reason_text,
            'ACCOUNT_SUSPENDED'
        );
    ELSIF p_new_status = 'ACTIVE' AND (v_old_status = 'SUSPENDED' OR v_old_status = 'FROZEN') THEN
        INSERT INTO public.notifications (
            member_id,
            title,
            message,
            type
        ) VALUES (
            p_target_id,
            'অ্যাকাউন্ট সক্রিয় করা হয়েছে',
            'আপনার সাপোর্ট লিংক বক্স অ্যাকাউন্ট পুনরায় সক্রিয় করা হয়েছে।',
            'ACCOUNT_RESTORED'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'old_status', v_old_status,
        'new_status', p_new_status,
        'reason', v_reason_text
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_member_secure(
    p_target_id UUID
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

    -- Row lock target
    SELECT * INTO v_target FROM public.members WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Target member not found.';
    END IF;

    IF v_target.status <> 'PENDING' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Member is not in PENDING status.';
    END IF;

    -- Community isolation
    IF v_actor.role <> 'DEVELOPER' AND v_actor.community_id <> v_target.community_id THEN
        RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED: Cannot manage members of another community.';
    END IF;

    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = 'ACTIVE',
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
        'MEMBER_APPROVED',
        'MEMBER',
        p_target_id::text,
        'Member ' || v_target.name || ' (' || v_target.member_number || ') approved by ' || v_actor.name
    );

    INSERT INTO public.notifications (
        member_id,
        title,
        message,
        type
    ) VALUES (
        p_target_id,
        'রেজিস্ট্রেশন অনুমোদিত',
        'অভিনন্দন! আপনার অ্যাকাউন্ট সফলভাবে অনুমোদন করা হয়েছে।',
        'ACCOUNT_APPROVED'
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'status', 'ACTIVE'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_member_secure(
    p_target_id UUID,
    p_reason TEXT DEFAULT NULL
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
    v_reason TEXT := COALESCE(NULLIF(TRIM(p_reason), ''), 'এডমিন কর্তৃক রেজিস্ট্রেশন বাতিল করা হয়েছে');
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

    -- Row lock target
    SELECT * INTO v_target FROM public.members WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Target member not found.';
    END IF;

    IF v_target.status <> 'PENDING' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Member is not in PENDING status.';
    END IF;

    -- Community isolation
    IF v_actor.role <> 'DEVELOPER' AND v_actor.community_id <> v_target.community_id THEN
        RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED: Cannot manage members of another community.';
    END IF;

    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = 'REMOVED',
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
        'MEMBER_REJECTED',
        'MEMBER',
        p_target_id::text,
        'Member ' || v_target.name || ' (' || v_target.member_number || ') rejected by ' || v_actor.name || '. Reason: ' || v_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'status', 'REMOVED',
        'reason', v_reason
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_member_profile_secure(
    p_target_id UUID,
    p_name VARCHAR(100) DEFAULT NULL,
    p_facebook_name VARCHAR(100) DEFAULT NULL,
    p_facebook_url TEXT DEFAULT NULL,
    p_profile_photo_url TEXT DEFAULT NULL
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
    v_new_name VARCHAR(100);
    v_new_fb_name VARCHAR(100);
    v_new_fb_url TEXT;
    v_new_photo TEXT;
BEGIN
    IF v_actor_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_actor_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor profile not found.';
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Target member not found.';
    END IF;

    -- Authorization check:
    IF v_actor.id <> v_target.id THEN
        IF v_actor.role <> 'DEVELOPER' AND v_actor.role <> 'ADMIN' THEN
            RAISE EXCEPTION 'FORBIDDEN: You can only edit your own profile.';
        END IF;

        IF v_target.role = 'DEVELOPER' AND v_actor.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'DEVELOPER_PROTECTED: Non-developer cannot edit Developer profiles.';
        END IF;

        IF v_actor.role <> 'DEVELOPER' AND v_actor.community_id <> v_target.community_id THEN
            RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED: Cannot edit members of another community.';
        END IF;
    END IF;

    v_new_name := COALESCE(NULLIF(TRIM(p_name), ''), v_target.name);
    v_new_fb_name := NULLIF(TRIM(p_facebook_name), '');
    v_new_fb_url := NULLIF(TRIM(p_facebook_url), '');
    v_new_photo := COALESCE(NULLIF(TRIM(p_profile_photo_url), ''), v_target.profile_photo_url);

    UPDATE public.members
    SET name = v_new_name,
        facebook_name = v_new_fb_name,
        facebook_url = v_new_fb_url,
        profile_photo_url = v_new_photo,
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
        'MEMBER_PROFILE_UPDATED',
        'MEMBER',
        p_target_id::text,
        'Profile updated for ' || v_target.member_number || ' by ' || v_actor.name
    );

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;

    RETURN jsonb_build_object(
        'success', true,
        'profile', to_jsonb(v_target)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_members_paginated(
    p_search TEXT DEFAULT NULL,
    p_role user_role DEFAULT NULL,
    p_status member_status DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_offset INTEGER;
    v_total_count INTEGER;
    v_members JSONB;
    v_search_pattern TEXT;
    v_limit INTEGER;
BEGIN
    IF v_actor_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_actor_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'DEVELOPER' AND v_actor.role <> 'ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin or Developer role required.';
    END IF;

    v_limit := GREATEST(1, LEAST(100, COALESCE(p_page_size, 10)));
    v_offset := GREATEST(0, (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit);

    IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
        v_search_pattern := '%' || TRIM(p_search) || '%';
    ELSE
        v_search_pattern := NULL;
    END IF;

    SELECT COUNT(*) INTO v_total_count
    FROM public.members m
    WHERE (v_actor.role = 'DEVELOPER' OR m.community_id = v_actor.community_id)
      AND (p_role IS NULL OR m.role = p_role)
      AND (p_status IS NULL OR m.status = p_status)
      AND (v_search_pattern IS NULL OR (
          m.name ILIKE v_search_pattern OR
          m.member_number ILIKE v_search_pattern OR
          m.email ILIKE v_search_pattern OR
          COALESCE(m.facebook_name, '') ILIKE v_search_pattern
      ));

    SELECT jsonb_agg(to_jsonb(r)) INTO v_members
    FROM (
        SELECT m.*
        FROM public.members m
        WHERE (v_actor.role = 'DEVELOPER' OR m.community_id = v_actor.community_id)
          AND (p_role IS NULL OR m.role = p_role)
          AND (p_status IS NULL OR m.status = p_status)
          AND (v_search_pattern IS NULL OR (
              m.name ILIKE v_search_pattern OR
              m.member_number ILIKE v_search_pattern OR
              m.email ILIKE v_search_pattern OR
              COALESCE(m.facebook_name, '') ILIKE v_search_pattern
          ))
        ORDER BY m.joined_at DESC, m.member_number ASC
        LIMIT v_limit OFFSET v_offset
    ) r;

    RETURN jsonb_build_object(
        'success', true,
        'page', GREATEST(1, COALESCE(p_page, 1)),
        'page_size', v_limit,
        'total_count', COALESCE(v_total_count, 0),
        'total_pages', CEIL(COALESCE(v_total_count, 0)::numeric / v_limit),
        'members', COALESCE(v_members, '[]'::jsonb)
    );
END;
$$;

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
    RETURN public.set_member_status_secure(p_target_id, p_new_status, NULL);
END;
$$;

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

    -- Allow initial binding when OLD.auth_user_id IS NULL
    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: auth_user_id is immutable once linked.';
    END IF;

    -- Allow initial member_number if null
    IF OLD.member_number IS NOT NULL AND NEW.member_number IS DISTINCT FROM OLD.member_number THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: member_number is immutable.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF current_setting('slb.internal_role_change', true) IS DISTINCT FROM 'true' 
           AND LOWER(COALESCE(NEW.email, '')) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct role update is prohibited. Use change_member_role() RPC.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF current_setting('slb.internal_status_change', true) IS DISTINCT FROM 'true'
           AND current_setting('slb.internal_approval', true) IS DISTINCT FROM 'true'
           AND LOWER(COALESCE(NEW.email, '')) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
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

CREATE OR REPLACE FUNCTION public.rpc_get_current_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_auth_email TEXT;
    v_next_int INTEGER;
    v_member_num VARCHAR(20);
BEGIN
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    -- 1. Try finding by auth_user_id
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;

    -- 2. If not found by auth_user_id, attempt to match by email and link
    IF NOT FOUND THEN
        SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;
        IF v_auth_email IS NOT NULL THEN
            UPDATE public.members 
            SET auth_user_id = v_auth_uid 
            WHERE LOWER(email) = LOWER(v_auth_email)
            RETURNING * INTO v_member;
        END IF;
    END IF;

    -- 3. If still not found, self-heal: auto-provision member profile on the fly
    IF v_member.id IS NULL THEN
        SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;
        IF v_auth_email IS NOT NULL THEN
            SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::integer), 100) + 1
            INTO v_next_int FROM public.members;
            v_member_num := 'SLB-' || LPAD(v_next_int::text, 3, '0');

            INSERT INTO public.members (
                auth_user_id,
                email,
                name,
                username,
                role,
                status,
                member_number
            )
            VALUES (
                v_auth_uid,
                v_auth_email,
                COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1)),
                COALESCE((SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)),
                CASE 
                    WHEN LOWER(v_auth_email) IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN 'DEVELOPER'::user_role
                    ELSE 'MEMBER'::user_role
                END,
                'ACTIVE',
                v_member_num
            )
            ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email
            RETURNING * INTO v_member;
        END IF;
    END IF;

    IF v_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile', to_jsonb(v_member)
    );
END;
$$;

-- Trigger for auto member creation on auth.users signup (CHAPTER 02)
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
    v_norm_email := LOWER(TRIM(NEW.email));

    SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::integer), 100) + 1
    INTO v_next_int FROM public.members;
    v_member_num := 'SLB-' || LPAD(v_next_int::text, 3, '0');

    IF v_norm_email IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
        v_initial_role := 'DEVELOPER';
        v_initial_status := 'ACTIVE';
        v_is_dev := true;
    END IF;

    v_name := CASE 
        WHEN v_is_dev THEN 'Md shihab khan'
        ELSE COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(v_norm_email, '@', 1))
    END;

    v_username := CASE 
        WHEN v_is_dev THEN 'Shihab_Vai'
        ELSE COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4))
    END;

    INSERT INTO public.members (
        auth_user_id,
        member_number,
        name,
        real_name,
        username,
        username_normalized,
        email,
        role,
        status,
        facebook_name,
        facebook_name_original,
        facebook_url,
        facebook_profile_url,
        facebook_identity_key,
        facebook_identity_type,
        profile_photo_url,
        points,
        weekly_points,
        total_links_submitted,
        total_supports_given,
        total_all_done,
        community_id,
        is_verified
    ) VALUES (
        NEW.id,
        CASE WHEN v_is_dev THEN 'SLB-001' ELSE v_member_num END,
        v_name,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'real_name'), ''), v_name),
        v_username,
        LOWER(TRIM(v_username)),
        v_norm_email,
        v_initial_role,
        CASE WHEN v_is_dev THEN 'ACTIVE'::member_status ELSE 'PENDING'::member_status END,
        CASE WHEN v_is_dev THEN 'MD SHIHAB KHAN' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), '') END,
        CASE WHEN v_is_dev THEN 'MD SHIHAB KHAN' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name_original'), '') END,
        CASE WHEN v_is_dev THEN 'https://www.facebook.com/SmShihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_url'), '') END,
        CASE WHEN v_is_dev THEN 'https://www.facebook.com/SmShihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_profile_url'), '') END,
        CASE WHEN v_is_dev THEN 'smshihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_identity_key'), '') END,
        CASE WHEN v_is_dev THEN 'username' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_identity_type'), '') END,
        CASE WHEN v_is_dev THEN 'https://i.ibb.co/DPDHM9Vm/1789329610483.jpg' ELSE COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80') END,
        CASE WHEN v_is_dev THEN 1500 ELSE 0 END,
        CASE WHEN v_is_dev THEN 120 ELSE 0 END,
        CASE WHEN v_is_dev THEN 150 ELSE 0 END,
        CASE WHEN v_is_dev THEN 2500 ELSE 0 END,
        CASE WHEN v_is_dev THEN 150 ELSE 0 END,
        'main',
        v_is_dev
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 20. RLS POLICIES
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members readable by authenticated" ON public.members;
CREATE POLICY "Members readable by authenticated" ON public.members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members updateable by owner" ON public.members;
CREATE POLICY "Members updateable by owner" ON public.members FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Daily links readable by all authenticated" ON public.daily_links;
CREATE POLICY "Daily links readable by all authenticated" ON public.daily_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Support records readable by all authenticated" ON public.support_records;
CREATE POLICY "Support records readable by all authenticated" ON public.support_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "All Done records viewable by community" ON public.all_done;
CREATE POLICY "All Done records viewable by community" ON public.all_done FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Point transactions readable by owner or admin" ON public.point_transactions;
CREATE POLICY "Point transactions readable by owner or admin" ON public.point_transactions FOR SELECT TO authenticated USING (member_id = public.get_current_member_id() OR public.is_current_user_admin_or_dev());

DROP POLICY IF EXISTS "Audit logs readable only by Admin or Developer" ON public.audit_logs;
CREATE POLICY "Audit logs readable only by Admin or Developer" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_current_user_admin_or_dev());

DROP POLICY IF EXISTS "Reports viewable by reporter or admin" ON public.reports;
CREATE POLICY "Reports viewable by reporter or admin" ON public.reports FOR SELECT TO authenticated USING (reporter_id = public.get_current_member_id() OR link_owner_id = public.get_current_member_id() OR public.is_current_user_admin_or_dev());

DROP POLICY IF EXISTS "Reports insertable by authenticated members" ON public.reports;
CREATE POLICY "Reports insertable by authenticated members" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = public.get_current_member_id());

DROP POLICY IF EXISTS "Notices viewable by authenticated users" ON public.notices;
CREATE POLICY "Notices viewable by authenticated users" ON public.notices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Settings viewable by all authenticated" ON public.settings;
CREATE POLICY "Settings viewable by all authenticated" ON public.settings FOR SELECT TO authenticated USING (true);

-- ====================================================================
-- CLEANUP & DEPRECATION OF INSECURE LEGACY FUNCTIONS (Section 55/85)
-- ====================================================================
DROP FUNCTION IF EXISTS public.award_member_points_atomic;
DROP FUNCTION IF EXISTS public.award_points;
DROP FUNCTION IF EXISTS public.admin_set_member_points;
DROP FUNCTION IF EXISTS public.insert_daily_link;
DROP FUNCTION IF EXISTS public.assign_serial_number;

