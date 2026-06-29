-- Storage bucket + RLS for community profile pictures (icons), plus the
-- icon_url column on communities. Applied live via Supabase MCP on
-- 2026-06-29; this file documents that change in the repo so the schema
-- history stays in sync, following the same pattern as
-- community_banner_storage.sql.
--
-- Filenames are `{communityId}.{ext}` (not `{userId}.{ext}` like avatars), so
-- write access is gated on being the *owner* of that community row, not on
-- the uploader's own id matching the filename.

alter table communities add column if not exists icon_url text;

insert into storage.buckets (id, name, public)
values ('community-icons', 'community-icons', true)
on conflict (id) do nothing;

drop policy if exists "community_icons_select" on storage.objects;
create policy "community_icons_select" on storage.objects
  for select using (bucket_id = 'community-icons');

-- NOTE: the subquery below qualifies every column reference (c.id, c.owner_id)
-- AND explicitly writes `objects.name` (not bare `name`) for the file path.
-- The `communities` table also has a column called `name` (the display name),
-- so an unqualified `name` here would resolve to `communities.name` instead of
-- `storage.objects.name` (the uploaded file's path) — a column-shadowing bug
-- that silently makes the ownership check always false. Confirmed and fixed
-- live in prod on 2026-06-29 after testing revealed icon/banner uploads were
-- failing RLS for every community owner. Keep `objects.name` qualified here.
drop policy if exists "community_icons_insert" on storage.objects;
create policy "community_icons_insert" on storage.objects
  for insert with check (
    bucket_id = 'community-icons'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(objects.name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "community_icons_update" on storage.objects;
create policy "community_icons_update" on storage.objects
  for update using (
    bucket_id = 'community-icons'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(objects.name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "community_icons_delete" on storage.objects;
create policy "community_icons_delete" on storage.objects
  for delete using (
    bucket_id = 'community-icons'
    and exists (
      select 1 from public.communities c
      where c.id::text = split_part(objects.name, '.', 1)
        and c.owner_id = auth.uid()
    )
  );
