BEGIN;

-- 1. Create Invite Tokens table dynamically based on members.id type
DO $$ 
DECLARE
  v_id_type TEXT;
BEGIN
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
  
  -- Drop existing policies if any
  EXECUTE 'DROP POLICY IF EXISTS admin_all_invite_tokens ON public.invite_tokens;';
  EXECUTE 'DROP POLICY IF EXISTS admin_select_invite_tokens ON public.invite_tokens;';
  EXECUTE 'DROP POLICY IF EXISTS admin_update_invite_tokens ON public.invite_tokens;';
  
  -- Admin Policy using existing helper function
  EXECUTE '
    CREATE POLICY admin_all_invite_tokens ON public.invite_tokens
    FOR ALL
    TO authenticated
    USING (public.is_current_user_admin_or_dev())
  ';
END $$;

-- 2. Secure sequence for member_number (SLB-xxx)
DO $$ 
DECLARE
  v_max_id INT;
BEGIN
  -- Safe numeric extraction: regexp_replace to get digits only, ignores non-digits
  SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, ''\D'', '''', ''g''), '''')::INT), 0)
  INTO v_max_id
  FROM public.members;

  CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1;
  
  IF v_max_id > 0 THEN
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

-- 4. Minimal Anonymous Token Verifier
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
  WHERE token_hash = v_token_hash
  FOR UPDATE; -- Row lock to prevent concurrent bypass

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  IF v_token.attempt_count >= 10 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'RATE_LIMITED');
  END IF;

  IF v_token.status != 'ACTIVE' OR v_token.expires_at < NOW() THEN
    UPDATE public.invite_tokens 
    SET 
      status = CASE WHEN v_token.status = 'ACTIVE' AND v_token.expires_at < NOW() THEN 'EXPIRED' ELSE status END,
      attempt_count = attempt_count + 1, 
      last_attempt_at = NOW() 
    WHERE id = v_token.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_OR_EXPIRED');
  END IF;

  -- Success: Do not return sensitive info, do not increment attempt count
  RETURN jsonb_build_object('valid', true);
END;
$$;

-- 5. Hardened Auth Trigger
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
BEGIN
    v_norm_email := LOWER(TRIM(NEW.email));

    -- Strict Invite Linking: check if member exists (created by admin) and lacks auth_user_id
    SELECT * INTO v_existing_member FROM public.members WHERE email = v_norm_email AND auth_user_id IS NULL LIMIT 1;
    
    IF FOUND THEN
        UPDATE public.members
        SET auth_user_id = NEW.id
        WHERE id = v_existing_member.id;
        
        RETURN NEW;
    END IF;

    -- Normal Public Registration Flow
    v_member_num := public.generate_member_number_secure();

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
        v_member_num,  -- Strictly enforced, client metadata ignored
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(v_norm_email, '@', 1)),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)),
        v_norm_email,
        'MEMBER',  -- Strictly enforced
        'PENDING', -- Strictly enforced
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
