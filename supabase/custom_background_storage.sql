-- Custom Background Storage Setup
-- Run in Supabase SQL Editor
-- (Also applied live directly via migration "create_custom_backgrounds_bucket")

-- 1. Create the custom-backgrounds storage bucket (public so images load without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-backgrounds', 'custom-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies — same "path = user_id.ext" ownership pattern as avatars
DROP POLICY IF EXISTS "custom_backgrounds_select" ON storage.objects;
CREATE POLICY "custom_backgrounds_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'custom-backgrounds');

DROP POLICY IF EXISTS "custom_backgrounds_insert" ON storage.objects;
CREATE POLICY "custom_backgrounds_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'custom-backgrounds'
    AND auth.uid()::text = split_part(name, '.', 1)
  );

DROP POLICY IF EXISTS "custom_backgrounds_update" ON storage.objects;
CREATE POLICY "custom_backgrounds_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'custom-backgrounds'
    AND auth.uid()::text = split_part(name, '.', 1)
  );

DROP POLICY IF EXISTS "custom_backgrounds_delete" ON storage.objects;
CREATE POLICY "custom_backgrounds_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'custom-backgrounds'
    AND auth.uid()::text = split_part(name, '.', 1)
  );
