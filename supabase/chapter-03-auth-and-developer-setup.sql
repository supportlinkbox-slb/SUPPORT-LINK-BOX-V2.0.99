-- ==============================================================================
-- CHAPTER 03: AUTHENTICATION, REGISTRATION, APPROVAL & DEVELOPER PROVISIONING
-- Support Link Box Authoritative Identity & Security Architecture
-- ==============================================================================

-- 1. Ensure Enum Values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'member_status' AND pg_enum.enumlabel = 'REJECTED'
    ) THEN
        ALTER TYPE public.member_status ADD VALUE 'REJECTED';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Ensure Chapter 03 Schema Columns in public.members
DO $$
BEGIN
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS username_normalized VARCHAR(50);
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS real_name VARCHAR(100);
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_name_original VARCHAR(100);
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_name_normalized VARCHAR(100);
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_profile_url TEXT;
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_key TEXT;
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS facebook_identity_type VARCHAR(20);
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.members(id);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Populate normalized fields for existing records
UPDATE public.members 
SET 
    username_normalized = LOWER(TRIM(username)),
    real_name = COALESCE(real_name, name),
    facebook_name_original = COALESCE(facebook_name_original, facebook_name),
    facebook_profile_url = COALESCE(facebook_profile_url, facebook_url)
WHERE username_normalized IS NULL;

