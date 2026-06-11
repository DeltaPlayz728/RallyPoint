-- Avatar Storage Setup
-- Run in Supabase SQL Editor

-- 1. Add avatar_url column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- 2. Create the avatars storage bucket (public so images load without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies
-- Allow any authenticated user to read avatars (public bucket)
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow users to upload/update only their own avatar (file path = user_id.ext)
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '.', 1)
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '.', 1)
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '.', 1)
  );
