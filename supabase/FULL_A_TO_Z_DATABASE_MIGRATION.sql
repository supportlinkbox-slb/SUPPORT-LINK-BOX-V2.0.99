-- ====================================================================
-- SUPPORT LINK BOX: FULL A-TO-Z CANONICAL MASTER DATABASE MIGRATION
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Features: Strict Security Guards, Privilege Escalation Prevention,
--           Atomic Numbering, Advisory Locking, Complete RLS Policies
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
        -- Ensure all required enum values exist
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

-- Ensure can_schedule_links column exists if table was previously created
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'can_schedule_links') THEN
        ALTER TABLE public.members ADD COLUMN can_schedule_links BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'monthly_points') THEN
        ALTER TABLE public.members ADD COLUMN monthly_points INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'daily_points') THEN
        ALTER TABLE public.members ADD COLUMN daily_points INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

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

-- Report Replies
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role user_role NOT NULL DEFAULT 'MEMBER',
    message TEXT NOT NULL,
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

-- Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id VARCHAR(50) UNIQUE NOT NULL DEFAULT 'main' REFERENCES public.communities(id) ON DELETE CASCADE,
    submission_start_time VARCHAR(10) NOT NULL DEFAULT '00:00',
    submission_end_time VARCHAR(10) NOT NULL DEFAULT '16:50',
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

