const fs = require('fs');
const path = require('path');

// ==========================================
// PART 1: SCHEMA, TABLES, SEQUENCES & INDEXES
// ==========================================
const part1Header = `-- ====================================================================
-- SUPPORT LINK BOX: MASTER SQL - PART 1 OF 3
-- SCHEMA, EXTENSIONS, TYPES, SEQUENCES, TABLES & INDEXES
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script FIRST in Supabase SQL Editor.
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM TYPES & ENUMS
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
    CREATE TYPE invite_status AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;

-- 4. TABLES DEFINITIONS

-- Communities Table
CREATE TABLE IF NOT EXISTS public.communities (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    name VARCHAR(100) NOT NULL DEFAULT 'Support Link Box Official',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members Table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main' REFERENCES public.communities(id),
    member_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'MEMBER',
    status member_status NOT NULL DEFAULT 'PENDING',
    
    -- Facebook Identity
    facebook_name VARCHAR(100),
    facebook_name_original VARCHAR(100),
    facebook_url TEXT,
    facebook_profile_url TEXT,
    facebook_identity_key VARCHAR(100),
    facebook_identity_type VARCHAR(50),
    
    -- Additional Identity & Profile
    whatsapp_number VARCHAR(30),
    profile_photo_url TEXT,
    alt_ids JSONB DEFAULT '[]'::jsonb,
    
    -- Points & VIP System
    points INT NOT NULL DEFAULT 0,
    vip_points INT NOT NULL DEFAULT 0,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    vip_expires_at TIMESTAMPTZ,
    
    -- Stats & Tracking
    total_supports_given INT NOT NULL DEFAULT 0,
    total_supports_received INT NOT NULL DEFAULT 0,
    consecutive_all_dones INT NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.members(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT members_facebook_identity_key_type_key UNIQUE (facebook_identity_key, facebook_identity_type)
);

-- Daily Links Table
CREATE TABLE IF NOT EXISTS public.daily_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    post_type post_type NOT NULL,
    category link_category NOT NULL DEFAULT 'NORMAL',
    post_link TEXT NOT NULL,
    link_code VARCHAR(50),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supports_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled Links Table
CREATE TABLE IF NOT EXISTS public.scheduled_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    post_type post_type NOT NULL,
    post_link TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Records Table
CREATE TABLE IF NOT EXISTS public.support_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES public.daily_links(id) ON DELETE CASCADE,
    supporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_supporter_link_date UNIQUE (link_id, supporter_id, date)
);

-- All Done Table
CREATE TABLE IF NOT EXISTS public.all_done (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    required_links_count INT NOT NULL DEFAULT 0,
    supported_links_count INT NOT NULL DEFAULT 0,
    points_awarded INT NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unique_member_all_done_date UNIQUE (member_id, date)
);

-- Invite Tokens Table
CREATE TABLE IF NOT EXISTS public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    raw_token_display TEXT,
    role user_role NOT NULL DEFAULT 'MEMBER',
    status invite_status NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES public.members(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ
);

-- Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    reported_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    link_id UUID REFERENCES public.daily_links(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report Replies Table
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.members(id),
    is_important BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    target_role user_role,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcement Reads Table
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_announcement_member_read UNIQUE (announcement_id, member_id)
);

-- Notices Table
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.members(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.members(id)
);

-- Points History Table
CREATE TABLE IF NOT EXISTS public.points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    points_change INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    reference_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Point Transactions Table
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    receiver_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member Daily Summary Table
CREATE TABLE IF NOT EXISTS public.member_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supports_given INT NOT NULL DEFAULT 0,
    all_done_completed BOOLEAN NOT NULL DEFAULT FALSE,
    points_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_daily_summary UNIQUE (member_id, date)
);

-- Archive Batches Table
CREATE TABLE IF NOT EXISTS public.archive_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_date DATE NOT NULL,
    records_archived INT NOT NULL DEFAULT 0,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member Punishments Table
CREATE TABLE IF NOT EXISTS public.member_punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    issued_by UUID NOT NULL REFERENCES public.members(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fake All Done Incidents Table
CREATE TABLE IF NOT EXISTS public.fake_all_done_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    claimed_supports INT NOT NULL DEFAULT 0,
    actual_supports INT NOT NULL DEFAULT 0,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media Items Table
CREATE TABLE IF NOT EXISTS public.media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    media_type VARCHAR(20) NOT NULL DEFAULT 'MOVIE',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT,
    is_vip_only BOOLEAN NOT NULL DEFAULT FALSE,
    required_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Movie Access Tokens Table
CREATE TABLE IF NOT EXISTS public.movie_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leaderboard Results Table
CREATE TABLE IF NOT EXISTS public.leaderboard_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    period_key VARCHAR(20) NOT NULL,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    total_supports INT NOT NULL DEFAULT 0,
    total_points INT NOT NULL DEFAULT 0,
    reward_granted VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VIP Reward Entitlements Table
CREATE TABLE IF NOT EXISTS public.vip_reward_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    reward_type VARCHAR(50) NOT NULL,
    description TEXT,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alt ID Disclosures Table
CREATE TABLE IF NOT EXISTS public.alt_id_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    alt_facebook_name VARCHAR(100) NOT NULL,
    alt_facebook_url TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.members(role);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_members_member_number ON public.members(member_number);

CREATE INDEX IF NOT EXISTS idx_daily_links_member_id ON public.daily_links(member_id);
CREATE INDEX IF NOT EXISTS idx_daily_links_date ON public.daily_links(date);
CREATE INDEX IF NOT EXISTS idx_daily_links_active ON public.daily_links(is_active);

CREATE INDEX IF NOT EXISTS idx_support_records_link_id ON public.support_records(link_id);
CREATE INDEX IF NOT EXISTS idx_support_records_supporter_id ON public.support_records(supporter_id);
CREATE INDEX IF NOT EXISTS idx_support_records_receiver_id ON public.support_records(receiver_id);
CREATE INDEX IF NOT EXISTS idx_support_records_date ON public.support_records(date);

CREATE INDEX IF NOT EXISTS idx_all_done_member_id ON public.all_done(member_id);
CREATE INDEX IF NOT EXISTS idx_all_done_date ON public.all_done(date);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token_hash ON public.invite_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_member_id ON public.invite_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_status ON public.invite_tokens(status);

CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON public.notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

-- END OF PART 1
`;

