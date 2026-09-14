-- CHAPTER 22 — MOVIE LOVER SECURE ACCESS & PROTECTED LINK DELIVERY

-- 1. Create table for short-lived access tokens
CREATE TABLE IF NOT EXISTS public.movie_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL,
    member_id UUID REFERENCES public.members(id) NOT NULL,
    community_id UUID REFERENCES public.communities(id) NOT NULL,
    media_id UUID REFERENCES public.media_items(id) NOT NULL,
    resolution TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_movie_access_tokens_token_hash ON public.movie_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_movie_access_tokens_member_expires ON public.movie_access_tokens(member_id, expires_at);

-- 3. Enable RLS
ALTER TABLE public.movie_access_tokens ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy (Members can only read their own tokens)
CREATE POLICY "Member can read their own tokens" ON public.movie_access_tokens
    FOR SELECT
    TO authenticated
    USING (member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));
