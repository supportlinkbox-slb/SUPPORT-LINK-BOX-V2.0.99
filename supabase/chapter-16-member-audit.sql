-- CHAPTER 16 — MEMBER AUDIT & HISTORY SYSTEM

-- Ensure audit_logs exists (if not created earlier)
-- Existing audit_logs table structure (hypothetical, need to check existing if it exists)
-- Assuming the table exists based on previous chapters.

-- 1. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_community_id_created_at ON public.audit_logs(community_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_member_id_created_at ON public.audit_logs(target_member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_member_id_created_at ON public.audit_logs(actor_member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON public.audit_logs(action, created_at);

-- Add missing target_member_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='target_member_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN target_member_id UUID REFERENCES public.members(id);
    END IF;
END $$;

-- 2. Secure RPC: get_member_history_secure
-- Aggregates history for a member, server-authorized.
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

    -- Authorization: Member sees own, Admin sees same community
    IF NOT (
        v_actor.id = p_target_member_id OR
        (v_actor.role IN ('ADMIN', 'DEVELOPER') AND v_actor.community_id = v_target.community_id)
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Unauthorized access.';
    END IF;

    RETURN QUERY
    -- Union of various history sources
    SELECT 'AUDIT'::TEXT, details::jsonb, created_at
    FROM public.audit_logs
    WHERE target_member_id = p_target_member_id
    UNION ALL
    SELECT 'POINT', jsonb_build_object('amount', amount, 'activity', activity), created_at
    FROM public.point_transactions
    WHERE member_id = p_target_member_id
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
