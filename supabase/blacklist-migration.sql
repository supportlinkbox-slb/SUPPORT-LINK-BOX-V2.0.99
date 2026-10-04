-- Blacklist table: permanent ban on email + FB link
CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  fb_link TEXT,
  reason TEXT NOT NULL,
  blacklisted_by UUID REFERENCES public.members(id),
  blacklisted_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_email ON public.blacklist (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_blacklist_fb_link ON public.blacklist (fb_link) WHERE fb_link IS NOT NULL;

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- Only admins can read/manage (service_role bypasses RLS anyway)
CREATE POLICY "Admins can manage blacklist" ON public.blacklist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_user_id = auth.uid()
      AND m.role IN ('ADMIN', 'DEVELOPER')
    )
  );

-- Function: check if email or fb_link is blacklisted
CREATE OR REPLACE FUNCTION public.is_blacklisted(p_email TEXT, p_fb_link TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blacklist
    WHERE LOWER(email) = LOWER(p_email)
       OR (p_fb_link IS NOT NULL AND fb_link = p_fb_link)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_blacklisted(TEXT, TEXT) TO anon, authenticated;
