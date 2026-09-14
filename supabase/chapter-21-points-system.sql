-- CHAPTER 21 — 3-LEVEL POINT SYSTEM, QUALIFICATION & REWARD ENGINE

-- 1. Create table for finalized leaderboard results
CREATE TABLE IF NOT EXISTS public.leaderboard_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES public.communities(id) NOT NULL,
    period_type TEXT NOT NULL, -- 'WEEKLY', 'MONTHLY'
    period_id TEXT NOT NULL, -- Format: YYYY-WW or YYYY-MM
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    member_id UUID REFERENCES public.members(id) NOT NULL,
    rank INT NOT NULL,
    points INT NOT NULL,
    link_days INT DEFAULT 0,
    fast_support_days INT DEFAULT 0,
    qualification_status TEXT DEFAULT 'QUALIFIED', -- 'QUALIFIED', 'DISQUALIFIED'
    reward_status TEXT DEFAULT 'NONE', -- 'NONE', 'ELIGIBLE', 'CLAIMED', 'PUBLISHED'
    finalized_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, period_type, period_id, member_id)
);

-- 2. Create table for VIP Reward Entitlements
CREATE TABLE IF NOT EXISTS public.vip_reward_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) NOT NULL,
    period_type TEXT NOT NULL,
    period_id TEXT NOT NULL,
    rank INT NOT NULL,
    qualification_status TEXT NOT NULL,
    status TEXT DEFAULT 'EARNED', -- 'EARNED', 'PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED', 'EXPIRED'
    submitted_link_id UUID REFERENCES public.daily_links(id),
    published_link_id UUID REFERENCES public.daily_links(id),
    approved_by_admin_id UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_results_period ON public.leaderboard_results(community_id, period_type, period_id);
CREATE INDEX IF NOT EXISTS idx_vip_reward_entitlements_member_period ON public.vip_reward_entitlements(member_id, period_type, period_id);

-- 4. Enable RLS
ALTER TABLE public.leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_reward_entitlements ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Admin can manage leaderboard in their community" ON public.leaderboard_results
    FOR ALL
    TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()) AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER'));

CREATE POLICY "Member can read their own leaderboard results" ON public.leaderboard_results
    FOR SELECT
    TO authenticated
    USING (member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin can manage VIP rewards in their community" ON public.vip_reward_entitlements
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = vip_reward_entitlements.member_id AND m.community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid())) AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER'));

CREATE POLICY "Member can read their own VIP rewards" ON public.vip_reward_entitlements
    FOR SELECT
    TO authenticated
    USING (member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));
