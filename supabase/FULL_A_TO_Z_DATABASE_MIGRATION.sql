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
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES public.members(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    IF v_db_user IN ('postgres', 'supabase_admin', 'service_role') OR v_role_setting = 'service_role' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- Direct client write over REST/GraphQL API
    IF v_role_setting IN ('authenticated', 'anon') THEN
        -- Check caller's role from members table
        SELECT role INTO v_caller_role FROM public.members WHERE auth_user_id = auth.uid();

        -- Non-admins/non-developers cannot mutate protected security fields directly
        IF v_caller_role IS NULL OR (v_caller_role <> 'ADMIN' AND v_caller_role <> 'DEVELOPER') THEN
            IF NEW.role IS DISTINCT FROM OLD.role OR
               NEW.points IS DISTINCT FROM OLD.points OR
               NEW.weekly_points IS DISTINCT FROM OLD.weekly_points OR
               NEW.monthly_points IS DISTINCT FROM OLD.monthly_points OR
               NEW.daily_points IS DISTINCT FROM OLD.daily_points OR
               NEW.member_number IS DISTINCT FROM OLD.member_number OR
               NEW.status IS DISTINCT FROM OLD.status OR
               NEW.can_schedule_links IS DISTINCT FROM OLD.can_schedule_links OR
               NEW.community_id IS DISTINCT FROM OLD.community_id THEN
                RAISE EXCEPTION 'PERMISSION_DENIED: Direct client modification of protected security fields (role, points, status) is strictly forbidden.';
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
BEGIN
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
        'MEMBER',
        'PENDING'
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

-- Schedule Permission Toggle RPC
CREATE OR REPLACE FUNCTION public.set_member_schedule_permission_secure(
    p_member_id UUID,
    p_can_schedule BOOLEAN
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
    SET can_schedule_links = p_can_schedule, updated_at = NOW()
    WHERE id = p_member_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

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
    v_next_serial INT;
    v_part INT;
    v_executed_count INT := 0;
BEGIN
    -- HARD RULE #8: Window Enforcement (12:00 - 16:00 BDT) unless invoked by admin
    IF v_curr_hour < 12 OR v_curr_hour >= 16 THEN
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
        ORDER BY sl.created_at ASC
    LOOP
        PERFORM pg_advisory_xact_lock(123456789);

        SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
        FROM public.daily_links WHERE date = v_today_bdt AND community_id = v_sched.community_id;

        v_part := ((v_next_serial - 1) / 20) + 1;

        INSERT INTO public.daily_links (
            community_id, owner_id, member_id, date, serial_number, link_number, serial_display, part_number, post_type, category, caption, instruction, fb_link
        ) VALUES (
            v_sched.community_id, v_sched.owner_id, v_sched.owner_id, v_today_bdt, v_next_serial, v_next_serial, 'SL-' || LPAD(v_next_serial::text, 3, '0'), v_part, v_sched.post_type, v_sched.category, v_sched.caption, v_sched.instruction, v_sched.fb_link
        );

        UPDATE public.scheduled_links SET status = 'executed', updated_at = NOW() WHERE id = v_sched.id;
        v_executed_count := v_executed_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'executed_count', v_executed_count);
END;
$$;

-- Invite Token RPCs
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(p_token_hash VARCHAR)
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
    WHERE token_hash = p_token_hash AND status = 'ACTIVE' AND expires_at > NOW();

    IF v_token.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID_OR_EXPIRED_TOKEN');
    END IF;

    UPDATE public.invite_tokens
    SET status = 'USED', used_at = NOW(), used_by = v_caller.id, updated_at = NOW()
    WHERE id = v_token.id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_invite_token(p_token_hash VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token public.invite_tokens%ROWTYPE;
BEGIN
    SELECT * INTO v_token FROM public.invite_tokens 
    WHERE token_hash = p_token_hash AND status = 'ACTIVE' AND expires_at > NOW();

    IF v_token.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Token is invalid or expired.');
    END IF;

    RETURN jsonb_build_object('valid', true, 'target_role', v_token.target_role);
END;
$$;

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

DROP POLICY IF EXISTS "Public communities read" ON public.communities;
CREATE POLICY "Public communities read" ON public.communities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Admin update settings" ON public.settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));

DROP POLICY IF EXISTS "Members view directory" ON public.members;
CREATE POLICY "Members view directory" ON public.members FOR SELECT TO authenticated
USING (true);

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
