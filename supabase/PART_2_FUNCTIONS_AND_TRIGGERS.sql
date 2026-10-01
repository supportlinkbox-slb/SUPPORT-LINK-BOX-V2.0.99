-- ====================================================================
-- SUPPORT LINK BOX: MASTER PRODUCTION SQL - PART 2 OF 3
-- FUNCTIONS, TRIGGERS, PROCEDURES & RPCS
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script SECOND after Part 1 completes.
-- ====================================================================

-- 1. HELPER SECURITY FUNCTIONS

-- Role Checking Function (Strictly requires ACTIVE status for Admin/Developer)
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
    v_status member_status;
BEGIN
    SELECT role, status INTO v_role, v_status
    FROM public.members
    WHERE auth_user_id = auth.uid();
    
    RETURN v_role IN ('ADMIN', 'DEVELOPER') AND v_status = 'ACTIVE';
END;
$$;

-- Active Status Checking Function (Returns TRUE only if caller has ACTIVE status)
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status member_status;
BEGIN
    SELECT status INTO v_status
    FROM public.members
    WHERE auth_user_id = auth.uid();
    
    RETURN v_status = 'ACTIVE';
END;
$$;

-- Secure Member Number Generator
CREATE OR REPLACE FUNCTION public.generate_member_number_secure()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  v_seq := nextval('public.member_number_seq');
  RETURN 'SLB-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- Updated At Timestamp Auto-Update Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Protect Member Auth User ID from unauthorized takeover
CREATE OR REPLACE FUNCTION public.protect_member_auth_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        IF NOT public.is_current_user_admin_or_dev() THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Modifying member auth_user_id is strictly forbidden.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_member_auth_user_id ON public.members;
CREATE TRIGGER trg_protect_member_auth_user_id
    BEFORE UPDATE OF auth_user_id ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_member_auth_user_id();

-- Authoritative Profile Resolution RPC
CREATE OR REPLACE FUNCTION public.rpc_get_current_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
    END IF;

    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_uid;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile', to_jsonb(v_member)
    );
END;
$$;

-- Hardened Orphan Profile Binding (Anti-Hijack & Anti-Privilege-Escalation)
CREATE OR REPLACE FUNCTION public.ensure_my_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_auth_email TEXT;
    v_email_confirmed TIMESTAMPTZ;
    v_member_id UUID;
    v_member_auth_uid UUID;
    v_member_role public.user_role;
BEGIN
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
    END IF;

    SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = v_auth_uid LIMIT 1;
    IF v_member_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Profile already bound');
    END IF;

    SELECT email, email_confirmed_at INTO v_auth_email, v_email_confirmed
    FROM auth.users WHERE id = v_auth_uid;

    IF v_auth_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_EMAIL_IN_AUTH');
    END IF;

    IF v_email_confirmed IS NULL AND LOWER(v_auth_email) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMAIL_NOT_VERIFIED');
    END IF;

    SELECT id, auth_user_id, role INTO v_member_id, v_member_auth_uid, v_member_role
    FROM public.members
    WHERE LOWER(email) = LOWER(v_auth_email)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
    END IF;

    IF v_member_auth_uid IS NOT NULL AND v_member_auth_uid <> v_auth_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'PROFILE_ALREADY_CLAIMED');
    END IF;

    IF v_member_role IN ('ADMIN', 'DEVELOPER') AND LOWER(v_auth_email) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRIVILEGED_ACCOUNTS_REQUIRE_MANUAL_ADMIN_PROVISIONING');
    END IF;

    UPDATE public.members
    SET auth_user_id = v_auth_uid,
        updated_at = NOW()
    WHERE id = v_member_id AND (auth_user_id IS NULL OR auth_user_id = v_auth_uid);

    RETURN jsonb_build_object('success', true, 'message', 'Profile successfully linked server-side');
END;
$$;

-- 2. AUTHENTICATION & NEW USER TRIGGERS

-- Handle New User Registration Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_email VARCHAR(150);
    v_member_num TEXT;
    v_username VARCHAR(50);
BEGIN
    -- Skip if marked as invite consumption
    IF NEW.raw_user_meta_data->>'is_invite_consumption' = 'true' THEN
        RETURN NEW;
    END IF;

    v_norm_email := LOWER(TRIM(NEW.email));
    v_member_num := public.generate_member_number_secure();
    v_username := split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4);

    INSERT INTO public.members (
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
        NEW.id,
        v_member_num,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), ''), split_part(v_norm_email, '@', 1)),
        v_username,
        v_norm_email,
        'MEMBER',
        'PENDING',
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_identity_key',
        NEW.raw_user_meta_data->>'facebook_identity_type',
        COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    -- HARDENED SECURITY: Set auth.users raw_app_meta_data so the JWT contains status = PENDING (or ACTIVE for devs)
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{status}',
        to_jsonb(CASE WHEN v_norm_email IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN 'ACTIVE' ELSE 'PENDING' END)
    )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- Re-attach Auth Trigger Safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to synchronize members.status change to auth.users.raw_app_meta_data for immediate JWT invalidation/update
CREATE OR REPLACE FUNCTION public.sync_member_status_to_auth_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF NEW.auth_user_id IS NOT NULL AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE auth.users
        SET raw_app_meta_data = jsonb_set(
            COALESCE(raw_app_meta_data, '{}'::jsonb),
            '{status}',
            to_jsonb(NEW.status::text)
        )
        WHERE id = NEW.auth_user_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_status_to_auth ON public.members;
