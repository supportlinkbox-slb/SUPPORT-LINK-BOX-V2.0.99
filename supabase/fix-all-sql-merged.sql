-- ============================================================================
-- SLB MERGED FIX FILE — ALL SQL BATCHES IN ONE (fix-all-sql-merged.sql)
-- .sql -> Supabase SQL Editor  |  project: ufgmyoppqedreqomcmcp (Singapore)
-- ============================================================================
-- THIS ONE FILE REPLACES (run it INSTEAD of, or AFTER, any of these):
--   fix-critical-batch1.sql        (C1,C2,C3,C4,C5,C6,C9)          — already LIVE
--   fix-critical-batch2.sql        (C10,C11,C12,C13,C15,C16,C17,C18,C19) — delivered
--   fix-high-batch.sql             (H3,H4,H5,H10,H11,H12,H13,H15,H17,H24,H25,
--                                   H26,H27,H29,H30,H32,H34,H35,H36,M37)
--   fix-medium-batch.sql           (M2,M8,M9,M10,M12,M13,M14,M18,M20,M21,M22,
--                                   M25,M27,M29,M34,M35,M36,L12,L15,L17,L22,L24)
--   fix-memberid-enumeration.sql   (M3 email-oracle kill, C7 member-ID login) — already LIVE
--
-- Every function/table/policy is written EXACTLY ONCE. Where two batches
-- rewrote the same function, the changes were MERGED into one body:
--   submit_daily_link_secure (6-arg) : H11 category coercion + M8 can_submit_links
--                                       + M9 part_number / no-'#' serial + M10 ACTIVE gate
--   rpc_submit_daily_link (5-arg)    : H11 + M8 + M10 + M22
--   record_support_atomic            : C9 + H12 (date/status) + H13 (ALREADY_SUPPORTED)
--   rpc_submit_all_done (2-arg)      : H15 (REVOKED filter) + H17 (COALESCE settings)
--                                       + M13 (rollups) + M22 (BDT date)
--   confirm_fake_all_done_secure     : C17/C19 + M12 (advisory lock, GREATEST floor)
--                                       + M18 (total_all_done decrement)
--   create_scheduled_link_secure     : C18 (R8 gates) + M25 (URL/owner-active/duplicate)
--   review_profile_change            : H36 (FOR UPDATE) + M36 (audit)
--   request_profile_change           : H35 (unique race) + M34 (validation)
--   approve_member_secure            : batch-2 (canonical audit) + high H25 (correct flag)
--   reject_member_secure             : batch-2, with the status-change flag corrected
--                                      (see MERGE NOTE below)
--
-- MERGE NOTES (bugs found while merging, fixed here):
--   1. batch-2's approve_member_secure / reject_member_secure set
--      slb.internal_approval, which the LIVE guard (C1) does NOT honor ->
--      every approve/reject would raise SECURITY_VIOLATION. Fixed to
--      slb.internal_status_change (the flag high/H25 proved correct), and the
--      'ACTIVE'::member_status casts were dropped (plain literal works for
--      both enum and text columns; the cast fails if the enum is absent).
--   2. high's rpc_submit_daily_link audit INSERT used actor_auth_id UNWRAPPED.
--      The merged version uses the wrapped canonical 7-col insert (medium).
--   3. high's rpc_submit_all_done used (CURRENT_DATE AT TIME ZONE ...) which
--      does NOT yield the BDT date under a non-BDT session. Merged version
--      uses M22's (NOW() AT TIME ZONE 'Asia/Dhaka')::date everywhere.
--
-- DEFENSIVE DESIGN: idempotent throughout (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP IF EXISTS / information_schema guards). Safe to re-run, and safe to run
-- AFTER batch-1 / batch-2 / memberid-enumeration were already applied.
--
-- SHAPE GUARANTEES: the live schema is UNKNOWN (competing migration files),
-- so this file ADDs every column the merged RPCs touch (ADD COLUMN IF NOT
-- EXISTS). No merged function references a column without a DDL guarantee.
-- Assumptions that remain: the enum types post_type / link_category /
-- member_status / user_role exist IF the live DB uses them (the originals
-- did); auth.users and the profile_change_requests table (live since
-- 2026-10-05) exist.
--
-- No secrets anywhere in this file.
-- ============================================================================

-- ============================ SECTION A: members DDL ========================
-- Batch-1 (C3) + batch-2 C19 + medium M2/M8/M13 + high H25 + shape guarantees.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS total_links_submitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS total_supports_given INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS can_schedule_links BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS can_submit_links BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS weekly_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS monthly_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS daily_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS total_all_done INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.members(id);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- M2: backfill joined_at from created_at where possible.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'members'
               AND column_name = 'created_at') THEN
    UPDATE public.members SET joined_at = created_at WHERE joined_at IS NULL;
    RAISE NOTICE 'M2: joined_at backfilled from created_at';
  ELSE
    RAISE WARNING 'M2: members.created_at missing; joined_at left at NOW() default';
  END IF;
END
$$;

-- ============================ SECTION B: settings (C2) ======================
-- Batch-1 C2 verbatim: reconcile MASTER-style (RPC) and A_TO_Z-style (admin
-- UI) column families, backfill once, keep in sync via trigger.
DO $$
DECLARE
  v_had_a2z BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings'
      AND column_name = 'points_daily_link_submit'
  ) INTO v_had_a2z;

  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS submission_start TIME;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS submission_end TIME;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS daily_link_points INTEGER NOT NULL DEFAULT 5;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS on_time_bonus_points INTEGER NOT NULL DEFAULT 2;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS support_point_per_link INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS alldone_base_points INTEGER NOT NULL DEFAULT 5;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rank_bonus_1 INTEGER NOT NULL DEFAULT 10;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rank_bonus_2 INTEGER NOT NULL DEFAULT 8;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rank_bonus_3 INTEGER NOT NULL DEFAULT 6;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rank_bonus_4 INTEGER NOT NULL DEFAULT 4;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rank_bonus_5 INTEGER NOT NULL DEFAULT 2;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS submission_start_time VARCHAR(10) NOT NULL DEFAULT '10:00';
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS submission_end_time VARCHAR(10) NOT NULL DEFAULT '16:50';
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS all_done_start_time VARCHAR(10) NOT NULL DEFAULT '17:00';
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_daily_link_submit INTEGER NOT NULL DEFAULT 5;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_per_support INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_all_done INTEGER NOT NULL DEFAULT 5;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_fastest_top1 INTEGER NOT NULL DEFAULT 10;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_fastest_top2 INTEGER NOT NULL DEFAULT 8;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_fastest_top3 INTEGER NOT NULL DEFAULT 6;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_fastest_top4 INTEGER NOT NULL DEFAULT 4;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS points_fastest_top5 INTEGER NOT NULL DEFAULT 2;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS penalty_late_support INTEGER NOT NULL DEFAULT 2;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS penalty_fake_all_done INTEGER NOT NULL DEFAULT 10;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS penalty_inactive INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  IF v_had_a2z THEN
    EXECUTE $q$
      UPDATE public.settings SET
        submission_start       = submission_start_time::TIME,
        submission_end         = submission_end_time::TIME,
        daily_link_points      = points_daily_link_submit,
        support_point_per_link = points_per_support,
        alldone_base_points    = points_all_done,
        rank_bonus_1           = points_fastest_top1,
        rank_bonus_2           = points_fastest_top2,
        rank_bonus_3           = points_fastest_top3,
        rank_bonus_4           = points_fastest_top4,
        rank_bonus_5           = points_fastest_top5
    $q$;
    RAISE NOTICE 'C2: settings MASTER columns backfilled from A_TO_Z values';
  ELSE
    RAISE NOTICE 'C2: A_TO_Z columns were not the original shape; defaults kept';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_settings_shapes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.daily_link_points IS DISTINCT FROM NEW.daily_link_points
     AND NOT (OLD.points_daily_link_submit IS DISTINCT FROM NEW.points_daily_link_submit) THEN
    NEW.points_daily_link_submit := NEW.daily_link_points;
  END IF;
  IF OLD.support_point_per_link IS DISTINCT FROM NEW.support_point_per_link
     AND NOT (OLD.points_per_support IS DISTINCT FROM NEW.points_per_support) THEN
    NEW.points_per_support := NEW.support_point_per_link;
  END IF;
  IF OLD.alldone_base_points IS DISTINCT FROM NEW.alldone_base_points
     AND NOT (OLD.points_all_done IS DISTINCT FROM NEW.points_all_done) THEN
    NEW.points_all_done := NEW.alldone_base_points;
  END IF;
  IF OLD.submission_start IS DISTINCT FROM NEW.submission_start
     AND NOT (OLD.submission_start_time IS DISTINCT FROM NEW.submission_start_time) THEN
    NEW.submission_start_time := TO_CHAR(NEW.submission_start, 'HH24:MI');
  END IF;
  IF OLD.submission_end IS DISTINCT FROM NEW.submission_end
     AND NOT (OLD.submission_end_time IS DISTINCT FROM NEW.submission_end_time) THEN
    NEW.submission_end_time := TO_CHAR(NEW.submission_end, 'HH24:MI');
  END IF;
  NEW.submission_start       := NEW.submission_start_time::TIME;
  NEW.submission_end         := NEW.submission_end_time::TIME;
  NEW.daily_link_points      := NEW.points_daily_link_submit;
  NEW.support_point_per_link := NEW.points_per_support;
  NEW.alldone_base_points    := NEW.points_all_done;
  NEW.rank_bonus_1           := NEW.points_fastest_top1;
  NEW.rank_bonus_2           := NEW.points_fastest_top2;
  NEW.rank_bonus_3           := NEW.points_fastest_top3;
  NEW.rank_bonus_4           := NEW.points_fastest_top4;
  NEW.rank_bonus_5           := NEW.points_fastest_top5;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_shapes ON public.settings;
CREATE TRIGGER trg_sync_settings_shapes
  BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_settings_shapes();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'settings'
               AND column_name = 'community_id') THEN
    BEGIN
      INSERT INTO public.settings (community_id) VALUES ('main')
      ON CONFLICT DO NOTHING;
      RAISE NOTICE 'C2: settings main row ensured';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'C2: settings seed skipped: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'C2: settings has no community_id column; seed skipped';
  END IF;
END
$$;

-- ============================ SECTION C: invite_tokens DDL ==================
-- Batch-1 C4 + C5.
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- ============================ SECTION D: daily_links DDL ====================
-- Merged H12 (high) + C16 (batch-2): ONE status column definition.
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
-- Shape guarantee: every column the merged submit/support/schedule RPCs touch.
-- (PART_1's lean daily_links lacks most of these; CREATE TABLE IF NOT EXISTS
--  made the first-deployed shape win silently, so we add what's missing.)
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) NOT NULL DEFAULT 'main';
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS serial_number INTEGER;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS serial_display VARCHAR(10);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS part_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS link_number INTEGER;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_name VARCHAR(100);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_member_number VARCHAR(20);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_photo_url TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS owner_facebook_url TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS submitted_by_admin_id UUID REFERENCES public.members(id);
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS post_type TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS instruction TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS fb_link TEXT;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS can_edit_until TIMESTAMPTZ;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS total_supports_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- H10: server-side duplicate fb_link guard (both submit and edit paths).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_links' AND column_name='community_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_links' AND column_name='date')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_links' AND column_name='fb_link') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_links_community_date_fblink
            ON public.daily_links (community_id, date, (LOWER(TRIM(fb_link))));
        RAISE NOTICE 'H10: uq_daily_links_community_date_fblink ensured';
    ELSE
        RAISE WARNING 'SLB H10: duplicate fb_link guard skipped (columns missing)';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H10: duplicate fb_link index NOT created (existing duplicates likely): %', SQLERRM;
END $$;

-- ============================ SECTION E: support_records DDL ================
-- Shape guarantee for the merged record_support_atomic INSERT
-- (community_id, link_id, supporter_id, supporter_member_number,
--  link_owner_id, date, points_awarded). PART_1 / FULL_A_TO_Z defs lack
-- several of these; the guarantee discharges the assumption.
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) NOT NULL DEFAULT 'main';
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS supporter_member_number VARCHAR(20);
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS link_owner_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS points_awarded INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS supported_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- H13: the dedupe constraint the ALREADY_SUPPORTED handler relies on.
DO $$
BEGIN
    IF to_regclass('public.support_records') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conname = 'unique_supporter_link_date'
                         AND conrelid = 'public.support_records'::regclass) THEN
        ALTER TABLE public.support_records
        ADD CONSTRAINT unique_supporter_link_date UNIQUE (link_id, supporter_id, date);
        RAISE NOTICE 'H13: unique_supporter_link_date created';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H13: unique_supporter_link_date NOT created (existing duplicates likely): %', SQLERRM;
END $$;

-- ============================ SECTION F: all_done DDL =======================
-- Merged H15 prerequisite + shape guarantee for the merged rpc_submit_all_done.
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) NOT NULL DEFAULT 'main';
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_name VARCHAR(100);
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_number VARCHAR(20);
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS member_photo_url TEXT;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS fastest_rank INTEGER;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS base_points INTEGER;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS bonus_points INTEGER;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS total_points INTEGER;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS alternative_id_used BOOLEAN;
ALTER TABLE public.all_done ADD COLUMN IF NOT EXISTS alternative_id_details JSONB;

-- ============================ SECTION G: blacklist (C13) ====================
-- The upsert needs a REAL unique constraint on the plain email column.
DO $$
BEGIN
    DELETE FROM public.blacklist a
    USING public.blacklist b
    WHERE a.id <> b.id
      AND a.email = b.email
      AND (COALESCE(a.created_at, '1970-01-01'::TIMESTAMPTZ), a.id::TEXT)
          > (COALESCE(b.created_at, '1970-01-01'::TIMESTAMPTZ), b.id::TEXT);
