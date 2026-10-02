-- ====================================================================
-- SUPPORT LINK BOX: FULL A-TO-Z CANONICAL MASTER DATABASE MIGRATION (v2.0.99)
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Complies with HARD RULES #1 - #8 & All Business Rules
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('MEMBER', 'VIP', 'ADMIN', 'DEVELOPER');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE member_status AS ENUM ('ACTIVE', 'PENDING', 'REJECTED', 'INACTIVE', 'FROZEN', 'SUSPENDED', 'REMOVED');
    ELSE
        BEGIN
            ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'REJECTED';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
    END IF;
END $$;

-- 3. CORE APPLICATION TABLES

-- Communities
CREATE TABLE IF NOT EXISTS public.communities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    member_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    facebook_url TEXT NOT NULL,
    profile_photo_url TEXT,
    role user_role NOT NULL DEFAULT 'MEMBER',
    status member_status NOT NULL DEFAULT 'PENDING',
    points INTEGER NOT NULL DEFAULT 0,
    weekly_points INTEGER NOT NULL DEFAULT 0,
    monthly_points INTEGER NOT NULL DEFAULT 0,
    daily_points INTEGER NOT NULL DEFAULT 0,
    total_links_submitted INTEGER NOT NULL DEFAULT 0,
    total_supports_given INTEGER NOT NULL DEFAULT 0,
    total_all_done INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    days_inactive INTEGER NOT NULL DEFAULT 0,
    can_schedule_links BOOLEAN NOT NULL DEFAULT true,
    last_active_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings Table (HARD RULE #5: Keyed strictly by community_id = 'main')
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) UNIQUE NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    submission_start_time VARCHAR(10) NOT NULL DEFAULT '10:00',
    submission_end_time VARCHAR(10) NOT NULL DEFAULT '16:50',
    admin_special_start_time VARCHAR(10) NOT NULL DEFAULT '16:51',
    admin_special_end_time VARCHAR(10) NOT NULL DEFAULT '16:59',
    all_done_start_time VARCHAR(10) NOT NULL DEFAULT '17:00',
    all_done_deadline_time VARCHAR(10) NOT NULL DEFAULT '23:59',
    points_daily_link_submit INTEGER NOT NULL DEFAULT 5,
    points_per_support INTEGER NOT NULL DEFAULT 1,
    points_all_done INTEGER NOT NULL DEFAULT 5,
    points_fastest_top1 INTEGER NOT NULL DEFAULT 10,
    points_fastest_top2 INTEGER NOT NULL DEFAULT 8,
    points_fastest_top3 INTEGER NOT NULL DEFAULT 6,
    points_fastest_top4 INTEGER NOT NULL DEFAULT 4,
    points_fastest_top5 INTEGER NOT NULL DEFAULT 2,
    penalty_late_support INTEGER NOT NULL DEFAULT 2,
    penalty_fake_all_done INTEGER NOT NULL DEFAULT 10,
    penalty_inactive INTEGER NOT NULL DEFAULT 1,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    can_submit_links_global BOOLEAN NOT NULL DEFAULT true,
    late_support_weekly_limit INTEGER NOT NULL DEFAULT 2,
    admin_support_contact JSONB,
    active_festival_theme JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily Links
CREATE TABLE IF NOT EXISTS public.daily_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE,
    serial_number INTEGER NOT NULL,
    link_number INTEGER NOT NULL,
    serial_display VARCHAR(10) NOT NULL,
    part_number INTEGER NOT NULL DEFAULT 1,
    post_type VARCHAR(20) NOT NULL DEFAULT 'Photo',
    category VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    caption TEXT NOT NULL DEFAULT '',
    instruction TEXT NOT NULL DEFAULT '',
    fb_link TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    can_edit_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
    editable_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
    is_approved BOOLEAN NOT NULL DEFAULT true,
    total_supports_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_daily_link_serial_date UNIQUE (community_id, date, serial_number)
);

-- Scheduled Links
CREATE TABLE IF NOT EXISTS public.scheduled_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    target_time VARCHAR(10) NOT NULL DEFAULT '12:00',
    post_type VARCHAR(20) NOT NULL DEFAULT 'Photo',
    category VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    caption TEXT NOT NULL DEFAULT '',
    instruction TEXT NOT NULL DEFAULT '',
    fb_link TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_by_admin_id UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Records
