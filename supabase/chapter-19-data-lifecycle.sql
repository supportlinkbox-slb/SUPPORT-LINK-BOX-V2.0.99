-- CHAPTER 19 — DATA LIFECYCLE, ARCHIVE, EXPORT & RETENTION SYSTEM

-- 1. Archive Batches Table
CREATE TABLE IF NOT EXISTS public.archive_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES public.communities(id) NOT NULL,
    archive_type TEXT NOT NULL,
    source_table TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, EXPORTED, VERIFYING, VERIFIED, CLEANUP_PENDING, CLEANED, FAILED, CANCELLED
    row_count INT DEFAULT 0,
    checksum TEXT,
    storage_path TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.members(id)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_archive_batches_community_id_status ON public.archive_batches(community_id, status);
CREATE INDEX IF NOT EXISTS idx_archive_batches_source_table_period ON public.archive_batches(source_table, period_start, period_end);

-- 3. Enable RLS
ALTER TABLE public.archive_batches ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy
CREATE POLICY "Admin can manage archive batches in their community" ON public.archive_batches
    FOR ALL
    TO authenticated
    USING (community_id = (SELECT community_id FROM public.members WHERE auth_user_id = auth.uid()) AND (SELECT role FROM public.members WHERE auth_user_id = auth.uid()) IN ('ADMIN', 'DEVELOPER'));