EXCEPTION
    WHEN undefined_table OR undefined_column THEN
        RAISE WARNING 'C13: blacklist dedupe skipped (%)', SQLERRM;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'blacklist_email_unique'
          AND conrelid = 'public.blacklist'::regclass
    ) THEN
        ALTER TABLE public.blacklist ADD CONSTRAINT blacklist_email_unique UNIQUE (email);
    END IF;
EXCEPTION
    WHEN undefined_table OR undefined_column THEN
        RAISE WARNING 'C13: blacklist constraint skipped (%)', SQLERRM;
    WHEN unique_violation THEN
        RAISE WARNING 'C13: duplicate emails remain; constraint not added. Dedupe manually, then re-run.';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_email ON public.blacklist (LOWER(email));

-- ============================ SECTION H: audit_logs (C15) ===================
-- Canonical 7-column shape. Every merged writer uses exactly these columns,
-- wrapped so an audit failure can never roll back the admin transaction.
-- (actor_auth_id kept as an 8th optional column: one repo def has it, and
--  create_report_secure's verbatim audit insert references it.)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_auth_id UUID;

-- H30: chapter-16's own prerequisite for get_member_history_secure.
DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='audit_logs'
                         AND column_name='target_member_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN target_member_id UUID REFERENCES public.members(id);
        RAISE NOTICE 'H30: audit_logs.target_member_id added';
    END IF;
END $$;

-- ============================ SECTION I: scheduled_links DDL ================
-- Guarantees for the merged create/run RPCs (target_time, error_message,
-- executed_at, member_id are absent from some defs).
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS target_time VARCHAR(10);
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.scheduled_links ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
-- L22: is_executed is never read/written (execution uses status/is_published).
DROP INDEX IF EXISTS public.idx_scheduled_links_queue;
ALTER TABLE public.scheduled_links DROP COLUMN IF EXISTS is_executed;

-- ============================ SECTION J: reports DDL (M21, L17) =============
-- M21: sequence replaces the MAX()+1 race. Guarded: reports may not exist.
CREATE SEQUENCE IF NOT EXISTS public.report_serial_seq;
DO $$
BEGIN
    IF to_regclass('public.reports') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='reports'
                     AND column_name='report_serial_display') THEN
        PERFORM setval(
            'public.report_serial_seq',
            GREATEST(
                COALESCE(
                    (SELECT MAX(NULLIF(regexp_replace(report_serial_display, '\D', '', 'g'), '')::integer)
                     FROM public.reports),
                    1000
                ),
                COALESCE((SELECT last_value FROM public.report_serial_seq), 1000)
            ),
            true
        );
        RAISE NOTICE 'M21: report_serial_seq initialized';
    ELSE
        RAISE NOTICE 'M21: reports table/column missing; sequence left at start';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'M21: report_serial_seq init skipped: %', SQLERRM;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.reports') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_report_serial_display_unique') THEN
        BEGIN
            ALTER TABLE public.reports
            ADD CONSTRAINT reports_report_serial_display_unique UNIQUE (report_serial_display);
            RAISE NOTICE 'M21: unique constraint on reports.report_serial_display added';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'M21: unique constraint skipped (existing duplicates?): %', SQLERRM;
        END;
    END IF;
END
$$;

-- L17: reports.link_serial INTEGER -> VARCHAR.
-- The public.link_reports view depends on this column, so it must be dropped
-- first, then re-created after the alter (else 0A000 aborts the whole script).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reports'
          AND column_name = 'link_serial' AND data_type = 'integer'
    ) THEN
        DROP VIEW IF EXISTS public.link_reports;
        BEGIN
            ALTER TABLE public.reports ALTER COLUMN link_serial TYPE VARCHAR USING link_serial::VARCHAR;
        EXCEPTION WHEN OTHERS THEN
            CREATE OR REPLACE VIEW public.link_reports AS SELECT * FROM public.reports;
            RAISE WARNING 'L17: alter failed, view restored (%). Fix manually.', SQLERRM;
            RETURN;
        END;
        CREATE OR REPLACE VIEW public.link_reports AS SELECT * FROM public.reports;
        RAISE NOTICE 'L17: reports.link_serial converted to VARCHAR (view recreated)';
    ELSE
        RAISE NOTICE 'L17: reports.link_serial is not INTEGER; skipped';
    END IF;
END
$$;

-- ============================ SECTION K: profile_change_requests (H35) ======
-- The "one pending per member" rule was app-level only; enforce at the DB.
-- Empty strings must never be stored (approval's COALESCE would write them).
DO $$
BEGIN
    IF to_regclass('public.profile_change_requests') IS NOT NULL THEN
        DELETE FROM public.profile_change_requests a
        USING public.profile_change_requests b
        WHERE a.status = 'PENDING' AND b.status = 'PENDING'
          AND a.member_id = b.member_id
          AND a.created_at > b.created_at;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_change_pending_member
            ON public.profile_change_requests (member_id) WHERE status = 'PENDING';
        RAISE NOTICE 'H35: uq_profile_change_pending_member ensured';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H35: pending-request unique index NOT created: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF to_regclass('public.profile_change_requests') IS NOT NULL THEN
        UPDATE public.profile_change_requests SET requested_name = NULL
        WHERE requested_name IS NOT NULL AND TRIM(requested_name) = '';
        UPDATE public.profile_change_requests SET requested_photo_url = NULL
        WHERE requested_photo_url IS NOT NULL AND TRIM(requested_photo_url) = '';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profile_change_nonempty') THEN
            ALTER TABLE public.profile_change_requests
            ADD CONSTRAINT chk_profile_change_nonempty
            CHECK ((requested_name IS NULL OR TRIM(requested_name) <> '')
               AND (requested_photo_url IS NULL OR TRIM(requested_photo_url) <> ''));
        END IF;
        RAISE NOTICE 'H35: nonempty CHECK ensured';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H35: nonempty CHECK NOT added: %', SQLERRM;
END $$;

-- ============================ H5: chapter-03 guard + identity indexes =======
DO $$
DECLARE
    v_has_all BOOLEAN;
BEGIN
    SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='username_normalized')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='username')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='real_name')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_name_original')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_name')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_profile_url')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_url')
    INTO v_has_all;

    IF v_has_all THEN
        UPDATE public.members
        SET
            username_normalized = LOWER(TRIM(username)),
            real_name = COALESCE(real_name, name),
            facebook_name_original = COALESCE(facebook_name_original, facebook_name),
            facebook_profile_url = COALESCE(facebook_profile_url, facebook_url)
        WHERE username_normalized IS NULL;
        RAISE NOTICE 'H5: username normalization applied';
    ELSE
        RAISE NOTICE 'H5: username normalization SKIPPED (columns missing) — file no longer aborts';
    END IF;
END $$;

DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower
    ON public.members (LOWER(TRIM(email)));
    RAISE NOTICE 'H5: idx_members_email_lower ensured';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H5: idx_members_email_lower NOT created (possible duplicate emails): %', SQLERRM;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_identity_key')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='facebook_identity_type') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_members_fb_identity
        ON public.members (facebook_identity_key, facebook_identity_type)
        WHERE facebook_identity_key IS NOT NULL AND status <> 'REJECTED';
        RAISE NOTICE 'H5: idx_members_fb_identity ensured';
    ELSE
        RAISE NOTICE 'H5: idx_members_fb_identity SKIPPED (fb identity columns missing)';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SLB H5: idx_members_fb_identity NOT created: %', SQLERRM;
END $$;

-- ============================ SECTION L: RLS policies =======================
-- C10: members must NOT INSERT support_records directly. Supports go ONLY via
-- record_support_atomic (SECURITY DEFINER bypasses RLS, so the RPC path works).
DROP POLICY IF EXISTS "Members insert own support records" ON public.support_records;
DROP POLICY IF EXISTS "support_records_insert" ON public.support_records;
DROP POLICY IF EXISTS "Supporters insert own support record" ON public.support_records;
DROP POLICY IF EXISTS "Active supporters insert support record" ON public.support_records;

-- C11: drop every stale "member updates own profile" policy (R14 approval
-- bypass). Direct member UPDATEs now fail closed; profile changes go only
-- through request_profile_change -> review_profile_change. The "Admins update
-- all profiles" (admin/dev-only) policy is intentionally kept.
DROP POLICY IF EXISTS "Members update own profile" ON public.members;
DROP POLICY IF EXISTS "members_update_own" ON public.members;
DROP POLICY IF EXISTS "Members update self or admin" ON public.members;
DROP POLICY IF EXISTS "Active members update self or admin" ON public.members;

-- H29: drop stale permissive policies, then (re)create strict active-only
-- replacements so authenticated reads keep working.
DO $$
BEGIN
    IF to_regclass('public.daily_links') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Anyone read daily links" ON public.daily_links;
    END IF;
    IF to_regclass('public.members') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members view directory" ON public.members;
    END IF;
    IF to_regclass('public.support_records') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members read support records" ON public.support_records;
    END IF;
    IF to_regclass('public.all_done') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members read all done" ON public.all_done;
    END IF;
    RAISE NOTICE 'H29: four stale permissive policies dropped (if they existed)';
END $$;

DO $$
BEGIN
    IF to_regclass('public.members') IS NOT NULL THEN
        DROP POLICY IF EXISTS "members_select_policy" ON public.members;
        CREATE POLICY "members_select_policy" ON public.members
            FOR SELECT TO authenticated
            USING (
                auth_user_id = auth.uid()
                OR public.is_current_user_active()
                OR public.is_current_user_admin_or_dev()
            );
    END IF;
    IF to_regclass('public.daily_links') IS NOT NULL THEN
        DROP POLICY IF EXISTS "daily_links_select" ON public.daily_links;
        CREATE POLICY "daily_links_select" ON public.daily_links
            FOR SELECT TO authenticated
            USING (
                public.is_current_user_active()
                OR public.is_current_user_admin_or_dev()
            );
    END IF;
    IF to_regclass('public.support_records') IS NOT NULL THEN
        DROP POLICY IF EXISTS "support_records_select" ON public.support_records;
        CREATE POLICY "support_records_select" ON public.support_records
            FOR SELECT TO authenticated
            USING (
                public.is_current_user_active()
                OR public.is_current_user_admin_or_dev()
            );
    END IF;
    IF to_regclass('public.all_done') IS NOT NULL THEN
        DROP POLICY IF EXISTS "all_done_select" ON public.all_done;
        CREATE POLICY "all_done_select" ON public.all_done
            FOR SELECT TO authenticated
            USING (
                public.is_current_user_active()
                OR public.is_current_user_admin_or_dev()
            );
    END IF;
    RAISE NOTICE 'H29: strict active-only SELECT policies ensured';
END $$;

-- H27: audit_logs RLS had zero SELECT policies -> admin viewer was empty.
DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
        CREATE POLICY "Admins view audit logs" ON public.audit_logs
            FOR SELECT TO authenticated
            USING (public.is_current_user_admin_or_dev());
        RAISE NOTICE 'H27: audit_logs admin/dev SELECT policy ensured';
    ELSE
        RAISE WARNING 'SLB H27: public.audit_logs does not exist; policy skipped';
    END IF;
END $$;

-- C17: fake_all_done_incidents had RLS enabled with zero policies.
DO $$
BEGIN
    IF to_regclass('public.fake_all_done_incidents') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins manage fake all done incidents" ON public.fake_all_done_incidents;
        CREATE POLICY "Admins manage fake all done incidents" ON public.fake_all_done_incidents
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')))
            WITH CHECK (EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'DEVELOPER')));
        RAISE NOTICE 'C17: fake_all_done_incidents admin/dev policy ensured';
    END IF;
END $$;

-- M35: members can retract their own PENDING profile-change requests.
DO $$
BEGIN
    IF to_regclass('public.profile_change_requests') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members cancel own pending requests" ON public.profile_change_requests;
        CREATE POLICY "Members cancel own pending requests"
        ON public.profile_change_requests FOR DELETE TO authenticated
        USING (
            status = 'PENDING'
            AND member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
        );

        DROP POLICY IF EXISTS "Members edit own pending requests" ON public.profile_change_requests;
        CREATE POLICY "Members edit own pending requests"
        ON public.profile_change_requests FOR UPDATE TO authenticated
        USING (
            status = 'PENDING'
            AND member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
        )
        WITH CHECK (
            status = 'PENDING'
            AND member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
        );
        RAISE NOTICE 'M35: profile-change cancel/edit policies ensured';
    END IF;
END $$;

-- ============================ SECTION M: helper functions ===================
-- C1: dynamic guard trigger — compares ONLY columns that actually exist
-- (to_jsonb loop), so a phantom column can never raise 42703 again.
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_j JSONB;
    v_old_j JSONB;
    v_c TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'DEVELOPER' THEN
            RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
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

    v_new_j := to_jsonb(NEW);
    v_old_j := to_jsonb(OLD);
    FOREACH v_c IN ARRAY ARRAY['points','weekly_points','monthly_points','daily_points','vip_points','is_vip','vip_expires_at','current_streak','longest_streak','streak'] LOOP
        IF (v_new_j ? v_c) AND ((v_new_j ->> v_c) IS DISTINCT FROM (v_old_j ->> v_c)) THEN
            IF current_setting('slb.internal_points_change', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'SECURITY_VIOLATION: Direct points, streak, or VIP modification is prohibited. Use authorized RPC.';
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Ensure the guard trigger exists (whichever migration generation is live,
-- the guard must be attached exactly once under its canonical name).
DO $$
BEGIN
    IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_members_security_guard'
    ) THEN
        CREATE TRIGGER trg_members_security_guard
            BEFORE INSERT OR UPDATE OR DELETE ON public.members
            FOR EACH ROW EXECUTE FUNCTION public.trg_protect_member_security_fields();
        RAISE NOTICE 'C1: trg_members_security_guard created';
    ELSE
        RAISE NOTICE 'C1: trg_members_security_guard already present';
    END IF;
END
$$;

-- M37: canonical admin/dev helper — SUSPENDED/BLACKLISTED admins must NOT pass.
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
      AND role IN ('ADMIN', 'DEVELOPER')
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