// ==========================================
// PART 2: FUNCTIONS, TRIGGERS & RPCS
// ==========================================
const part2Header = `-- ====================================================================
-- SUPPORT LINK BOX: MASTER SQL - PART 2 OF 3
-- FUNCTIONS, TRIGGERS, PROCEDURES & RPCS
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script SECOND after Part 1 completes.
-- ====================================================================

-- 1. HELPER SECURITY FUNCTIONS

-- Role Checking Function
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.members
    WHERE auth_user_id = auth.uid();
    
    RETURN v_role IN ('ADMIN', 'DEVELOPER');
END;
$$;

-- Secure Member Number Generator
CREATE OR REPLACE FUNCTION public.generate_member_number_secure()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  v_seq := nextval('public.member_number_seq');
  RETURN 'SLB-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- Updated At Timestamp Auto-Update Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. AUTHENTICATION & NEW USER TRIGGERS

-- Handle New User Registration Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_email VARCHAR(150);
    v_member_num TEXT;
    v_username VARCHAR(50);
BEGIN
    -- Skip if marked as invite consumption
    IF NEW.raw_user_meta_data->>'is_invite_consumption' = 'true' THEN
        RETURN NEW;
    END IF;

    v_norm_email := LOWER(TRIM(NEW.email));
    v_member_num := public.generate_member_number_secure();
    v_username := split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4);

    INSERT INTO public.members (
        auth_user_id,
        member_number,
        name,
        username,
        email,
        role,
        status,
        facebook_name,
        facebook_name_original,
        facebook_url,
        facebook_profile_url,
        facebook_identity_key,
        facebook_identity_type,
        profile_photo_url
    ) VALUES (
        NEW.id,
        v_member_num,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), ''), split_part(v_norm_email, '@', 1)),
        v_username,
        v_norm_email,
        'MEMBER',
        'PENDING',
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_identity_key',
        NEW.raw_user_meta_data->>'facebook_identity_type',
        COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Re-attach Auth Trigger Safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. INVITE SYSTEM RPCS

-- Verify Invite Token
CREATE OR REPLACE FUNCTION public.verify_invite_token(p_raw_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token record;
  v_token_hash TEXT;
BEGIN
  v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');
  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.attempt_count >= 10 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  IF v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    IF v_token.status = 'ACTIVE' THEN
        UPDATE public.invite_tokens 
        SET 
          status = CASE WHEN v_token.expires_at < NOW() THEN 'EXPIRED' ELSE status END,
          attempt_count = attempt_count + 1, 
          last_attempt_at = NOW() 
        WHERE id = v_token.id;
    END IF;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- Consume Invite Token
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(
    p_token_hash TEXT,
    p_auth_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token record;
  v_member record;
BEGIN
  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_TOKEN');
  END IF;

  IF v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'EXPIRED_OR_USED');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = v_token.member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MEMBER_NOT_FOUND');
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_LINKED');
  END IF;

  UPDATE public.members
  SET auth_user_id = p_auth_uid, status = 'ACTIVE'
  WHERE id = v_member.id;

  UPDATE public.invite_tokens
  SET status = 'USED', used_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object('success', true, 'member_id', v_member.id);
END;
$$;

-- Secure Login Check
CREATE OR REPLACE FUNCTION public.secure_login_check(
    p_identifier TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_member record;
  v_user record;
  v_email TEXT;
BEGIN
  IF p_identifier LIKE '%@%' THEN
    v_email := LOWER(TRIM(p_identifier));
    SELECT * INTO v_member FROM public.members WHERE LOWER(email) = v_email;
  ELSE
    SELECT * INTO v_member FROM public.members WHERE UPPER(member_number) = UPPER(TRIM(p_identifier));
    IF FOUND THEN
      v_email := LOWER(v_member.email);
    END IF;
  END IF;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE email = v_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  IF v_user.encrypted_password != crypt(p_password, v_user.encrypted_password) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  RETURN jsonb_build_object('success', true, 'email', v_email, 'member_id', v_member.id);
END;
$$;

-- GRANT EXECUTE ON RPCS
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM PUBLIC;

-- END OF PART 2
`;