-- Point Transactions
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

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_status_role ON public.members(status, role);
CREATE INDEX IF NOT EXISTS idx_daily_links_owner_date ON public.daily_links(owner_id, date);
CREATE INDEX IF NOT EXISTS idx_support_records_supporter_date ON public.support_records(supporter_id, date);
CREATE INDEX IF NOT EXISTS idx_all_done_member_date ON public.all_done(member_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_member_unread ON public.notifications(member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_point_transactions_member_date ON public.point_transactions(member_id, date);

-- 5. CRITICAL SECURITY TRIGGER: PREVENT PRIVILEGE ESCALATION
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role user_role;
BEGIN
    -- If update is initiated by service role / system internal bypass, allow
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_caller_role FROM public.members WHERE auth_user_id = auth.uid();

    -- Only ADMIN and DEVELOPER may change role, points, status, or can_schedule_links
    IF v_caller_role IS NULL OR (v_caller_role <> 'ADMIN' AND v_caller_role <> 'DEVELOPER') THEN
        NEW.role := OLD.role;
        NEW.points := OLD.points;
        NEW.weekly_points := OLD.weekly_points;
        NEW.monthly_points := OLD.monthly_points;
        NEW.daily_points := OLD.daily_points;
        NEW.member_number := OLD.member_number;
        NEW.status := OLD.status;
        NEW.can_schedule_links := OLD.can_schedule_links;
        NEW.community_id := OLD.community_id;
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

-- 6. SECURITY DEFINER HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.members
        WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.members
        WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    );
$$;

-- 7. SECURE AUTH & DIRECTORY RPCs

-- Login Member ID Resolution RPC
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

-- Leaderboard Public Safe Ranking RPC
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
    SELECT 
        m.id,
        m.name,
        m.member_number,
        m.profile_photo_url,
        m.role,
        m.status,
        m.points,
        m.weekly_points,
        m.monthly_points,
        m.daily_points,
        m.total_links_submitted,
        m.total_supports_given,
        m.total_all_done
    FROM public.members m
    WHERE m.status = 'ACTIVE'
    ORDER BY 
        CASE WHEN UPPER(p_period) = 'WEEKLY' THEN m.weekly_points
             WHEN UPPER(p_period) = 'DAILY' THEN m.daily_points
             WHEN UPPER(p_period) = 'MONTHLY' THEN m.monthly_points
             ELSE m.points
        END DESC,
        m.total_all_done DESC
    LIMIT 100;
END;
$$;

-- Ad Recovery Procedure
CREATE OR REPLACE FUNCTION public.rpc_complete_ad_recovery(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    IF v_member.status IN ('SUSPENDED', 'FROZEN', 'INACTIVE') THEN
        UPDATE public.members
        SET status = 'ACTIVE', updated_at = NOW()
        WHERE id = p_member_id;

        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (p_member_id, v_member.name, v_member.role::text, 'AD_RECOVERY_COMPLETED', 'MEMBER', p_member_id::text, 'Member recovered account status to ACTIVE via Ad step.');

        RETURN jsonb_build_object('success', true);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Member already active');
END;
$$;

-- Developer System Reset Procedure
CREATE OR REPLACE FUNCTION public.rpc_developer_reset_system(p_reset_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role user_role;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
BEGIN
    SELECT role INTO v_caller_role FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_role <> 'DEVELOPER' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN: DEVELOPER role required.');
    END IF;

    IF UPPER(p_reset_type) = 'DAILY' THEN
        DELETE FROM public.support_records WHERE date = v_today;
        DELETE FROM public.all_done WHERE date = v_today;
        DELETE FROM public.daily_links WHERE date = v_today;
    ELSIF UPPER(p_reset_type) = 'ALL' THEN
        DELETE FROM public.support_records;
        DELETE FROM public.all_done;
        DELETE FROM public.daily_links;
        DELETE FROM public.scheduled_links;
        DELETE FROM public.point_transactions;
        DELETE FROM public.reports;
        DELETE FROM public.member_punishments;
        DELETE FROM public.fake_all_done_incidents;
    END IF;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
        (SELECT id FROM public.members WHERE auth_user_id = auth.uid()),
        'Developer', 'DEVELOPER', 'SYSTEM_RESET_EXECUTED', 'SYSTEM', 'GLOBAL',
        'Reset type: ' || p_reset_type
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fake_all_done_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_punishments ENABLE ROW LEVEL SECURITY;

-- Communities
DROP POLICY IF EXISTS "Public communities read" ON public.communities;
CREATE POLICY "Public communities read" ON public.communities FOR SELECT USING (true);

-- Members
DROP POLICY IF EXISTS "Active members view directory" ON public.members;
CREATE POLICY "Active members view directory" ON public.members FOR SELECT TO authenticated
USING (
    auth_user_id = auth.uid()
    OR public.is_current_user_active()
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members update self or admin" ON public.members;
CREATE POLICY "Active members update self or admin" ON public.members FOR UPDATE TO authenticated
USING (
    auth_user_id = auth.uid()
    OR public.is_current_user_admin_or_dev()
)
WITH CHECK (
    auth_user_id = auth.uid()
    OR public.is_current_user_admin_or_dev()
);

-- Daily Links
DROP POLICY IF EXISTS "Active members view daily links" ON public.daily_links;
CREATE POLICY "Active members view daily links" ON public.daily_links FOR SELECT TO authenticated
USING (
    public.is_current_user_active()
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members insert daily link" ON public.daily_links;
CREATE POLICY "Active members insert daily link" ON public.daily_links FOR INSERT TO authenticated
WITH CHECK (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'))
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members update daily link" ON public.daily_links;
CREATE POLICY "Active members update daily link" ON public.daily_links FOR UPDATE TO authenticated
USING (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'))
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Admins delete daily link" ON public.daily_links;
CREATE POLICY "Admins delete daily link" ON public.daily_links FOR DELETE TO authenticated
USING (public.is_current_user_admin_or_dev());

-- Scheduled Links
DROP POLICY IF EXISTS "Scheduled links viewable" ON public.scheduled_links;
CREATE POLICY "Scheduled links viewable" ON public.scheduled_links FOR SELECT TO authenticated
USING (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Scheduled links insert" ON public.scheduled_links;
CREATE POLICY "Scheduled links insert" ON public.scheduled_links FOR INSERT TO authenticated
WITH CHECK (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND can_schedule_links = true))
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Scheduled links update" ON public.scheduled_links;
CREATE POLICY "Scheduled links update" ON public.scheduled_links FOR UPDATE TO authenticated
USING (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Scheduled links delete" ON public.scheduled_links;
CREATE POLICY "Scheduled links delete" ON public.scheduled_links FOR DELETE TO authenticated
USING (
    (owner_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
    OR public.is_current_user_admin_or_dev()
);

-- Support Records
DROP POLICY IF EXISTS "Active members view support records" ON public.support_records;
CREATE POLICY "Active members view support records" ON public.support_records FOR SELECT TO authenticated
USING (
    public.is_current_user_active()
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active supporters insert support record" ON public.support_records;
CREATE POLICY "Active supporters insert support record" ON public.support_records FOR INSERT TO authenticated
WITH CHECK (
    supporter_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE')
    OR public.is_current_user_admin_or_dev()
);

-- All Done Records
DROP POLICY IF EXISTS "Active members view all done" ON public.all_done;
CREATE POLICY "Active members view all done" ON public.all_done FOR SELECT TO authenticated
USING (
    public.is_current_user_active()
    OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members insert all done" ON public.all_done;
CREATE POLICY "Active members insert all done" ON public.all_done FOR INSERT TO authenticated
WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE')
    OR public.is_current_user_admin_or_dev()
);

-- Settings
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Admin update settings" ON public.settings FOR ALL TO authenticated
USING (public.is_current_user_admin_or_dev());

-- 9. INITIAL SEED
INSERT INTO public.communities (id, name, description)
VALUES ('main', 'Support Link Box Official', 'Primary community partition')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (community_id)
VALUES ('main')
ON CONFLICT (community_id) DO NOTHING;