-- C7/M3: the exact RPC the deployed auth-login edge function calls.
-- service_role ONLY (the edge function uses service_role) -> no oracle.
CREATE OR REPLACE FUNCTION public.get_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN NULL;
  END IF;
  IF p_identifier LIKE '%@%' THEN
    RETURN LOWER(TRIM(p_identifier));
  END IF;
  SELECT email INTO v_email
  FROM public.members
  WHERE LOWER(TRIM(member_number)) = LOWER(TRIM(p_identifier))
  LIMIT 1;
  RETURN v_email;
END;
$$;

-- ============================ SECTION N: auth / registration ================
-- H3: disable rpc_bootstrap_developer — any authenticated caller could
-- self-elevate to DEVELOPER. A developer (SLB-001) already exists.
CREATE OR REPLACE FUNCTION public.rpc_bootstrap_developer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'developer bootstrap is disabled; use SQL directly';
END;
$$;

-- H4: handle_new_user — (1) pre-provisioned link requires auth_user_id IS NULL
-- (2) first-ever-signup ADMIN bootstrap logs LOUDLY.
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
    v_existing_id UUID;
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

    SELECT id INTO v_existing_id
    FROM public.members
    WHERE LOWER(email) = v_norm_email
      AND auth_user_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.members
        SET auth_user_id = NEW.id,
            role = v_role,
            status = v_status,
            name = COALESCE(NULLIF(v_name, 'Member'), name),
            facebook_url = CASE WHEN v_fb_url <> 'https://facebook.com' THEN v_fb_url ELSE facebook_url END,
            profile_photo_url = COALESCE(v_profile_photo, profile_photo_url)
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.members (
            auth_user_id, community_id, member_number, name, email,
            facebook_url, profile_photo_url, role, status
        ) VALUES (
            NEW.id, 'main', v_member_number, v_name, NEW.email,
            v_fb_url, v_profile_photo, v_role, v_status
        )
        ON CONFLICT (auth_user_id) DO NOTHING;
    END IF;

    IF v_is_first AND v_role = 'ADMIN' THEN
        RAISE WARNING 'SLB SECURITY (H4): first-ever signup (%) auto-elevated to ADMIN/ACTIVE', NEW.email;
        BEGIN
            INSERT INTO public.audit_logs (actor_name, actor_role, action, target_type, target_id, details)
            VALUES ('SYSTEM (auto-bootstrap)', 'ADMIN', 'FIRST_SIGNUP_ADMIN_BOOTSTRAP', 'MEMBER', NEW.id::text,
                    'First-ever signup auto-elevated to ADMIN/ACTIVE: ' || COALESCE(NEW.email, '?'));
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'SLB H4: bootstrap audit insert failed (signup itself unaffected): %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- C5: verify_invite_token (rate-limited token check).
CREATE OR REPLACE FUNCTION public.verify_invite_token(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token record;
BEGIN
  SELECT * INTO v_token FROM public.invite_tokens WHERE token_hash = p_token_hash FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.attempt_count >= 10 OR (v_token.last_attempt_at IS NOT NULL AND v_token.last_attempt_at > NOW() - INTERVAL '5 seconds') THEN
    UPDATE public.invite_tokens SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  IF v_token.status = 'ACTIVE' AND v_token.expires_at < NOW() THEN
    UPDATE public.invite_tokens SET status = 'EXPIRED', attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.status != 'ACTIVE' THEN
    UPDATE public.invite_tokens SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- C6: consume_invite_token_tx(TEXT, UUID) — the exact signature the deployed
-- edge function calls. Audit uses only canonical columns, wrapped so audit
-- can never break the consume transaction.
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(p_token_hash TEXT, p_auth_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token record;
  v_member record;
  v_auth_email TEXT;
BEGIN
  IF p_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'UNAUTHORIZED');
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = p_auth_uid;
  IF v_auth_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'IDENTITY_MISMATCH');
  END IF;

  SELECT * INTO v_token FROM public.invite_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_token.member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MEMBER_NOT_FOUND');
  END IF;

  IF LOWER(TRIM(v_member.email)) != LOWER(TRIM(v_auth_email)) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'IDENTITY_MISMATCH');
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_LINKED');
  END IF;

  UPDATE public.members SET auth_user_id = p_auth_uid WHERE id = v_member.id;
  UPDATE public.invite_tokens SET status = 'USED', used_at = NOW() WHERE id = v_token.id;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_member.id, v_member.name, v_member.role::TEXT, 'INVITE_CONSUMED',
            'invite_tokens', v_token.id::TEXT,
            jsonb_build_object('member_id', v_member.id)::TEXT);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'C6: audit INVITE_CONSUMED skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================ SECTION O: member admin =======================
-- MERGED approve_member_secure: batch-2 (C15 canonical 7-col audit, wrapped)
-- + high H25 (the CORRECT status-change flag + approved_at/approved_by DDL).
-- MERGE FIX: batch-2 set slb.internal_approval, which the LIVE guard (C1)
-- ignores -> every approval raised SECURITY_VIOLATION. Now sets
-- slb.internal_status_change, the flag the live guard honors. The
-- 'ACTIVE'::member_status cast is dropped: a plain literal works whether the
-- column is enum or text; the cast fails when the enum type is absent.
CREATE OR REPLACE FUNCTION public.approve_member_secure(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = auth.uid();
    IF v_actor.id IS NULL OR v_actor.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'অ্যাডমিন অথবা ডেভেলপার পারমিশন প্রয়োজন।');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'সদস্যের প্রোফাইল খুঁজে পাওয়া যায়নি।');
    END IF;

    IF v_target.status = 'ACTIVE' THEN
        RETURN jsonb_build_object('success', true, 'message', 'অ্যাকাউন্টটি ইতোমধ্যে সচল (Active) রয়েছে।');
    END IF;

    -- H25: the flag the LIVE guard trigger honors.
    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = 'ACTIVE',
        approved_at = NOW(),
        approved_by = v_actor.id,
        updated_at = NOW()
    WHERE id = p_target_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_actor.id,
            v_actor.name,
            v_actor.role::TEXT,
            'MEMBER_APPROVED',
            'MEMBER',
            p_target_id::TEXT,
            'Approved registration for ' || v_target.name || ' (' || v_target.member_number || ')'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'approve_member_secure: audit skipped (approval itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'message', 'সদস্য সফলভাবে অনুমোদিত হয়েছে।');
END;
$$;

-- reject_member_secure (batch-2 C15, with the same MERGE FIX: correct flag,
-- plain 'REJECTED' literal instead of the ::member_status cast).
CREATE OR REPLACE FUNCTION public.reject_member_secure(p_target_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = auth.uid();
    IF v_actor.id IS NULL OR v_actor.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'অ্যাডমিন অথবা ডেভেলপার পারমিশন প্রয়োজন।');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'সদস্য খুঁজে পাওয়া যায়নি।');
    END IF;

    IF v_target.role = 'DEVELOPER' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ডেভেলপার অ্যাকাউন্ট রিজেক্ট বা বাতিল করা যায় না।');
    END IF;

    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = 'REJECTED',
        updated_at = NOW()
    WHERE id = p_target_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_actor.id,
            v_actor.name,
            v_actor.role::TEXT,
            'MEMBER_REJECTED',
            'MEMBER',
            p_target_id::TEXT,
            'Rejected registration for ' || v_target.name || COALESCE('. Reason: ' || p_reason, '')
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'reject_member_secure: audit skipped (rejection itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'message', 'সদস্যের আবেদন সফলভাবে বাতিল করা হয়েছে।');
END;
$$;

-- H24: admin_restore_member_secure — sets the flag the live guard honors;
-- only SUSPENDED/FROZEN restorable; never DEVELOPER; never blacklisted.
CREATE OR REPLACE FUNCTION public.admin_restore_member_secure(
    p_member_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF v_target.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community access denied.';
    END IF;

    IF v_target.role = 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: DEVELOPER accounts cannot be restored via this RPC.';
    END IF;

    IF v_target.status NOT IN ('SUSPENDED', 'FROZEN') THEN
        RAISE EXCEPTION 'INVALID_TARGET: Only SUSPENDED or FROZEN members can be restored (current: %).', v_target.status;
    END IF;

    IF to_regclass('public.blacklist') IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.blacklist WHERE LOWER(email) = LOWER(v_target.email)) THEN
        RAISE EXCEPTION 'FORBIDDEN: Target is blacklisted and cannot be restored.';
    END IF;

    PERFORM set_config('slb.internal_status_change', 'true', true);

    UPDATE public.members
    SET status = 'ACTIVE'
    WHERE id = p_member_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_actor.id, v_actor.name, v_actor.role::TEXT, 'ADMIN_STATUS_RESTORE', 'MEMBER', p_member_id::text,
                'Restored member ' || v_target.member_number || ' to ACTIVE. Reason: ' || p_reason);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'SLB H24: restore audit insert failed (restore itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- M12: admin_adjust_points_secure — GREATEST(0,...) floor so adjustments can
-- never drive totals negative. (Ledger keeps the true value.)
CREATE OR REPLACE FUNCTION public.admin_adjust_points_secure(
    p_member_id UUID,
    p_points INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
    v_now TIMESTAMP := NOW();
    v_date DATE := (v_now AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF v_target.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community access denied.';
    END IF;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, description, created_by)
    VALUES (p_member_id, 'ADMIN_ADJUSTMENT', p_points, v_date, 'Manual Admin Adjustment: ' || p_reason, v_actor.id);

    UPDATE public.members
    SET points = GREATEST(0, points + p_points),
        weekly_points = GREATEST(0, weekly_points + p_points)
    WHERE id = p_member_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role::TEXT, 'ADMIN_ADJUST_POINTS', 'MEMBER', p_member_id::text,
            'Adjusted ' || p_points || ' points for ' || v_target.member_number || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================ SECTION P: submit / support / all-done ========
-- MERGED submit_daily_link_secure (6-arg): the exact overload the frontend
-- calls. High H11 (category coercion) + medium M8 (can_submit_links) +
-- M9 (part_number, serial_display WITHOUT '#') + M10 (ACTIVE gating).
-- Settings columns read here (submission_start/submission_end/daily_link_points/
-- on_time_bonus_points) are all added by Section B (C2).
CREATE OR REPLACE FUNCTION public.submit_daily_link_secure(
    p_fb_link TEXT,
    p_post_type post_type DEFAULT 'Photo',
    p_category link_category DEFAULT 'NORMAL',
    p_caption TEXT DEFAULT NULL,
    p_instruction TEXT DEFAULT NULL,
    p_target_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_target_member public.members%ROWTYPE;
    v_settings public.settings%ROWTYPE;
    v_today DATE;
    v_now_time TIME;
    v_next_serial INTEGER;
    v_serial_display VARCHAR(10);
    v_part_number INTEGER;
    v_new_link_id UUID;
    v_is_on_time BOOLEAN := false;
    v_earned_points INTEGER := 0;
    v_clean_url TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.'; END IF;
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
    -- M10: uniform ACTIVE gating (caller)
    IF v_member.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MEMBER_INACTIVE: Account is %.', v_member.status; END IF;

    IF p_target_member_id IS NOT NULL AND p_target_member_id <> v_member.id THEN
        IF v_member.role <> 'ADMIN' AND v_member.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Only Admins can submit on behalf of members.';
        END IF;
        SELECT * INTO v_target_member FROM public.members WHERE id = p_target_member_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_MEMBER_NOT_FOUND'; END IF;
    ELSE
        v_target_member := v_member;
    END IF;

    -- H11: server-side category-vs-role enforcement. Members can never mint
    -- ADMIN/VIP/NOTICE links; on-behalf submissions always belong to a member.
    IF v_target_member.id IS DISTINCT FROM v_member.id THEN
        p_category := 'NORMAL';
    ELSIF v_member.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        p_category := 'NORMAL';
    END IF;

    -- M10: the effective owner keeps member restrictions even on admin on-behalf
    IF v_target_member.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MEMBER_INACTIVE: Target account is %.', v_target_member.status; END IF;

    -- M8: per-member submission permission
    IF v_target_member.can_submit_links = false THEN
        RAISE EXCEPTION 'SUBMIT_NOT_ALLOWED: Link submission is disabled for this member.';
    END IF;

    v_today := public.get_current_bdt_date();
    v_now_time := public.get_current_bdt_time();
    SELECT * INTO v_settings FROM public.settings WHERE community_id = v_target_member.community_id;

    IF v_member.role = 'MEMBER' THEN
        IF v_now_time < v_settings.submission_start OR v_now_time > v_settings.submission_end THEN
            RAISE EXCEPTION 'WINDOW_CLOSED: Submissions open % to % BDT.', v_settings.submission_start, v_settings.submission_end;
        END IF;
        IF EXISTS (SELECT 1 FROM public.daily_links WHERE community_id = v_target_member.community_id AND date = v_today AND owner_id = v_target_member.id) THEN
            RAISE EXCEPTION 'DUPLICATE_SUBMISSION: Daily link already submitted.';
        END IF;
    END IF;

    v_clean_url := TRIM(p_fb_link);
    IF v_clean_url NOT SIMILAR TO 'https?://(www\.|web\.|m\.)?(facebook\.com|fb\.watch)/.+' THEN
        RAISE EXCEPTION 'INVALID_URL: Must be a valid Facebook link.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('slb_daily_link_' || v_target_member.community_id || '_' || v_today::text));

    SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
    FROM public.daily_links
    WHERE community_id = v_target_member.community_id AND date = v_today;

    -- M9: part number by 20-link ranges; serial_display WITHOUT the '#' prefix
    -- (the UI renders #{...} itself; the old code produced '##01').
    v_serial_display := LPAD(v_next_serial::text, 2, '0');
    v_part_number := CEIL(v_next_serial::numeric / 20);

    v_is_on_time := (v_now_time >= v_settings.submission_start AND v_now_time <= v_settings.submission_end);

    INSERT INTO public.daily_links (
        community_id, date, serial_number, serial_display, part_number, owner_id, owner_name,
        owner_member_number, owner_photo_url, owner_facebook_url,
        submitted_by_admin_id, post_type, category, caption, instruction, fb_link,
        can_edit_until
    ) VALUES (
        v_target_member.community_id, v_today, v_next_serial,
        v_serial_display, v_part_number,
        v_target_member.id, v_target_member.name, v_target_member.member_number,
        v_target_member.profile_photo_url, v_target_member.facebook_url,
        CASE WHEN v_member.id <> v_target_member.id THEN v_member.id ELSE NULL END,
        p_post_type, p_category, p_caption, p_instruction, v_clean_url,
        NOW() + INTERVAL '2 minutes'
    ) RETURNING id INTO v_new_link_id;

    v_earned_points := v_settings.daily_link_points;
    IF v_is_on_time THEN v_earned_points := v_earned_points + v_settings.on_time_bonus_points; END IF;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_target_member.id, 'LINK_SUBMIT', v_earned_points, v_today, v_new_link_id::text,
            'Daily Link #' || v_next_serial || ' (' || CASE WHEN v_is_on_time THEN '+2 On-Time Bonus' ELSE 'Standard' END || ')');

    UPDATE public.members
    SET points = points + v_earned_points,
        weekly_points = weekly_points + v_earned_points,
        total_links_submitted = total_links_submitted + 1,
        last_active_at = NOW()
    WHERE id = v_target_member.id;

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_new_link_id,
        'serial_number', v_next_serial,
        'serial_display', v_serial_display,
        'part_number', v_part_number,
        'points_awarded', v_earned_points
    );
END;
$$;

-- MERGED rpc_submit_daily_link (5-arg fallback): medium's body (M10 uniform
-- ACTIVE gate, M8 can_submit_links, M22 BDT date, wrapped canonical audit) +
-- high H11 category coercion (medium's version had none).
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
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
    v_next_serial INTEGER;
    v_serial_display VARCHAR(10);
    v_part_number INTEGER;
    v_link_id UUID;
    v_existing_count INTEGER;
    v_start_str VARCHAR(10);
    v_end_str VARCHAR(10);
    v_now_bdt TIME;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Member profile not provisioned.';
    END IF;

    -- M10: uniform ACTIVE gating (was SUSPENDED/FROZEN only)
    IF v_member.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'MEMBER_INACTIVE: Account is currently %.', v_member.status;
    END IF;

    -- H11: server-side category-vs-role enforcement (this fallback RPC has no
    -- on-behalf path, so a plain role check suffices).
    IF v_member.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        p_category := 'NORMAL';
    END IF;

    -- M8: per-member submission permission
    IF v_member.can_submit_links = false THEN
        RAISE EXCEPTION 'SUBMIT_NOT_ALLOWED: Link submission is disabled for this member.';
    END IF;

    -- Server-side submission time window enforcement for members (default 10:00-16:50 BDT)
    IF v_member.role = 'MEMBER' THEN
        BEGIN
            SELECT submission_start_time, submission_end_time
            INTO v_start_str, v_end_str
            FROM public.settings
            WHERE community_id = v_member.community_id OR community_id = 'main'
            ORDER BY (community_id = 'main') DESC
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_start_str := NULL;
            v_end_str := NULL;
        END;

        IF v_start_str IS NULL OR v_start_str = '' THEN v_start_str := '10:00'; END IF;
        IF v_end_str IS NULL OR v_end_str = '' THEN v_end_str := '16:50'; END IF;

        v_now_bdt := (NOW() AT TIME ZONE 'Asia/Dhaka')::time;

        IF v_now_bdt < v_start_str::time OR v_now_bdt > v_end_str::time THEN
            RAISE EXCEPTION 'SUBMISSION_CLOSED: Link submission is open from % to % (Asia/Dhaka).', v_start_str, v_end_str;
        END IF;
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

    -- Append audit log (defensive: never breaks the submit)
    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_member.id, v_member.name, v_member.role::TEXT, 'SUBMIT_DAILY_LINK', 'DAILY_LINK', v_link_id::text, 'Submitted #' || v_serial_display);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'rpc_submit_daily_link: audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_link_id,
        'serial_number', v_next_serial,
        'serial_display', v_serial_display,
        'part_number', v_part_number
    );
