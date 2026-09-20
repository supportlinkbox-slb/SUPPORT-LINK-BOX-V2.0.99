-- ==============================================================================
-- CHAPTER 14: ANNOUNCEMENTS, 3-LEVEL NOTICES & NOTIFICATION SYSTEM
-- ==============================================================================

-- Ensure notices table has all required Chapter 14 columns
ALTER TABLE public.notices 
  ADD COLUMN IF NOT EXISTS target_role VARCHAR(20) DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS target_member_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS days_inactive_filter INTEGER,
  ADD COLUMN IF NOT EXISTS exact_inactive_days INTEGER,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100) DEFAULT 'Admin';

-- Ensure notifications table has all required columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS community_id VARCHAR(50) DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';

-- Unique constraint / Index for notification deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup 
  ON public.notifications(member_id, type, COALESCE(reference_id, 'none'));

-- Indexes for high-performance notification retrieval
CREATE INDEX IF NOT EXISTS idx_notifications_member_unread 
  ON public.notifications(member_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notices_status_created 
  ON public.notices(status, is_pinned DESC, created_at DESC);

-- ==============================================================================
-- RPC 1: Calculate Server-Authoritative Inactive Days (Asia/Dhaka)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.calculate_member_inactive_days_secure(p_member_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_activity_date DATE;
    v_today_bdt DATE;
    v_inactive_days INTEGER := 0;
BEGIN
    -- Current BDT Date
    v_today_bdt := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;

    -- Find latest qualifying activity (link submission or verified support)
    SELECT MAX(activity_date) INTO v_last_activity_date
    FROM (
        SELECT date as activity_date FROM public.links WHERE member_id = p_member_id
        UNION ALL
        SELECT date as activity_date FROM public.supports WHERE supporter_id = p_member_id
        UNION ALL
        SELECT date as activity_date FROM public.all_done_records WHERE member_id = p_member_id AND status = 'VERIFIED'
    ) activities;

    IF v_last_activity_date IS NULL THEN
        -- Check member created_at if no activity
        SELECT (created_at AT TIME ZONE 'Asia/Dhaka')::DATE INTO v_last_activity_date
        FROM public.members WHERE id = p_member_id;
    END IF;

    IF v_last_activity_date IS NOT NULL THEN
        v_inactive_days := GREATEST(0, (v_today_bdt - v_last_activity_date));
    ELSE
        v_inactive_days := 0;
    END IF;

    RETURN v_inactive_days;
END;
$$;

-- ==============================================================================
-- RPC 2: Generate Notice Secure (Single Member)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.generate_notice_secure(
    p_member_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(200),
    p_content TEXT,
    p_level VARCHAR(20) DEFAULT 'SIMPLE_WARNING',
    p_days_inactive_filter INTEGER DEFAULT NULL,
    p_is_pinned BOOLEAN DEFAULT false,
    p_priority VARCHAR(20) DEFAULT 'NORMAL'
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
BEGIN
    v_caller_id := auth.uid();
    
    -- Verify caller is Admin or Developer
    SELECT role, name INTO v_caller_role, v_caller_name 
    FROM public.members WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Admins can generate notices.');
    END IF;

    -- Fetch target member
    SELECT * INTO v_target_member FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND: Member does not exist.');
    END IF;

    -- LEVEL 3 SECURITY CHECK: Kickout Notice is only permitted for REMOVED members!
    IF p_type = 'KICKOUT_WARNING' OR p_level = 'KICKOUT_WARNING' THEN
        IF v_target_member.status != 'REMOVED' THEN
            RETURN jsonb_build_object('success', false, 'error', 'KICKOUT_NOTICE_NOT_ALLOWED: Member is currently active and not removed.');
        END IF;
    ELSE
        -- Level 1 & 2 Warning checks
        IF v_target_member.status = 'REMOVED' THEN
            RETURN jsonb_build_object('success', false, 'error', 'NOTICE_NOT_ALLOWED: Inactive warnings cannot be sent to already removed members.');
        END IF;
    END IF;

    -- Calculate server-authoritative exact inactive days
    v_exact_inactive_days := public.calculate_member_inactive_days_secure(p_member_id);

    -- Template replacements
    v_rendered_content := p_content;
    v_rendered_content := REPLACE(v_rendered_content, '{member_name}', v_target_member.name);
    v_rendered_content := REPLACE(v_rendered_content, '{member_number}', v_target_member.member_number);
    v_rendered_content := REPLACE(v_rendered_content, '{inactive_days}', v_exact_inactive_days::TEXT);
    v_rendered_content := REPLACE(v_rendered_content, '{warning_level}', p_level);
    v_rendered_content := REPLACE(v_rendered_content, '{community_name}', 'Support Link Box');

    -- Insert Notice
    INSERT INTO public.notices (
        community_id,
        target_member_id,
        type,
        title,
        message,
        level,
        target_role,
        target_member_ids,
        days_inactive_filter,
        exact_inactive_days,
        is_pinned,
        priority,
        status,
        created_by,
        created_by_name,
        created_at
    ) VALUES (
        v_target_member.community_id,
        p_member_id,
        p_type,
        p_title,
        v_rendered_content,
        p_level,
        'MEMBER',
        ARRAY[p_member_id],
        p_days_inactive_filter,
        v_exact_inactive_days,
        p_is_pinned,
        p_priority,
        'ACTIVE',
        v_caller_id,
        v_caller_name,
        NOW()
    ) RETURNING id INTO v_notice_id;

    -- Generate Notification for Member (Idempotent / Deduped)
    INSERT INTO public.notifications (
        member_id,
        community_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        priority,
        created_at
    ) VALUES (
        p_member_id,
        v_target_member.community_id,
        p_title,
        v_rendered_content,
        CASE 
            WHEN p_type = 'KICKOUT_WARNING' THEN 'NOTICE_KICKOUT'
            WHEN p_type = 'ALERT_WARNING' THEN 'NOTICE_ALERT'
            ELSE 'NOTICE_SIMPLE'
        END,
        v_notice_id::TEXT,
        false,
        p_priority,
        NOW()
    )
    ON CONFLICT (member_id, type, COALESCE(reference_id, 'none')) DO NOTHING;

    -- Audit Log
    INSERT INTO public.audit_logs (
        community_id,
        actor_id,
        actor_name,
        actor_role,
        action,
        target_type,
        target_id,
        target_member_id,
        details
    ) VALUES (
        v_target_member.community_id,
        v_caller_id,
        v_caller_name,
        v_caller_role,
        'NOTICE_GENERATED',
        'NOTICE',
        v_notice_id::TEXT,
        p_member_id,
        format('Generated %s for %s (%s). Inactive days: %s', p_type, v_target_member.name, v_target_member.member_number, v_exact_inactive_days)
    );

    RETURN jsonb_build_object(
        'success', true,
        'notice_id', v_notice_id,
        'exact_inactive_days', v_exact_inactive_days,
        'message', 'নোটিশ সফলভাবে তৈরি ও পাঠানো হয়েছে।'
    );
END;
$$;

-- ==============================================================================
-- RPC 3: Bulk Generate Notices Secure (Multiple Members)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.bulk_generate_notices_secure(
    p_member_ids UUID[],
    p_type VARCHAR(50),
    p_title VARCHAR(200),
    p_content_template TEXT,
    p_level VARCHAR(20) DEFAULT 'SIMPLE_WARNING',
    p_days_inactive_filter INTEGER DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'NORMAL'
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
BEGIN
    v_caller_id := auth.uid();
    
    SELECT role, name INTO v_caller_role, v_caller_name 
    FROM public.members WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Admins can bulk generate notices.');
    END IF;

    FOREACH v_mem_id IN ARRAY p_member_ids
    LOOP
        SELECT * INTO v_target_member FROM public.members WHERE id = v_mem_id;
        IF FOUND THEN
            -- Check Level 3 constraints
            IF (p_type = 'KICKOUT_WARNING' OR p_level = 'KICKOUT_WARNING') AND v_target_member.status != 'REMOVED' THEN
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            -- Check Level 1 & 2 constraints
            IF (p_type != 'KICKOUT_WARNING' AND p_level != 'KICKOUT_WARNING') AND v_target_member.status = 'REMOVED' THEN
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            -- Authoritative inactive days
            v_exact_inactive_days := public.calculate_member_inactive_days_secure(v_mem_id);

            -- Template render
            v_rendered_content := p_content_template;
            v_rendered_content := REPLACE(v_rendered_content, '{member_name}', v_target_member.name);
            v_rendered_content := REPLACE(v_rendered_content, '{member_number}', v_target_member.member_number);
            v_rendered_content := REPLACE(v_rendered_content, '{inactive_days}', v_exact_inactive_days::TEXT);
            v_rendered_content := REPLACE(v_rendered_content, '{warning_level}', p_level);
            v_rendered_content := REPLACE(v_rendered_content, '{community_name}', 'Support Link Box');

            INSERT INTO public.notices (
                community_id,
                target_member_id,
                type,
                title,
                message,
                level,
                target_role,
                target_member_ids,
                days_inactive_filter,
                exact_inactive_days,
                is_pinned,
                priority,
                status,
                created_by,
                created_by_name,
                created_at
            ) VALUES (
                v_target_member.community_id,
                v_mem_id,
                p_type,
                p_title,
                v_rendered_content,
                p_level,
                'MEMBER',
                ARRAY[v_mem_id],
                p_days_inactive_filter,
                v_exact_inactive_days,
                false,
                p_priority,
                'ACTIVE',
                v_caller_id,
                v_caller_name,
                NOW()
            ) RETURNING id INTO v_notice_id;

            INSERT INTO public.notifications (
                member_id,
                community_id,
                title,
                message,
                type,
                reference_id,
                is_read,
                priority,
                created_at
            ) VALUES (
                v_mem_id,
                v_target_member.community_id,
                p_title,
                v_rendered_content,
                CASE 
                    WHEN p_type = 'KICKOUT_WARNING' THEN 'NOTICE_KICKOUT'
                    WHEN p_type = 'ALERT_WARNING' THEN 'NOTICE_ALERT'
                    ELSE 'NOTICE_SIMPLE'
                END,
                v_notice_id::TEXT,
                false,
                p_priority,
                NOW()
            )
            ON CONFLICT (member_id, type, COALESCE(reference_id, 'none')) DO NOTHING;

            v_success_count := v_success_count + 1;
        END IF;
    END LOOP;

    -- Bulk Audit Log
    INSERT INTO public.audit_logs (
        community_id,
        actor_id,
        actor_name,
        actor_role,
        action,
        target_type,
        details
    ) VALUES (
        'main',
        v_caller_id,
        v_caller_name,
        v_caller_role,
        'NOTICE_BULK_GENERATED',
        'NOTICE',
        format('Bulk generated %s notices of type %s (Skipped: %s)', v_success_count, p_type, v_skipped_count)
    );

    RETURN jsonb_build_object(
        'success', true,
        'success_count', v_success_count,
        'skipped_count', v_skipped_count,
        'message', format('মোট %s জনের নোটিশ সফলভাবে তৈরি হয়েছে।', v_success_count)
    );
END;
$$;

-- ==============================================================================
-- RPC 4: Mark Notification Read Secure
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read_secure(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_notif RECORD;
BEGIN
    v_caller_id := auth.uid();
    
    SELECT * INTO v_notif FROM public.notifications WHERE id = p_notification_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOTIFICATION_NOT_FOUND');
    END IF;

    -- Security: Member can only mark own notification as read
    IF v_notif.member_id != v_caller_id THEN
        -- Check if caller is admin
        IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = v_caller_id AND role IN ('ADMIN', 'DEVELOPER')) THEN
            RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
        END IF;
    END IF;

    -- Idempotent read update
    UPDATE public.notifications
    SET is_read = true,
        read_at = COALESCE(read_at, NOW())
    WHERE id = p_notification_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- RPC 5: Mark All Notifications Read Secure
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read_secure(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    
    IF p_member_id != v_caller_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = v_caller_id AND role IN ('ADMIN', 'DEVELOPER')) THEN
            RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
        END IF;
    END IF;

    UPDATE public.notifications
    SET is_read = true,
        read_at = COALESCE(read_at, NOW())
    WHERE member_id = p_member_id AND is_read = false;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- RPC 6: Revoke Notice Secure
-- ==============================================================================
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
    FROM public.members WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    UPDATE public.notices
    SET status = 'REVOKED'
    WHERE id = p_notice_id;

    INSERT INTO public.audit_logs (
        community_id,
        actor_id,
        actor_name,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        'main',
        v_caller_id,
        v_caller_name,
        v_caller_role,
        'NOTICE_REVOKED',
        'NOTICE',
        p_notice_id::TEXT,
        'Revoked notice'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
