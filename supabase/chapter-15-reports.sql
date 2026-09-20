-- ====================================================================
-- CHAPTER 15: REPORT & PROBLEM MANAGEMENT SYSTEM (PRODUCTION HARDENED)
-- ====================================================================

-- 0. Helper Functions (Safeguard)
CREATE OR REPLACE FUNCTION public.get_current_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

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
  );
$$;

-- 1. Ensure Table Structure & Extensions
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_serial_display VARCHAR(20),
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    link_id UUID NOT NULL REFERENCES public.daily_links(id) ON DELETE CASCADE,
    link_serial INTEGER NOT NULL,
    link_owner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    link_owner_name VARCHAR(100) NOT NULL,
    reporter_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    reporter_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    screenshot_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.members(id),
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table previously existed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'report_serial_display') THEN
        ALTER TABLE public.reports ADD COLUMN report_serial_display VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'resolved_at') THEN
        ALTER TABLE public.reports ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'resolved_by') THEN
        ALTER TABLE public.reports ADD COLUMN resolved_by UUID REFERENCES public.members(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'dismissed_at') THEN
        ALTER TABLE public.reports ADD COLUMN dismissed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'dismissed_by') THEN
        ALTER TABLE public.reports ADD COLUMN dismissed_by UUID REFERENCES public.members(id);
    END IF;
END $$;

-- 2. Report Replies Table
CREATE TABLE IF NOT EXISTS public.report_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role user_role NOT NULL DEFAULT 'MEMBER',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Report Evidence Table (Chapter 15 section 16)
CREATE TABLE IF NOT EXISTS public.report_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    community_id VARCHAR(50) NOT NULL DEFAULT 'main',
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'reports',
    storage_path TEXT NOT NULL,
    original_filename TEXT,
    mime_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Unique Partial Index for Duplicate Active Report Prevention (Section 6)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_active 
