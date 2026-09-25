const fs = require('fs');

let content = fs.readFileSync('supabase/PART_1_SCHEMA_TABLES_INDEXES.sql', 'utf8');

const marker = '-- SAFE MIGRATION / COLUMN GUARANTEE';

if (content.includes(marker)) {
  const parts = content.split(marker);
  const head = parts[0];
  const tailParts = parts[1].split('-- 5. PERFORMANCE INDEXES');
  const tail = '-- 5. PERFORMANCE INDEXES' + tailParts[1];

  const middle = `-- SAFE MIGRATION / COLUMN GUARANTEE (STANDARD SQL - NO PL/pgSQL)
-- Guarantees all required columns exist even if tables pre-existed from prior schema drafts

-- Daily Links guarantees
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS post_type post_type;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS category link_category NOT NULL DEFAULT 'NORMAL';
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS post_link TEXT;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS link_code VARCHAR(50);
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS supports_count INT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS public.daily_links ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE;

-- Notices guarantees
ALTER TABLE IF EXISTS public.notices ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Notifications guarantees
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Scheduled links guarantees
ALTER TABLE IF EXISTS public.scheduled_links ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;

-- Support records guarantees
ALTER TABLE IF EXISTS public.support_records ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;

-- All done guarantees
ALTER TABLE IF EXISTS public.all_done ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;

-- Invite tokens guarantees
ALTER TABLE IF EXISTS public.invite_tokens ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;

-- Points & Summary guarantees
ALTER TABLE IF EXISTS public.points_history ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.point_transactions ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.member_daily_summary ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.member_punishments ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.fake_all_done_incidents ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.movie_access_tokens ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.leaderboard_results ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.vip_reward_entitlements ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.alt_id_disclosures ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE CASCADE;

`;

  const newContent = head + middle + tail;
  fs.writeFileSync('supabase/PART_1_SCHEMA_TABLES_INDEXES.sql', newContent, 'utf8');
  console.log('Successfully updated PART 1 SQL file!');
} else {
  console.error('Marker not found in PART 1');
}
