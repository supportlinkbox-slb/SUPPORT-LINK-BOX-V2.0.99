import re

with open('supabase/invite-system-migration.sql', 'r') as f:
    content = f.read()

# 1. Fix Facebook Identity UNIQUE constraint
fb_unique_old = """DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'members_facebook_identity_key_type_key'
    ) THEN
        ALTER TABLE public.members ADD CONSTRAINT members_facebook_identity_key_type_key UNIQUE NULLS NOT DISTINCT (facebook_identity_key, facebook_identity_type);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create facebook_identity_key_type_key constraint, duplicates might already exist.';
END $$;"""

fb_unique_new = """ALTER TABLE public.members
DROP CONSTRAINT IF EXISTS members_facebook_identity_key_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS members_facebook_identity_key_type_uidx
ON public.members (facebook_identity_key, facebook_identity_type)
WHERE facebook_identity_key IS NOT NULL
  AND facebook_identity_type IS NOT NULL;"""

content = content.replace(fb_unique_old, fb_unique_new)

# 2. Fix RPC Permissions (REVOKE instead of GRANT)
rpc_old = """GRANT EXECUTE ON FUNCTION public.check_login_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) TO anon, authenticated;"""

rpc_new = """GRANT EXECUTE ON FUNCTION public.check_login_status(TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_failure(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) FROM anon, authenticated;"""

content = content.replace(rpc_old, rpc_new)

# 3. Fix Developer Protection Trigger
dev_old = """CREATE OR REPLACE FUNCTION public.protect_developer_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.role = 'DEVELOPER' AND auth.uid() != OLD.auth_user_id THEN
        RAISE EXCEPTION 'Developer accounts cannot be modified or deleted by other admins.';
    END IF;"""

dev_new = """CREATE OR REPLACE FUNCTION public.protect_developer_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.role = 'DEVELOPER' AND auth.uid() IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'Developer account is protected';
    END IF;"""

content = content.replace(dev_old, dev_new)

with open('supabase/invite-system-migration.sql', 'w') as f:
    f.write(content)
