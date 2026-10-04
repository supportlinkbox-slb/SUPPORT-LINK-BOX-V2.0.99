-- FIX: Enforce 10:00-16:50 BDT submission window server-side for members
-- Run once in Supabase SQL Editor (new project)

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
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka');
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

    IF v_member.status = 'SUSPENDED' OR v_member.status = 'FROZEN' THEN
        RAISE EXCEPTION 'MEMBER_INACTIVE: Account is currently %.', v_member.status;
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

    -- Append audit log
    INSERT INTO public.audit_logs (actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (v_member.id, v_auth_uid, v_member.name, v_member.role, 'SUBMIT_DAILY_LINK', 'DAILY_LINK', v_link_id::text, 'Submitted #' || v_serial_display);

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_link_id,
        'serial_number', v_next_serial,
        'serial_display', v_serial_display,
        'part_number', v_part_number
    );
END;
$$;

-- B. Record Verified Link Support (+1 Point, Self-Support & Duplicate Guarded)