-- 4. Unique Indexes for Identity & Duplicate Prevention (Section 18, 52)
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_username_normalized 
ON public.members (LOWER(TRIM(username)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower 
ON public.members (LOWER(TRIM(email)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_fb_identity 
ON public.members (facebook_identity_key, facebook_identity_type) 
WHERE facebook_identity_key IS NOT NULL AND status <> 'REJECTED';

-- 5. Fix Security Guard Trigger to Allow Initial Binding
CREATE OR REPLACE FUNCTION public.trg_protect_member_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'DEVELOPER' THEN
            RAISE EXCEPTION 'DEVELOPER_PROTECTED: Developer accounts cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    -- Allow initial binding when OLD.auth_user_id IS NULL
    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: auth_user_id is immutable once linked.';
    END IF;

    -- Allow initial member_number if null
    IF OLD.member_number IS NOT NULL AND NEW.member_number IS DISTINCT FROM OLD.member_number THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: member_number is immutable.';
    END IF;

    -- Allow role update for Developer emails or internal calls
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF current_setting('slb.internal_role_change', true) IS DISTINCT FROM 'true' 
           AND LOWER(COALESCE(NEW.email, '')) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct role update is prohibited. Use change_member_role() RPC.';
        END IF;
    END IF;

    -- Allow status update for Developer emails or internal calls
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF current_setting('slb.internal_status_change', true) IS DISTINCT FROM 'true'
           AND current_setting('slb.internal_approval', true) IS DISTINCT FROM 'true'
           AND LOWER(COALESCE(NEW.email, '')) NOT IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Direct status update is prohibited. Use set_member_status_secure() RPC.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_security_guard ON public.members;
CREATE TRIGGER trg_members_security_guard
    BEFORE UPDATE OR DELETE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.trg_protect_member_security_fields();

-- 6. DEVELOPER PROVISIONING & REPAIR (Murad Shihab Khan)
-- Handles both cases: auth.users exists OR will register soon
DO $$
DECLARE
    v_auth_uid UUID := NULL;
    v_existing_id UUID := NULL;
BEGIN
    -- Look up auth user safely (case-insensitive)
    SELECT id INTO v_auth_uid 
    FROM auth.users 
    WHERE LOWER(email) = 'muradshihab516@gmail.com' 
    LIMIT 1;

    -- Look up existing member row
    SELECT id INTO v_existing_id 
    FROM public.members 
    WHERE LOWER(email) = 'muradshihab516@gmail.com' 
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing record
        UPDATE public.members
        SET 
            name = 'Md shihab khan',
            real_name = 'Md shihab khan',
            username = 'Shihab_Vai',
            username_normalized = 'shihab_vai',
            role = 'DEVELOPER'::user_role,
            status = 'ACTIVE'::member_status,
            facebook_name = 'MD SHIHAB KHAN',
            facebook_name_original = 'MD SHIHAB KHAN',
            facebook_url = 'https://www.facebook.com/SmShihab2.0',
            facebook_profile_url = 'https://www.facebook.com/SmShihab2.0',
            facebook_identity_key = 'smshihab2.0',
            facebook_identity_type = 'username',
            profile_photo_url = 'https://i.ibb.co/DPDHM9Vm/1789329610483.jpg',
            auth_user_id = COALESCE(auth_user_id, v_auth_uid),
            is_verified = true
        WHERE id = v_existing_id;
    ELSE
        -- Insert new developer profile
        INSERT INTO public.members (
            member_number,
            name,
            real_name,
            username,
            username_normalized,
            email,
            role,
            status,
            facebook_name,
            facebook_name_original,
            facebook_url,
            facebook_profile_url,
            facebook_identity_key,
            facebook_identity_type,
            profile_photo_url,
            auth_user_id,
            points,
            weekly_points,
            total_links_submitted,
            total_supports_given,
            total_all_done,
            is_verified,
            community
        ) VALUES (
            'SLB-001',
            'Md shihab khan',
            'Md shihab khan',
            'Shihab_Vai',
            'shihab_vai',
            'muradshihab516@gmail.com',
            'DEVELOPER'::user_role,
            'ACTIVE'::member_status,
            'MD SHIHAB KHAN',
            'MD SHIHAB KHAN',
            'https://www.facebook.com/SmShihab2.0',
            'https://www.facebook.com/SmShihab2.0',
            'smshihab2.0',
            'username',
            'https://i.ibb.co/DPDHM9Vm/1789329610483.jpg',
            v_auth_uid,
            1500,
            120,
            150,
            2500,
            150,
            true,
            'Support Link Box Official'
        );
    END IF;

    IF v_auth_uid IS NOT NULL THEN
        RAISE NOTICE 'SUCCESS: Developer account Murad Shihab Khan successfully linked to auth.users (UUID: %)', v_auth_uid;
    ELSE
        RAISE NOTICE 'NOTICE: Developer profile created in public.members. When Muradshihab516@gmail.com signs up or logs in, it will auto-bind to auth.users immediately!';
    END IF;
END $$;

-- 7. Authoritative Self-Healing RPC: rpc_get_current_member_profile
CREATE OR REPLACE FUNCTION public.rpc_get_current_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_member public.members%ROWTYPE;
    v_auth_email TEXT;
    v_next_int INTEGER;
    v_member_num VARCHAR(20);
    v_is_dev BOOLEAN := false;
BEGIN
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    -- Get email from auth.users
    SELECT LOWER(email) INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;

    IF v_auth_email IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
        v_is_dev := true;
    END IF;

    -- 1. Try finding by auth_user_id
    SELECT * INTO v_member FROM public.members WHERE auth_user_id = v_auth_uid;

    -- 2. If not found by auth_user_id, match by email and bind
    IF v_member.id IS NULL AND v_auth_email IS NOT NULL THEN
        UPDATE public.members 
        SET auth_user_id = v_auth_uid 
        WHERE LOWER(email) = v_auth_email
        RETURNING * INTO v_member;
    END IF;

    -- 3. If Developer, enforce role and active status
    IF v_is_dev AND v_member.id IS NOT NULL THEN
        IF v_member.role <> 'DEVELOPER' OR v_member.status <> 'ACTIVE' THEN
            UPDATE public.members
            SET 
                role = 'DEVELOPER'::user_role,
                status = 'ACTIVE'::member_status
            WHERE id = v_member.id
            RETURNING * INTO v_member;
        END IF;
    END IF;

    -- 4. If still not found, self-heal: auto-provision member profile on the fly
    IF v_member.id IS NULL AND v_auth_email IS NOT NULL THEN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::integer), 100) + 1
        INTO v_next_int FROM public.members;
        v_member_num := 'SLB-' || LPAD(v_next_int::text, 3, '0');

        INSERT INTO public.members (
            auth_user_id,
            email,
            name,
            real_name,
            username,
            username_normalized,
            role,
            status,
            member_number,
            facebook_name,
            facebook_url,
            profile_photo_url
        )
        VALUES (
            v_auth_uid,
            v_auth_email,
            CASE WHEN v_is_dev THEN 'Md shihab khan' ELSE COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1)) END,
            CASE WHEN v_is_dev THEN 'Md shihab khan' ELSE COALESCE((SELECT raw_user_meta_data->>'real_name' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1)) END,
            CASE WHEN v_is_dev THEN 'Shihab_Vai' ELSE COALESCE((SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)) END,
            CASE WHEN v_is_dev THEN 'shihab_vai' ELSE LOWER(COALESCE((SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = v_auth_uid), split_part(v_auth_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4))) END,
            CASE WHEN v_is_dev THEN 'DEVELOPER'::user_role ELSE 'MEMBER'::user_role END,
            CASE WHEN v_is_dev THEN 'ACTIVE'::member_status ELSE 'PENDING'::member_status END,
            CASE WHEN v_is_dev THEN 'SLB-001' ELSE v_member_num END,
            CASE WHEN v_is_dev THEN 'MD SHIHAB KHAN' ELSE (SELECT raw_user_meta_data->>'facebook_name' FROM auth.users WHERE id = v_auth_uid) END,
            CASE WHEN v_is_dev THEN 'https://www.facebook.com/SmShihab2.0' ELSE (SELECT raw_user_meta_data->>'facebook_url' FROM auth.users WHERE id = v_auth_uid) END,
            CASE WHEN v_is_dev THEN 'https://i.ibb.co/DPDHM9Vm/1789329610483.jpg' ELSE COALESCE((SELECT raw_user_meta_data->>'profile_photo_url' FROM auth.users WHERE id = v_auth_uid), 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80') END
        )
        ON CONFLICT (auth_user_id) DO UPDATE SET 
            email = EXCLUDED.email,
            role = CASE WHEN v_is_dev THEN 'DEVELOPER'::user_role ELSE public.members.role END,
            status = CASE WHEN v_is_dev THEN 'ACTIVE'::member_status ELSE public.members.status END
        RETURNING * INTO v_member;
    END IF;

    IF v_member.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile', to_jsonb(v_member)
    );
