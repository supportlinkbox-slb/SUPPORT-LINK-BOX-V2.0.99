-- CHAPTER 18 — MOVIE & MEDIA SYSTEM

-- 1. Create media_items table
CREATE TABLE IF NOT EXISTS public.media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES public.communities(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT NOT NULL, -- 'MOVIE', 'VIDEO', 'TUTORIAL', 'TRAINING', 'OTHER'
    category TEXT NOT NULL,
    storage_bucket TEXT,
    storage_path TEXT,
    external_url TEXT,
    thumbnail_path TEXT,
    duration_seconds INT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'
    visibility TEXT NOT NULL DEFAULT 'COMMUNITY', -- 'COMMUNITY', 'ADMINS_ONLY', 'PRIVATE'
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_media_items_community_id_status ON public.media_items(community_id, status);
CREATE INDEX IF NOT EXISTS idx_media_items_category ON public.media_items(category);
CREATE INDEX IF NOT EXISTS idx_media_items_is_featured ON public.media_items(is_featured);

-- 3. Enable RLS
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Admin can manage media in their community
CREATE POLICY "Admin can manage media in their community" ON public.media_items
    FOR ALL
    TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()) AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER'));

-- Member can read published community media
CREATE POLICY "Member can read published community media" ON public.media_items
    FOR SELECT
    TO authenticated
    USING (status = 'PUBLISHED' AND community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()));
