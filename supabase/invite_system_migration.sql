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

-- 4. Minimal Anonymous Token Verifier (Deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql)

-- 5. Hardened Auth Trigger
-- handle_new_user deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql
GIN;

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

-- 4. Minimal Anonymous Token Verifier (Deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql)

-- 5. Hardened Auth Trigger
-- handle_new_user deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql
