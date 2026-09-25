-- ====================================================================
-- SUPPORT LINK BOX: MASTER PRODUCTION SQL - PART 3 OF 3
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

DO 1270 
BEGIN
    ALTER TABLE IF EXISTS public.settings DROP CONSTRAINT IF EXISTS settings_community_id_key;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'community_id'
    ) THEN
        ALTER TABLE public.settings ALTER COLUMN community_id DROP NOT NULL;
        ALTER TABLE public.settings ALTER COLUMN community_id DROP DEFAULT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'daily_link_limit') THEN
        INSERT INTO public.settings (key, value, description)
        VALUES ('daily_link_limit', '1'::jsonb, 'Number of links allowed per member per day');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'all_done_point_reward') THEN
        INSERT INTO public.settings (key, value, description)
        VALUES ('all_done_point_reward', '10'::jsonb, 'Points awarded for completing All-Done');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'system_maintenance_mode') THEN
        INSERT INTO public.settings (key, value, description)
        VALUES ('system_maintenance_mode', 'false'::jsonb, 'Toggle system maintenance status');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Seed settings completed with legacy fallback.';
END 1270;

-- END OF PART 3
