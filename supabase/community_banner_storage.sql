-- Storage bucket + RLS for community banner images.
-- Applied live via Supabase MCP on 2026-06-26; this file documents that change
-- in the repo so the schema history stays in sync with the avatars pattern
-- (see avatar_storage.sql), since this bucket isn't created by any other migration.
--
-- Filenames are `{communityId}.{ext}` (not `{userId}.{ext}` like avatars), so
-- write access is gated on being the *owner* of that community row, not on the
-- uploader's own id matching the filename.

insert into storage.buckets (id, name, public)
values ('community-banners', 'community-banners', true)
on conflict (id) do nothing;

create policy if not exists "community_banners_select" on storage.objects
  for select using (bucket_id = 'community-banners');

create policy if not exists "community_banners_insert" on storage.objects
  for insert with check (
    bucket_id = 'community-banners'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );

create policy if not exists "community_banners_update" on storage.objects
  for update using (
    bucket_id = 'community-banners'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );

create policy if not exists "community_banners_delete" on storage.objects
  for delete using (
    bucket_id = 'community-banners'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );
