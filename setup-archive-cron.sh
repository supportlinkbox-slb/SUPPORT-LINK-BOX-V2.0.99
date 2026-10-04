#!/data/data/com.termux/files/usr/bin/bash
# Schedules the weekly archive pg_cron job.
# Run ONLY after the dry-run curl returned VERIFIED_NOT_DELETED.
set -u
echo "=== Weekly archive cron setup ==="
echo "Run this ONLY after the dry-run curl returned VERIFIED_NOT_DELETED."
read -p "Continue? (type YES): " OK
[ "$OK" = "YES" ] || { echo "Aborted."; exit 0; }
read -p "Pooler host [aws-0-ap-northeast-1.pooler.supabase.com]: " PGHOST
PGHOST=${PGHOST:-aws-0-ap-northeast-1.pooler.supabase.com}
read -p "DB user [postgres.bqrecpmrewhpkylsrqc]: " PGUSER
PGUSER=${PGUSER:-postgres.bqrecpmrewhpkylsrqc}
read -s -p "DB password (hidden): " PGPASSWORD
echo ""
read -p "Supabase ANON_KEY (paste): " ANON_KEY
export PGHOST PGUSER PGPASSWORD
export PGDATABASE=postgres PGPORT=5432
psql -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule(
  'weekly-lifecycle-archive',
  '0 2 * * 0',
  \$\$
  SELECT net.http_post(
    url => 'https://bqrecpmrewhpkylsrqc.supabase.co/functions/v1/lifecycle-google-sheets',
    headers => jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ${ANON_KEY}'
    ),
    body => jsonb_build_object('execute_cleanup', true),
    timeout_milliseconds => 30000
  );
  \$\$
);
SQL
echo "=== CRON SCHEDULED (Sundays 02:00 UTC = 08:00 BDT) ==="
psql -c "SELECT jobname, schedule FROM cron.job WHERE jobname='weekly-lifecycle-archive';"
unset PGPASSWORD