END;
$$;

-- MERGED record_support_atomic: batch-1 C9 (self-support + cross-community
-- guards, M22 BDT date) + high H12 (only today's ACTIVE links) + high H13
-- (unique_violation -> ALREADY_SUPPORTED). The INSERT column list targets the
-- production-hardening support_records shape; Section E's DDL guarantees every
-- one of these columns exists on ANY live shape, so no phantom-column crash.
CREATE OR REPLACE FUNCTION public.record_support_atomic(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_supporter public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::DATE;
    v_support_id UUID;
    v_pts_support INTEGER := 1;
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

    -- C9: server-side guards (were missing entirely)
    IF v_link.owner_id = v_supporter.id THEN
        RAISE EXCEPTION 'SELF_SUPPORT_FORBIDDEN: You cannot support your own link.';
    END IF;
    IF v_link.community_id IS DISTINCT FROM v_supporter.community_id THEN
        RAISE EXCEPTION 'CROSS_COMMUNITY_DENIED';
    END IF;

    -- H12: only today's ACTIVE links may be supported (R7). Stale/removed
    -- links can no longer be supported, nor re-supported day after day.
    IF v_link.date IS DISTINCT FROM v_today THEN
        RAISE EXCEPTION 'STALE_LINK: Only today''s links can be supported.';
    END IF;
    IF v_link.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'LINK_NOT_ACTIVE: This link is no longer active.';
    END IF;

    SELECT COALESCE(points_per_support, 1) INTO v_pts_support
    FROM public.settings
    WHERE community_id = v_supporter.community_id OR community_id = 'main'
    ORDER BY (community_id = 'main') DESC
    LIMIT 1;

    IF v_pts_support IS NULL OR v_pts_support < 1 THEN v_pts_support := 1; END IF;

    IF EXISTS (
        SELECT 1 FROM public.support_records
        WHERE link_id = p_link_id AND supporter_id = v_supporter.id AND date = v_today
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already supported.');
    END IF;

    -- H13: double-submit race -> idempotent ALREADY_SUPPORTED (R10)
    BEGIN
        INSERT INTO public.support_records (
            community_id, link_id, supporter_id, supporter_member_number, link_owner_id, date, points_awarded
        ) VALUES (
            v_link.community_id, v_link.id, v_supporter.id, v_supporter.member_number, v_link.owner_id, v_today, v_pts_support
        ) RETURNING id INTO v_support_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', true, 'error_code', 'ALREADY_SUPPORTED');
    END;

    UPDATE public.daily_links SET total_supports_count = total_supports_count + 1 WHERE id = p_link_id;
    UPDATE public.members
    SET points = points + v_pts_support,
        weekly_points = weekly_points + v_pts_support,
        total_supports_given = total_supports_given + 1,
        last_active_at = NOW()
    WHERE id = v_supporter.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_supporter.id, 'LINK_SUPPORT', v_pts_support, v_today, v_support_id::TEXT, 'Supported link ' || v_link.serial_display || ' (+' || v_pts_support || ')');

    RETURN jsonb_build_object('success', true, 'support_id', v_support_id);
END;
$$;

-- rpc_submit_all_done overload A (0-arg): medium M13 (weekly/monthly/daily
-- rollups) + M22 (BDT date). Kept verbatim from the medium batch.
CREATE OR REPLACE FUNCTION public.rpc_submit_all_done()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
    v_now_time TIME := (NOW() AT TIME ZONE 'Asia/Dhaka')::time;
    v_start_str VARCHAR(10);
    v_rank INTEGER;
    v_bonus INTEGER := 0;
    v_base INTEGER := 5;
    v_top1 INTEGER := 10;
    v_top2 INTEGER := 8;
    v_top3 INTEGER := 6;
    v_top4 INTEGER := 4;
    v_top5 INTEGER := 2;
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

    -- Lookup configured all done parameters from settings (FIX #6)
    SELECT all_done_start_time,
           COALESCE(points_all_done, 5),
           COALESCE(points_fastest_top1, 10),
           COALESCE(points_fastest_top2, 8),
           COALESCE(points_fastest_top3, 6),
           COALESCE(points_fastest_top4, 4),
           COALESCE(points_fastest_top5, 2)
    INTO v_start_str, v_base, v_top1, v_top2, v_top3, v_top4, v_top5
    FROM public.settings
    WHERE community_id = v_member.community_id OR community_id = 'main'
    ORDER BY (community_id = 'main') DESC
    LIMIT 1;

    IF v_base IS NULL OR v_base < 1 THEN v_base := 5; END IF;

    -- Validate window (Default 17:00 BDT)
    IF v_now_time < COALESCE(v_start_str, '17:00')::time THEN
        RAISE EXCEPTION 'ALL_DONE_NOT_OPEN: All Done submission window opens at % BDT.', COALESCE(v_start_str, '17:00');
    END IF;

    IF EXISTS (SELECT 1 FROM public.all_done WHERE member_id = v_member.id AND date = v_today) THEN
        RAISE EXCEPTION 'DUPLICATE: All Done already submitted today.';
    END IF;

    -- Concurrency-safe rank determination
    PERFORM pg_advisory_xact_lock(hashtext('slb_alldone_rank_' || v_member.community_id || '_' || v_today::text));

    SELECT COUNT(*) + 1 INTO v_rank FROM public.all_done WHERE date = v_today AND community_id = v_member.community_id;

    IF v_rank = 1 THEN v_bonus := v_top1;
    ELSIF v_rank = 2 THEN v_bonus := v_top2;
    ELSIF v_rank = 3 THEN v_bonus := v_top3;
    ELSIF v_rank = 4 THEN v_bonus := v_top4;
    ELSIF v_rank = 5 THEN v_bonus := v_top5;
    ELSE v_bonus := 0;
    END IF;

    v_total := v_base + v_bonus;

    INSERT INTO public.all_done (
        community_id, date, member_id, member_name, member_number, member_photo_url, fastest_rank, base_points, bonus_points, total_points
    ) VALUES (
        v_member.community_id, v_today, v_member.id, v_member.name, v_member.member_number, v_member.profile_photo_url, v_rank, v_base, v_bonus, v_total
    ) RETURNING id INTO v_all_done_id;

    -- M13: All Done points now feed the rollup columns like submit/support do
    UPDATE public.members
    SET points = points + v_total,
        weekly_points = weekly_points + v_total,
        monthly_points = monthly_points + v_total,
        daily_points = daily_points + v_total,
        total_all_done = total_all_done + 1
    WHERE id = v_member.id;

    INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description)
    VALUES (v_member.id, 'ALL_DONE', v_total, v_today, v_all_done_id::TEXT, 'All Done Completion (+ ' || v_total || ' pts, Rank #' || v_rank || ')');

    RETURN jsonb_build_object('success', true, 'rank', v_rank, 'total_points', v_total);
END;
$$;

-- MERGED rpc_submit_all_done overload B (2-arg, the one the frontend calls):
-- high H15 (REVOKED rows ignored by the duplicate check AND the fastest-rank
-- counter -> re-submission after revocation is allowed) + high H17 (settings
-- resolved via COALESCE across BOTH column families; fallback is WARNING-loud
-- + audit-logged, never silent) + medium M13 (monthly/daily rollups) +
-- medium M22 (BDT date derivation — high's (CURRENT_DATE AT TIME ZONE ...)
-- form does NOT yield the BDT date under a non-BDT session).
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
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
    v_current_time TIME := (NOW() AT TIME ZONE 'Asia/Dhaka')::time;
    v_start_time TIME := '17:00:00'::time;
    v_total_required_links INTEGER;
    v_supported_count INTEGER;
    v_existing_all_done_count INTEGER;
    v_rank INTEGER := NULL;
    v_base_points INTEGER := 5;
    v_bonus_points INTEGER := 0;
    v_top1 INTEGER := 10;
    v_top2 INTEGER := 8;
    v_top3 INTEGER := 6;
    v_top4 INTEGER := 4;
    v_top5 INTEGER := 2;
    v_total_points INTEGER;
    v_all_done_id UUID;
    v_configured_start_str VARCHAR(10);
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Member profile not found.';
    END IF;

    -- H17: resolve settings across BOTH column families (Section B reconciled
    -- them and keeps them in sync via trg_sync_settings_shapes). No SILENT
    -- fallback: if the lookup fails outright, it is WARNING-loud and audit-logged.
    BEGIN
        SELECT all_done_start_time,
               COALESCE(points_all_done, alldone_base_points, 5),
               COALESCE(points_fastest_top1, rank_bonus_1, 10),
               COALESCE(points_fastest_top2, rank_bonus_2, 8),
               COALESCE(points_fastest_top3, rank_bonus_3, 6),
               COALESCE(points_fastest_top4, rank_bonus_4, 4),
               COALESCE(points_fastest_top5, rank_bonus_5, 2)
        INTO v_configured_start_str, v_base_points, v_top1, v_top2, v_top3, v_top4, v_top5
        FROM public.settings
        WHERE community_id = v_member.community_id OR community_id = 'main'
        ORDER BY (community_id = 'main') DESC
        LIMIT 1;

        IF v_configured_start_str IS NOT NULL AND v_configured_start_str <> '' THEN
            v_start_time := v_configured_start_str::time;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'SLB H17: all_done settings lookup failed, using defaults: %', SQLERRM;
        BEGIN
            INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
            VALUES (v_member.id, v_member.name, v_member.role::TEXT, 'ALL_DONE_SETTINGS_FALLBACK', 'SETTINGS',
                    'settings lookup failed, hardcoded defaults used: ' || SQLERRM);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- audit must never break the submission
        END;
        v_start_time := '17:00:00'::time;
        v_base_points := 5;
        v_top1 := 10; v_top2 := 8; v_top3 := 6; v_top4 := 4; v_top5 := 2;
    END;

    IF v_base_points IS NULL OR v_base_points < 1 THEN
        v_base_points := 5;
    END IF;

    -- Server-authoritative All Done start time validation (Default 17:00 Asia/Dhaka)
    IF v_current_time < v_start_time THEN
        RAISE EXCEPTION 'ALL_DONE_NOT_OPEN: All Done submission window opens at % Asia/Dhaka.', v_start_time;
    END IF;

    -- H15: duplicate check ignores REVOKED rows -> a member MAY re-submit
    -- after a revocation (explicit decision; revoked rows no longer block).
    IF EXISTS (
        SELECT 1 FROM public.all_done
        WHERE community_id = v_member.community_id AND date = v_today AND member_id = v_member.id
          AND status <> 'REVOKED'
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

    -- H15: revoked rows must not consume fastest-rank slots.
    SELECT COUNT(*) INTO v_existing_all_done_count
    FROM public.all_done
    WHERE community_id = v_member.community_id AND date = v_today
      AND status <> 'REVOKED';

    IF v_existing_all_done_count = 0 THEN
        v_rank := 1; v_bonus_points := v_top1;
    ELSIF v_existing_all_done_count = 1 THEN
        v_rank := 2; v_bonus_points := v_top2;
    ELSIF v_existing_all_done_count = 2 THEN
        v_rank := 3; v_bonus_points := v_top3;
    ELSIF v_existing_all_done_count = 3 THEN
        v_rank := 4; v_bonus_points := v_top4;
    ELSIF v_existing_all_done_count = 4 THEN
        v_rank := 5; v_bonus_points := v_top5;
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

    -- Update member profile (M13: monthly/daily rollups like submit/support)
    UPDATE public.members
    SET points = points + v_total_points,
        weekly_points = weekly_points + v_total_points,
        monthly_points = monthly_points + v_total_points,
        daily_points = daily_points + v_total_points,
        total_all_done = total_all_done + 1,
        last_active_at = NOW()
    WHERE id = v_member.id;

    -- Audit log (canonical 7-col; defensive: never breaks the submit)
    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_member.id, v_member.name, v_member.role::TEXT, 'SUBMIT_ALL_DONE', 'ALL_DONE', v_all_done_id::text, 'Completed All Done. Rank: ' || COALESCE(v_rank::text, 'Standard'));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'rpc_submit_all_done: audit skipped (submission itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'all_done_id', v_all_done_id,
        'fastest_rank', v_rank,
        'bonus_points', v_bonus_points,
        'total_points', v_total_points
    );
END;
$$;

-- C16: edit_daily_link_secure / remove_daily_link_secure — the phantom
-- v_link.member_id disjunct removed (owner_id is the real owner column);
-- remove uses soft-delete (cancelled).
CREATE OR REPLACE FUNCTION public.edit_daily_link_secure(
    p_link_id UUID,
    p_post_type TEXT DEFAULT 'NORMAL',
    p_caption TEXT DEFAULT NULL,
    p_instruction TEXT DEFAULT NULL,
    p_fb_link TEXT DEFAULT NULL,
    p_new_fb_link TEXT DEFAULT NULL
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
    v_target_url TEXT;
    v_clean_url TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Profile not found.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINK_NOT_FOUND: Daily link does not exist.';
    END IF;

    IF v_link.status = 'cancelled' OR v_link.status = 'removed' THEN
        RAISE EXCEPTION 'LINK_REMOVED: This link has already been removed.';
    END IF;

    IF v_actor.role = 'MEMBER' THEN
        IF v_link.owner_id <> v_actor.id THEN
            RAISE EXCEPTION 'FORBIDDEN: Cannot edit another member link.';
        END IF;

        IF v_link.can_edit_until IS NOT NULL AND NOW() > v_link.can_edit_until THEN
            RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED: 2-minute edit window passed.';
        ELSIF v_link.submitted_at IS NOT NULL AND NOW() > (v_link.submitted_at + INTERVAL '2 minutes') THEN
            RAISE EXCEPTION 'EDIT_WINDOW_EXPIRED: 2-minute edit window passed.';
        END IF;
    ELSE
        IF v_link.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Cross-community edit denied.';
        END IF;
    END IF;

    v_target_url := COALESCE(p_fb_link, p_new_fb_link);
    IF v_target_url IS NOT NULL AND TRIM(v_target_url) <> '' THEN
        v_clean_url := TRIM(v_target_url);
        IF v_clean_url NOT SIMILAR TO 'https?://(www\.|web\.|m\.)?(facebook\.com|fb\.watch)/.+' THEN
            RAISE EXCEPTION 'INVALID_URL: Must be a valid Facebook link.';
        END IF;
    ELSE
        v_clean_url := v_link.fb_link;
    END IF;

    UPDATE public.daily_links
    SET fb_link = v_clean_url,
        post_type = COALESCE(p_post_type::public.post_type, post_type),
        caption = COALESCE(p_caption, caption),
        instruction = COALESCE(p_instruction, instruction),
        updated_at = NOW()
    WHERE id = p_link_id;

    RETURN jsonb_build_object('success', true, 'link_id', p_link_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_daily_link_secure(
    p_link_id UUID,
    p_reason TEXT DEFAULT 'User deleted'
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
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required.';
    END IF;

    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: Profile not found.';
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINK_NOT_FOUND: Daily link does not exist.';
    END IF;

    IF v_link.status = 'cancelled' OR v_link.status = 'removed' THEN
        RAISE EXCEPTION 'ALREADY_REMOVED: This link has already been removed.';
    END IF;

    IF v_actor.role = 'MEMBER' THEN
        IF v_link.owner_id <> v_actor.id THEN
            RAISE EXCEPTION 'FORBIDDEN: Cannot delete another member link.';
        END IF;

        IF v_link.can_edit_until IS NOT NULL AND NOW() > v_link.can_edit_until THEN
            RAISE EXCEPTION 'DELETE_WINDOW_EXPIRED: Cannot delete after 2 minutes.';
        ELSIF v_link.submitted_at IS NOT NULL AND NOW() > (v_link.submitted_at + INTERVAL '2 minutes') THEN
            RAISE EXCEPTION 'DELETE_WINDOW_EXPIRED: Cannot delete after 2 minutes.';
        END IF;
    ELSE
        IF v_link.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
            RAISE EXCEPTION 'FORBIDDEN: Cross-community deletion denied.';
        END IF;
    END IF;

    UPDATE public.daily_links
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_link_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_actor.id, v_actor.name, v_actor.role::TEXT, 'LINK_REMOVED', 'DAILY_LINK', p_link_id::text, 'Reason: ' || p_reason);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'remove_daily_link_secure: audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'link_id', p_link_id);
END;
$$;

-- ============================ SECTION Q: fake all done + scheduling ========
-- MERGED confirm_fake_all_done_secure (2-arg): batch-2 (C17 grant/policy are
-- in Sections L/V; C19 revokes the punished member's scheduling permission) +
-- medium M12 (advisory lock serializes concurrent confirms; GREATEST floor)
-- + medium M18 (total_all_done decremented). Audit: canonical 7-col, wrapped
-- (both sources left it unwrapped — a phantom audit column must never roll
-- back a punishment). The 3-arg chapter-13 overload delegates to this 2-arg
-- version and keeps working unchanged.
CREATE OR REPLACE FUNCTION public.confirm_fake_all_done_secure(
    p_incident_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_incident public.fake_all_done_incidents%ROWTYPE;
    v_all_done public.all_done%ROWTYPE;
    v_tx RECORD;
    v_reversed_points INTEGER := 0;
    v_now TIMESTAMP := NOW();
BEGIN
    -- Authorization
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    -- M12: serialize concurrent confirms of the SAME incident (prevents double-reverse)
    PERFORM pg_advisory_xact_lock(hashtext('fake_all_done:' || p_incident_id::text));

    -- Incident Check
    SELECT * INTO v_incident FROM public.fake_all_done_incidents WHERE id = p_incident_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
    IF v_incident.review_status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

    -- All Done Check
    SELECT * INTO v_all_done FROM public.all_done WHERE id = v_incident.all_done_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ALL_DONE_NOT_FOUND'; END IF;
    IF v_all_done.status = 'REVOKED' THEN RAISE EXCEPTION 'ALREADY_REVOKED'; END IF;

    -- 1. Invalidate All Done
    UPDATE public.all_done SET status = 'REVOKED' WHERE id = v_all_done.id;

    -- 2. Reverse Points (find original tx and create reversal)
    FOR v_tx IN
        SELECT id, points FROM public.point_transactions
        WHERE member_id = v_incident.member_id
          AND reference_id = v_all_done.id::text
          AND (activity_type = 'ALL_DONE' OR activity_type = 'FASTEST_ALL_DONE')
    LOOP
        INSERT INTO public.point_transactions (member_id, activity_type, points, date, reference_id, description, created_by)
        VALUES (v_incident.member_id,
                CASE WHEN v_tx.points > 0 THEN 'PENALTY_REVERSAL' ELSE 'ERROR' END,
                -v_tx.points,
                (NOW() AT TIME ZONE 'Asia/Dhaka')::date,
                v_all_done.id::text,
                'Reversal of Fake All Done: ' || p_reason,
                v_actor.id);

        v_reversed_points := v_reversed_points + v_tx.points;
    END LOOP;

    -- 3. Update Member Points: M12 floor at zero; M18 decrement total_all_done
    UPDATE public.members
    SET points = GREATEST(0, points - v_reversed_points),
        weekly_points = GREATEST(0, weekly_points - v_reversed_points),
        total_all_done = GREATEST(0, total_all_done - 1)
    WHERE id = v_incident.member_id;

    -- 4. Punishment History
    INSERT INTO public.member_punishments (member_id, community_id, punishment_type, reason, detected_date, detected_by_admin, original_all_done_id)
    VALUES (v_incident.member_id, v_incident.community_id, 'FAKE_ALL_DONE_PENALTY', p_reason, (NOW() AT TIME ZONE 'Asia/Dhaka')::date, v_actor.id, v_all_done.id);

    -- 4b. C19: revoke the scheduling permission so the R8 gate actually fires.
    UPDATE public.members SET can_schedule_links = false, updated_at = NOW() WHERE id = v_incident.member_id;

    -- 5. Update Incident
    UPDATE public.fake_all_done_incidents
    SET review_status = 'CONFIRMED_FAKE', reason = p_reason, confirmed_by = v_actor.id, confirmed_at = v_now
    WHERE id = p_incident_id;

    -- 6. Audit (canonical shape; wrapped so audit can never roll back the punishment)
    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_actor.id, v_actor.name, v_actor.role::TEXT, 'FAKE_ALL_DONE_CONFIRMED', 'MEMBER', v_incident.member_id::text,
                'Confirmed Fake All Done. Points reversed: ' || v_reversed_points || '. Reason: ' || p_reason);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'confirm_fake_all_done_secure: audit skipped (confirm itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- MERGED create_scheduled_link_secure: batch-2 C18 (the 3 R8 gates server-side:
-- no pending supports / today's All Done done / no confirmed Fake All Done
-- this week; admin/dev bypass; exact error codes src/lib/supabase.ts expects)
-- + medium M25 (URL validation, owner ACTIVE, TARGET_MEMBER_NOT_FOUND,
-- DUPLICATE_SCHEDULE — the mapped error codes were dead before).
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
        -- M25: unknown on-behalf target
        IF v_owner.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'TARGET_MEMBER_NOT_FOUND');
        END IF;
    ELSE
        v_owner := v_caller;
    END IF;

    IF v_owner.can_schedule_links = false AND v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SCHEDULING_DISABLED: Admin disabled your schedule permission.');
    END IF;

    -- M25: owner must be ACTIVE (admin on-behalf keeps member restrictions)
    IF v_owner.status <> 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_INACTIVE: Cannot schedule for an inactive account.');
    END IF;

    -- M25: server-side Facebook URL validation (same regex as the submit RPC)
    IF p_fb_link IS NULL OR TRIM(p_fb_link) NOT SIMILAR TO 'https?://(www\.|web\.|m\.)?(facebook\.com|fb\.watch)/.+' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_URL: Must be a valid Facebook link.');
    END IF;

    -- C18: R8 server-side gates. The frontend checks these too, but direct RPC
    -- calls must not bypass them. Skipped for ADMIN/DEVELOPER callers, mirroring
    -- the app's admin bypass. Error codes match src/lib/supabase.ts exactly.
    IF v_caller.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        -- 1. No pending supports: every active link from today that is not owned
        --    by the owner must already be supported by the owner.
        IF EXISTS (
            SELECT 1 FROM public.daily_links dl
            WHERE dl.date = v_today_bdt
              AND COALESCE(dl.status, 'active') = 'active'
              AND dl.owner_id <> v_owner.id
              AND NOT EXISTS (
                  SELECT 1 FROM public.support_records sr
                  WHERE sr.link_id = dl.id AND sr.supporter_id = v_owner.id
              )
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'PENDING_SUPPORT_EXIST: Complete all required supports before scheduling.');
        END IF;

        -- 2. Today's All Done must be completed.
        IF NOT EXISTS (
            SELECT 1 FROM public.all_done ad
            WHERE ad.member_id = v_owner.id AND ad.date = v_today_bdt
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'ALL_DONE_REQUIRED: Complete today''s All Done before scheduling.');
        END IF;

        -- 3. No confirmed Fake All Done in the current (BDT) week.
        IF EXISTS (
            SELECT 1 FROM public.fake_all_done_incidents fi
            WHERE fi.member_id = v_owner.id
              AND fi.review_status = 'CONFIRMED_FAKE'
              AND (fi.confirmed_at AT TIME ZONE 'Asia/Dhaka')::DATE >= (date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')))::DATE
        ) OR (
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'member_punishments')
            AND EXISTS (
                SELECT 1 FROM public.member_punishments mp
                WHERE mp.member_id = v_owner.id
                  AND mp.punishment_type LIKE 'FAKE_ALL_DONE%'
                  AND mp.detected_date >= (date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')))::DATE
            )
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'FAKE_ALL_DONE_RESTRICTION: Scheduling is blocked due to a confirmed Fake All Done this week.');
        END IF;
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

    -- M25: one pending schedule per owner per day
    IF EXISTS (
        SELECT 1 FROM public.scheduled_links
        WHERE owner_id = v_owner.id
          AND target_date = p_target_date
          AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_SCHEDULE: A schedule already exists for this date.');
    END IF;

    INSERT INTO public.scheduled_links (
        community_id, owner_id, member_id, target_date, target_time, post_type, category, caption, instruction, fb_link, status
    ) VALUES (
        v_owner.community_id, v_owner.id, v_owner.id, p_target_date, COALESCE(p_target_time, '12:00'), COALESCE(p_post_type, 'Photo'), COALESCE(p_category, 'NORMAL'), COALESCE(p_caption, ''), COALESCE(p_instruction, ''), p_fb_link, 'pending'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- M27 + M29: run_due_scheduled_links_secure — 12:00-16:00 BDT hard window for
-- EVERYONE (no admin exemption); execution-time eligibility recheck; failures
-- mark the schedule 'failed' with a reason instead of silently publishing.
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
    v_pending_count INT;
BEGIN
    -- M27: hard 12:00-16:00 BDT window for EVERYONE (no admin exemption)
    IF v_now_bdt::time < '12:00:00'::time OR v_now_bdt::time > '16:00:00'::time THEN
        RETURN jsonb_build_object('success', false, 'error', 'WINDOW_CLOSED: Automated execution window is 12:00 PM to 4:00 PM BDT.');
    END IF;

    FOR v_sched IN
        SELECT sl.* FROM public.scheduled_links sl
        WHERE sl.target_date = v_today_bdt AND sl.status = 'pending'
          AND (sl.target_time IS NULL OR sl.target_time::time <= v_now_bdt::time)
        ORDER BY sl.target_time ASC, sl.created_at ASC
    LOOP
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

            -- M29: R8 eligibility recheck at execution time --
            -- (a) owner must have no pending supports for today
            SELECT COUNT(*) INTO v_pending_count
            FROM public.daily_links dl
            WHERE dl.community_id = v_sched.community_id
              AND dl.date = v_today_bdt
              AND dl.owner_id <> v_sched.owner_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.support_records sr
                  WHERE sr.link_id = dl.id
                    AND sr.supporter_id = v_sched.owner_id
                    AND sr.date = v_today_bdt
              );
            IF v_pending_count > 0 THEN
                UPDATE public.scheduled_links
                SET status = 'failed', error_message = 'PENDING_SUPPORTS_EXIST', executed_at = NOW()
                WHERE id = v_sched.id;
                CONTINUE;
            END IF;

            -- (b) owner must not have submitted All Done already today
            IF EXISTS (
                SELECT 1 FROM public.all_done
                WHERE member_id = v_sched.owner_id
                  AND date = v_today_bdt
                  AND status <> 'REVOKED'
            ) THEN
                UPDATE public.scheduled_links
                SET status = 'failed', error_message = 'ALL_DONE_ALREADY_SUBMITTED', executed_at = NOW()
                WHERE id = v_sched.id;
                CONTINUE;
            END IF;

            -- (c) no confirmed Fake All Done in the last 7 days
            IF EXISTS (
                SELECT 1 FROM public.fake_all_done_incidents
                WHERE member_id = v_sched.owner_id
                  AND review_status = 'CONFIRMED_FAKE'
                  AND confirmed_at >= NOW() - INTERVAL '7 days'
            ) THEN
                UPDATE public.scheduled_links
                SET status = 'failed', error_message = 'FAKE_ALL_DONE_RESTRICTION', executed_at = NOW()
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
                id, community_id, owner_id, member_id, date, serial_number, serial_display, part_number, post_type, category, caption, instruction, fb_link, status, submitted_at
            ) VALUES (
                v_link_id, v_sched.community_id, v_sched.owner_id, v_sched.owner_id, v_today_bdt, v_next_serial, LPAD(v_next_serial::text, 2, '0'), v_part, v_sched.post_type, v_sched.category, v_sched.caption, v_sched.instruction, v_sched.fb_link, 'active', NOW()
            );

            -- 4. Read earning points configuration
            SELECT COALESCE(points_daily_link_submit, 5) INTO v_earned
            FROM public.settings WHERE community_id = 'main';

            -- 5. Write to point transaction ledger
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
            UPDATE public.scheduled_links
            SET status = 'failed', error_message = SQLERRM, executed_at = NOW()
            WHERE id = v_sched.id;
        END;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'executed_count', v_executed_count);
END;
$$;

-- ============================ SECTION R: notices (C12) ======================
-- C12: the three notice RPCs resolved the caller via members.id = auth.uid()
-- (always NULL -> permanent UNAUTHORIZED). Fixed to auth_user_id = auth.uid();
-- audit INSERTs use the canonical 7-col shape, wrapped.
CREATE OR REPLACE FUNCTION public.generate_notice_secure(
    p_member_id UUID DEFAULT NULL,
    p_type VARCHAR(50) DEFAULT 'SIMPLE_WARNING',
    p_title VARCHAR(200) DEFAULT '',
    p_content TEXT DEFAULT '',
    p_level VARCHAR(20) DEFAULT 'SIMPLE_WARNING',
    p_days_inactive_filter INTEGER DEFAULT NULL,
    p_is_pinned BOOLEAN DEFAULT false,
    p_priority VARCHAR(20) DEFAULT 'NORMAL',
    p_target_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role user_role;
    v_caller_name VARCHAR(100);
    v_target_member RECORD;
    v_exact_inactive_days INTEGER := 0;
    v_notice_id UUID;
    v_rendered_content TEXT;
    v_target_id UUID;
BEGIN
    v_target_id := COALESCE(p_member_id, p_target_member_id);
    IF v_target_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_ID_REQUIRED: Target member ID must be provided.');
    END IF;

    v_caller_id := auth.uid();

    SELECT role, name INTO v_caller_role, v_caller_name
    FROM public.members WHERE auth_user_id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Admins can generate notices.');
    END IF;

    SELECT * INTO v_target_member FROM public.members WHERE id = v_target_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND: Member does not exist.');
    END IF;

    IF p_type = 'KICKOUT_WARNING' OR p_level = 'KICKOUT_WARNING' THEN
        IF v_target_member.status != 'REMOVED' THEN
            RETURN jsonb_build_object('success', false, 'error', 'KICKOUT_NOTICE_NOT_ALLOWED: Member is currently active and not removed.');
        END IF;
    ELSE
        IF v_target_member.status = 'REMOVED' THEN
            RETURN jsonb_build_object('success', false, 'error', 'NOTICE_NOT_ALLOWED: Inactive warnings cannot be sent to already removed members.');
        END IF;
    END IF;

    v_exact_inactive_days := public.calculate_member_inactive_days_secure(v_target_id);

    v_rendered_content := p_content;
    v_rendered_content := REPLACE(v_rendered_content, '{member_name}', v_target_member.name);
    v_rendered_content := REPLACE(v_rendered_content, '{member_number}', v_target_member.member_number);
    v_rendered_content := REPLACE(v_rendered_content, '{inactive_days}', v_exact_inactive_days::TEXT);
    v_rendered_content := REPLACE(v_rendered_content, '{warning_level}', p_level);
    v_rendered_content := REPLACE(v_rendered_content, '{community_name}', 'Support Link Box');

    INSERT INTO public.notices (
        community_id, target_member_id, type, title, message, level, target_role,
        target_member_ids, days_inactive_filter, exact_inactive_days, is_pinned,
        priority, status, created_by, created_by_name, created_at
    ) VALUES (
        v_target_member.community_id, v_target_id, p_type, p_title, v_rendered_content,
        p_level, 'MEMBER', ARRAY[v_target_id], p_days_inactive_filter,
        v_exact_inactive_days, p_is_pinned, p_priority, 'ACTIVE',
        v_caller_id, v_caller_name, NOW()
    ) RETURNING id INTO v_notice_id;

    INSERT INTO public.notifications (
        member_id, community_id, title, message, type, reference_id, is_read, priority, created_at
    ) VALUES (
        v_target_id, v_target_member.community_id, p_title, v_rendered_content,
        CASE
            WHEN p_type = 'KICKOUT_WARNING' THEN 'NOTICE_KICKOUT'
            WHEN p_type = 'ALERT_WARNING' THEN 'NOTICE_ALERT'
            ELSE 'NOTICE_SIMPLE'
        END,
        v_notice_id::TEXT, false, p_priority, NOW()
    )
    ON CONFLICT (member_id, type, COALESCE(reference_id, 'none')) DO NOTHING;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_caller_id, v_caller_name, v_caller_role::TEXT, 'NOTICE_GENERATED', 'NOTICE',
            v_notice_id::TEXT,
            format('Generated %s for %s (%s), member %s. Inactive days: %s', p_type, v_target_member.name, v_target_member.member_number, v_target_id, v_exact_inactive_days)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'C15: audit NOTICE_GENERATED skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'notice_id', v_notice_id,
        'exact_inactive_days', v_exact_inactive_days,
        'message', 'নোটিশ সফলভাবে তৈরি ও পাঠানো হয়েছে।'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_generate_notices_secure(
    p_member_ids UUID[] DEFAULT NULL,
    p_type VARCHAR(50) DEFAULT 'SIMPLE_WARNING',
    p_title VARCHAR(200) DEFAULT '',
    p_content_template TEXT DEFAULT '',
    p_level VARCHAR(20) DEFAULT 'SIMPLE_WARNING',
    p_days_inactive_filter INTEGER DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'NORMAL',
    p_target_member_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role user_role;
    v_caller_name VARCHAR(100);
    v_mem_id UUID;
    v_target_member RECORD;
    v_exact_inactive_days INTEGER;
    v_notice_id UUID;
    v_rendered_content TEXT;
    v_success_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_target_ids UUID[];
BEGIN
    v_target_ids := COALESCE(p_member_ids, p_target_member_ids);
    IF v_target_ids IS NULL OR array_length(v_target_ids, 1) IS NULL OR array_length(v_target_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_IDS_REQUIRED: Target member IDs array must be provided.');
    END IF;

    v_caller_id := auth.uid();

    SELECT role, name INTO v_caller_role, v_caller_name
    FROM public.members WHERE auth_user_id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Admins can bulk generate notices.');
    END IF;

    FOREACH v_mem_id IN ARRAY v_target_ids
    LOOP
        SELECT * INTO v_target_member FROM public.members WHERE id = v_mem_id;
        IF FOUND THEN
            IF (p_type = 'KICKOUT_WARNING' OR p_level = 'KICKOUT_WARNING') AND v_target_member.status != 'REMOVED' THEN
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            IF (p_type != 'KICKOUT_WARNING' AND p_level != 'KICKOUT_WARNING') AND v_target_member.status = 'REMOVED' THEN
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            v_exact_inactive_days := public.calculate_member_inactive_days_secure(v_mem_id);

            v_rendered_content := p_content_template;
            v_rendered_content := REPLACE(v_rendered_content, '{member_name}', v_target_member.name);
            v_rendered_content := REPLACE(v_rendered_content, '{member_number}', v_target_member.member_number);
            v_rendered_content := REPLACE(v_rendered_content, '{inactive_days}', v_exact_inactive_days::TEXT);
            v_rendered_content := REPLACE(v_rendered_content, '{warning_level}', p_level);
            v_rendered_content := REPLACE(v_rendered_content, '{community_name}', 'Support Link Box');

            INSERT INTO public.notices (
                community_id, target_member_id, type, title, message, level, target_role,
                target_member_ids, days_inactive_filter, exact_inactive_days, is_pinned,
                priority, status, created_by, created_by_name, created_at
            ) VALUES (
                v_target_member.community_id, v_mem_id, p_type, p_title, v_rendered_content,
                p_level, 'MEMBER', ARRAY[v_mem_id], p_days_inactive_filter,
                v_exact_inactive_days, false, p_priority, 'ACTIVE',
                v_caller_id, v_caller_name, NOW()
            ) RETURNING id INTO v_notice_id;

            INSERT INTO public.notifications (
                member_id, community_id, title, message, type, reference_id, is_read, priority, created_at
            ) VALUES (
                v_mem_id, v_target_member.community_id, p_title, v_rendered_content,
                CASE
                    WHEN p_type = 'KICKOUT_WARNING' THEN 'NOTICE_KICKOUT'
                    WHEN p_type = 'ALERT_WARNING' THEN 'NOTICE_ALERT'
                    ELSE 'NOTICE_SIMPLE'
                END,
                v_notice_id::TEXT, false, p_priority, NOW()
            )
            ON CONFLICT (member_id, type, COALESCE(reference_id, 'none')) DO NOTHING;

            v_success_count := v_success_count + 1;
        END IF;
    END LOOP;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, details)
        VALUES (
            v_caller_id, v_caller_name, v_caller_role::TEXT, 'NOTICE_BULK_GENERATED', 'NOTICE',
            format('Bulk generated %s notices of type %s (Skipped: %s)', v_success_count, p_type, v_skipped_count)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'C15: audit NOTICE_BULK_GENERATED skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'success_count', v_success_count,
        'skipped_count', v_skipped_count,
        'message', format('মোট %s জনের নোটিশ সফলভাবে তৈরি হয়েছে।', v_success_count)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_notice_secure(p_notice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role user_role;
    v_caller_name VARCHAR(100);
BEGIN
    v_caller_id := auth.uid();

    SELECT role, name INTO v_caller_role, v_caller_name
    FROM public.members WHERE auth_user_id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    UPDATE public.notices
    SET status = 'REVOKED'
    WHERE id = p_notice_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_caller_id, v_caller_name, v_caller_role::TEXT, 'NOTICE_REVOKED', 'NOTICE',
            p_notice_id::TEXT, 'Revoked notice'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'C15: audit NOTICE_REVOKED skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================ SECTION S: reports ============================
-- M20: update_report_status_secure — real status vocabulary PENDING /
-- IN_DISCUSSION / RESOLVED / DISMISSED with a validated transition table;
-- leaving a terminal state clears its metadata.
CREATE OR REPLACE FUNCTION public.update_report_status_secure(
    p_report_id UUID,
    p_new_status VARCHAR,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_member public.members%ROWTYPE;
    v_report public.reports%ROWTYPE;
    v_old_status VARCHAR(20);
    v_clean_status VARCHAR(20);
    v_allowed BOOLEAN;
BEGIN
    SELECT * INTO v_caller_member FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_member.id IS NULL OR v_caller_member.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Admins can update report status');
    END IF;

    SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
    IF v_report.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'REPORT_NOT_FOUND');
    END IF;

    IF v_report.community_id <> v_caller_member.community_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_COMMUNITY_DENIED');
    END IF;

    v_clean_status := UPPER(TRIM(p_new_status));
    IF v_clean_status NOT IN ('PENDING', 'IN_DISCUSSION', 'RESOLVED', 'DISMISSED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS: Allowed statuses are PENDING, IN_DISCUSSION, RESOLVED, DISMISSED');
    END IF;

    v_old_status := v_report.status;

    v_allowed := CASE v_old_status
        WHEN 'PENDING'      THEN v_clean_status IN ('IN_DISCUSSION', 'DISMISSED')
        WHEN 'IN_DISCUSSION' THEN v_clean_status IN ('RESOLVED', 'DISMISSED', 'PENDING')
        WHEN 'RESOLVED'     THEN v_clean_status IN ('DISMISSED', 'PENDING')
        WHEN 'DISMISSED'    THEN v_clean_status IN ('PENDING')
        ELSE false
    END;
    IF NOT v_allowed THEN
        RETURN jsonb_build_object('success', false, 'error',
            'INVALID_TRANSITION: Cannot move report from ' || v_old_status || ' to ' || v_clean_status);
    END IF;

    UPDATE public.reports
    SET status = v_clean_status,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        resolved_at = CASE WHEN v_clean_status = 'RESOLVED' THEN NOW() ELSE NULL END,
        resolved_by = CASE WHEN v_clean_status = 'RESOLVED' THEN v_caller_member.id ELSE NULL END,
        dismissed_at = CASE WHEN v_clean_status = 'DISMISSED' THEN NOW() ELSE NULL END,
        dismissed_by = CASE WHEN v_clean_status = 'DISMISSED' THEN v_caller_member.id ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_report_id;

    INSERT INTO public.notifications (
        member_id, title, message, type, reference_type, reference_id, created_at
    ) VALUES (
        v_report.reporter_id,
        '📋 রিপোর্ট স্ট্যাটাস পরিবর্তন',
        'আপনার রিপোর্ট #' || COALESCE(v_report.report_serial_display, '') || ' এর স্ট্যাটাস ' || v_clean_status || ' করা হয়েছে।',
        'ADMIN_MESSAGE',
        'REPORT',
        p_report_id::text,
        NOW()
    );

    IF v_report.link_owner_id <> v_report.reporter_id THEN
        INSERT INTO public.notifications (
            member_id, title, message, type, reference_type, reference_id, created_at
        ) VALUES (
            v_report.link_owner_id,
            '📋 লিংক রিপোর্ট আপডেট',
            'আপনার লিংক সম্পর্কিত রিপোর্ট #' || COALESCE(v_report.report_serial_display, '') || ' স্ট্যাটাস ' || v_clean_status || ' করা হয়েছে।',
            'ADMIN_MESSAGE',
            'REPORT',
            p_report_id::text,
            NOW()
        );
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
            v_caller_member.id, v_caller_member.name, v_caller_member.role::TEXT,
            'REPORT_STATUS_CHANGED', 'REPORT', p_report_id::text,
            'Changed report #' || COALESCE(v_report.report_serial_display, '') || ' status from ' || v_old_status || ' to ' || v_clean_status
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'update_report_status_secure: audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- M21: create_report_secure — only the serial generation changed (sequence,
-- no MAX()+1 race). (actor_auth_id is guaranteed by Section H.)
CREATE OR REPLACE FUNCTION public.create_report_secure(
    p_link_id UUID,
    p_category VARCHAR,
    p_description TEXT,
    p_screenshot_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_member public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_link_owner public.members%ROWTYPE;
    v_existing_active_count INTEGER;
    v_report_id UUID;
    v_next_serial_int INTEGER;
    v_report_serial VARCHAR(20);
    v_admin_rec RECORD;
    v_clean_cat VARCHAR(50);
BEGIN
    SELECT * INTO v_caller_member FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Member profile not found');
    END IF;

    IF v_caller_member.status IN ('BANNED', 'REMOVED', 'SUSPENDED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_RESTRICTED: You cannot submit reports');
    END IF;

    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF v_link.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'LINK_NOT_FOUND: Target link does not exist');
    END IF;

    IF v_link.community_id <> v_caller_member.community_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_COMMUNITY_DENIED: Link belongs to another community');
    END IF;

    SELECT * INTO v_link_owner FROM public.members WHERE id = v_link.owner_id;
    IF v_link_owner.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'LINK_OWNER_NOT_FOUND');
    END IF;

    SELECT COUNT(*) INTO v_existing_active_count
    FROM public.reports
    WHERE link_id = p_link_id
      AND reporter_id = v_caller_member.id
      AND status IN ('PENDING', 'IN_DISCUSSION');

    IF v_existing_active_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_REPORT: এই Link সম্পর্কে আপনার একটি Active Report ইতোমধ্যে রয়েছে।');
    END IF;

    v_clean_cat := UPPER(TRIM(p_category));
    IF v_clean_cat IN ('LINK_NOT_WORKING', 'COMMENTS_DISABLED', 'POST_NOT_PUBLIC', 'REACTION_COMMENT_DISABLED', 'ADULT_POST', 'POLITICAL_POST') THEN
        -- Standard canonical code
    ELSIF v_clean_cat = 'REACT_COMMENT_DISABLED' THEN
        v_clean_cat := 'REACTION_COMMENT_DISABLED';
    ELSE
        v_clean_cat := 'LINK_NOT_WORKING';
    END IF;

    -- M21: sequence — no MAX()+1 race
    v_next_serial_int := nextval('public.report_serial_seq');
    v_report_serial := 'REP-' || LPAD(v_next_serial_int::text, 6, '0');

    INSERT INTO public.reports (
        report_serial_display,
        community_id,
        link_id,
        link_serial,
        link_owner_id,
        link_owner_name,
        reporter_id,
        reporter_name,
        category,
        description,
        screenshot_url,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_report_serial,
        v_caller_member.community_id,
        v_link.id,
        v_link.serial_display,
        v_link_owner.id,
        v_link_owner.name,
        v_caller_member.id,
        v_caller_member.name,
        v_clean_cat,
        COALESCE(TRIM(p_description), 'No description provided'),
        p_screenshot_path,
        'PENDING',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_report_id;

    IF p_screenshot_path IS NOT NULL AND LENGTH(TRIM(p_screenshot_path)) > 0 THEN
        INSERT INTO public.report_evidence (
            report_id,
            community_id,
            storage_bucket,
            storage_path,
            uploaded_by,
            created_at
        ) VALUES (
            v_report_id,
            v_caller_member.community_id,
            'reports',
            p_screenshot_path,
            v_caller_member.id,
            NOW()
        );
    END IF;

    IF v_link_owner.id <> v_caller_member.id THEN
        INSERT INTO public.notifications (
            member_id, title, message, type, reference_type, reference_id, created_at
        ) VALUES (
            v_link_owner.id,
            '⚠️ লিংক রিপোর্ট নোটিশ',
            'আপনার সাবমিট করা লিংক #' || v_link.serial_display || ' সম্পর্কে একটি রিপোর্ট (' || v_clean_cat || ') জমা হয়েছে।',
            'ADMIN_MESSAGE',
            'REPORT',
            v_report_id::text,
            NOW()
        );
    END IF;

    FOR v_admin_rec IN
        SELECT id FROM public.members
        WHERE community_id = v_caller_member.community_id
          AND role IN ('ADMIN', 'DEVELOPER')
          AND id <> v_caller_member.id
    LOOP
        INSERT INTO public.notifications (
            member_id, title, message, type, reference_type, reference_id, created_at
        ) VALUES (
            v_admin_rec.id,
            '🚨 নতুন সমস্যা রিপোর্ট #' || v_report_serial,
            v_caller_member.name || ' লিংক #' || v_link.serial_display || ' নিয়ে অভিযোগ দায়ের করেছেন: ' || v_clean_cat,
            'ADMIN_MESSAGE',
            'REPORT',
            v_report_id::text,
            NOW()
        );
    END LOOP;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_auth_id,
        actor_name,
        actor_role,
        action,
        target_type,
        target_id,
        details,
        created_at
    ) VALUES (
        v_caller_member.id,
        auth.uid(),
        v_caller_member.name,
        v_caller_member.role,
        'REPORT_CREATED',
        'REPORT',
        v_report_id::text,
        'Submitted report [' || v_clean_cat || '] against Link #' || v_link.serial_display || ' owned by ' || v_link_owner.name,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'report_id', v_report_id,
        'report_serial', v_report_serial,
        'status', 'PENDING'
    );
END;
$$;

-- ============================ SECTION T: profile change =====================
-- MERGED request_profile_change: medium M34 (full server-side validation:
-- name 2-100 chars, no control chars, photo URL must be https://) + high H35
-- (the partial unique index is the real one-pending-per-member guard; the
-- INSERT catches the race -> ALREADY_PENDING). Keeps the LIVE
-- profile-change-requests.sql behavior (one pending per member, PENDING /
-- APPROVED / REJECTED lifecycle).
CREATE OR REPLACE FUNCTION public.request_profile_change(
    p_requested_name VARCHAR(100),
    p_requested_photo_url TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member_id UUID;
    v_existing UUID;
    v_clean_name TEXT;
    v_clean_photo TEXT;
BEGIN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE auth_user_id = auth.uid();

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    v_clean_name := NULLIF(TRIM(p_requested_name), '');
    v_clean_photo := NULLIF(TRIM(p_requested_photo_url), '');

    IF v_clean_name IS NULL AND v_clean_photo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOTHING_TO_CHANGE');
    END IF;

    -- M34: name validation
    IF v_clean_name IS NOT NULL THEN
        IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 100 THEN
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME: Name must be 2-100 characters.');
        END IF;
        IF v_clean_name ~ ('[' || chr(1) || '-' || chr(31) || chr(127) || ']') THEN
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME: Name contains invalid characters.');
        END IF;
    END IF;

    -- M34: photo URL must be https (blocks javascript:/data: URLs)
    IF v_clean_photo IS NOT NULL AND v_clean_photo NOT LIKE 'https://%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHOTO_URL: Photo URL must start with https://.');
    END IF;

    SELECT id INTO v_existing
    FROM public.profile_change_requests
    WHERE member_id = v_member_id AND status = 'PENDING'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PENDING');
    END IF;

    -- H35: the index is the real guard; the INSERT just reports the race nicely.
    BEGIN
        INSERT INTO public.profile_change_requests (member_id, requested_name, requested_photo_url, reason)
        VALUES (
            v_member_id,
            v_clean_name,
            v_clean_photo,
            NULLIF(TRIM(p_reason), '')
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PENDING');
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- MERGED review_profile_change: high H36 (SELECT ... FOR UPDATE serializes
-- reviewers: the second blocks, then sees ALREADY_REVIEWED) + high's
-- NULLIF(TRIM()) apply (an empty string can never wipe a name) + medium M36
-- (canonical wrapped audit on BOTH approve and reject).
CREATE OR REPLACE FUNCTION public.review_profile_change(
    p_request_id UUID,
    p_approve BOOLEAN,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reviewer_id UUID;
    v_reviewer_role user_role;
    v_req public.profile_change_requests%ROWTYPE;
BEGIN
    SELECT id, role INTO v_reviewer_id, v_reviewer_role
    FROM public.members
    WHERE auth_user_id = auth.uid();

    IF v_reviewer_id IS NULL OR v_reviewer_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    -- H36: lock the request row first.
    SELECT * INTO v_req
    FROM public.profile_change_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REVIEWED');
    END IF;

    IF p_approve THEN
        -- Apply the approved changes (name/photo are not guard-protected
        -- fields). NULLIF(TRIM()) so an empty string can never wipe a name.
        UPDATE public.members
        SET name = COALESCE(NULLIF(TRIM(v_req.requested_name), ''), name),
            profile_photo_url = COALESCE(NULLIF(TRIM(v_req.requested_photo_url), ''), profile_photo_url)
        WHERE id = v_req.member_id;

        UPDATE public.profile_change_requests
        SET status = 'APPROVED',
            reviewed_by = v_reviewer_id,
            review_note = NULLIF(TRIM(p_note), ''),
            reviewed_at = NOW()
        WHERE id = p_request_id;
    ELSE
        UPDATE public.profile_change_requests
        SET status = 'REJECTED',
            reviewed_by = v_reviewer_id,
            review_note = NULLIF(TRIM(p_note), ''),
            reviewed_at = NOW()
        WHERE id = p_request_id;
    END IF;

    -- M36: audit trail on approve AND reject (defensive: never breaks the review)
    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        SELECT v_reviewer_id, m.name, v_reviewer_role::TEXT,
               CASE WHEN p_approve THEN 'PROFILE_CHANGE_APPROVED' ELSE 'PROFILE_CHANGE_REJECTED' END,
               'PROFILE_CHANGE_REQUEST', p_request_id::TEXT,
               'Reviewed profile change for member ' || v_req.member_id
               || '. Decision: ' || CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END
               || '. Note: ' || COALESCE(NULLIF(TRIM(p_note), ''), '-')
        FROM public.members m WHERE m.id = v_reviewer_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'M36: audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- M35: members can retract their own PENDING requests.
CREATE OR REPLACE FUNCTION public.cancel_profile_change_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_member_id UUID;
    v_deleted_id UUID;
BEGIN
    SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid();
    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    DELETE FROM public.profile_change_requests
    WHERE id = p_request_id AND member_id = v_member_id AND status = 'PENDING'
    RETURNING id INTO v_deleted_id;

    IF v_deleted_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND_OR_NOT_PENDING');
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        SELECT v_member_id, m.name, m.role::TEXT, 'PROFILE_CHANGE_CANCELLED',
               'PROFILE_CHANGE_REQUEST', p_request_id::TEXT,
               'Member cancelled their pending profile change request.'
        FROM public.members m WHERE m.id = v_member_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'M35: audit skipped: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================ SECTION U: system =============================
-- H26: rpc_developer_reset_system — DAILY/WEEKLY/ALL with ledger-correct
-- counter math (no phantom points), built from information_schema so missing
-- counter columns can never abort the reset.
CREATE OR REPLACE FUNCTION public.rpc_developer_reset_system(
    p_reset_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role user_role;
    v_caller_id UUID;
    v_caller_name TEXT;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
    v_week_start DATE := date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'))::DATE;
    v_scope_start DATE;
    v_period_col TEXT;
    v_set_list TEXT;
    v_d_links INT := 0;
    v_d_supports INT := 0;
    v_d_alldone INT := 0;
    v_d_tx INT := 0;
BEGIN
    SELECT role, id, name INTO v_caller_role, v_caller_id, v_caller_name
    FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'DEVELOPER' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Developer privileges required.';
    END IF;

    IF p_reset_type = 'DAILY' THEN
        v_scope_start := v_today; v_period_col := 'daily_points';
    ELSIF p_reset_type = 'WEEKLY' THEN
        v_scope_start := v_week_start; v_period_col := 'weekly_points';
    ELSIF p_reset_type = 'ALL' THEN
        v_scope_start := NULL; v_period_col := NULL;
    ELSE
        RAISE EXCEPTION 'INVALID_RESET_TYPE: use DAILY, WEEKLY, or ALL.';
    END IF;

    IF v_scope_start IS NULL THEN
        SELECT string_agg(column_name || ' = 0', ', ') INTO v_set_list
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'members'
          AND column_name IN ('points', 'weekly_points', 'monthly_points', 'daily_points');
        IF v_set_list IS NOT NULL THEN
            EXECUTE 'UPDATE public.members SET ' || v_set_list;
        END IF;
        DELETE FROM public.point_transactions;
        GET DIAGNOSTICS v_d_tx = ROW_COUNT;
    ELSE
        SELECT string_agg('m.' || k.c || ' = GREATEST(0, m.' || k.c || ' - COALESCE(t.s, 0))', ', ')
          INTO v_set_list
        FROM (VALUES ('points'), ('weekly_points'), ('monthly_points')) AS k(c)
        WHERE EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'members'
                        AND column_name = k.c);
        IF v_set_list IS NOT NULL THEN
            EXECUTE 'UPDATE public.members m SET ' || v_set_list ||
                    ' FROM (SELECT member_id, SUM(points) AS s FROM public.point_transactions' ||
                    ' WHERE date >= ' || quote_literal(v_scope_start) ||
                    ' GROUP BY member_id) t WHERE m.id = t.member_id';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'members'
                      AND column_name = v_period_col) THEN
            EXECUTE 'UPDATE public.members SET ' || quote_ident(v_period_col) || ' = 0';
        END IF;
        DELETE FROM public.point_transactions WHERE date >= v_scope_start;
        GET DIAGNOSTICS v_d_tx = ROW_COUNT;
    END IF;

    IF v_scope_start IS NULL THEN
        DELETE FROM public.support_records;
        GET DIAGNOSTICS v_d_supports = ROW_COUNT;
        DELETE FROM public.all_done;
        GET DIAGNOSTICS v_d_alldone = ROW_COUNT;
        DELETE FROM public.daily_links;
        GET DIAGNOSTICS v_d_links = ROW_COUNT;
    ELSE
        IF p_reset_type = 'DAILY' THEN
            DELETE FROM public.support_records WHERE date >= v_scope_start;
            GET DIAGNOSTICS v_d_supports = ROW_COUNT;
            DELETE FROM public.all_done WHERE date >= v_scope_start;
            GET DIAGNOSTICS v_d_alldone = ROW_COUNT;
            DELETE FROM public.daily_links WHERE date >= v_scope_start;
            GET DIAGNOSTICS v_d_links = ROW_COUNT;
        END IF;
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_caller_id, v_caller_name, v_caller_role::TEXT, 'SYSTEM_RESET', 'SYSTEM', p_reset_type,
                'Developer reset ' || p_reset_type ||
                ': daily_links=' || v_d_links ||
                ' support_records=' || v_d_supports ||
                ' all_done=' || v_d_alldone ||
                ' point_transactions=' || v_d_tx);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'SLB H26: reset audit insert failed (reset itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'reset_type', p_reset_type,
        'deleted', jsonb_build_object(
            'daily_links', v_d_links,
            'support_records', v_d_supports,
            'all_done', v_d_alldone,
            'point_transactions', v_d_tx
        )
    );
END;
$$;

-- H30: get_member_history_secure — real ledger columns (points/activity_type);
-- defensive details->jsonb cast (most audit rows store plain text).
CREATE OR REPLACE FUNCTION public.get_member_history_secure(
    p_target_member_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    event_type TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    SELECT * INTO v_target FROM public.members WHERE id = p_target_member_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    IF NOT (
        v_actor.id = p_target_member_id OR
        (v_actor.role IN ('ADMIN', 'DEVELOPER') AND v_actor.community_id = v_target.community_id)
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Unauthorized access.';
    END IF;

    RETURN QUERY
    SELECT 'AUDIT'::TEXT,
           CASE WHEN a.details IS NULL THEN NULL
                WHEN a.details ~ '^\s*[{[]' THEN a.details::jsonb
                ELSE jsonb_build_object('text', a.details)
           END,
           a.created_at
    FROM public.audit_logs a
    WHERE a.target_member_id = p_target_member_id
    UNION ALL
    SELECT 'POINT', jsonb_build_object('amount', p.points, 'activity', p.activity_type), p.created_at
    FROM public.point_transactions p
    WHERE p.member_id = p_target_member_id
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- H32: execute_weekly_safe_cleanup — support_records ONLY, gated on
-- status='VERIFIED' + checksum + cutoff_date (what the job actually produces).
-- daily_links / all_done / point_transactions are NEVER deleted here.
CREATE OR REPLACE FUNCTION public.execute_weekly_safe_cleanup(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch RECORD;
    v_deleted_count INTEGER := 0;
    v_caller_id UUID;
    v_caller_name TEXT;
    v_caller_role TEXT;
BEGIN
    IF NOT public.is_current_user_admin_or_dev() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ACCESS');
    END IF;
    SELECT id, name, role::text INTO v_caller_id, v_caller_name, v_caller_role
    FROM public.members WHERE auth_user_id = auth.uid();

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='archive_batches'
                     AND column_name='cutoff_date')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='archive_batches'
                        AND column_name='checksum') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SCHEMA_MISMATCH: archive_batches lacks cutoff_date/checksum');
    END IF;

    SELECT * INTO v_batch
    FROM public.archive_batches
    WHERE id = p_batch_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'BATCH_NOT_FOUND');
    END IF;

    IF v_batch.status IS DISTINCT FROM 'VERIFIED' OR v_batch.checksum IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNVERIFIED_BACKUP_CLEANUP_ABORTED: Database cleanup is strictly forbidden until Google Sheets SHA-256 backup is verified.'
        );
    END IF;

    IF v_batch.cutoff_date IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'MISSING_CUTOFF: archive batch has no cutoff_date; cleanup scope unknown.'
        );
    END IF;

    DELETE FROM public.support_records
    WHERE created_at < v_batch.cutoff_date;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    UPDATE public.archive_batches
    SET status = 'ARCHIVED_COMPLETED',
        updated_at = NOW()
    WHERE id = p_batch_id;

    BEGIN
        INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (v_caller_id, v_caller_name, v_caller_role, 'WEEKLY_SAFE_CLEANUP_EXECUTED', 'ARCHIVE_BATCH', p_batch_id::text,
                'support_records cleaned before ' || v_batch.cutoff_date::text ||
                ': ' || v_deleted_count || ' rows; checksum ' || v_batch.checksum);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'SLB H32: cleanup audit insert failed (cleanup itself succeeded): %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verified archive cleanup executed successfully (support_records only)',
        'rows_cleaned', v_deleted_count,
        'sha256_checksum', v_batch.checksum
    );
END;
$$;

-- M14: update_point_settings_secure — NULL params mean "leave unchanged"
-- (partial updates no longer reset untouched metrics to defaults).
CREATE OR REPLACE FUNCTION public.update_point_settings_secure(
    p_points_daily_link_submit INTEGER DEFAULT NULL,
    p_points_per_support INTEGER DEFAULT NULL,
    p_points_all_done INTEGER DEFAULT NULL,
    p_points_fastest_top1 INTEGER DEFAULT NULL,
    p_points_fastest_top2 INTEGER DEFAULT NULL,
    p_points_fastest_top3 INTEGER DEFAULT NULL,
    p_points_fastest_top4 INTEGER DEFAULT NULL,
    p_points_fastest_top5 INTEGER DEFAULT NULL,
    p_penalty_late_support INTEGER DEFAULT NULL,
    p_penalty_fake_all_done INTEGER DEFAULT NULL,
    p_penalty_inactive INTEGER DEFAULT NULL
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
    SET points_daily_link_submit = COALESCE(p_points_daily_link_submit, points_daily_link_submit),
        points_per_support = COALESCE(p_points_per_support, points_per_support),
        points_all_done = COALESCE(p_points_all_done, points_all_done),
        points_fastest_top1 = COALESCE(p_points_fastest_top1, points_fastest_top1),
        points_fastest_top2 = COALESCE(p_points_fastest_top2, points_fastest_top2),
        points_fastest_top3 = COALESCE(p_points_fastest_top3, points_fastest_top3),
        points_fastest_top4 = COALESCE(p_points_fastest_top4, points_fastest_top4),
        points_fastest_top5 = COALESCE(p_points_fastest_top5, points_fastest_top5),
        penalty_late_support = ABS(COALESCE(p_penalty_late_support, penalty_late_support)),
        penalty_fake_all_done = ABS(COALESCE(p_penalty_fake_all_done, penalty_fake_all_done)),
        penalty_inactive = ABS(COALESCE(p_penalty_inactive, penalty_inactive)),
        updated_at = NOW()
    WHERE community_id = 'main';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================ SECTION V: grants & locked-down RPCs ==========
-- verify_invite_token (C5)
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;
-- consume_invite_token_tx (C6)
GRANT EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) TO authenticated, service_role;
-- confirm_fake_all_done_secure (C17: the 2-arg overload had no grant)
GRANT EXECUTE ON FUNCTION public.confirm_fake_all_done_secure(UUID, TEXT) TO authenticated;
-- create_scheduled_link_secure (L24: was relying on the default PUBLIC execute)
GRANT EXECUTE ON FUNCTION public.create_scheduled_link_secure(DATE, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, VARCHAR, UUID) TO authenticated;
-- cancel_profile_change_request (M35)
GRANT EXECUTE ON FUNCTION public.cancel_profile_change_request(UUID) TO authenticated;
-- rpc_developer_reset_system (H26)
GRANT EXECUTE ON FUNCTION public.rpc_developer_reset_system(TEXT) TO authenticated;

-- M3/C7: lock down the identifier-resolution RPCs. The edge function
-- (service_role) is the only legitimate caller; the login FORM already shows
-- only generic errors, so no oracle remains. Guarded: safe even if a function
-- is somehow absent.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'get_email_by_identifier'
                 AND pg_get_function_identity_arguments(p.oid) = 'text') THEN
        REVOKE ALL ON FUNCTION public.get_email_by_identifier(TEXT) FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT) TO service_role;
        RAISE NOTICE 'M3/C7: get_email_by_identifier locked to service_role';
    ELSE
        RAISE WARNING 'M3/C7: get_email_by_identifier not found; lock skipped';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'resolve_member_email_by_number'
                 AND pg_get_function_identity_arguments(p.oid) = 'character varying') THEN
        REVOKE ALL ON FUNCTION public.resolve_member_email_by_number(VARCHAR) FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.resolve_member_email_by_number(VARCHAR) TO service_role;
        RAISE NOTICE 'M3: resolve_member_email_by_number oracle revoked';
    ELSE
        RAISE NOTICE 'M3: resolve_member_email_by_number not found; nothing to revoke';
    END IF;
END
$$;

-- H34: kill the blacklist oracle. is_blacklisted(p_email, p_fb_link) was
-- granted to anon/authenticated -> anyone could probe arbitrary emails/FB
-- links to learn who is blacklisted. Only edge functions (service_role) call it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'is_blacklisted'
                 AND pg_get_function_identity_arguments(p.oid) = 'text, text') THEN
        REVOKE ALL ON FUNCTION public.is_blacklisted(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.is_blacklisted(TEXT, TEXT) TO service_role;
        RAISE NOTICE 'H34: is_blacklisted oracle revoked';
    ELSE
        RAISE NOTICE 'H34: is_blacklisted(TEXT, TEXT) not found; nothing to revoke';
    END IF;
END
$$;

-- ============================================================================
-- DONE. Run in the Supabase SQL Editor and expect "Success. No rows returned".
-- Send back any WARNING text (NOTICEs are informational).
-- This ONE file supersedes: fix-critical-batch1.sql, fix-critical-batch2.sql,
-- fix-high-batch.sql, fix-medium-batch.sql, fix-memberid-enumeration.sql.
-- ============================================================================
