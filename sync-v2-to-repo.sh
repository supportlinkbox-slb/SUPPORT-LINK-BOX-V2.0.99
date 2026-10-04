#!/bin/bash
# Syncs live v2 Edge Functions + blacklist SQL into the repo (direct download)
# Run from repo root: bash sync-v2-to-repo.sh
# Then: git add -A && git commit -m "sync: v2 functions" && git push

set -e
mkdir -p supabase/functions/admin-create-invite
mkdir -p supabase/functions/consume-invite-token
mkdir -p supabase/functions/admin-reject-member
mkdir -p supabase/functions/admin-blacklist-member

echo "Downloading v2 functions..."
curl -sfL -o supabase/functions/admin-create-invite/index.ts \
  "https://muse.ai/files/1345602521972253/2305669510208009/3sybvl8v0xr2zggnezkds1cx/admin-create-invite-v2-index.ts" \
  && echo "OK: admin-create-invite"

curl -sfL -o supabase/functions/consume-invite-token/index.ts \
  "https://muse.ai/files/1345602521972253/1109075674851908/wufb04nsgm8r3hr706m7ac17/consume-invite-token-v2-index.ts" \
  && echo "OK: consume-invite-token"

curl -sfL -o supabase/functions/admin-reject-member/index.ts \
  "https://muse.ai/files/1345602521972253/2096138607654669/48d46yp393ofy1iyktegmmkd/admin-reject-member-index.ts" \
  && echo "OK: admin-reject-member"

curl -sfL -o supabase/functions/admin-blacklist-member/index.ts \
  "https://muse.ai/files/1345602521972253/2532969393862489/16n32bstrtltnwz6gfdgmrcu/admin-blacklist-member-index.ts" \
  && echo "OK: admin-blacklist-member"

curl -sfL -o supabase/blacklist-migration.sql \
  "https://muse.ai/files/1345602521972253/1828321464829453/lklbrukvdumsvqsfsbyvfsgv/blacklist-migration.sql" \
  && echo "OK: blacklist-migration.sql"

echo ""
echo "Done. Now run:"
echo '  git add -A && git commit -m "sync: v2 functions + blacklist SQL to repo" && git push origin main'
