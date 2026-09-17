-- ADMIN INVITE TOKEN SYSTEM MIGRATION

BEGIN;

-- 1. Create Invite Tokens table dynamically based on members.id type
DO $$ 
DECLARE
  v_id_type TEXT;
BEGIN
  -- Inspect the data type of members.id
  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'id';

  IF v_id_type IS NULL THEN
    RAISE EXCEPTION 'members table or id column not found';
  END IF;

  -- Create table safely (EXECUTE format needs escaped quotes for string literals)
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

  -- Index for quick lookups
  CREATE INDEX IF NOT EXISTS idx_invite_token_hash ON public.invite_tokens(token_hash);
  
  -- Enable RLS
  ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
  
  -- Admins can read all tokens
  EXECUTE '
    CREATE POLICY admin_select_invite_tokens ON public.invite_tokens
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = auth.uid()::text AND role = ''ADMIN''
      )
    )
  ';
  
  -- Admins can update tokens (e.g. revoke)
  EXECUTE '
    CREATE POLICY admin_update_invite_tokens ON public.invite_tokens
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = auth.uid()::text AND role = ''ADMIN''
      )
    )
  ';
END $$;

-- 2. Synchronize sequence and replace M-0000 with SLB-000
DO $$ 
DECLARE
  v_max_id INT;
BEGIN
  -- Temporarily migrate any exact "M-xxxx" formats to SLB-xxx (preserving numeric value)
  UPDATE public.members
  SET member_number = 'SLB-' || lpad(SUBSTRING(member_number FROM 3), 3, '0')
  WHERE member_number LIKE 'M-%';

  -- Find the maximum numeric part in SLB-xxx
  SELECT COALESCE(MAX(SUBSTRING(member_number FROM 5)::INT), 0)
  INTO v_max_id
  FROM public.members
  WHERE member_number LIKE 'SLB-%';

  -- Create sequence if missing
  CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;
  
  -- Sync sequence
  IF v_max_id > 0 THEN
    EXECUTE 'ALTER SEQUENCE public.member_number_seq RESTART WITH ' || (v_max_id + 1);
  END IF;
END $$;

-- 3. Replace generator to STRICTLY return SLB-001 format
CREATE OR REPLACE FUNCTION public.generate_member_number_secure()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
  v_member_number TEXT;
BEGIN
  v_seq := nextval('public.member_number_seq');
  -- Format: SLB-001
  v_member_number := 'SLB-' || lpad(v_seq::text, 3, '0');
  RETURN v_member_number;
END;
$$;

-- 4. Secure Anonymous Token Verifier RPC
CREATE OR REPLACE FUNCTION public.verify_invite_token(p_raw_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token record;
  v_member_number TEXT;
  v_facebook_name TEXT;
  v_token_hash TEXT;
BEGIN
  -- Using pgcrypto digest for SHA-256
  v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  -- Rate limit (e.g. 10 attempts max, simple mechanism)
  IF v_token.attempt_count >= 10 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  IF v_token.expires_at < NOW() THEN
    UPDATE public.invite_tokens SET status = 'EXPIRED' WHERE id = v_token.id AND status = 'ACTIVE';
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  UPDATE public.invite_tokens 
  SET attempt_count = attempt_count + 1, last_attempt_at = NOW() 
  WHERE id = v_token.id;

  -- Safe info only
  SELECT member_number, facebook_name INTO v_member_number, v_facebook_name 
  FROM public.members WHERE id = v_token.member_id;

  RETURN jsonb_build_object(
    'valid', true,
    'member_number', v_member_number,
    'facebook_name', v_facebook_name
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_email VARCHAR(150);
    v_existing_member record;
    v_member_num TEXT;
    v_initial_role TEXT := 'MEMBER';
BEGIN
    v_norm_email := LOWER(TRIM(NEW.email));

    -- Developer hardcodes (if any)
    IF v_norm_email = 'supportlinkbox@gmail.com' THEN
        v_initial_role := 'DEVELOPER';
    END IF;

    -- 1. Check if member already exists (e.g., from Admin Invite Token system)
    SELECT * INTO v_existing_member FROM public.members WHERE email = v_norm_email AND auth_user_id IS NULL LIMIT 1;
    
    IF FOUND THEN
        -- Link existing member to this auth user
        UPDATE public.members
        SET auth_user_id = NEW.id
        WHERE id = v_existing_member.id;
        
        RETURN NEW;
    END IF;

    -- 2. Normal Public Registration Flow
    -- We use the new secure sequence for member_number
    v_member_num := public.generate_member_number_secure();

    INSERT INTO public.members (
        auth_user_id,
        member_number,
        name,
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
        COALESCE(NEW.raw_user_meta_data->>'member_number', v_member_num),
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(v_norm_email, '@', 1)),
        v_norm_email,
        v_initial_role,
        COALESCE(NEW.raw_user_meta_data->>'status', 'PENDING'),
        NEW.raw_user_meta_data->>'facebook_name',
        NEW.raw_user_meta_data->>'facebook_name_original',
        NEW.raw_user_meta_data->>'facebook_url',
        NEW.raw_user_meta_data->>'facebook_profile_url',
        NEW.raw_user_meta_data->>'facebook_identity_key',
        NEW.raw_user_meta_data->>'facebook_identity_type',
        COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
    ) ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;
COMMIT;
