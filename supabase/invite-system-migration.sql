-- ==============================================================================
-- SUPPORT LINK BOX: SECURE INVITE, REGISTRATION & AUTHENTICATION MIGRATION
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DATATYPE COMPATIBILITY & FACEBOOK IDENTITY PROTECTION
-- ------------------------------------------------------------------------------
ALTER TABLE public.members
DROP CONSTRAINT IF EXISTS members_facebook_identity_key_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS members_facebook_identity_key_type_uidx
ON public.members (facebook_identity_key, facebook_identity_type)
WHERE facebook_identity_key IS NOT NULL
  AND facebook_identity_type IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. SECURE MEMBER NUMBER GENERATOR (Race-condition free)
-- ------------------------------------------------------------------------------
DO $$ 
DECLARE
  v_max_id BIGINT;
  v_current_seq BIGINT := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::BIGINT), 0)
  INTO v_max_id
  FROM public.members;

  CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;
  
  BEGIN
    SELECT last_value INTO v_current_seq FROM public.member_number_seq;
  EXCEPTION WHEN OTHERS THEN
    v_current_seq := 0;
  END;
  
  IF v_max_id > 0 AND (v_current_seq IS NULL OR v_current_seq <= v_max_id) THEN
    EXECUTE 'ALTER SEQUENCE public.member_number_seq RESTART WITH ' || (v_max_id + 1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_member_number_secure()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    v_seq := nextval('public.member_number_seq');
    RETURN 'SLB-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. INVITE TOKENS TABLE (Strict Datatypes & RLS)
-- ------------------------------------------------------------------------------
-- members.id is UUID in this schema
CREATE TABLE IF NOT EXISTS public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Block public access entirely. Admins use secure RPCs.
DROP POLICY IF EXISTS admin_read_invite_tokens ON public.invite_tokens;
DROP POLICY IF EXISTS admin_all_invite_tokens ON public.invite_tokens;

CREATE POLICY admin_read_invite_tokens ON public.invite_tokens
    FOR SELECT TO authenticated
    USING (public.is_current_user_admin_or_dev());

-- ------------------------------------------------------------------------------
-- 4. LOGIN RATE LIMITING (3 Attempts -> 30 Min Freeze)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
    email TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_login_status(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_record record;
BEGIN
    SELECT * INTO v_record FROM public.login_attempts WHERE email = LOWER(TRIM(p_email));
    IF FOUND AND v_record.locked_until > NOW() THEN
        RETURN jsonb_build_object('allowed', false, 'locked_until', v_record.locked_until);
    END IF;
    RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.login_attempts (email, failed_attempts, last_attempt)
    VALUES (LOWER(TRIM(p_email)), 1, NOW())
    ON CONFLICT (email) DO UPDATE SET 
        failed_attempts = public.login_attempts.failed_attempts + 1,
        last_attempt = NOW(),
        locked_until = CASE 
            WHEN public.login_attempts.failed_attempts + 1 >= 3 THEN NOW() + INTERVAL '30 minutes'
            ELSE public.login_attempts.locked_until 
        END;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.login_attempts WHERE email = LOWER(TRIM(p_email));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_login_status(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_failure(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_status(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. MINIMAL ANONYMOUS TOKEN VERIFIER (Anti-Enumeration & Rate Limited)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_invite_token(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token record;
BEGIN
  -- Token is passed already hashed from client. Raw token NEVER hits DB.
  SELECT * INTO v_token FROM public.invite_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  -- Cooldown / Rate Limiting (Max 10 attempts, 5 sec cooldown)
  IF v_token.attempt_count >= 10 OR (v_token.last_attempt_at IS NOT NULL AND v_token.last_attempt_at > NOW() - INTERVAL '5 seconds') THEN
    UPDATE public.invite_tokens SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  -- Mark expired dynamically
  IF v_token.status = 'ACTIVE' AND v_token.expires_at < NOW() THEN
    UPDATE public.invite_tokens SET status = 'EXPIRED', attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.status != 'ACTIVE' THEN
    UPDATE public.invite_tokens SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  -- Return MINIMAL details. No email exposed.
  RETURN jsonb_build_object('valid', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. SECURE INVITE CONSUME RPC (Strictly uses auth.uid())
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token record;
  v_member record;
  v_auth_uid UUID;
  v_auth_email TEXT;
BEGIN
  -- MUST be extracted from secure JWT context
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'UNAUTHORIZED');
  END IF;

  -- Get Authenticated Email
  SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;

  -- Row Lock on Token (Race-condition protection)
  SELECT * INTO v_token FROM public.invite_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  -- Row Lock on Target Member
  SELECT * INTO v_member FROM public.members WHERE id = v_token.member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MEMBER_NOT_FOUND');
  END IF;

  -- [CRITICAL SECURITY] Ensure authenticated email matches the invited member email
  IF LOWER(TRIM(v_member.email)) != LOWER(TRIM(v_auth_email)) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'IDENTITY_MISMATCH');
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_LINKED');
  END IF;

  -- Link Member & Mark Token Used atomically
  UPDATE public.members SET auth_user_id = v_auth_uid WHERE id = v_member.id;
  UPDATE public.invite_tokens SET status = 'USED', used_at = NOW() WHERE id = v_token.id;

  -- Audit Log
  INSERT INTO public.audit_logs (action, table_name, record_id, changed_by, new_data)
  VALUES ('INVITE_CONSUMED', 'invite_tokens', v_token.id::TEXT, v_auth_uid, jsonb_build_object('member_id', v_member.id));

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. AUTH TRIGGER (Handles Public Registration & Admin Invite Collision)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_email TEXT;
    v_member_num TEXT;
    v_username TEXT;
    v_name VARCHAR(100);
BEGIN
    v_norm_email := LOWER(TRIM(NEW.email));

    -- If member already exists (e.g. created by Admin for an invite),
    -- LINK auth_user_id to prevent orphan auth user.
    IF EXISTS (SELECT 1 FROM public.members WHERE LOWER(email) = v_norm_email) THEN
        UPDATE public.members
        SET auth_user_id = NEW.id
        WHERE LOWER(email) = v_norm_email AND (auth_user_id IS NULL OR auth_user_id = NEW.id);
        RETURN NEW;
    END IF;

    -- Normal Public Registration Flow
    v_member_num := public.generate_member_number_secure();
    v_username := split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4);
    v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), ''), split_part(v_norm_email, '@', 1));

    INSERT INTO public.members (
        id,
        auth_user_id,
        member_number,
        name,
        username,
        email,
        role,
        status,
        facebook_name,
        facebook_name_original,
        facebook_url,
        facebook_profile_url,
        facebook_identity_key,
        facebook_identity_type,
        profile_photo_url
    ) VALUES (
        gen_random_uuid(),
        NEW.id,
        v_member_num,
        v_name,
        v_username,
        v_norm_email,
        'MEMBER',
        'PENDING', -- Strictly enforced
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_identity_key',
        NEW.raw_user_meta_data->>'facebook_identity_type',
        COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. DEVELOPER PROTECTION TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_developer_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.role = 'DEVELOPER' AND auth.uid() IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'Developer account is protected';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.role = 'DEVELOPER' AND OLD.role != 'DEVELOPER' THEN
         IF NOT public.is_current_user_developer() THEN
             RAISE EXCEPTION 'Only existing developers can promote others to DEVELOPER role.';
         END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_developer_accounts ON public.members;
CREATE TRIGGER trg_protect_developer_accounts
BEFORE UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.protect_developer_accounts();

-- ------------------------------------------------------------------------------
-- 9. LOGIN IDENTIFIER RESOLVER (Safe mapping from SLB-xxx to Email)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    IF p_identifier LIKE '%@%' THEN
        RETURN LOWER(TRIM(p_identifier));
    ELSE
        SELECT email INTO v_email FROM public.members WHERE UPPER(member_number) = UPPER(TRIM(p_identifier));
        RETURN v_email;
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT) TO service_role;

COMMIT;
