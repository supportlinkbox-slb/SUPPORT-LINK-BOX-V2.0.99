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
