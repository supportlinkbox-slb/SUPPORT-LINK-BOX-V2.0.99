-- CHAPTER 11 — PRODUCTION POINTS & LEADERBOARD HARDENING

-- 1. Table structure audit (Point Ledger)
-- Ensure point_transactions exists and has necessary constraints.
-- (Existing table assumed based on Chapter 9)

-- 2. New RPC: admin_adjust_points_secure
-- Securely adjust points by Admin/Developer with mandatory reason and audit log.
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
    -- Authorization
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    -- Target validation
    SELECT * INTO v_target FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF v_target.community_id <> v_actor.community_id AND v_actor.role <> 'DEVELOPER' THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community access denied.';
    END IF;

    -- Atomic Update
    INSERT INTO public.point_transactions (member_id, activity_type, points, date, description, created_by)
    VALUES (p_member_id, 'ADMIN_ADJUSTMENT', p_points, v_date, 'Manual Admin Adjustment: ' || p_reason, v_actor.id);

    UPDATE public.members
    SET points = points + p_points,
        weekly_points = weekly_points + p_points
    WHERE id = p_member_id;

    -- Audit
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'ADMIN_ADJUST_POINTS', 'MEMBER', p_member_id::text, 
            'Adjusted ' || p_points || ' points for ' || v_target.member_number || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Views for Performant Leaderboard Queries

-- View: daily_leaderboard_view
-- Aggregates points per member per day.
CREATE OR REPLACE VIEW public.daily_leaderboard_view AS
SELECT
    member_id,
    date,
    SUM(points) as total_points,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id FROM all_done WHERE fastest_rank = 1) THEN 1 END) as first_place_count,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id FROM all_done WHERE fastest_rank = 2) THEN 1 END) as second_place_count,
    COUNT(CASE WHEN activity_type = 'ALL_DONE' AND reference_id IN (SELECT id FROM all_done WHERE fastest_rank = 3) THEN 1 END) as third_place_count
FROM public.point_transactions
GROUP BY member_id, date;

-- Add performance indexes if missing (assuming tables exist)
CREATE INDEX IF NOT EXISTS idx_point_transactions_member_date ON public.point_transactions(member_id, date);
CREATE INDEX IF NOT EXISTS idx_point_transactions_activity_date ON public.point_transactions(activity_type, date);
