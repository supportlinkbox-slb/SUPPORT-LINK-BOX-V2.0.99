-- CHAPTER 15 — REPORT PROBLEM, REPORTS & REPLIES SYSTEM

-- 1. Secure RPC: create_report_secure
-- Atomically creates a report with server-authoritative identity & duplicate guard.
CREATE OR REPLACE FUNCTION public.create_report_secure(
    p_link_id UUID,
    p_category TEXT,
    p_description TEXT,
    p_screenshot_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_reporter public.members%ROWTYPE;
    v_link public.daily_links%ROWTYPE;
    v_report_id UUID;
BEGIN
    -- Authorization & Identity
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_reporter FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    -- Link Validation
    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;
    
    -- Community Isolation & Eligibility
    IF v_link.community_id <> v_reporter.community_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Cross-community report denied.';
    END IF;

    -- Duplicate Guard (Active report for this link)
    IF EXISTS (
        SELECT 1 FROM public.reports 
        WHERE link_id = p_link_id AND reporter_id = v_reporter.id 
        AND status IN ('PENDING', 'IN_DISCUSSION')
    ) THEN
        RAISE EXCEPTION 'REPORT_DUPLICATE: An active report already exists.';
    END IF;

    -- Create Report
    INSERT INTO public.reports (
        community_id, link_id, link_serial, link_owner_id, link_owner_name,
        reporter_id, reporter_name, category, description, screenshot_url, status
    ) VALUES (
        v_reporter.community_id, p_link_id, v_link.serial_number, v_link.owner_id, v_link.owner_name,
        v_reporter.id, v_reporter.name, p_category, p_description, p_screenshot_path, 'PENDING'
    ) RETURNING id INTO v_report_id;

    -- Audit Log
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_reporter.id, v_reporter.name, v_reporter.role, 'REPORT_CREATED', 'REPORT', v_report_id::text, 
            'Reported link #' || v_link.serial_display || ' for category: ' || p_category);

    RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- 2. Secure RPC: create_report_reply_secure
-- Atomically creates a reply if authorized.
CREATE OR REPLACE FUNCTION public.create_report_reply_secure(
    p_report_id UUID,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_sender public.members%ROWTYPE;
    v_report public.reports%ROWTYPE;
BEGIN
    -- Authorization & Identity
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_sender FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

    -- Report Access & Authorization
    SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;

    IF NOT (
        v_sender.id = v_report.reporter_id OR 
        v_sender.id = v_report.link_owner_id OR
        (v_sender.role IN ('ADMIN', 'DEVELOPER') AND v_sender.community_id = v_report.community_id)
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Unauthorized to reply.';
    END IF;

    -- Insert Reply
    INSERT INTO public.report_replies (report_id, sender_id, sender_name, sender_role, message)
    VALUES (p_report_id, v_sender.id, v_sender.name, v_sender.role, p_message);

    -- Update report status to IN_DISCUSSION if pending
    UPDATE public.reports SET status = 'IN_DISCUSSION', updated_at = NOW() WHERE id = p_report_id AND status = 'PENDING';

    -- Audit Log
    INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_sender.id, v_sender.name, v_sender.role, 'REPORT_REPLY_CREATED', 'REPORT', p_report_id::text, 'Reply added to report.');

    RETURN jsonb_build_object('success', true);
END;
$$;
