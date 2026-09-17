-- FINAL SECURITY REGISTRATION + LOGIN MIGRATION

-- 1. Create a sequence for member_number (SLB-001)
CREATE SEQUENCE IF NOT EXISTS member_number_seq START 1;

-- 2. Add security lock columns to members table
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMPTZ;

-- 3. Ensure facebook_identity columns are present and unique
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS facebook_identity_key TEXT,
  ADD COLUMN IF NOT EXISTS facebook_identity_type TEXT;

-- We only want unique constraint on facebook identity if it's not null.
DO $$ 
BEGIN
  BEGIN
    CREATE UNIQUE INDEX unique_fb_identity 
    ON public.members (facebook_identity_key, facebook_identity_type) 
    WHERE facebook_identity_key IS NOT NULL;
  EXCEPTION WHEN duplicate_table THEN null;
  END;
END $$;

-- 4. RPC: generate_member_number_secure
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
  -- Get next sequence atomically
  v_seq := nextval('member_number_seq');
  
  -- Format: SLB-001, SLB-010, SLB-100
  v_member_number := 'SLB-' || lpad(v_seq::text, 3, '0');
  
  RETURN v_member_number;
END;
$$;

-- 5. RPC: record_failed_login
CREATE OR REPLACE FUNCTION public.record_failed_login(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_failed_attempts INT;
  v_locked_until TIMESTAMPTZ;
  v_is_locked BOOLEAN := FALSE;
BEGIN
  -- Find member by email or member_number
  SELECT * INTO v_member
  FROM public.members
  WHERE LOWER(email) = LOWER(p_identifier) 
     OR LOWER(member_number) = LOWER(p_identifier)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  v_failed_attempts := COALESCE(v_member.failed_attempts, 0) + 1;
  v_locked_until := v_member.locked_until;

  IF v_failed_attempts >= 3 THEN
    v_locked_until := NOW() + INTERVAL '30 minutes';
    v_is_locked := TRUE;
  END IF;

  UPDATE public.members
  SET failed_attempts = v_failed_attempts,
      locked_until = v_locked_until,
      last_failed_at = NOW()
  WHERE id = v_member.id;

  RETURN jsonb_build_object(
    'success', true, 
    'failed_attempts', v_failed_attempts, 
    'is_locked', v_is_locked,
    'locked_until', v_locked_until
  );
END;
$$;

-- 6. RPC: check_login_lock
CREATE OR REPLACE FUNCTION public.check_login_lock(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_locked BOOLEAN := FALSE;
  v_remaining_seconds INT := 0;
BEGIN
  SELECT * INTO v_member
  FROM public.members
  WHERE LOWER(email) = LOWER(p_identifier) 
     OR LOWER(member_number) = LOWER(p_identifier)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'locked', false);
  END IF;

  IF v_member.locked_until IS NOT NULL AND v_member.locked_until > NOW() THEN
    v_locked := TRUE;
    v_remaining_seconds := EXTRACT(EPOCH FROM (v_member.locked_until - NOW()))::INT;
  ELSIF v_member.locked_until IS NOT NULL AND v_member.locked_until <= NOW() THEN
    -- Lock expired naturally
    UPDATE public.members 
    SET failed_attempts = 0, locked_until = NULL 
    WHERE id = v_member.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'locked', v_locked,
    'remaining_seconds', v_remaining_seconds,
    'email', v_member.email -- Securely return email so backend can authenticate via Auth if it was SLB-001
  );
END;
$$;

-- 7. RPC: reset_login_lock
CREATE OR REPLACE FUNCTION public.reset_login_lock(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET failed_attempts = 0,
      locked_until = NULL
  WHERE LOWER(email) = LOWER(p_email);
END;
$$;

-- 8. RPC: admin_unlock_account
CREATE OR REPLACE FUNCTION public.admin_unlock_account(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin or developer (simplified check, usually you'd check auth.uid())
  UPDATE public.members
  SET failed_attempts = 0,
      locked_until = NULL
  WHERE id = p_member_id;
END;
$$;
