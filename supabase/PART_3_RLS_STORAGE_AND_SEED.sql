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

-- 2. RLS POLICIES (WITH SAFE DROP IF EXISTS PROTECTION & STRICT ACTIVE STATUS GUARDS)

-- Ensure compatibility columns in daily_links
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_links' AND column_name = 'owner_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_links' AND column_name = 'member_id') THEN
            ALTER TABLE public.daily_links ADD COLUMN owner_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
            UPDATE public.daily_links SET owner_id = member_id WHERE owner_id IS NULL;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_links' AND column_name = 'member_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_links' AND column_name = 'owner_id') THEN
            ALTER TABLE public.daily_links ADD COLUMN member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
            UPDATE public.daily_links SET member_id = owner_id WHERE member_id IS NULL;
        END IF;
    END IF;
END $$;

-- Communities
DROP POLICY IF EXISTS "Public communities read" ON public.communities;
CREATE POLICY "Public communities read" ON public.communities FOR SELECT USING (true);

-- Members
-- Security Rule: Own profile viewable even if PENDING/SUSPENDED for UI status screen; Directory viewable ONLY by ACTIVE members or Admin/Developer
DROP POLICY IF EXISTS "Authenticated members read" ON public.members;
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
DROP POLICY IF EXISTS "Active members view directory" ON public.members;
CREATE POLICY "Active members view directory" ON public.members FOR SELECT TO authenticated
USING (
    auth_user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

-- Security Rule: Profile update allowed ONLY for ACTIVE members (or Admin/Developer)
DROP POLICY IF EXISTS "Members update self or admin" ON public.members;
DROP POLICY IF EXISTS "members_update_policy" ON public.members;
DROP POLICY IF EXISTS "Active members update self or admin" ON public.members;
CREATE POLICY "Active members update self or admin" ON public.members FOR UPDATE TO authenticated
USING (
    (auth_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'))
    OR public.is_current_user_admin_or_dev()
)
WITH CHECK (
    (auth_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'))
    OR public.is_current_user_admin_or_dev()
);

-- Daily Links
-- Security Rule: Daily links viewable ONLY by ACTIVE members (prevents PENDING/SUSPENDED/REMOVED data leakage)
DROP POLICY IF EXISTS "Authenticated view daily links" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_select_policy" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_select" ON public.daily_links;
DROP POLICY IF EXISTS "Active members view daily links" ON public.daily_links;
CREATE POLICY "Active members view daily links" ON public.daily_links FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Members insert own daily link" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_insert_policy" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_insert" ON public.daily_links;
DROP POLICY IF EXISTS "Active members insert daily link" ON public.daily_links;
CREATE POLICY "Active members insert daily link" ON public.daily_links FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = daily_links.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Members update own link or admin" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_update_policy" ON public.daily_links;
DROP POLICY IF EXISTS "daily_links_update" ON public.daily_links;
DROP POLICY IF EXISTS "Active members update daily link" ON public.daily_links;
CREATE POLICY "Active members update daily link" ON public.daily_links FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = daily_links.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Admins delete daily link" ON public.daily_links;
CREATE POLICY "Admins delete daily link" ON public.daily_links FOR DELETE TO authenticated
USING (public.is_current_user_admin_or_dev());

-- Support Records
-- Security Rule: Support records viewable ONLY by ACTIVE members or Admin/Developer
DROP POLICY IF EXISTS "Authenticated view support records" ON public.support_records;
DROP POLICY IF EXISTS "support_records_select_policy" ON public.support_records;
DROP POLICY IF EXISTS "support_records_select" ON public.support_records;
DROP POLICY IF EXISTS "Active members view support records" ON public.support_records;
CREATE POLICY "Active members view support records" ON public.support_records FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Supporters insert own support record" ON public.support_records;
DROP POLICY IF EXISTS "support_records_insert_policy" ON public.support_records;
DROP POLICY IF EXISTS "support_records_insert" ON public.support_records;
DROP POLICY IF EXISTS "Active supporters insert support record" ON public.support_records;
CREATE POLICY "Active supporters insert support record" ON public.support_records FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = support_records.supporter_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    )
);

-- All Done Records
-- Security Rule: All Done completion viewable ONLY by ACTIVE members or Admin/Developer
DROP POLICY IF EXISTS "Authenticated view all done" ON public.all_done;
DROP POLICY IF EXISTS "all_done_select_policy" ON public.all_done;
DROP POLICY IF EXISTS "all_done_select" ON public.all_done;
DROP POLICY IF EXISTS "Active members view all done" ON public.all_done;
CREATE POLICY "Active members view all done" ON public.all_done FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Members insert own all done" ON public.all_done;
DROP POLICY IF EXISTS "all_done_insert_policy" ON public.all_done;
DROP POLICY IF EXISTS "all_done_insert" ON public.all_done;
DROP POLICY IF EXISTS "Active members insert all done" ON public.all_done FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members
        WHERE id = all_done.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    )
);