CREATE TRIGGER trg_sync_member_status_to_auth
  AFTER UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_status_to_auth_app_metadata();

-- 3. INVITE SYSTEM RPCS

-- Verify Invite Token
CREATE OR REPLACE FUNCTION public.verify_invite_token(p_raw_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token record;
  v_token_hash TEXT;
BEGIN
  v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');
  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.attempt_count >= 10 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  IF v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    IF v_token.status = 'ACTIVE' THEN
        UPDATE public.invite_tokens 
        SET 
          status = CASE WHEN v_token.expires_at < NOW() THEN 'EXPIRED' ELSE status END,
          attempt_count = attempt_count + 1, 
          last_attempt_at = NOW() 
        WHERE id = v_token.id;
    END IF;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- Consume Invite Token
CREATE OR REPLACE FUNCTION public.consume_invite_token_tx(
    p_token_hash TEXT,
    p_auth_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token record;
  v_member record;
BEGIN
  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_TOKEN');
  END IF;

  IF v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'EXPIRED_OR_USED');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = v_token.member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MEMBER_NOT_FOUND');
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_LINKED');
  END IF;

  UPDATE public.members
  SET auth_user_id = p_auth_uid, status = 'ACTIVE'
  WHERE id = v_member.id;

  UPDATE public.invite_tokens
  SET status = 'USED', used_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object('success', true, 'member_id', v_member.id);
END;
$$;

-- Secure Login Check
CREATE OR REPLACE FUNCTION public.secure_login_check(
    p_identifier TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_member record;
  v_user record;
  v_email TEXT;
BEGIN
  IF p_identifier LIKE '%@%' THEN
    v_email := LOWER(TRIM(p_identifier));
    SELECT * INTO v_member FROM public.members WHERE LOWER(email) = v_email;
  ELSE
    SELECT * INTO v_member FROM public.members WHERE UPPER(member_number) = UPPER(TRIM(p_identifier));
    IF FOUND THEN
      v_email := LOWER(v_member.email);
    END IF;
  END IF;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE email = v_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  IF v_user.encrypted_password != crypt(p_password, v_user.encrypted_password) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  RETURN jsonb_build_object('success', true, 'email', v_email, 'member_id', v_member.id);
END;
$$;

-- GRANT EXECUTE ON RPCS
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM PUBLIC;

-- High-performance paginated members fetch RPC
CREATE OR REPLACE FUNCTION public.fetch_members_paginated(
    p_search TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_actor public.members%ROWTYPE;
    v_offset INT;
    v_total_count INT := 0;
    v_members_json JSONB;
    v_search_query TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = v_auth_uid;
    IF NOT FOUND OR (v_actor.role <> 'ADMIN' AND v_actor.role <> 'DEVELOPER') THEN
        RAISE EXCEPTION 'FORBIDDEN: Admin/Developer only.';
    END IF;

    IF p_page < 1 THEN p_page := 1; END IF;
    IF p_page_size < 1 THEN p_page_size := 15; END IF;
    IF p_page_size > 100 THEN p_page_size := 100; END IF;
    v_offset := (p_page - 1) * p_page_size;

    IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
        v_search_query := '%' || LOWER(TRIM(p_search)) || '%';
    END IF;

    -- Count total matches
    SELECT COUNT(*) INTO v_total_count
    FROM public.members m
    WHERE (v_actor.role = 'DEVELOPER' OR m.community_id = v_actor.community_id)
      AND (p_role IS NULL OR p_role = 'ALL' OR m.role::text = p_role)
      AND (p_status IS NULL OR p_status = 'ALL' OR m.status::text = p_status)
      AND (
          v_search_query IS NULL OR
          LOWER(m.name) LIKE v_search_query OR
          LOWER(m.member_number) LIKE v_search_query OR
          LOWER(COALESCE(m.email, '')) LIKE v_search_query OR
          LOWER(COALESCE(m.facebook_name, '')) LIKE v_search_query
      );

    -- Fetch paginated slice
    SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb) INTO v_members_json
    FROM (
        SELECT 
            m.id,
            m.community_id,
            m.member_number,
            m.name,
            m.email,
            m.phone,
            m.role,
            m.status,
            m.facebook_name,
            m.facebook_url,
            m.facebook_profile_url,
            m.profile_photo_url,
            m.points,
            m.vip_points,
            m.is_vip,
            m.total_supports_given,
            m.total_supports_received,
            m.consecutive_all_dones,
            m.days_inactive,
            m.last_active_at,
            m.approved_at,
            m.joined_at,
            m.created_at,
            m.updated_at
        FROM public.members m
        WHERE (v_actor.role = 'DEVELOPER' OR m.community_id = v_actor.community_id)
          AND (p_role IS NULL OR p_role = 'ALL' OR m.role::text = p_role)
          AND (p_status IS NULL OR p_status = 'ALL' OR m.status::text = p_status)
          AND (
              v_search_query IS NULL OR
              LOWER(m.name) LIKE v_search_query OR
              LOWER(m.member_number) LIKE v_search_query OR
              LOWER(COALESCE(m.email, '')) LIKE v_search_query OR
              LOWER(COALESCE(m.facebook_name, '')) LIKE v_search_query
          )
        ORDER BY m.joined_at DESC NULLS LAST, m.created_at DESC
        LIMIT p_page_size OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'success', true,
        'page', p_page,
        'page_size', p_page_size,
        'total_count', v_total_count,
        'total_pages', CEIL(v_total_count::numeric / p_page_size),
        'members', v_members_json
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_members_paginated(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

-- END OF PART 2
