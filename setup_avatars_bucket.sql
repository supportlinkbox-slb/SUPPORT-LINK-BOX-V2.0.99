-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Set up policies for public access to the avatars bucket
DO $$ 
BEGIN
  -- 1. Allow public read access
  BEGIN
    CREATE POLICY "Avatar images are publicly accessible." 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'avatars');
  EXCEPTION WHEN duplicate_object THEN null;
  END;

  -- 2. Allow authenticated users to upload avatars
  BEGIN
    CREATE POLICY "Anyone can upload an avatar." 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'avatars');
  EXCEPTION WHEN duplicate_object THEN null;
  END;
END $$;
