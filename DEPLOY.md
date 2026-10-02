# SUPPORT LINK BOX — SUPABASE DEPLOYMENT GUIDE

## Prerequisites
> **CRITICAL PRE-STEP:** Enable the `pg_cron` extension in your Supabase project before applying Step 1.
> In Supabase Dashboard: **Database** → **Extensions** → search for `pg_cron` and toggle **ON** (or run `CREATE EXTENSION IF NOT EXISTS pg_cron;`).

---

## Supabase SQL Apply Order (Exact, One at a Time)

Apply each of the following SQL scripts in the Supabase SQL Editor strictly in the numbered order below, executing each completely before proceeding to the next:

1. `supabase/FULL_A_TO_Z_DATABASE_MIGRATION.sql`
2. `supabase/PART_1_SCHEMA_TABLES_INDEXES.sql`
3. `supabase/PART_2_FUNCTIONS_AND_TRIGGERS.sql`
4. `supabase/PART_3_RLS_STORAGE_AND_SEED.sql`
5. `supabase/FULL_MASTER_CHAPTER_1_TO_22.sql`
6. `supabase/chapter-03-auth-and-developer-setup.sql`
7. `supabase/chapter-11-points.sql`
8. `supabase/chapter-12-recovery.sql`
9. `supabase/chapter-13-fake-all-done.sql`
10. `supabase/chapter-14-notifications.sql`
11. `supabase/chapter-15-reports.sql`
12. `supabase/chapter-16-member-audit.sql`
13. `supabase/chapter-18-media.sql`
14. `supabase/chapter-19-data-lifecycle.sql`
15. `supabase/chapter-21-points-system.sql`
16. `supabase/chapter-22-media-security.sql`
17. `supabase/invite-system-migration.sql`
18. `supabase/invite_system_final.sql`
19. `supabase/invite_system_migration.sql`
20. `supabase/SUPPORT_LINK_BOX_MASTER_RECONCILIATION.sql`
21. `supabase/production-hardening.sql`
22. `supabase/CANONICAL_PRODUCTION_HARDENING_V2.sql`
23. `supabase/SUPPORT_LINK_BOX_DATA_MIGRATION.sql`
24. `supabase/PART_10_SECURITY_LIFECYCLE_CRON.sql`

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
