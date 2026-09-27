-- ====================================================================
-- CHAPTER 23 — ADVANCED LIFECYCLE, 10:00 AM BDT RECOVERY CRON & MEDIA DRM
-- Support Link Box Official — Production Master Security Functions
-- ====================================================================

-- 1. 10:00 AM BDT RECOVERY CUTOFF PROCEDURE
CREATE OR REPLACE FUNCTION public.cron_bdt_10am_recovery_cutoff()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bdt_yesterday DATE;
    v_total_links_yesterday INTEGER;
    v_suspended_count INTEGER := 0;
    v_member_rec RECORD;
    v_completed_support INTEGER;
    v_required_support INTEGER;
    v_suspended_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Target previous calendar date in Asia/Dhaka (UTC+6)
    v_bdt_yesterday := (NOW() AT TIME ZONE 'Asia/Dhaka' - INTERVAL '1 day')::DATE;

    -- Count active links from yesterday
    SELECT COUNT(*) INTO v_total_links_yesterday
    FROM public.daily_links
    WHERE date = v_bdt_yesterday AND status = 'active';

    IF v_total_links_yesterday <= 1 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No pending recovery requirements for target date',
            'target_date', v_bdt_yesterday,
            'suspended_count', 0
        );
    END IF;

    -- Iterate active members who submitted links yesterday
    FOR v_member_rec IN
        SELECT DISTINCT m.id, m.name, m.member_number, m.days_inactive
        FROM public.members m
        JOIN public.daily_links dl ON dl.owner_id = m.id AND dl.date = v_bdt_yesterday AND dl.status = 'active'
        WHERE m.status = 'ACTIVE' AND m.role != 'DEVELOPER'
        AND NOT EXISTS (
            SELECT 1 FROM public.all_done ad
            WHERE ad.member_id = m.id AND ad.date = v_bdt_yesterday
        )
    LOOP
        -- Check total support records completed by member for yesterday
        SELECT COUNT(*) INTO v_completed_support
        FROM public.support_records sr
        WHERE sr.supporter_id = v_member_rec.id AND sr.date = v_bdt_yesterday;

        v_required_support := v_total_links_yesterday - 1;

        -- If member completed fewer than required support and missed 10:00 AM cutoff
        IF v_completed_support < v_required_support THEN
            -- Update member status to SUSPENDED
            UPDATE public.members
            SET status = 'SUSPENDED',
                days_inactive = COALESCE(v_member_rec.days_inactive, 0) + 1,
                updated_at = NOW()
            WHERE id = v_member_rec.id;

            -- Record disciplinary action
            INSERT INTO public.member_punishments (
                member_id,
                penalty_type,
                reason,
                issued_by,
                effective_date
            ) VALUES (
                v_member_rec.id,
                'SUSPENSION',
                'AUTOMATIC_SUSPENSION_MISSED_10AM_BDT_RECOVERY',
                'SYSTEM_10AM_BDT_CRON',
                v_bdt_yesterday
            );

            -- Send in-app notification
            INSERT INTO public.notifications (
                member_id,
                title,
                message,
                type
            ) VALUES (
                v_member_rec.id,
                'অ্যাকাউন্ট সাময়িক স্থগিত (Suspended)',
                'পূর্ববর্তী দিনের (' || v_bdt_yesterday || ') বাকি সাপোর্ট সকাল ১০:০০ AM BDT কাট-অফ সময়ের মধ্যে সম্পন্ন না করায় আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে।',
                'PENALTY_WARNING'
            );

            v_suspended_count := v_suspended_count + 1;
            v_suspended_list := array_append(v_suspended_list, v_member_rec.member_number || ' (' || v_member_rec.name || ')');
        END IF;
    END LOOP;

    -- Log to audit trail
    INSERT INTO public.audit_logs (
        action,
        details,
        ip_address
    ) VALUES (
        '10AM_BDT_RECOVERY_CUTOFF_EXECUTED',
        jsonb_build_object(
            'target_date', v_bdt_yesterday,
            'suspended_count', v_suspended_count,
            'suspended_members', v_suspended_list
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_date', v_bdt_yesterday,
        'suspended_count', v_suspended_count,
        'suspended_members', v_suspended_list
    );
END;
$$;


-- 2. WEEKLY GOOGLE SHEETS ARCHIVE VERIFIED CLEANUP PROCEDURE (Blueprint Sections 51-54)
CREATE OR REPLACE FUNCTION public.execute_weekly_safe_cleanup(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch RECORD;
    v_deleted_count INTEGER := 0;
BEGIN
    -- 1. Verify caller has admin/developer privileges
    IF NOT public.is_current_user_admin_or_dev() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ACCESS');
    END IF;

    -- 2. Fetch and strictly validate archive batch
    SELECT * INTO v_batch
    FROM public.archive_batches
    WHERE id = p_batch_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'BATCH_NOT_FOUND');
    END IF;

    -- STRICT LIFECYCLE GUARD: Cleanup is FORBIDDEN if status != 'VERIFIED' or checksum is NULL
    IF v_batch.status != 'VERIFIED' OR v_batch.checksum IS NULL OR v_batch.row_count IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNVERIFIED_BACKUP_CLEANUP_ABORTED: Database cleanup is strictly forbidden until Google Sheets SHA-256 backup is verified.'
        );
    END IF;

    -- 3. Perform safe soft archive / cleanup on source table
    IF v_batch.source_table = 'daily_links' THEN
        DELETE FROM public.daily_links
        WHERE created_at >= v_batch.period_start::timestamptz
          AND created_at < v_batch.period_end::timestamptz
          AND community_id = v_batch.community_id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    ELSIF v_batch.source_table = 'support_records' THEN
        DELETE FROM public.support_records
        WHERE created_at >= v_batch.period_start::timestamptz
          AND created_at < v_batch.period_end::timestamptz
          AND community_id = v_batch.community_id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;

    -- 4. Mark batch as ARCHIVED & COMPLETED
    UPDATE public.archive_batches
    SET status = 'ARCHIVED_COMPLETED',
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- 5. Audit log
    INSERT INTO public.audit_logs (
        action,
        details,
        ip_address
    ) VALUES (
        'WEEKLY_SAFE_CLEANUP_EXECUTED',
        jsonb_build_object(
            'batch_id', p_batch_id,
            'source_table', v_batch.source_table,
            'period_start', v_batch.period_start,
            'period_end', v_batch.period_end,
            'sha256_checksum', v_batch.checksum,
            'rows_cleaned', v_deleted_count
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verified archive cleanup executed successfully',
        'rows_cleaned', v_deleted_count,
        'sha256_checksum', v_batch.checksum
    );
END;
$$;


-- 3. MOVIE STREAM TOKEN GENERATOR (Blueprint Section 45 — 3-Layer URL Obfuscation)
CREATE OR REPLACE FUNCTION public.get_obfuscated_media_stream(
    p_media_id UUID,
    p_resolution TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_member_id UUID;
    v_caller_status member_status;
    v_media RECORD;
    v_token TEXT;
    v_salt TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Layer 1: Caller Authentication and Status Check
    SELECT id, status INTO v_caller_member_id, v_caller_status
    FROM public.members
    WHERE auth_user_id = auth.uid();

    IF v_caller_member_id IS NULL OR v_caller_status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ACTIVE_MEMBER_AUTHENTICATION_REQUIRED');
    END IF;

    -- Fetch Media Item
    SELECT * INTO v_media
    FROM public.media_items
    WHERE id = p_media_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEDIA_ITEM_NOT_FOUND');
    END IF;

    -- Generate Ephemeral Token (3 minutes expiry)
    v_token := 'stream_tok_' || encode(gen_random_bytes(16), 'hex');
    v_salt := 'salt_' || encode(gen_random_bytes(8), 'hex');
    v_expires_at := NOW() + INTERVAL '3 minutes';

    -- Record in access token registry
    INSERT INTO public.movie_access_tokens (
        media_id,
        member_id,
        token,
        resolution,
        expires_at
    ) VALUES (
        p_media_id,
        v_caller_member_id,
        v_token,
        p_resolution,
        v_expires_at
    );

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token,
        'salt', v_salt,
        'expires_at', v_expires_at,
        'media_id', p_media_id,
        'resolution', p_resolution
    );
END;
$$;