END;
$$;

-- 8. Fallback explicit self-heal RPC
CREATE OR REPLACE FUNCTION public.ensure_my_member_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.rpc_get_current_member_profile();
END;
$$;

-- 9. Authoritative Member Approval RPC (Section 22, 49)
CREATE OR REPLACE FUNCTION public.approve_member_secure(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    -- Verify Actor permissions
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = auth.uid();
    IF v_actor.id IS NULL OR v_actor.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'অ্যাডমিন অথবা ডেভেলপার পারমিশন প্রয়োজন।');
    END IF;

    -- Verify Target Member
    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'সদস্যের প্রোফাইল খুঁজে পাওয়া যায়নি।');
    END IF;

    IF v_target.status = 'ACTIVE' THEN
        RETURN jsonb_build_object('success', true, 'message', 'অ্যাকাউন্টটি ইতোমধ্যে সচল (Active) রয়েছে।');
    END IF;

    -- Enable internal status update bypass for trigger
    PERFORM set_config('slb.internal_approval', 'true', true);

    UPDATE public.members
    SET 
        status = 'ACTIVE'::member_status,
        approved_at = NOW(),
        approved_by = v_actor.id,
        updated_at = NOW()
    WHERE id = p_target_id;

    -- Audit Log
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (
        v_actor.id,
        'MEMBER_APPROVED',
        'MEMBER',
        p_target_id,
        'Approved registration for ' || v_target.name || ' (' || v_target.member_number || ')'
    );

    RETURN jsonb_build_object('success', true, 'message', 'সদস্য সফলভাবে অনুমোদিত হয়েছে।');
END;
$$;

