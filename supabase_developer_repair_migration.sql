-- 1. ENFORCE COLUMNS (SAFE ALTER)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS real_name VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS username_normalized VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_name_original VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_profile_url TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_key VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_type VARCHAR(20);

-- Backfill normalized username if null
UPDATE public.members 
SET username_normalized = LOWER(username) 
WHERE username_normalized IS NULL;

-- Unique constraint on auth_user_id (if not already there)
DO $$ BEGIN
    ALTER TABLE public.members ADD CONSTRAINT members_auth_user_id_key UNIQUE (auth_user_id);
EXCEPTION WHEN duplicate_table THEN null;
WHEN duplicate_object THEN null;
WHEN others THEN null;
END $$;

-- 2. CREATE SECURE DEVELOPER CLAIM RPC
CREATE OR REPLACE FUNCTION public.claim_seeded_developer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID;
    v_auth_email TEXT;
    v_member_id UUID;
    v_member_auth_uid UUID;
    v_member_role public.user_role;
    v_member_status public.member_status;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;
    
    -- Restrict strictly to specified developer emails
    IF LOWER(v_auth_email) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
         RETURN json_build_object('success', false, 'error', 'Not a developer email');
    END IF;

    -- Find EXACT match for email
    SELECT id, auth_user_id, role, status
    INTO v_member_id, v_member_auth_uid, v_member_role, v_member_status
    FROM public.members
    WHERE LOWER(email) = LOWER(v_auth_email)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_member_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Developer member profile not found for this email. Admin must create it first.');
    END IF;

    -- Ensure it's not already claimed by a DIFFERENT auth user
    IF v_member_auth_uid IS NOT NULL AND v_member_auth_uid != v_auth_uid THEN
        RETURN json_build_object('success', false, 'error', 'This developer profile is already claimed by another Auth account');
    END IF;

    -- Safe binding
    UPDATE public.members
    SET 
        auth_user_id = v_auth_uid,
        role = 'DEVELOPER'::public.user_role,
        status = 'ACTIVE'::public.member_status,
        is_verified = true
    WHERE id = v_member_id;

    RETURN json_build_object('success', true, 'message', 'Developer profile claimed successfully');
END;
$$;

-- 3. CREATE ORPHAN AUTH REPAIR RPC
CREATE OR REPLACE FUNCTION public.ensure_my_member_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID;
    v_auth_email TEXT;
    v_member_id UUID;
    v_member_auth_uid UUID;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;

    -- 1. Check if perfectly bound
    SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = v_auth_uid LIMIT 1;
    IF v_member_id IS NOT NULL THEN
        RETURN json_build_object('success', true, 'message', 'Profile already bound');
    END IF;

    -- 2. Find by exact email match (orphan)
    SELECT id, auth_user_id INTO v_member_id, v_member_auth_uid 
    FROM public.members 
    WHERE LOWER(email) = LOWER(v_auth_email)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
        IF v_member_auth_uid IS NULL THEN
            UPDATE public.members SET auth_user_id = v_auth_uid WHERE id = v_member_id;
            RETURN json_build_object('success', true, 'message', 'Orphan profile successfully bound to current auth user');
        ELSE
            RETURN json_build_object('success', false, 'error', 'Profile email exists but is claimed by a different auth user');
        END IF;
    END IF;

    RETURN json_build_object('success', false, 'error', 'Profile not found in members table');
END;
$$;

-- 4. FIX RLS FOR SELF-PROFILE READ
-- Make sure members can read their own profile even if they are PENDING
DO $$ BEGIN
    DROP POLICY IF EXISTS "Members can view own profile" ON public.members;
    CREATE POLICY "Members can view own profile" 
    ON public.members FOR SELECT 
    USING (auth_user_id = auth.uid());
EXCEPTION WHEN others THEN null;
END $$;