CREATE TABLE IF NOT EXISTS public.support_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    link_id UUID NOT NULL REFERENCES public.daily_links(id) ON DELETE CASCADE,
    supporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE,
    supported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_supporter_link_date UNIQUE (link_id, supporter_id, date)
);

-- All Done Records
CREATE TABLE IF NOT EXISTS public.all_done (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_supports_given INTEGER NOT NULL DEFAULT 0,
    required_supports_count INTEGER NOT NULL DEFAULT 0,
    points_awarded INTEGER NOT NULL DEFAULT 5,
    fastest_bonus_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 5,
    fastest_rank INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    alternative_id_used BOOLEAN NOT NULL DEFAULT false,
    alternative_id_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_all_done_date UNIQUE (community_id, member_id, date)
);

-- Point Transactions Ledger (HARD RULE #3: Immutable ledger)
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE,
    reference_id TEXT,
    description TEXT,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invite Tokens
CREATE TABLE IF NOT EXISTS public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_by UUID REFERENCES public.members(id),
    target_role user_role NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES public.members(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_serial_display VARCHAR(20),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    link_id UUID REFERENCES public.daily_links(id) ON DELETE CASCADE,
    link_serial INTEGER NOT NULL DEFAULT 1,
    link_owner_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    link_owner_name VARCHAR(100) NOT NULL DEFAULT '',
    reporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    reporter_name VARCHAR(100) NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    screenshot_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.members(id),
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    actor_name VARCHAR(100) NOT NULL DEFAULT 'System',
    actor_role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fake All Done Incidents
CREATE TABLE IF NOT EXISTS public.fake_all_done_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    all_done_id UUID NOT NULL REFERENCES public.all_done(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
    reason TEXT,
    confirmed_by UUID REFERENCES public.members(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member Punishments
CREATE TABLE IF NOT EXISTS public.member_punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    punishment_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    detected_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE,
    detected_by_admin UUID REFERENCES public.members(id),
    original_all_done_id UUID REFERENCES public.all_done(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. HARD RULE #2: MEMBER SECURITY TRIGGER USING current_setting('role') AND current_user
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_setting TEXT := current_setting('role', true);
    v_db_user TEXT := current_user;
    v_caller_role user_role;
BEGIN
    -- If executed inside a trusted SECURITY DEFINER function owned by superuser/postgres/service_role, allow internal system mutations
    IF v_db_user IN ('postgres', 'supabase_admin') OR v_role_setting = 'service_role' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- Direct client write over REST/GraphQL API
    IF v_role_setting IN ('authenticated', 'anon') THEN
        -- CRITICAL RULE: NO ONE (neither Member nor Admin) can directly alter points/ledger/stats columns on the table!
        -- All point and stat alterations must be logged to the immutable ledger via secure RPCs.
        IF NEW.points IS DISTINCT FROM OLD.points OR
           NEW.weekly_points IS DISTINCT FROM OLD.weekly_points OR
           NEW.monthly_points IS DISTINCT FROM OLD.monthly_points OR
           NEW.daily_points IS DISTINCT FROM OLD.daily_points OR
           NEW.total_links_submitted IS DISTINCT FROM OLD.total_links_submitted OR
           NEW.total_supports_given IS DISTINCT FROM OLD.total_supports_given OR
           NEW.total_all_done IS DISTINCT FROM OLD.total_all_done THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Direct modification of points and stats is forbidden. All point adjustments must go through ledger RPCs.';
        END IF;

        -- Check caller's role from members table
        SELECT role INTO v_caller_role FROM public.members WHERE auth_user_id = auth.uid();

        -- Non-admins/non-developers cannot mutate role, status, member_number, can_schedule_links, community_id
        IF v_caller_role IS NULL OR (v_caller_role <> 'ADMIN' AND v_caller_role <> 'DEVELOPER') THEN
            IF NEW.role IS DISTINCT FROM OLD.role OR
               NEW.status IS DISTINCT FROM OLD.status OR
               NEW.member_number IS DISTINCT FROM OLD.member_number OR
               NEW.can_schedule_links IS DISTINCT FROM OLD.can_schedule_links OR
               NEW.community_id IS DISTINCT FROM OLD.community_id THEN
                RAISE EXCEPTION 'PERMISSION_DENIED: Direct client modification of protected security fields (role, status) is strictly forbidden.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_protect_security_fields ON public.members;
CREATE TRIGGER trg_members_protect_security_fields
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_member_security_fields();

-- 5. HARD RULE #7: AUTOMATIC USER CREATION TRIGGER ON auth.users
CREATE OR REPLACE FUNCTION public.generate_member_number_secure()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_seq_val INT;
BEGIN
    PERFORM pg_advisory_xact_lock(987654321);
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '') AS INTEGER)), 0) + 1
    INTO v_seq_val FROM public.members;
    RETURN 'SLB-' || LPAD(v_seq_val::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member_number VARCHAR(20);
    v_name VARCHAR(100);
    v_fb_url TEXT;
    v_profile_photo TEXT;
    v_is_first BOOLEAN;
    v_norm_email VARCHAR(255);
    v_role user_role;
    v_status member_status;
BEGIN
    SELECT NOT EXISTS (SELECT 1 FROM public.members) INTO v_is_first;

    v_norm_email := LOWER(TRIM(NEW.email));
    IF v_norm_email IN ('muradshihab516@gmail.com','supportlinkbox@gmail.com') THEN
      v_role := 'DEVELOPER'; v_status := 'ACTIVE';
    ELSIF v_is_first THEN v_role := 'ADMIN'; v_status := 'ACTIVE';
    ELSE v_role := 'MEMBER'; v_status := 'PENDING'; END IF;

    v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'facebook_name', 'Member');
    v_fb_url := COALESCE(NEW.raw_user_meta_data->>'facebook_url', NEW.raw_user_meta_data->>'facebook_profile_url', 'https://facebook.com');
    v_profile_photo := NEW.raw_user_meta_data->>'profile_photo_url';
    v_member_number := NEW.raw_user_meta_data->>'member_number';

    IF v_member_number IS NULL OR TRIM(v_member_number) = '' THEN
        v_member_number := public.generate_member_number_secure();
    END IF;

    INSERT INTO public.members (
        auth_user_id,
        community_id,
        member_number,
        name,
        email,
        facebook_url,
        profile_photo_url,
        role,
        status
    ) VALUES (
        NEW.id,
        'main',
        v_member_number,
        v_name,
        NEW.email,
        v_fb_url,
        v_profile_photo,
        v_role,
        v_status
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 6. HARD RULE #6: REQUIRED RPC SIGNATURES

-- Leaderboard Ranking RPC (Computes scores from point_transactions ledger per HARD RULE #4)
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard_secure(
    p_period VARCHAR DEFAULT 'WEEKLY',
    p_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    member_number VARCHAR,
    profile_photo_url TEXT,
    role user_role,
    status member_status,
    points INTEGER,
    weekly_points INTEGER,
    monthly_points INTEGER,
    daily_points INTEGER,
    total_links_submitted INTEGER,
    total_supports_given INTEGER,
    total_all_done INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH ledger_scores AS (
        SELECT 
            pt.member_id,
            COALESCE(SUM(CASE WHEN pt.date = p_date THEN pt.points ELSE 0 END), 0)::INTEGER AS computed_daily,
            COALESCE(SUM(CASE WHEN pt.date >= (p_date - INTERVAL '7 days')::DATE THEN pt.points ELSE 0 END), 0)::INTEGER AS computed_weekly,
            COALESCE(SUM(CASE WHEN pt.date >= date_trunc('month', p_date)::DATE THEN pt.points ELSE 0 END), 0)::INTEGER AS computed_monthly,
            COALESCE(SUM(pt.points), 0)::INTEGER AS computed_total
        FROM public.point_transactions pt
        GROUP BY pt.member_id
    )
    SELECT 
        m.id,
        m.name,
        m.member_number,
        m.profile_photo_url,
        m.role,
        m.status,
        COALESCE(ls.computed_total, m.points) AS points,
        COALESCE(ls.computed_weekly, m.weekly_points) AS weekly_points,
        COALESCE(ls.computed_monthly, m.monthly_points) AS monthly_points,
        COALESCE(ls.computed_daily, m.daily_points) AS daily_points,
        m.total_links_submitted,
        m.total_supports_given,
        m.total_all_done
    FROM public.members m
    LEFT JOIN ledger_scores ls ON ls.member_id = m.id
    WHERE m.status = 'ACTIVE'
    ORDER BY 
        CASE WHEN UPPER(p_period) = 'WEEKLY' THEN COALESCE(ls.computed_weekly, m.weekly_points)
             WHEN UPPER(p_period) = 'DAILY' THEN COALESCE(ls.computed_daily, m.daily_points)
             WHEN UPPER(p_period) = 'MONTHLY' THEN COALESCE(ls.computed_monthly, m.monthly_points)
             ELSE COALESCE(ls.computed_total, m.points)
        END DESC,
        m.total_all_done DESC
    LIMIT 100;
END;
$$;

-- Schedule Permission Toggle RPC (FIX #2: Canonical signature matching frontend caller)
CREATE OR REPLACE FUNCTION public.set_member_schedule_permission_secure(
    p_target_member_id UUID,
    p_allowed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL OR v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Admin privilege required.');
    END IF;

    UPDATE public.members
    SET can_schedule_links = p_allowed, updated_at = NOW()
    WHERE id = p_target_member_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_member_schedule_permission_secure(UUID, BOOLEAN) TO authenticated;

-- Member Status Management RPC (FIX #3: Includes optional p_reason logged to audit_logs)
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
    v_caller public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_old_status member_status;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL OR v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Admin privilege required.');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    IF v_target.role = 'DEVELOPER' THEN
        RETURN jsonb_build_object('success', false, 'error', 'DEVELOPER_PROTECTED: Developer accounts cannot be modified.');
    END IF;

    v_old_status := v_target.status;

    UPDATE public.members
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_target_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        v_caller.id,
        v_caller.name,
        v_caller.role::text,
        'STATUS_CHANGED',
        'MEMBER',
        p_target_id::text,
        'Status changed from ' || v_old_status::text || ' to ' || p_new_status::text || CASE WHEN p_reason IS NOT NULL AND TRIM(p_reason) <> '' THEN '. Reason: ' || p_reason ELSE '' END
    );

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_member_status_secure(UUID, member_status, TEXT) TO authenticated;

-- Member Email Resolution for Login Fallback
CREATE OR REPLACE FUNCTION public.resolve_member_email_by_number(p_member_number VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_email VARCHAR;
BEGIN
    SELECT email INTO v_email
    FROM public.members
    WHERE LOWER(TRIM(member_number)) = LOWER(TRIM(p_member_number))
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Point Settings Management RPCs
CREATE OR REPLACE FUNCTION public.get_point_settings_secure()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sett public.settings%ROWTYPE;
BEGIN
    SELECT * INTO v_sett FROM public.settings WHERE community_id = 'main';
    IF v_sett.id IS NULL THEN
        INSERT INTO public.settings (community_id) VALUES ('main') RETURNING * INTO v_sett;
    END IF;
    RETURN to_jsonb(v_sett);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_point_settings_secure(
    p_points_daily_link_submit INTEGER DEFAULT 5,
    p_points_per_support INTEGER DEFAULT 1,
    p_points_all_done INTEGER DEFAULT 5,
    p_points_fastest_top1 INTEGER DEFAULT 10,
    p_points_fastest_top2 INTEGER DEFAULT 8,
    p_points_fastest_top3 INTEGER DEFAULT 6,
    p_points_fastest_top4 INTEGER DEFAULT 4,
    p_points_fastest_top5 INTEGER DEFAULT 2,
    p_penalty_late_support INTEGER DEFAULT 2,
    p_penalty_fake_all_done INTEGER DEFAULT 10,
    p_penalty_inactive INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL OR v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Admin privilege required.');
    END IF;

    UPDATE public.settings
    SET points_daily_link_submit = p_points_daily_link_submit,
        points_per_support = p_points_per_support,
        points_all_done = p_points_all_done,
        points_fastest_top1 = p_points_fastest_top1,
        points_fastest_top2 = p_points_fastest_top2,
        points_fastest_top3 = p_points_fastest_top3,
        points_fastest_top4 = p_points_fastest_top4,
        points_fastest_top5 = p_points_fastest_top5,
        penalty_late_support = ABS(p_penalty_late_support),
        penalty_fake_all_done = ABS(p_penalty_fake_all_done),
        penalty_inactive = ABS(p_penalty_inactive),
        updated_at = NOW()
    WHERE community_id = 'main';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Add scheduled links status additions if missing
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS published_link_id UUID;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Scheduled Link Creation RPC
CREATE OR REPLACE FUNCTION public.create_scheduled_link_secure(
    p_target_date DATE,
    p_target_time VARCHAR(10),
    p_post_type VARCHAR(20),
    p_caption TEXT,
    p_instruction TEXT,
    p_fb_link TEXT,
    p_category VARCHAR(20) DEFAULT 'NORMAL',
    p_target_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
    v_owner public.members%ROWTYPE;
    v_target_id UUID;
    v_today_bdt DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
    v_now_bdt TIMESTAMPTZ := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    IF p_target_member_id IS NOT NULL AND v_caller.role IN ('ADMIN', 'DEVELOPER') THEN
        SELECT * INTO v_owner FROM public.members WHERE id = p_target_member_id;
    ELSE
        v_owner := v_caller;
    END IF;

    IF v_owner.can_schedule_links = false AND v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SCHEDULING_DISABLED: Admin disabled your schedule permission.');
    END IF;

    -- Validation
    IF p_target_date < v_today_bdt THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TARGET_DATE: Date cannot be in the past.');
    END IF;

    IF p_target_time::time < '12:00:00'::time OR p_target_time::time > '16:00:00'::time THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TIME: Scheduled execution is allowed only between 12:00 PM and 4:00 PM BDT.');
    END IF;

    IF p_target_date = v_today_bdt AND (p_target_time::time <= v_now_bdt::time) THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TARGET_TIME: Same-day schedule time must be in the future.');
    END IF;

    INSERT INTO public.scheduled_links (
        community_id, owner_id, member_id, target_date, target_time, post_type, category, caption, instruction, fb_link, status
    ) VALUES (
        v_owner.community_id, v_owner.id, v_owner.id, p_target_date, COALESCE(p_target_time, '12:00'), COALESCE(p_post_type, 'Photo'), COALESCE(p_category, 'NORMAL'), COALESCE(p_caption, ''), COALESCE(p_instruction, ''), p_fb_link, 'pending'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Scheduled Link Execution Runner RPC (HARD RULE #8: Window enforced)
CREATE OR REPLACE FUNCTION public.run_due_scheduled_links_secure()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now_bdt TIMESTAMPTZ := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';
    v_today_bdt DATE := v_now_bdt::DATE;
    v_curr_hour INT := EXTRACT(HOUR FROM v_now_bdt);
    v_sched RECORD;
    v_owner public.members%ROWTYPE;
    v_next_serial INT;
    v_part INT;
    v_link_id UUID;
    v_earned INTEGER := 5;
    v_executed_count INT := 0;
BEGIN
    -- HARD RULE #8: Window Enforcement (12:00 PM - 4:00 PM BDT) unless invoked by admin
    IF v_now_bdt::time < '12:00:00'::time OR v_now_bdt::time > '16:05:00'::time THEN
        IF auth.uid() IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')) THEN
                RETURN jsonb_build_object('success', false, 'error', 'WINDOW_CLOSED: Automated execution window is 12:00 PM to 4:00 PM BDT.');
            END IF;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'WINDOW_CLOSED: Execution window is 12:00 PM to 4:00 PM BDT.');
        END IF;
    END IF;

    FOR v_sched IN
        SELECT sl.* FROM public.scheduled_links sl
        WHERE sl.target_date = v_today_bdt AND sl.status = 'pending'
          AND (sl.target_time IS NULL OR sl.target_time::time <= v_now_bdt::time)
        ORDER BY sl.target_time ASC, sl.created_at ASC
    LOOP
        -- Wrap each iteration in its own block for independent failure tracking
        BEGIN
            -- 1. Fetch and Verify Owner eligibility
            SELECT * INTO v_owner FROM public.members WHERE id = v_sched.owner_id;
            IF NOT FOUND OR v_owner.status <> 'ACTIVE' THEN
                UPDATE public.scheduled_links 
                SET status = 'failed', error_message = 'OWNER_INACTIVE', executed_at = NOW() 
                WHERE id = v_sched.id;
                CONTINUE;
            END IF;

            IF v_owner.can_schedule_links = false THEN
                UPDATE public.scheduled_links 
                SET status = 'failed', error_message = 'SCHEDULING_DISABLED', executed_at = NOW() 
                WHERE id = v_sched.id;
                CONTINUE;
            END IF;

            -- Check duplicate daily link for owner today
            IF EXISTS (
                SELECT 1 FROM public.daily_links 
                WHERE owner_id = v_sched.owner_id AND date = v_today_bdt AND status <> 'cancelled'
            ) THEN
                UPDATE public.scheduled_links 
                SET status = 'failed', error_message = 'DUPLICATE_LINK', executed_at = NOW() 
                WHERE id = v_sched.id;
                CONTINUE;
            END IF;

            -- 2. Clean serial generation using daily community advisory lock
            PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_sched.community_id || '_' || v_today_bdt::text));

            SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
            FROM public.daily_links 
            WHERE date = v_today_bdt AND community_id = v_sched.community_id;

            v_part := ((v_next_serial - 1) / 20) + 1;
            v_link_id := gen_random_uuid();

            -- 3. Insert into daily_links
            INSERT INTO public.daily_links (
                id, community_id, owner_id, member_id, date, serial_number, link_number, serial_display, part_number, post_type, category, caption, instruction, fb_link, status, submitted_at
            ) VALUES (
                v_link_id, v_sched.community_id, v_sched.owner_id, v_sched.owner_id, v_today_bdt, v_next_serial, v_next_serial, 'SL-' || LPAD(v_next_serial::text, 3, '0'), v_part, v_sched.post_type, v_sched.category, v_sched.caption, v_sched.instruction, v_sched.fb_link, 'active', NOW()
            );

            -- 4. Read earning points configuration
            SELECT COALESCE(points_daily_link_submit, 5) INTO v_earned 
            FROM public.settings WHERE community_id = 'main';

            -- 5. Write to point transaction ledger (Fix 1)
            INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
            VALUES (v_sched.owner_id, 'LINK_SUBMIT', v_earned, v_today_bdt, v_link_id::text, 'Scheduled Link #' || v_next_serial || ' (auto-published)');

            -- 6. Update member balance and active metadata
            UPDATE public.members 
            SET points = points + v_earned, 
                weekly_points = weekly_points + v_earned, 
                total_links_submitted = total_links_submitted + 1, 
                last_active_date = v_today_bdt 
            WHERE id = v_sched.owner_id;

            -- 7. Update scheduled_links state on success
            UPDATE public.scheduled_links 
            SET status = 'published', is_published = true, published_link_id = v_link_id, executed_at = NOW(), error_message = NULL
            WHERE id = v_sched.id;

            v_executed_count := v_executed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Record failure and continue
            UPDATE public.scheduled_links 
            SET status = 'failed', error_message = SQLERRM, executed_at = NOW() 
            WHERE id = v_sched.id;
        END;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'executed_count', v_executed_count);
END;
$$;

-- Invite Token RPCs (FIX #5: Canonical consolidated definitions with is_revoked check)
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
    v_token public.invite_tokens%ROWTYPE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    
    SELECT * INTO v_token FROM public.invite_tokens 
    WHERE token_hash = p_token_hash AND status = 'ACTIVE' AND is_revoked = false AND expires_at > NOW();

    IF v_token.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID_OR_EXPIRED_TOKEN');
    END IF;

    UPDATE public.invite_tokens
    SET status = 'USED', used_at = NOW(), used_by = v_caller.id, updated_at = NOW()
    WHERE id = v_token.id;

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_invite_token(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token public.invite_tokens%ROWTYPE;
BEGIN
    SELECT * INTO v_token FROM public.invite_tokens 
    WHERE token_hash = p_token_hash AND status = 'ACTIVE' AND is_revoked = false AND expires_at > NOW();

    IF v_token.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Token is invalid, expired, or revoked.');
    END IF;

    RETURN jsonb_build_object('valid', true, 'target_role', v_token.target_role);
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;

-- Admin Revoke Invite Token RPC (Sets is_revoked = true and revoked_at = NOW())
CREATE OR REPLACE FUNCTION public.revoke_invite_token_secure(p_token_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL OR v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Admin privilege required.');
    END IF;

    UPDATE public.invite_tokens
    SET status = 'REVOKED', is_revoked = true, revoked_at = NOW(), updated_at = NOW()
    WHERE id = p_token_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_invite_token_secure(UUID) TO authenticated;

-- 7. RLS POLICIES
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Communities
DROP POLICY IF EXISTS "Public communities read" ON public.communities;
CREATE POLICY "Public communities read" ON public.communities FOR SELECT USING (true);

-- Settings
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Admin update settings" ON public.settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Members RLS (Ironclad)
DROP POLICY IF EXISTS "Members view directory" ON public.members;
CREATE POLICY "Members view directory" ON public.members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members update own profile" ON public.members;
CREATE POLICY "Members update own profile" ON public.members FOR UPDATE TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Admins update all profiles" ON public.members;
CREATE POLICY "Admins update all profiles" ON public.members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Daily Links RLS (Users must use rpc to insert/modify)
DROP POLICY IF EXISTS "Anyone read daily links" ON public.daily_links;
CREATE POLICY "Anyone read daily links" ON public.daily_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage daily links" ON public.daily_links;
CREATE POLICY "Admins manage daily links" ON public.daily_links FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Scheduled Links RLS
DROP POLICY IF EXISTS "Members view own scheduled links" ON public.scheduled_links;
CREATE POLICY "Members view own scheduled links" ON public.scheduled_links FOR SELECT TO authenticated
USING (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

DROP POLICY IF EXISTS "Admins manage all scheduled links" ON public.scheduled_links;
CREATE POLICY "Admins manage all scheduled links" ON public.scheduled_links FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Support Records RLS
DROP POLICY IF EXISTS "Members read support records" ON public.support_records;
CREATE POLICY "Members read support records" ON public.support_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members insert own support records" ON public.support_records;
CREATE POLICY "Members insert own support records" ON public.support_records FOR INSERT TO authenticated
WITH CHECK (supporter_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all support records" ON public.support_records;
CREATE POLICY "Admins manage all support records" ON public.support_records FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- All Done RLS (Users must use secure rpc to insert)
DROP POLICY IF EXISTS "Members read all done" ON public.all_done;
CREATE POLICY "Members read all done" ON public.all_done FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage all done" ON public.all_done;
CREATE POLICY "Admins manage all done" ON public.all_done FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Point Transactions Ledger RLS (Clients can only read, insertion strictly internal via secure rpc)
DROP POLICY IF EXISTS "Members view own points ledger" ON public.point_transactions;
CREATE POLICY "Members view own points ledger" ON public.point_transactions FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Invite Tokens RLS
DROP POLICY IF EXISTS "Admins view invite tokens" ON public.invite_tokens;
CREATE POLICY "Admins view invite tokens" ON public.invite_tokens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

DROP POLICY IF EXISTS "Admins manage invite tokens" ON public.invite_tokens;
CREATE POLICY "Admins manage invite tokens" ON public.invite_tokens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Reports RLS
DROP POLICY IF EXISTS "Members view own reports" ON public.reports;
CREATE POLICY "Members view own reports" ON public.reports FOR SELECT TO authenticated
USING (reporter_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

DROP POLICY IF EXISTS "Members insert own reports" ON public.reports;
CREATE POLICY "Members insert own reports" ON public.reports FOR INSERT TO authenticated
WITH CHECK (reporter_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

-- Notifications RLS
DROP POLICY IF EXISTS "Members view own notifications" ON public.notifications;
CREATE POLICY "Members view own notifications" ON public.notifications FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Members update own notifications" ON public.notifications;
CREATE POLICY "Members update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- INITIAL SEED
INSERT INTO public.communities (id, name, description) VALUES ('main', 'Support Link Box Official', 'Primary partition') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings (community_id) VALUES ('main') ON CONFLICT (community_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.consume_my_pending_invite(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_auth UUID := auth.uid(); v_tok public.invite_tokens%ROWTYPE;
BEGIN
  IF v_auth IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'NO_SESSION'); END IF;
  IF p_token_hash IS NULL OR p_token_hash = '' THEN RETURN jsonb_build_object('success', false, 'reason', 'NO_TOKEN'); END IF;
  SELECT * INTO v_tok FROM public.invite_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_tok.status <> 'ACTIVE' OR v_tok.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_TOKEN');
  END IF;
  UPDATE public.invite_tokens SET status = 'USED', used_at = NOW(), used_by = v_auth, updated_at = NOW() WHERE id = v_tok.id;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.consume_my_pending_invite(TEXT) TO authenticated;

-- 8. ADMIN MANUAL POINTS ADJUSTMENT RPC (Immutable ledger + audit log recorded)
CREATE OR REPLACE FUNCTION public.admin_adjust_points_secure(
    p_member_id UUID,
    p_amount INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_today_bdt DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL OR v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Admin or Developer privilege required.');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    -- Record in point_transactions immutable ledger
    INSERT INTO public.point_transactions (
        member_id,
        activity_type,
        points,
        date,
        reference_id,
        description
    ) VALUES (
        v_target.id,
        'ADMIN_ADJUSTMENT',
        p_amount,
        v_today_bdt,
        v_caller.id::text,
        COALESCE(p_reason, 'Manual point adjustment by Admin ' || v_caller.name)
    );

    -- Update member balance atomically
    UPDATE public.members
    SET points = GREATEST(0, points + p_amount),
        weekly_points = GREATEST(0, weekly_points + p_amount),
        updated_at = NOW()
    WHERE id = v_target.id;

    -- Record audit log
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_caller.id, v_caller.name, v_caller.role::text, 'MANUAL_POINT_ADJUSTMENT', 'MEMBER', v_target.id::text, 'Adjusted ' || p_amount::text || ' points: ' || COALESCE(p_reason, ''));

    RETURN jsonb_build_object('success', true, 'new_points', GREATEST(0, v_target.points + p_amount));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points_secure(UUID, INTEGER, TEXT) TO authenticated;

-- 9. AD RECOVERY COMPLETION RPC (FIX #7: Unlocks suspended/inactive accounts after monetization ad watch)
CREATE OR REPLACE FUNCTION public.rpc_complete_ad_recovery(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_today_bdt DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
BEGIN
    SELECT * INTO v_caller FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Please sign in.');
    END IF;

    -- Verify caller is admin/developer or target themselves
    IF v_caller.id <> p_member_id AND v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN: You can only recover your own account.');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    -- Update member to ACTIVE and reset inactive days
    UPDATE public.members
    SET status = 'ACTIVE',
        days_inactive = 0,
        last_active_date = v_today_bdt,
        updated_at = NOW()
    WHERE id = p_member_id;

    -- Ledger record (0 points for audit trail)
    INSERT INTO public.point_transactions (
        member_id,
        activity_type,
        points,
        date,
        reference_id,
        description
    ) VALUES (
        p_member_id,
        'AD_RECOVERY',
        0,
        v_today_bdt,
        p_member_id::text,
        'Member status restored to ACTIVE via Ad Monetization Recovery'
    );

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_caller.id, v_caller.name, v_caller.role::text, 'AD_RECOVERY_COMPLETED', 'MEMBER', p_member_id::text, 'Ad recovery completed for ' || v_target.name);

    RETURN jsonb_build_object('success', true, 'status', 'ACTIVE');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_complete_ad_recovery(UUID) TO authenticated;

-- 10. PG_CRON AUTOMATED BACKGROUND RUNNER (FIX #1: Uses $cron$ tag to avoid syntax error in nested DO block)
-- Automatically invokes run_due_scheduled_links_secure() every 2 minutes.
-- The runner internally verifies 12:00 PM - 04:00 PM BDT execution window and target_time.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('slb-run-due-scheduled-links');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.schedule(
        'slb-run-due-scheduled-links',
        '*/2 * * * *',
        $cron$SELECT public.run_due_scheduled_links_secure()$cron$
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

