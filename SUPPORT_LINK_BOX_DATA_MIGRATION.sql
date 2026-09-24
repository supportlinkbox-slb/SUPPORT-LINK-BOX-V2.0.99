-- ====================================================================
-- SUPPORT LINK BOX: SAFE & NON-DESTRUCTIVE DATA MIGRATION SCRIPT
-- Project: Support Link Box
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Purpose: Backfill missing calculated fields and reconcile legacy data
-- ====================================================================

BEGIN;

-- 1. Backfill daily_links.total_supports_count from support_records
UPDATE public.daily_links dl
SET total_supports_count = (
    SELECT COUNT(*) 
    FROM public.support_records sr 
    WHERE sr.link_id = dl.id
)
WHERE dl.total_supports_count = 0 OR dl.total_supports_count IS NULL;

-- 2. Backfill members.total_links_submitted
UPDATE public.members m
SET total_links_submitted = (
    SELECT COUNT(*) 
    FROM public.daily_links dl 
    WHERE dl.owner_id = m.id
)
WHERE m.total_links_submitted = 0 OR m.total_links_submitted IS NULL;

-- 3. Backfill members.total_supports_given
UPDATE public.members m
SET total_supports_given = (
    SELECT COUNT(*) 
    FROM public.support_records sr 
    WHERE sr.supporter_id = m.id
)
WHERE m.total_supports_given = 0 OR m.total_supports_given IS NULL;

-- 4. Backfill members.total_all_done
UPDATE public.members m
SET total_all_done = (
    SELECT COUNT(*) 
    FROM public.all_done ad 
    WHERE ad.member_id = m.id
)
WHERE m.total_all_done = 0 OR m.total_all_done IS NULL;

-- 5. Backfill members.points from point_transactions ledger
UPDATE public.members m
SET points = COALESCE((
    SELECT SUM(points) 
    FROM public.point_transactions pt 
    WHERE pt.member_id = m.id
), m.points, 0)
WHERE m.points = 0 OR m.points IS NULL;

-- 6. Ensure default system settings exist
INSERT INTO public.settings (
    id, community_id, submission_start_time, submission_end_time,
    all_done_start_time, all_done_deadline_time, recovery_end_time,
    max_links_per_member, base_all_done_points, community_name, timezone
) VALUES (
    'default', 'main', '10:00', '16:50',
    '17:00', '24:00', '10:00',
    1, 5, 'Support Link Box Official', 'Asia/Dhaka'
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'SUPPORT LINK BOX: DATA MIGRATION COMPLETED SUCCESSFULLY WITHOUT ANY DATA LOSS.';
END $$;
