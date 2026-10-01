-- ====================================================================
-- SUPPORT LINK BOX - ENTERPRISE CANONICAL PRODUCTION HARDENING V2
-- Fixes Audited Vulnerabilities (P0 / P1 / S-C1 to S-C8)
-- ====================================================================

-- 1. SEARCH PATH & TRIGGER PROTECTION FOR MEMBERS
-- Prevents users from manually increasing points, VIP status, role or status
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'DEVELOPER' THEN
            RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: auth_user_id is immutable.';
    END IF;

    IF NEW.member_number IS DISTINCT FROM OLD.member_number THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: member_number is immutable.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF current_setting('slb.internal_role_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct role update is prohibited. Use change_member_role() RPC.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF current_setting('slb.internal_status_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct status update is prohibited. Use set_member_status_secure() RPC.';
        END IF;
    END IF;

    -- Strict Protection against self-awarded points, streak, or VIP
    IF NEW.points IS DISTINCT FROM OLD.points OR 
       NEW.vip_points IS DISTINCT FROM OLD.vip_points OR 
       NEW.is_vip IS DISTINCT FROM OLD.is_vip OR 
       NEW.vip_expires_at IS DISTINCT FROM OLD.vip_expires_at OR 
       NEW.streak IS DISTINCT FROM OLD.streak THEN
        IF current_setting('slb.internal_points_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct points, streak, or VIP modification is prohibited. Use authorized RPC.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_security_guard ON public.members;
CREATE TRIGGER trg_members_security_guard
    BEFORE UPDATE OR DELETE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.trg_protect_member_security_fields();


-- 2. REVOKE SENSITIVE FUNCTION PERMISSIONS FROM ANON & PUBLIC (Password Oracle & Cutoff Prevention)
DO $$
BEGIN
    -- Revoke secure_login_check password oracle from public/anon
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_login_check') THEN
        REVOKE EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) FROM PUBLIC, anon;
    END IF;

    -- Revoke login lock bypasses from anonymous users
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_login_lock') THEN
        REVOKE EXECUTE ON FUNCTION public.reset_login_lock(TEXT) FROM PUBLIC, anon;
    END IF;

    -- Revoke 10am recovery cutoff trigger from anonymous users
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cron_bdt_10am_recovery_cutoff') THEN
        REVOKE EXECUTE ON FUNCTION public.cron_bdt_10am_recovery_cutoff() FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.cron_bdt_10am_recovery_cutoff() TO service_role;
    END IF;
END $$;


-- 3. ENSURE RLS POLICIES ON ALL TABLES
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Settings readable by authenticated" ON public.settings;
CREATE POLICY "Settings readable by authenticated"
    ON public.settings FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Settings updateable by admin or developer" ON public.settings;
CREATE POLICY "Settings updateable by admin or developer"
    ON public.settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.members 
            WHERE auth_user_id = auth.uid() 
            AND role IN ('ADMIN', 'DEVELOPER')
        )
    );

-- 4. MISSING PERFORMANCE INDEXES (Audit P1 Finding)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_member_id ON public.reports(reported_member_id);
CREATE INDEX IF NOT EXISTS idx_daily_links_owner_date ON public.daily_links(owner_id, date);
CREATE INDEX IF NOT EXISTS idx_support_records_member_date ON public.support_records(member_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_member_unread ON public.notifications(member_id, is_read);

-- 5. SECURE DEVELOPER RESET RPC (DEVELOPER ONLY)
CREATE OR REPLACE FUNCTION public.rpc_developer_reset_system(
    p_reset_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role user_role;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
BEGIN
    SELECT role INTO v_caller_role FROM public.members WHERE auth_user_id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'DEVELOPER' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Developer privileges required.';
    END IF;

    IF p_reset_type = 'DAILY' THEN
        DELETE FROM public.support_records WHERE date = v_today;
        DELETE FROM public.all_done WHERE date = v_today;
        DELETE FROM public.daily_links WHERE date = v_today;
    ELSIF p_reset_type = 'ALL' THEN
        DELETE FROM public.support_records;
        DELETE FROM public.all_done;
        DELETE FROM public.daily_links;
    END IF;

    RETURN jsonb_build_object('success', true, 'reset_type', p_reset_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_developer_reset_system(TEXT) TO authenticated;
