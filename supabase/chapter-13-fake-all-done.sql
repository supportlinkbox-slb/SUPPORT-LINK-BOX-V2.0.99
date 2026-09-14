-- CHAPTER 13 — FAKE ALL DONE & PUNISHMENT SYSTEM

-- 1. Table: fake_all_done_incidents
-- Tracks review process for potential Fake All Done submissions.
CREATE TABLE IF NOT EXISTS public.fake_all_done_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    all_done_id UUID NOT NULL REFERENCES public.all_done(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    community_id UUID NOT NULL REFERENCES public.communities(id),
    review_status TEXT DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'CONFIRMED_FAKE', 'NOT_FAKE', 'DISMISSED'
    reason TEXT,
    required_support_count INTEGER,
    verified_support_count INTEGER,
    missing_support_count INTEGER,
    confirmed_by UUID REFERENCES public.members(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Secure RPC: confirm_fake_all_done_secure
-- Atomically marks All Done as revoked, reverses points, creates punishment, and audit log.
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

    -- 3. Update Member Points
    UPDATE public.members 
    SET points = points - v_reversed_points,
        weekly_points = weekly_points - v_reversed_points
    WHERE id = v_incident.member_id;

    -- 4. Punishment History
    INSERT INTO public.member_punishments (member_id, community_id, punishment_type, reason, detected_date, detected_by_admin, original_all_done_id)
    VALUES (v_incident.member_id, v_incident.community_id, 'FAKE_ALL_DONE_PENALTY', p_reason, (NOW() AT TIME ZONE 'Asia/Dhaka')::date, v_actor.id, v_all_done.id);

    -- 5. Update Incident
    UPDATE public.fake_all_done_incidents 
    SET review_status = 'CONFIRMED_FAKE', reason = p_reason, confirmed_by = v_actor.id, confirmed_at = v_now 
    WHERE id = p_incident_id;

    -- 6. Audit
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_actor.id, v_actor.name, v_actor.role, 'FAKE_ALL_DONE_CONFIRMED', 'MEMBER', v_incident.member_id::text, 
            'Confirmed Fake All Done. Points reversed: ' || v_reversed_points || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fake_all_done_incidents_member ON public.fake_all_done_incidents(member_id);
CREATE INDEX IF NOT EXISTS idx_fake_all_done_incidents_status ON public.fake_all_done_incidents(review_status);
