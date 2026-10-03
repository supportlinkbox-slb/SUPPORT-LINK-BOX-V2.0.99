# SUPPORT LINK BOX — SUPABASE DEPLOYMENT GUIDE (v18 + schema-reconcile fix)

## Prerequisites
> **CRITICAL PRE-STEP:** Enable the `pg_cron` extension in your Supabase project before applying Step 1.
> In Supabase Dashboard: **Database** → **Extensions** → search for `pg_cron` and toggle **ON** (or run `CREATE EXTENSION IF NOT EXISTS pg_cron;`).

---

## Supabase SQL Apply Order (Exact, One at a Time)

Apply each of the following SQL scripts in the Supabase SQL Editor strictly in the numbered order below, executing each completely before proceeding to the next:

1. `supabase/FULL_A_TO_Z_DATABASE_MIGRATION.sql`
2. `supabase/PART_1_SCHEMA_TABLES_INDEXES.sql`
3. `supabase/RECONCILE_SCHEMA_V18.sql` — **NEW**: unifies competing table definitions (adds 67 missing columns, idempotent)
4. `supabase/PART_2_FUNCTIONS_AND_TRIGGERS.sql`
5. `supabase/PART_3_RLS_STORAGE_AND_SEED.sql`
6. `supabase/FULL_MASTER_CHAPTER_1_TO_22.sql`
7. `supabase/chapter-03-auth-and-developer-setup.sql`
8. `supabase/chapter-11-points.sql`
9. `supabase/chapter-12-recovery.sql`
10. `supabase/chapter-13-fake-all-done.sql`
11. `supabase/chapter-14-notifications.sql`
12. `supabase/chapter-15-reports.sql`
13. `supabase/chapter-16-member-audit.sql`
14. `supabase/chapter-18-media.sql`
15. `supabase/chapter-19-data-lifecycle.sql`
16. `supabase/chapter-21-points-system.sql`
17. `supabase/chapter-22-media-security.sql`
18. `supabase/invite-system-migration.sql`
19. `supabase/invite_system_final.sql`
20. `supabase/invite_system_migration.sql`
21. `supabase/SUPPORT_LINK_BOX_MASTER_RECONCILIATION.sql`
22. `supabase/production-hardening.sql`
23. `supabase/CANONICAL_PRODUCTION_HARDENING_V2.sql`
24. `supabase/SUPPORT_LINK_BOX_DATA_MIGRATION.sql`
25. `supabase/PART_10_SECURITY_LIFECYCLE_CRON.sql`

> **Note:** If your database already has an older version of this schema applied,
> wipe it first with `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
> (only safe when there is no data worth keeping), then apply from step 1.

---

## Post-Deployment Verification
1. Verify Developer bootstrap:
   ```sql
   SELECT * FROM public.members WHERE role = 'DEVELOPER';
   ```
2. Verify core tables exist: `members`, `daily_links`, `scheduled_links`, `support_records`, `all_done`, `settings`, `notices`, `notifications`, `reports`.
3. Check active cron jobs:
   ```sql
   SELECT * FROM cron.job;
   ```
4. Verify reconciled columns exist:
   ```sql
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'notices' AND column_name = 'target_member_id';
   -- expect 1
   ```
