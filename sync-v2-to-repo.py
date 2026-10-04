#!/usr/bin/env python3
# Syncs live v2 Edge Functions + blacklist SQL into the repo
# Run from repo root: python3 sync-v2-to-repo.py
# Then: git add -A && git commit -m "sync: v2 functions + blacklist SQL" && git push
import shutil, os

REPO = '.'
YOUR_FILES = os.path.expanduser('~/workspace/your_files')

tasks = [
    # (source file, dest path in repo)
    ('admin-create-invite-v2-index.ts', 'supabase/functions/admin-create-invite/index.ts'),
    ('consume-invite-token-v2-index.ts', 'supabase/functions/consume-invite-token/index.ts'),
    ('admin-reject-member-index.ts', 'supabase/functions/admin-reject-member/index.ts'),
    ('admin-blacklist-member-index.ts', 'supabase/functions/admin-blacklist-member/index.ts'),
    ('blacklist-migration.sql', 'supabase/blacklist-migration.sql'),
]

for src_name, dest_rel in tasks:
    src = os.path.join(YOUR_FILES, src_name)
    dest = os.path.join(REPO, dest_rel)
    if not os.path.exists(src):
        print(f"SKIP (not found): {src_name}")
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(src, dest)
    print(f"OK: {dest_rel}")

print("\nDone. Now run:")
print("  git add -A")
print('  git commit -m "sync: v2 functions + blacklist SQL to repo"')
print("  git push origin main")
