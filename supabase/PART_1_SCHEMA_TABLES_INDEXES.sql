-- ====================================================================
-- OPTIONAL RESET (IF RE-RUNNING ON AN OLD BROKEN/INCOMPATIBLE SCHEMA):
-- To completely start fresh and wipe legacy tables, UNCOMMENT the line below before running:
-- DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;
-- ====================================================================

-- ====================================================================
-- SUPPORT LINK BOX: MASTER PRODUCTION SQL - PART 1 OF 3
-- SCHEMA, EXTENSIONS, ENUMS, SEQUENCES, TABLES & INDEXES
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script FIRST in Supabase SQL Editor.
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM TYPES & ENUMS
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('DEVELOPER', 'ADMIN', 'MEMBER'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN CREATE TYPE member_status AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE', 'FROZEN', 'SUSPENDED', 'REMOVED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN CREATE TYPE post_type AS ENUM ('Photo', 'Video'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'link_category') THEN CREATE TYPE link_category AS ENUM ('NORMAL', 'VIP', 'ADMIN', 'NOTICE'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN CREATE TYPE invite_status AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED'); END IF; END $$;

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


-- ====================================================================
-- SAFE MIGRATION / AUTO-REPAIR GUARANTEES
-- Ensures all columns exist even if tables pre-existed from legacy runs.

-- Members guarantees
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main';
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS member_number VARCHAR(20);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'MEMBER';
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS status member_status DEFAULT 'PENDING';
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_name VARCHAR(100);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_name_original VARCHAR(100);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_profile_url TEXT;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_identity_key VARCHAR(100);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS facebook_identity_type VARCHAR(50);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS alt_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS vip_points INT DEFAULT 0;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS total_supports_given INT DEFAULT 0;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS total_supports_received INT DEFAULT 0;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS consecutive_all_dones INT DEFAULT 0;
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Daily links guarantees
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS post_type post_type DEFAULT 'Photo';
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS category link_category DEFAULT 'NORMAL';
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS post_link TEXT;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS link_code VARCHAR(20);
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS supports_count INT DEFAULT 0;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;

-- Scheduled links guarantees
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS post_type post_type DEFAULT 'Photo';
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS post_link TEXT;
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- Support records guarantees
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS link_id UUID REFERENCES public.daily_links(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS supporter_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS supported_at TIMESTAMPTZ DEFAULT NOW();

-- All done guarantees
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS required_links_count INT DEFAULT 0;
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS supported_links_count INT DEFAULT 0;
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS points_awarded INT DEFAULT 0;
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

-- Notices guarantees
ALTER TABLE IF EXISTS public.notices ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE IF EXISTS public.notices ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE IF EXISTS public.notices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.members(id);
ALTER TABLE IF EXISTS public.notices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Notifications guarantees
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS title VARCHAR(150);
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'INFO';
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Reports guarantees
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS reported_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS link_id UUID REFERENCES public.daily_links(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS subject VARCHAR(200);
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- Invite tokens guarantees
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS raw_token_display TEXT;
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'MEMBER';
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS status invite_status DEFAULT 'ACTIVE';

-- Points history & transactions guarantees
ALTER TABLE IF EXISTS public.points_history ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.points_history ADD COLUMN IF NOT EXISTS points_change INT DEFAULT 0;
ALTER TABLE IF EXISTS public.points_history ADD COLUMN IF NOT EXISTS balance_after INT DEFAULT 0;
ALTER TABLE IF EXISTS public.points_history ADD COLUMN IF NOT EXISTS reason VARCHAR(100);

ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS amount INT DEFAULT 0;
ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'TRANSFER';
ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS note TEXT;

-- Member daily summary guarantees
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS supports_given INT DEFAULT 0;
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS all_done_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS points_earned INT DEFAULT 0;

-- Other tables guarantees
ALTER TABLE IF EXISTS public.member_punishments ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.fake_all_done_incidents ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.movie_access_tokens ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.leaderboard_results ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.vip_reward_entitlements ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.alt_id_disclosures ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;




-- Settings guarantees & legacy constraint cleanup
ALTER TABLE IF EXISTS public.settings DROP CONSTRAINT IF EXISTS settings_community_id_key;
DO 1248 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'community_id'
    ) THEN
        ALTER TABLE public.settings ALTER COLUMN community_id DROP NOT NULL;
        ALTER TABLE public.settings ALTER COLUMN community_id DROP DEFAULT;
    END IF;
END 1248;

ALTER TABLE IF EXISTS public.settings ADD COLUMN IF NOT EXISTS key VARCHAR(100);
ALTER TABLE IF EXISTS public.settings ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE IF EXISTS public.settings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.members(id);


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