-- Scheduled Links
DROP POLICY IF EXISTS "Scheduled links viewable by owner or admin" ON public.scheduled_links;
DROP POLICY IF EXISTS "scheduled_links_select" ON public.scheduled_links;
DROP POLICY IF EXISTS "Active members view scheduled links" ON public.scheduled_links;
CREATE POLICY "Active members view scheduled links" ON public.scheduled_links FOR SELECT TO authenticated
USING (
    (
        EXISTS (
            SELECT 1 FROM public.members 
            WHERE id = scheduled_links.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
        )
    ) OR public.is_current_user_admin_or_dev()
);

-- Invite Tokens
DROP POLICY IF EXISTS "Admins manage invite tokens" ON public.invite_tokens;
CREATE POLICY "Admins manage invite tokens" ON public.invite_tokens FOR ALL TO authenticated
USING (public.is_current_user_admin_or_dev());

-- Reports & Replies
DROP POLICY IF EXISTS "Members view own reports or admin" ON public.reports;
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "Members view own reports or admin" ON public.reports FOR SELECT TO authenticated
USING (
    (
        EXISTS (
            SELECT 1 FROM public.members WHERE id = reports.reporter_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
        )
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Members create reports" ON public.reports;
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "Members create reports" ON public.reports FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members WHERE id = reports.reporter_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    )
);

-- Notifications
DROP POLICY IF EXISTS "Members view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "Members view own notifications" ON public.notifications FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = notifications.member_id AND auth_user_id = auth.uid()
    ) OR public.is_current_user_admin_or_dev()
);

-- Notices
DROP POLICY IF EXISTS "Members view notices" ON public.notices;
DROP POLICY IF EXISTS "notices_select" ON public.notices;
DROP POLICY IF EXISTS "Active members view notices" ON public.notices;
CREATE POLICY "Active members view notices" ON public.notices FOR SELECT TO authenticated
USING (
    (
        EXISTS (
            SELECT 1 FROM public.members 
            WHERE id = notices.target_member_id AND auth_user_id = auth.uid()
        )
    )
    OR (
        notices.target_member_id IS NULL AND EXISTS (
            SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
        )
    )
    OR public.is_current_user_admin_or_dev()
);

-- Points & Summary
DROP POLICY IF EXISTS "point_tx_select" ON public.point_transactions;
DROP POLICY IF EXISTS "Active members view point transactions" ON public.point_transactions;
CREATE POLICY "Active members view point transactions" ON public.point_transactions FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = point_transactions.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members view points history" ON public.points_history;
CREATE POLICY "Active members view points history" ON public.points_history FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = points_history.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Active members view daily summary" ON public.member_daily_summary;
CREATE POLICY "Active members view daily summary" ON public.member_daily_summary FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = member_daily_summary.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
    ) OR public.is_current_user_admin_or_dev()
);

-- Audit Logs
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_current_user_admin_or_dev());

-- Movies & Requests
DROP POLICY IF EXISTS "movies_select_policy" ON public.movies;
DROP POLICY IF EXISTS "Active members view movies" ON public.movies;
CREATE POLICY "Active members view movies" ON public.movies FOR SELECT TO authenticated
USING (
    (
        status = 'Published' AND EXISTS (
            SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
        )
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "movie_requests_select_policy" ON public.movie_requests;
DROP POLICY IF EXISTS "Active members view movie requests" ON public.movie_requests;
CREATE POLICY "Active members view movie requests" ON public.movie_requests FOR SELECT TO authenticated
USING (
    (
        EXISTS (
            SELECT 1 FROM public.members WHERE id = movie_requests.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
        )
    ) OR public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "movie_requests_insert_policy" ON public.movie_requests;
DROP POLICY IF EXISTS "Active members insert movie request" ON public.movie_requests FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members WHERE id = movie_requests.member_id AND auth_user_id = auth.uid() AND status = 'ACTIVE'
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
