#!/data/data/com.termux/files/usr/bin/bash
# Applies ARCHIVE_SHEETS_V1.sql to Supabase (prompts for connection).
# Run from the dir containing ARCHIVE_SHEETS_V1.sql.
set -u
echo "=== Archive SQL migration ==="
echo "(connection is fixed in this script — only the DB password is asked)"
PGHOST="aws-0-ap-northeast-1.pooler.supabase.com"
PGUSER="postgres.bqrecpmrewhpkylsrqc"
read -s -p "DB password (hidden): " PGPASSWORD
echo ""
export PGHOST PGUSER PGPASSWORD
export PGDATABASE=postgres PGPORT=5432
[ -f "ARCHIVE_SHEETS_V1.sql" ] || { echo "ARCHIVE_SHEETS_V1.sql not found in current dir!"; exit 1; }
psql -v ON_ERROR_STOP=1 -f ARCHIVE_SHEETS_V1.sql && echo "=== MIGRATION OK ==="
unset PGPASSWORD