// ==========================================
// PART 3: RLS POLICIES, STORAGE & SEED DATA
// ==========================================
const part3Header = `-- ====================================================================
-- SUPPORT LINK BOX: MASTER SQL - PART 3 OF 3
-- ROW LEVEL SECURITY (RLS), STORAGE BUCKETS & SEED DATA
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script THIRD after Part 2 completes.
-- ====================================================================

-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_done ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fake_all_done_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_reward_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alt_id_disclosures ENABLE ROW LEVEL SECURITY;

-- 2. RLS POLICIES (WITH SAFE DROP IF EXISTS PROTECTION)

-- Communities
DROP POLICY IF EXISTS "Public communities read" ON public.communities;
CREATE POLICY "Public communities read" ON public.communities FOR SELECT USING (true);

-- Members
DROP POLICY IF EXISTS "Authenticated members read" ON public.members;
CREATE POLICY "Authenticated members read" ON public.members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members update self or admin" ON public.members;
CREATE POLICY "Members update self or admin" ON public.members FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid() OR public.is_current_user_admin_or_dev());

-- Daily Links
DROP POLICY IF EXISTS "Authenticated view daily links" ON public.daily_links;
CREATE POLICY "Authenticated view daily links" ON public.daily_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members insert own daily link" ON public.daily_links;
CREATE POLICY "Members insert own daily link" ON public.daily_links FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = daily_links.member_id AND auth_user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Members update own link or admin" ON public.daily_links;
CREATE POLICY "Members update own link or admin" ON public.daily_links FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = daily_links.member_id AND auth_user_id = auth.uid()
    ) OR public.is_current_user_admin_or_dev()
);

-- Support Records
DROP POLICY IF EXISTS "Authenticated view support records" ON public.support_records;
CREATE POLICY "Authenticated view support records" ON public.support_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Supporters insert own support record" ON public.support_records;
CREATE POLICY "Supporters insert own support record" ON public.support_records FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = support_records.supporter_id AND auth_user_id = auth.uid()
    )
);

-- All Done Records
DROP POLICY IF EXISTS "Authenticated view all done" ON public.all_done;
CREATE POLICY "Authenticated view all done" ON public.all_done FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members insert own all done" ON public.all_done;
CREATE POLICY "Members insert own all done" ON public.all_done FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = all_done.member_id AND auth_user_id = auth.uid()
    )
);

-- Invite Tokens
DROP POLICY IF EXISTS "Admins manage invite tokens" ON public.invite_tokens;
CREATE POLICY "Admins manage invite tokens" ON public.invite_tokens FOR ALL TO authenticated
USING (public.is_current_user_admin_or_dev());

-- Reports & Replies
DROP POLICY IF EXISTS "Members view own reports or admin" ON public.reports;
CREATE POLICY "Members view own reports or admin" ON public.reports FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members WHERE id = reports.reporter_id AND auth_user_id = auth.uid()
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Members create reports" ON public.reports;
CREATE POLICY "Members create reports" ON public.reports FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members WHERE id = reports.reporter_id AND auth_user_id = auth.uid()
    )
);

-- Notifications
DROP POLICY IF EXISTS "Members view own notifications" ON public.notifications;
CREATE POLICY "Members view own notifications" ON public.notifications FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members WHERE id = notifications.member_id AND auth_user_id = auth.uid()
    )
);

-- Settings
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Admin update settings" ON public.settings FOR ALL TO authenticated
USING (public.is_current_user_admin_or_dev());

-- 3. STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Storage Read Avatars" ON storage.objects;
CREATE POLICY "Public Storage Read Avatars" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'media'));

DROP POLICY IF EXISTS "Authenticated Storage Upload Avatars" ON storage.objects;
CREATE POLICY "Authenticated Storage Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('avatars', 'media'));

-- 4. INITIAL SEED DATA
INSERT INTO public.communities (id, name, description)
VALUES ('main', 'Support Link Box Official', 'Primary community partition')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (key, value, description)
VALUES 
  ('daily_link_limit', '1'::jsonb, 'Number of links allowed per member per day'),
  ('all_done_point_reward', '10'::jsonb, 'Points awarded for completing All-Done'),
  ('system_maintenance_mode', 'false'::jsonb, 'Toggle system maintenance status')
ON CONFLICT (key) DO NOTHING;

-- END OF PART 3
`;

fs.writeFileSync(path.join(__dirname, 'supabase/PART_1_SCHEMA_TABLES_INDEXES.sql'), part1Header, 'utf8');
fs.writeFileSync(path.join(__dirname, 'supabase/PART_2_FUNCTIONS_AND_TRIGGERS.sql'), part2Header, 'utf8');
fs.writeFileSync(path.join(__dirname, 'supabase/PART_3_RLS_STORAGE_AND_SEED.sql'), part3Header, 'utf8');

console.log('All 3 Master SQL files generated successfully in supabase/ directory!');
