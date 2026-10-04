#!/usr/bin/env python3
# Patches handle_new_user in FULL_A_TO_Z_DATABASE_MIGRATION.sql to link pre-provisioned rows
# Run from repo root: python3 apply-handle-new-user-fix.py
import sys

path = 'supabase/FULL_A_TO_Z_DATABASE_MIGRATION.sql'
with open(path, 'r') as f:
    content = f.read()

start = content.find('CREATE OR REPLACE FUNCTION public.handle_new_user()')
if start == -1:
    print("ERROR: function not found")
    sys.exit(1)

# Find the end of this function (the $$; after BEGIN...END)
func_end = content.find('$$;', start) + 3
func_text = content[start:func_end]

if 'v_existing_id' in func_text:
    print("Already patched, skipping.")
    sys.exit(0)

# 1. Add v_existing_id to DECLARE
old_decl = "    v_norm_email VARCHAR(255);\n    v_role user_role;"
new_decl = "    v_norm_email VARCHAR(255);\n    v_existing_id UUID;\n    v_role user_role;"
assert old_decl in func_text, "DECLARE not found"
func_text = func_text.replace(old_decl, new_decl, 1)

# 2. Replace the INSERT block with link-or-insert logic
old_insert = """    INSERT INTO public.members (
        auth_user_id,
        community_id,
        member_number,
        name,
        email,
        facebook_url,
        profile_photo_url,
        role,
        status
    ) VALUES (
        NEW.id,
        'main',
        v_member_number,
        v_name,
        NEW.email,
        v_fb_url,
        v_profile_photo,
        v_role,
        v_status
    )
    ON CONFLICT (auth_user_id) DO NOTHING;"""

new_insert = """    -- Check for pre-provisioned row (same email, no auth linked yet)
    SELECT id INTO v_existing_id
    FROM public.members
    WHERE LOWER(email) = v_norm_email
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Link the pre-provisioned row to this auth user
        UPDATE public.members
        SET auth_user_id = NEW.id,
            role = v_role,
            status = v_status,
            name = COALESCE(NULLIF(v_name, 'Member'), name),
            facebook_url = CASE WHEN v_fb_url <> 'https://facebook.com' THEN v_fb_url ELSE facebook_url END,
            profile_photo_url = COALESCE(v_profile_photo, profile_photo_url)
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.members (
            auth_user_id,
            community_id,
            member_number,
            name,
            email,
            facebook_url,
            profile_photo_url,
            role,
            status
        ) VALUES (
            NEW.id,
            'main',
            v_member_number,
            v_name,
            NEW.email,
            v_fb_url,
            v_profile_photo,
            v_role,
            v_status
        )
        ON CONFLICT (auth_user_id) DO NOTHING;
    END IF;"""

assert old_insert in func_text, "INSERT block not found"
func_text = func_text.replace(old_insert, new_insert, 1)

content = content[:start] + func_text + content[func_end:]
with open(path, 'w') as f:
    f.write(content)

print("Patched OK: handle_new_user links pre-provisioned rows.")
