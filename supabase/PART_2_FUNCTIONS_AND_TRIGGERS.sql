-- ====================================================================
-- SUPPORT LINK BOX: MASTER SQL - PART 2 OF 3
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
RETURNS VARCHAR
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

-- 2. AUTHENTICATION & NEW USER TRIGGERS (Deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql)

-- 3. INVITE SYSTEM RPCS (Deferred to canonical FULL_A_TO_Z_DATABASE_MIGRATION.sql)

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
GRANT EXECUTE ON FUNCTION public.secure_login_check(TEXT, TEXT) TO anon, authenticated;

-- END OF PART 2
