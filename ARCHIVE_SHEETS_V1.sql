-- ============================================================================
-- ARCHIVE_SHEETS_V1: Google Sheets weekly archive system (rebuild)
-- Replaces the manually-created archive objects that were lost in the v18
-- schema wipe. Designed against the ACTUAL live schema (v18 + reconcile).
--
-- Policy (per owner):
--   BACKUP to Google Sheets (never deleted): daily_links, all_done,
--     point_transactions   (essential history stays in Supabase)
--   BACKUP + DELETE after verified: support_records only
--     (the heavy raw table; 7-day default retention)
--   Safety: cleanup runs ONLY when the batch status = 'VERIFIED'.
--
-- Run once in Supabase SQL Editor (or psql). Idempotent.
-- ============================================================================

-- 1) Extend archive_batches with the columns the archive job needs.
--    (Live table = PART_1 def + RECONCILE adds; these are the missing pieces.)
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS cutoff_date TIMESTAMPTZ;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS exported_counts JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE public.archive_batches ADD COLUMN IF NOT EXISTS archive_type TEXT DEFAULT 'GOOGLE_SHEETS_WEEKLY';

-- Sensible defaults for inherited columns
ALTER TABLE public.archive_batches ALTER COLUMN batch_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.archive_batches ALTER COLUMN status SET DEFAULT 'PENDING';

-- 2) Cleanup RPC: deletes ONLY old raw support_records, and ONLY when the
--    batch has been VERIFIED. Backup-only tables are never touched here.
CREATE OR REPLACE FUNCTION public.cleanup_archived_lifecycle_data(
  p_batch_id UUID,
  p_cutoff_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch RECORD;
  v_deleted_supports INTEGER := 0;
  v_is_server BOOLEAN := (auth.role() = 'service_role');
BEGIN
  -- Caller must be the server-side archive job (service_role) or an admin/dev.
  IF NOT v_is_server AND NOT public.is_current_user_admin_or_dev() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_batch
  FROM public.archive_batches
  WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'BATCH_NOT_FOUND');
  END IF;

  -- Idempotent: already cleaned -> nothing to do.
  IF v_batch.status = 'CLEANED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_cleaned', true,
      'deleted', jsonb_build_object('support_records', 0)
    );
  END IF;

  -- HARD SAFETY RULE: never delete unless the archive was verified.
  IF v_batch.status IS DISTINCT FROM 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BATCH_NOT_VERIFIED_CLEANUP_BLOCKED'
    );
  END IF;

  -- Delete ONLY old raw support records (heavy table).
  -- daily_links / all_done / point_transactions are backup-only: never deleted.
  DELETE FROM public.support_records
  WHERE created_at < p_cutoff_date;
  GET DIAGNOSTICS v_deleted_supports = ROW_COUNT;

  UPDATE public.archive_batches
  SET status = 'CLEANED',
      updated_at = NOW(),
      exported_counts = COALESCE(exported_counts, '{}'::jsonb)
        || jsonb_build_object('deleted_support_records', v_deleted_supports)
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object('support_records', v_deleted_supports)
  );
END;
$$;

-- Tighten execute permissions: server job + logged-in users only (anon blocked).
REVOKE ALL ON FUNCTION public.cleanup_archived_lifecycle_data(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_archived_lifecycle_data(UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- 3) Sanity check (should return 2 rows: table + function)
-- SELECT 'archive_batches' AS obj, count(*) FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='archive_batches'
-- UNION ALL
-- SELECT 'cleanup_rpc', count(*) FROM pg_proc WHERE proname='cleanup_archived_lifecycle_data';
