#!/data/data/com.termux/files/usr/bin/bash
# Support Link Box — Supabase deploy RESUME (no wipe needed)
# Run from the repo root, e.g.:  ~/SUPPORT-LINK-BOX-V2.0.99/SUPPORT-LINK-BOX-V2.0.99
# It re-applies files from the given number to 25 (all are idempotent).

set -u
echo "=== Support Link Box Supabase Deploy (RESUME, no wipe) ==="
read -p "Pooler host: " PGHOST
read -p "DB user [postgres]: " PGUSER
PGUSER=${PGUSER:-postgres}
read -s -p "DB password (hidden, not saved in history): " PGPASSWORD
echo ""
export PGHOST PGUSER PGPASSWORD
export PGDATABASE=postgres PGPORT=5432

read -p "Start from file number [19]: " START
START=${START:-19}

echo "--- 0. Enabling pg_cron (idempotent) ---"
psql -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" || { echo "pg_cron failed, aborting."; unset PGPASSWORD; exit 1; }

FILES=(
  "supabase/FULL_A_TO_Z_DATABASE_MIGRATION.sql"
  "supabase/PART_1_SCHEMA_TABLES_INDEXES.sql"
  "supabase/RECONCILE_SCHEMA_V18.sql"
  "supabase/PART_2_FUNCTIONS_AND_TRIGGERS.sql"
  "supabase/PART_3_RLS_STORAGE_AND_SEED.sql"
  "supabase/FULL_MASTER_CHAPTER_1_TO_22.sql"
  "supabase/chapter-03-auth-and-developer-setup.sql"
  "supabase/chapter-11-points.sql"
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

i=1
total=${#FILES[@]}
for f in "${FILES[@]}"; do
  if [ "$i" -ge "$START" ]; then
    echo "--- [$i/$total] $f ---"
    [ -f "$f" ] || { echo "FILE NOT FOUND: $f — aborting."; unset PGPASSWORD; exit 1; }
    psql -v ON_ERROR_STOP=1 -f "$f" > /dev/null || { echo "FAILED at file $i: $f — fix and re-run from this file."; unset PGPASSWORD; exit 1; }
  fi
  i=$((i+1))
done

echo "--- Verification ---"
psql -c "SELECT count(*) AS cron_jobs FROM cron.job;"
psql -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('members','daily_links','scheduled_links','support_records','all_done','settings','notices') ORDER BY 1;"

unset PGPASSWORD
echo "=== DONE: all 25 files applied ==="
