with open('supabase/invite-system-migration.sql', 'r') as f:
    sql = f.read()

old_block = """    -- If member already exists (e.g. created by Admin for an invite),
    -- DO NOT create a new member profile to prevent duplicate conflicts.
    IF EXISTS (SELECT 1 FROM public.members WHERE LOWER(email) = v_norm_email) THEN
        RETURN NEW;
    END IF;"""

new_block = """    -- If member already exists (e.g. created by Admin for an invite),
    -- LINK auth_user_id to prevent orphan auth user.
    IF EXISTS (SELECT 1 FROM public.members WHERE LOWER(email) = v_norm_email) THEN
        UPDATE public.members
        SET auth_user_id = NEW.id
        WHERE LOWER(email) = v_norm_email AND (auth_user_id IS NULL OR auth_user_id = NEW.id);
        RETURN NEW;
    END IF;"""

if old_block in sql:
    sql = sql.replace(old_block, new_block)
    with open('supabase/invite-system-migration.sql', 'w') as f:
        f.write(sql)
    print("Updated invite-system-migration.sql")
else:
    print("old_block not found in migration file")