ON public.reports (community_id, link_id, reporter_id) 
WHERE status IN ('PENDING', 'IN_DISCUSSION');

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reports_community_status ON public.reports (community_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_link_owner ON public.reports (link_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_link_id ON public.reports (link_id);
CREATE INDEX IF NOT EXISTS idx_report_replies_report_id ON public.report_replies (report_id, created_at ASC);

-- 6. Storage Bucket Provisioning
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 7. RLS Configuration
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reports viewable by participants and admin" ON public.reports;
CREATE POLICY "Reports viewable by participants and admin" ON public.reports
FOR SELECT TO authenticated
USING (
    reporter_id = public.get_current_member_id() OR
    link_owner_id = public.get_current_member_id() OR
    public.is_current_user_admin_or_dev()
);

DROP POLICY IF EXISTS "Replies viewable by report participants and admin" ON public.report_replies;
CREATE POLICY "Replies viewable by report participants and admin" ON public.report_replies
FOR SELECT TO authenticated
USING (
    report_id IN (
        SELECT r.id FROM public.reports r 
        WHERE r.reporter_id = public.get_current_member_id()
           OR r.link_owner_id = public.get_current_member_id()
           OR public.is_current_user_admin_or_dev()
    )
);

DROP POLICY IF EXISTS "Evidence viewable by report participants and admin" ON public.report_evidence;
CREATE POLICY "Evidence viewable by report participants and admin" ON public.report_evidence
FOR SELECT TO authenticated
USING (
    report_id IN (
        SELECT r.id FROM public.reports r 
        WHERE r.reporter_id = public.get_current_member_id()
           OR r.link_owner_id = public.get_current_member_id()
           OR public.is_current_user_admin_or_dev()
    )
);

-- ====================================================================
-- 8. SECURE RPC: create_report_secure (Section 19)
-- ====================================================================
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
    -- 1. Identity & Permissions Verification
    SELECT * INTO v_caller_member FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Member profile not found');
    END IF;

    IF v_caller_member.status IN ('BANNED', 'REMOVED', 'SUSPENDED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_RESTRICTED: You cannot submit reports');
    END IF;

    -- 2. Target Link Verification
    SELECT * INTO v_link FROM public.daily_links WHERE id = p_link_id;
    IF v_link.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'LINK_NOT_FOUND: Target link does not exist');
    END IF;

    IF v_link.community_id <> v_caller_member.community_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_COMMUNITY_DENIED: Link belongs to another community');
    END IF;

    -- Fetch Link Owner
    SELECT * INTO v_link_owner FROM public.members WHERE id = v_link.owner_id;
    IF v_link_owner.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'LINK_OWNER_NOT_FOUND');
    END IF;

    -- 3. Duplicate Active Report Check (Atomic protection)
    SELECT COUNT(*) INTO v_existing_active_count
    FROM public.reports
    WHERE link_id = p_link_id 
      AND reporter_id = v_caller_member.id
      AND status IN ('PENDING', 'IN_DISCUSSION');

    IF v_existing_active_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_REPORT: এই Link সম্পর্কে আপনার একটি Active Report ইতোমধ্যে রয়েছে।');
    END IF;

    -- 4. Category Normalization
    v_clean_cat := UPPER(TRIM(p_category));
    IF v_clean_cat IN ('LINK_NOT_WORKING', 'COMMENTS_DISABLED', 'POST_NOT_PUBLIC', 'REACTION_COMMENT_DISABLED', 'ADULT_POST', 'POLITICAL_POST') THEN
        -- Standard canonical code
    ELSIF v_clean_cat = 'REACT_COMMENT_DISABLED' THEN
        v_clean_cat := 'REACTION_COMMENT_DISABLED';
    ELSE
        v_clean_cat := 'LINK_NOT_WORKING';
    END IF;

    -- 5. Generate Human Readable Report Serial
    SELECT COALESCE(MAX(NULLIF(regexp_replace(report_serial_display, '\D', '', 'g'), '')::integer), 1000) + 1
    INTO v_next_serial_int FROM public.reports;
    v_report_serial := 'REP-' || LPAD(v_next_serial_int::text, 6, '0');

    -- 6. Insert Report
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

    -- 7. Insert Evidence if path provided
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

    -- 8. Trigger Notifications (Chapter 14 Integration)
    -- Notify Link Owner
    IF v_link_owner.id <> v_caller_member.id THEN
        INSERT INTO public.notifications (
            member_id,
            title,
            message,
            type,
            reference_type,
            reference_id,
            created_at
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

    -- Notify Admins in Community
    FOR v_admin_rec IN 
        SELECT id FROM public.members 
        WHERE community_id = v_caller_member.community_id 
          AND role IN ('ADMIN', 'DEVELOPER')
          AND id <> v_caller_member.id
    LOOP
        INSERT INTO public.notifications (
            member_id,
            title,
            message,
            type,
            reference_type,
            reference_id,
            created_at
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

    -- 9. Audit Logging
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

-- ====================================================================
-- 9. SECURE RPC: create_report_reply_secure (Section 20)
-- ====================================================================
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
    v_caller_member public.members%ROWTYPE;
    v_report public.reports%ROWTYPE;
    v_reply_id UUID;
    v_admin_rec RECORD;
BEGIN
    IF p_message IS NULL OR LENGTH(TRIM(p_message)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_MESSAGE: Message cannot be empty');
    END IF;

    IF LENGTH(p_message) > 4000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'MESSAGE_TOO_LONG: Maximum length is 4000 characters');
    END IF;

    SELECT * INTO v_caller_member FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
    IF v_report.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'REPORT_NOT_FOUND');
    END IF;

    IF v_report.community_id <> v_caller_member.community_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_COMMUNITY_DENIED');
    END IF;

    -- Participation Check (Reporter, Link Owner, or Admin/Dev)
    IF v_caller_member.id <> v_report.reporter_id 
       AND v_caller_member.id <> v_report.link_owner_id 
       AND v_caller_member.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN: You are not authorized to participate in this report');
    END IF;

    -- Insert Reply
    INSERT INTO public.report_replies (
        report_id,
        community_id,
        sender_id,
        sender_name,
        sender_role,
        message,
        created_at,
        updated_at
    ) VALUES (
        p_report_id,
        v_caller_member.community_id,
        v_caller_member.id,
        v_caller_member.name,
        v_caller_member.role,
        TRIM(p_message),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_reply_id;

    -- Update Report timestamp & state to IN_DISCUSSION if currently PENDING
    UPDATE public.reports
    SET updated_at = NOW(),
        status = CASE WHEN status = 'PENDING' THEN 'IN_DISCUSSION' ELSE status END
    WHERE id = p_report_id;

    -- Notifications:
    IF v_caller_member.role IN ('ADMIN', 'DEVELOPER') THEN
        -- Notify Reporter
        IF v_report.reporter_id <> v_caller_member.id THEN
            INSERT INTO public.notifications (
                member_id, title, message, type, reference_type, reference_id, created_at
            ) VALUES (
                v_report.reporter_id,
                '💬 রিপোর্টে নতুন বার্তা',
                'এডমিন আপনার রিপোর্ট #' || COALESCE(v_report.report_serial_display, '') || '-এ উত্তর দিয়েছেন।',
                'ADMIN_MESSAGE',
                'REPORT',
                p_report_id::text,
                NOW()
            );
        END IF;
        -- Notify Link Owner
        IF v_report.link_owner_id <> v_caller_member.id THEN
            INSERT INTO public.notifications (
                member_id, title, message, type, reference_type, reference_id, created_at
            ) VALUES (
                v_report.link_owner_id,
                '💬 রিপোর্টে নতুন বার্তা',
                'এডমিন রিপোর্ট #' || COALESCE(v_report.report_serial_display, '') || '-এ মন্তব্য করেছেন।',
                'ADMIN_MESSAGE',
                'REPORT',
                p_report_id::text,
                NOW()
            );
        END IF;
    ELSE
        -- Member replied -> Notify Admins
        FOR v_admin_rec IN 
            SELECT id FROM public.members 
            WHERE community_id = v_caller_member.community_id 
              AND role IN ('ADMIN', 'DEVELOPER')
        LOOP
            INSERT INTO public.notifications (
                member_id, title, message, type, reference_type, reference_id, created_at
            ) VALUES (
                v_admin_rec.id,
                '💬 রিপোর্টে নতুন উত্তর',
                v_caller_member.name || ' রিপোর্ট #' || COALESCE(v_report.report_serial_display, '') || '-এ উত্তর দিয়েছেন।',
                'ADMIN_MESSAGE',
                'REPORT',
                p_report_id::text,
                NOW()
            );
        END LOOP;
    END IF;

    -- Audit Log
    INSERT INTO public.audit_logs (
        actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details, created_at
    ) VALUES (
        v_caller_member.id, auth.uid(), v_caller_member.name, v_caller_member.role,
        'REPORT_REPLY_CREATED', 'REPORT', p_report_id::text,
        'Posted reply on report #' || COALESCE(v_report.report_serial_display, ''),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'reply_id', v_reply_id);
END;
$$;

-- ====================================================================
-- 10. SECURE RPC: update_report_status_secure (Section 21)
-- ====================================================================
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

    UPDATE public.reports
    SET status = v_clean_status,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        resolved_at = CASE WHEN v_clean_status = 'RESOLVED' THEN NOW() ELSE resolved_at END,
        resolved_by = CASE WHEN v_clean_status = 'RESOLVED' THEN v_caller_member.id ELSE resolved_by END,
        dismissed_at = CASE WHEN v_clean_status = 'DISMISSED' THEN NOW() ELSE dismissed_at END,
        dismissed_by = CASE WHEN v_clean_status = 'DISMISSED' THEN v_caller_member.id ELSE dismissed_by END,
        updated_at = NOW()
    WHERE id = p_report_id;

    -- Notify Reporter & Link Owner
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

    -- Audit Log
    INSERT INTO public.audit_logs (
        actor_id, actor_auth_id, actor_name, actor_role, action, target_type, target_id, details, created_at
    ) VALUES (
        v_caller_member.id, auth.uid(), v_caller_member.name, v_caller_member.role,
        'REPORT_STATUS_CHANGED', 'REPORT', p_report_id::text,
        'Changed report #' || COALESCE(v_report.report_serial_display, '') || ' status from ' || v_old_status || ' to ' || v_clean_status,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'report_id', p_report_id,
        'old_status', v_old_status,
        'new_status', v_clean_status
    );
END;
$$;

-- ====================================================================
-- 11. SECURE RPC: fetch_reports_paginated (Section 31/43)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fetch_reports_paginated(
    p_status VARCHAR DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_member public.members%ROWTYPE;
    v_offset INTEGER;
    v_limit INTEGER;
    v_total_count INTEGER;
    v_reports JSONB;
BEGIN
    SELECT * INTO v_caller_member FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    v_limit := COALESCE(p_page_size, 10);
    IF v_limit > 50 THEN v_limit := 50; END IF;
    v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;

    -- Total Count Calculation
    SELECT COUNT(*) INTO v_total_count
    FROM public.reports r
    WHERE r.community_id = v_caller_member.community_id
      AND (
          v_caller_member.role IN ('ADMIN', 'DEVELOPER')
          OR r.reporter_id = v_caller_member.id
          OR r.link_owner_id = v_caller_member.id
      )
      AND (p_status IS NULL OR p_status = 'ALL' OR r.status = UPPER(p_status))
      AND (p_category IS NULL OR p_category = 'ALL' OR r.category = UPPER(p_category))
      AND (
          p_search IS NULL OR p_search = '' 
          OR r.reporter_name ILIKE '%' || p_search || '%'
          OR r.link_owner_name ILIKE '%' || p_search || '%'
          OR r.report_serial_display ILIKE '%' || p_search || '%'
      );

    -- Fetch Records
    SELECT COALESCE(jsonb_agg(sub.report_row), '[]'::jsonb) INTO v_reports
    FROM (
        SELECT jsonb_build_object(
            'id', r.id,
            'report_serial_display', r.report_serial_display,
            'community_id', r.community_id,
            'link_id', r.link_id,
            'link_serial', r.link_serial,
            'link_owner_id', r.link_owner_id,
            'link_owner_name', r.link_owner_name,
            'reporter_id', r.reporter_id,
            'reporter_name', r.reporter_name,
            'category', r.category,
            'description', r.description,
            'screenshot_url', r.screenshot_url,
            'status', r.status,
            'admin_notes', r.admin_notes,
            'resolved_at', r.resolved_at,
            'resolved_by', r.resolved_by,
            'dismissed_at', r.dismissed_at,
            'dismissed_by', r.dismissed_by,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'messages', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', rm.id,
                        'report_id', rm.report_id,
                        'sender_id', rm.sender_id,
                        'sender_name', rm.sender_name,
                        'sender_role', rm.sender_role,
                        'message', rm.message,
                        'created_at', rm.created_at
                    ) ORDER BY rm.created_at ASC
                ), '[]'::jsonb)
                FROM public.report_replies rm
                WHERE rm.report_id = r.id
            )
        ) AS report_row
        FROM public.reports r
        WHERE r.community_id = v_caller_member.community_id
          AND (
              v_caller_member.role IN ('ADMIN', 'DEVELOPER')
              OR r.reporter_id = v_caller_member.id
              OR r.link_owner_id = v_caller_member.id
          )
          AND (p_status IS NULL OR p_status = 'ALL' OR r.status = UPPER(p_status))
          AND (p_category IS NULL OR p_category = 'ALL' OR r.category = UPPER(p_category))
          AND (
              p_search IS NULL OR p_search = '' 
              OR r.reporter_name ILIKE '%' || p_search || '%'
              OR r.link_owner_name ILIKE '%' || p_search || '%'
              OR r.report_serial_display ILIKE '%' || p_search || '%'
          )
        ORDER BY r.created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'reports', v_reports,
            'totalCount', v_total_count,
            'page', GREATEST(COALESCE(p_page, 1), 1),
            'pageSize', v_limit,
            'totalPages', CEIL(v_total_count::float / GREATEST(v_limit, 1))
        )
    );
END;
$$;
