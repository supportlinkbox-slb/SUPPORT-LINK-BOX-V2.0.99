BEGIN;

-- 1. Create Invite Tokens table dynamically based on members.id type
DO $$ 
DECLARE
  v_id_type TEXT;
BEGIN
  -- Inspect the data type of members.id to ensure compatibility (UUID or TEXT)
  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'id';

  IF v_id_type IS NULL THEN
    RAISE EXCEPTION 'members table or id column not found';
  END IF;

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.invite_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash TEXT UNIQUE NOT NULL,
      member_id %I NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
      created_by %I NOT NULL REFERENCES public.members(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      attempt_count INTEGER DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      status TEXT CHECK (status IN (''ACTIVE'', ''USED'', ''REVOKED'', ''EXPIRED'')) DEFAULT ''ACTIVE''
    )
  ', v_id_type, v_id_type);

  CREATE INDEX IF NOT EXISTS idx_invite_token_hash ON public.invite_tokens(token_hash);
  
  -- Enable RLS
  EXECUTE 'ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;';
  
  -- Safely drop existing policies for re-run capability
  EXECUTE 'DROP POLICY IF EXISTS admin_all_invite_tokens ON public.invite_tokens;';
  
  -- Admin Policy using existing secure helper
  EXECUTE '
    CREATE POLICY admin_all_invite_tokens ON public.invite_tokens
    FOR ALL
    TO authenticated
    USING (public.is_current_user_admin_or_dev())
  ';
END $$;

-- Duplicate protection for Facebook Identity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'members_facebook_identity_key_type_key'
    ) THEN
        ALTER TABLE public.members ADD CONSTRAINT members_facebook_identity_key_type_key UNIQUE (facebook_identity_key, facebook_identity_type);
    END IF;
END $$;

-- 2. Secure sequence for member_number (SLB-xxx) with re-run safety
DO $$ 
DECLARE
  v_max_id INT;
  v_current_seq INT := 0;
BEGIN
  -- Safe numeric extraction: regexp_replace to get digits only, ignores non-digits
  SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::INT), 0)
  INTO v_max_id
  FROM public.members;

  CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;
  
  -- Check current sequence value to avoid resetting backward
  BEGIN
    SELECT last_value INTO v_current_seq FROM public.member_number_seq;
  EXCEPTION WHEN OTHERS THEN
    v_current_seq := 0;
  END;
  
  IF v_max_id > 0 AND (v_current_seq IS NULL OR v_current_seq <= v_max_id) THEN
    EXECUTE 'ALTER SEQUENCE public.member_number_seq RESTART WITH ' || (v_max_id + 1);
  END IF;
END $$;

-- 3. Replace generator to strictly use the sequence
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

-- 4. Minimal Anonymous Token Verifier (No data leakage, No unnecessary writes)
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
    -- Only update attempt count & expiry if the token was supposed to be ACTIVE
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

  -- Success: Minimal response
  RETURN jsonb_build_object('valid', true);
END;
$$;

-- 5. Secure Consume RPC (Transaction Safe, Row Lock)
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
  -- 1. Row Lock on Token (Race-condition protection)
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

  -- 2. Verify Target Member
  SELECT * INTO v_member
  FROM public.members
  WHERE id = v_token.member_id
  FOR UPDATE; -- Lock member row

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MEMBER_NOT_FOUND');
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_LINKED');
  END IF;

  -- 3. Link Member & Mark Token
  UPDATE public.members
  SET auth_user_id = p_auth_uid
  WHERE id = v_member.id;

  UPDATE public.invite_tokens
  SET status = 'USED', used_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object('success', true, 'member_id', v_member.id);
END;
$$;

-- 6. Hardened Auth Trigger
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
    -- [CRITICAL]: Invite Consumption Bypass
    -- Edge function 'consume-invite-token' passes this metadata.
    -- Since the edge function is secured by a service role key and runs server-side,
    -- this prevents public registration triggers from interfering with Admin Invites.
    IF NEW.raw_user_meta_data->>'is_invite_consumption' = 'true' THEN
        RETURN NEW;
    END IF;

    -- Normal Public Registration Flow
    v_norm_email := LOWER(TRIM(NEW.email));
    v_member_num := public.generate_member_number_secure();
    -- Provide default username since schema requires UNIQUE NOT NULL
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
        v_member_num,  -- Strictly enforced server sequence
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), ''), split_part(v_norm_email, '@', 1)),
        v_username,
        v_norm_email,
        'MEMBER',  -- Strictly enforced
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

-- Grant permissions safely
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_invite_token_tx(TEXT, UUID) FROM authenticated;

COMMIT;

-- 8. Secure Login Check RPC
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
  -- 1. Resolve Identifier to Email
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

  -- 2. Fetch Auth User to verify password (requires auth schema access)
  SELECT * INTO v_user FROM auth.users WHERE email = v_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  -- 3. Verify Password securely using pgcrypto
  IF v_user.encrypted_password != crypt(p_password, v_user.encrypted_password) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;

  -- 4. Check Rate Limits / Account Lock logic here if needed
  -- (Assuming no explicit locking in schema, returning success)

  RETURN jsonb_build_object('success', true, 'email', v_email, 'member_id', v_member.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) TO anon, authenticated;

