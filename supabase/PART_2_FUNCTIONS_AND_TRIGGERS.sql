-- ====================================================================
-- SUPPORT LINK BOX: MASTER PRODUCTION SQL - PART 2 OF 3
-- FUNCTIONS, TRIGGERS, PROCEDURES & RPCS
-- Timezone: Asia/Dhaka (BDT = UTC+6)
-- Target: PostgreSQL 15+ / Supabase SQL Editor
-- Instructions: Copy and Run this script SECOND after Part 1 completes.
-- ====================================================================

-- 1. HELPER SECURITY FUNCTIONS

-- Role Checking Function
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_dev()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.members
    WHERE auth_user_id = auth.uid();
    
    RETURN v_role IN ('ADMIN', 'DEVELOPER');
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

    RETURN NEW;
END;
$$;

-- Re-attach Auth Trigger Safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
GRANT EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM PUBLIC;

-- END OF PART 2
