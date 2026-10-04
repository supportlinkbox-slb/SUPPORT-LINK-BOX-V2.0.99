#!/data/data/com.termux/files/usr/bin/bash
# Resumes the v18 deploy from file 9 (files 1-8 already applied).
# Run from the repo root: ~/SUPPORT-LINK-BOX-V2.0.99/SUPPORT-LINK-BOX-V2.0.99
set -u
echo "=== Resume deploy from 9/25 to NEW project (ufgmyoppqedreqomcmcp) ==="
PGHOST="aws-0-ap-southeast-1.pooler.supabase.com"
PGUSER="postgres.ufgmyoppqedreqomcmcp"
read -s -p "DB password (hidden, paste): " PGPASSWORD
echo ""
export PGHOST PGUSER PGPASSWORD
export PGDATABASE=postgres PGPORT=5432
FILES=(
  "supabase/chapter-12-recovery.sql"
  "supabase/chapter-13-fake-all-done.sql"
  "supabase/chapter-14-notifications.sql"
  "supabase/chapter-15-reports.sql"
  "supabase/chapter-16-member-audit.sql"
  "supabase/chapter-18-media.sql"
  "supabase/chapter-19-data-lifecycle.sql"
  "supabase/chapter-21-points-system.sql"
  "supabase/chapter-22-media-security.sql"
  "supabase/invite-system-migration.sql"
  "supabase/invite_system_final.sql"
  "supabase/invite_system_migration.sql"
  "supabase/SUPPORT_LINK_BOX_MASTER_RECONCILIATION.sql"
  "supabase/production-hardening.sql"
  "supabase/CANONICAL_PRODUCTION_HARDENING_V2.sql"
  "supabase/SUPPORT_LINK_BOX_DATA_MIGRATION.sql"
  "supabase/PART_10_SECURITY_LIFECYCLE_CRON.sql"
)
i=8
for f in "${FILES[@]}"; do
  i=$((i+1))
  [ -f "$f" ] || { echo "MISSING FILE: $f (stopping)"; exit 1; }
  echo "[$i/25] $f"
  psql -v ON_ERROR_STOP=1 -q -f "$f" || { echo "FAILED at [$i/25] $f (stopping)"; exit 1; }
done
echo "=== ALL 25 APPLIED ==="
psql -c "SELECT count(*) AS cron_jobs FROM cron.job;"
psql -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('all_done','daily_links','members','notices','scheduled_links','settings','support_records') ORDER BY tablename;"
unset PGPASSWORD
