-- =========================================================================================
-- 🎬 SUPPORT LINK BOX - MOVIE LOVER SYSTEM (SQL SCHEMA, RLS & SEED DATA)
-- File: /src/features/movie/schema.sql
-- =========================================================================================

-- 1. Movies Table (Catalog)
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    title VARCHAR(255) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    category VARCHAR(50) NOT NULL DEFAULT 'Movie' CHECK (category IN ('Movie', 'Web Series', 'Drama', 'Short Film')),
    poster_url TEXT NOT NULL,
    description TEXT,
    language VARCHAR(50) DEFAULT 'Bengali',
    quality VARCHAR(20) DEFAULT '1080p',
    status VARCHAR(20) DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Hidden', 'Archived')),
    stream_480p_url TEXT,
    stream_720p_url TEXT,
    stream_1080p_url TEXT,
    pixeldrain_url TEXT,
    gdflex_url TEXT,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Movie Requests Table (Member Wishlist & Tracking)
CREATE TABLE IF NOT EXISTS public.movie_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    member_number VARCHAR(50) NOT NULL,
    movie_title VARCHAR(255) NOT NULL,
    release_year VARCHAR(10) NOT NULL DEFAULT '2024',
    thumbnail_url TEXT,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'ADDED', 'REJECTED', 'ALREADY_AVAILABLE', 'CANCELLED')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;

-- Movies RLS: Everyone logged-in can view Published movies; Admins/Developers can manage all
CREATE POLICY "Public and members can view published movies"
    ON public.movies FOR SELECT
    USING (status = 'Published' OR auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

CREATE POLICY "Admins can insert and modify movies"
    ON public.movies FOR ALL
    USING (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

-- Movie Requests RLS: Members can view & submit their own requests; Admins can view/edit all
CREATE POLICY "Members can view their own requests and admins view all"
    ON public.movie_requests FOR SELECT
    USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()) OR auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

CREATE POLICY "Active members can insert requests"
    ON public.movie_requests FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE status = 'ACTIVE'));

CREATE POLICY "Admins can update request status"
    ON public.movie_requests FOR UPDATE
    USING (auth.uid() IN (SELECT auth_user_id FROM public.members WHERE role IN ('ADMIN', 'DEVELOPER')));

-- 4. Initial Seed Data (Popular Bengali & International Cinema)
INSERT INTO public.movies (title, release_year, category, poster_url, description, language, quality, status, stream_1080p_url, stream_720p_url, stream_480p_url, pixeldrain_url)
VALUES 
(
  'তুফান (Toofan)',
  '2024',
  'Movie',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
  'নব্বই দশকের এক গ্যাংস্টারের উত্থানের রোমাঞ্চকর গল্প। মেগাস্টার শাকিব খানের অ্যাকশন থ্রিলার।',
  'Bengali',
  '1080p',
  'Published',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://pixeldrain.com/u/sample1'
),
(
  'প্রিয়তমা (Priyotoma)',
  '2023',
  'Movie',
  'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=500&auto=format&fit=crop&q=80',
  'একটি ট্র্যাজিক রোমান্টিক ড্রামা যা হৃদয় ছুঁয়ে যায়।',
  'Bengali',
  '1080p',
  'Published',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
  'https://pixeldrain.com/u/sample2'
)
ON CONFLICT DO NOTHING;