-- 10. Authoritative Member Rejection RPC
CREATE OR REPLACE FUNCTION public.reject_member_secure(p_target_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor public.members%ROWTYPE;
    v_target public.members%ROWTYPE;
BEGIN
    SELECT * INTO v_actor FROM public.members WHERE auth_user_id = auth.uid();
    IF v_actor.id IS NULL OR v_actor.role NOT IN ('ADMIN', 'DEVELOPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'অ্যাডমিন অথবা ডেভেলপার পারমিশন প্রয়োজন।');
    END IF;

    SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
    IF v_target.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'সদস্য খুঁজে পাওয়া যায়নি।');
    END IF;

    IF v_target.role = 'DEVELOPER' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ডেভেলপার অ্যাকাউন্ট রিজেক্ট বা বাতিল করা যাবে না।');
    END IF;

    PERFORM set_config('slb.internal_approval', 'true', true);

    UPDATE public.members
    SET 
        status = 'REJECTED'::member_status,
        updated_at = NOW()
    WHERE id = p_target_id;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (
        v_actor.id,
        'MEMBER_REJECTED',
        'MEMBER',
        p_target_id,
        'Rejected registration for ' || v_target.name || COALESCE('. Reason: ' || p_reason, '')
    );

    RETURN jsonb_build_object('success', true, 'message', 'সদস্যের আবেদন সফলভাবে বাতিল করা হয়েছে।');
END;
$$;

-- 11. Availability & Duplicate Checking RPC (Section 48)
CREATE OR REPLACE FUNCTION public.rpc_check_identity_availability(
    p_email TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_fb_identity_key TEXT DEFAULT NULL,
    p_fb_identity_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check Email
    IF p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
        SELECT EXISTS(SELECT 1 FROM public.members WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))) INTO v_exists;
        IF v_exists THEN
            RETURN jsonb_build_object('available', false, 'field', 'email', 'reason', 'এই Email Address দিয়ে ইতিমধ্যে একটি Account রয়েছে।');
        END IF;
    END IF;

    -- Check Username
    IF p_username IS NOT NULL AND TRIM(p_username) <> '' THEN
        SELECT EXISTS(SELECT 1 FROM public.members WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_username))) INTO v_exists;
        IF v_exists THEN
            RETURN jsonb_build_object('available', false, 'field', 'username', 'এই Username ইতিমধ্যে অন্য সদস্য ব্যবহার করছেন। নতুন Username দিন।');
        END IF;
    END IF;

    -- Check Facebook Identity Key
    IF p_fb_identity_key IS NOT NULL AND TRIM(p_fb_identity_key) <> '' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.members 
            WHERE facebook_identity_key = TRIM(p_fb_identity_key) 
              AND status <> 'REJECTED'
        ) INTO v_exists;
        IF v_exists THEN
            RETURN jsonb_build_object(
                'available', false, 
                'field', 'facebook', 
                'reason', '⚠️ এই Facebook Profile-এর সাথে একটি Account ইতোমধ্যে যুক্ত আছে। আপনার যদি এটি পুরোনো Account হয়, নতুন Account তৈরি না করে Admin-এর সাথে যোগাযোগ করুন।'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('available', true);
END;
$$;

-- 12. Update handle_new_user Trigger for Signup Sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_int INTEGER;
    v_member_num VARCHAR(20);
    v_initial_role user_role := 'MEMBER';
    v_initial_status member_status := 'PENDING';
    v_norm_email VARCHAR(150);
    v_name VARCHAR(100);
    v_username VARCHAR(50);
    v_is_dev BOOLEAN := false;
BEGIN
    v_norm_email := LOWER(TRIM(NEW.email));

    IF v_norm_email IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com') THEN
        v_initial_role := 'DEVELOPER';
        v_initial_status := 'ACTIVE';
        v_is_dev := true;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(member_number, '\D', '', 'g'), '')::integer), 100) + 1
    INTO v_next_int FROM public.members;
    v_member_num := CASE WHEN v_is_dev THEN 'SLB-001' ELSE 'SLB-' || LPAD(v_next_int::text, 3, '0') END;

    v_name := CASE 
        WHEN v_is_dev THEN 'Md shihab khan'
        ELSE COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(v_norm_email, '@', 1))
    END;

    v_username := CASE 
        WHEN v_is_dev THEN 'Shihab_Vai'
        ELSE COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(v_norm_email, '@', 1) || '_' || substr(md5(random()::text), 1, 4))
    END;

    INSERT INTO public.members (
        auth_user_id,
        member_number,
        name,
        real_name,
        username,
        username_normalized,
        email,
        role,
        status,
        facebook_name,
        facebook_name_original,
        facebook_url,
        facebook_profile_url,
        facebook_identity_key,
        facebook_identity_type,
        profile_photo_url,
        points,
        weekly_points,
        total_links_submitted,
        total_supports_given,
        total_all_done,
        community_id,
        is_verified
    ) VALUES (
        NEW.id,
        v_member_num,
        v_name,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'real_name'), ''), v_name),
        v_username,
        LOWER(TRIM(v_username)),
        v_norm_email,
        v_initial_role,
        v_initial_status,
        CASE WHEN v_is_dev THEN 'MD SHIHAB KHAN' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name'), '') END,
        CASE WHEN v_is_dev THEN 'MD SHIHAB KHAN' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_name_original'), '') END,
        CASE WHEN v_is_dev THEN 'https://www.facebook.com/SmShihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_url'), '') END,
        CASE WHEN v_is_dev THEN 'https://www.facebook.com/SmShihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_profile_url'), '') END,
        CASE WHEN v_is_dev THEN 'smshihab2.0' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_identity_key'), '') END,
        CASE WHEN v_is_dev THEN 'username' ELSE NULLIF(TRIM(NEW.raw_user_meta_data->>'facebook_identity_type'), '') END,
        CASE WHEN v_is_dev THEN 'https://i.ibb.co/DPDHM9Vm/1789329610483.jpg' ELSE COALESCE(NEW.raw_user_meta_data->>'profile_photo_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80') END,
        CASE WHEN v_is_dev THEN 1500 ELSE 0 END,
        CASE WHEN v_is_dev THEN 120 ELSE 0 END,
        CASE WHEN v_is_dev THEN 150 ELSE 0 END,
        CASE WHEN v_is_dev THEN 2500 ELSE 0 END,
        CASE WHEN v_is_dev THEN 150 ELSE 0 END,
        'main',
        v_is_dev
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        role = CASE WHEN v_is_dev THEN 'DEVELOPER'::user_role ELSE public.members.role END,
        status = CASE WHEN v_is_dev THEN 'ACTIVE'::member_status ELSE public.members.status END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant execute permissions to authenticated and anon
GRANT EXECUTE ON FUNCTION public.rpc_get_current_member_profile() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_member_profile() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_member_secure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_member_secure(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_check_identity_availability(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
