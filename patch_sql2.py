import re

with open('supabase/invite-system-migration.sql', 'r') as f:
    content = f.read()

# 1. Fix Facebook Identity UNIQUE constraint
fb_unique_new = """ALTER TABLE public.members
DROP CONSTRAINT IF EXISTS members_facebook_identity_key_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS members_facebook_identity_key_type_uidx
ON public.members (facebook_identity_key, facebook_identity_type)
WHERE facebook_identity_key IS NOT NULL
  AND facebook_identity_type IS NOT NULL;"""

content = re.sub(
    r"DO \$\$.*?END \$\$;",
    fb_unique_new,
    content,
    count=1, # Only the first DO block
    flags=re.DOTALL
)

with open('supabase/invite-system-migration.sql', 'w') as f:
    f.write(content)
