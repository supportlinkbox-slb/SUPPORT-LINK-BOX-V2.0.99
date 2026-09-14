-- CHAPTER 12 — RECOVERY, LATE SUPPORT & PUNISHMENT SYSTEM

-- 1. Table: member_punishments
-- Tracks disciplinary actions.
CREATE TABLE IF NOT EXISTS public.member_punishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES public.members(id),
    community_id UUID NOT NULL REFERENCES public.communities(id),
    punishment_type TEXT NOT NULL, -- 'FAKE_ALL_DONE', 'MISSED_DEADLINE', 'DISRUPTIVE_BEHAVIOR'
    reason TEXT NOT NULL,
    detected_date DATE NOT NULL,
    detected_by_admin UUID REFERENCES public.members(id),
    original_all_done_id UUID, -- For FAKE_ALL_DONE
    missing_support_count INTEGER DEFAULT 0,
    extra_free_support_days INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 2. Secure RPC: admin_restore_member_secure
-- Admin utility to restore a member's status securely.
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

    UPDATE public.members
    SET status = 'ACTIVE'
    WHERE id = p_member_id;

    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'ADMIN_STATUS_RESTORE', 'MEMBER', p_member_id::text, 
            'Restored member ' || v_target.member_number || ' to ACTIVE. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;
