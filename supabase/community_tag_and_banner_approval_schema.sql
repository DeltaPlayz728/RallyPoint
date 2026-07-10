-- ============================================================
-- RallyPoint V2 — Pillar 3 (Community Tab + Banner): remaining pieces
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- IMPORTANT CONTEXT: communities/community_members/community_messages/
-- community_channels/community_announcements/community_bans already exist
-- and are fully wired in the app (join/leave, channels, chat, announcements,
-- kick/ban, banner+icon upload, accent color) — this migration does NOT
-- recreate any of that. It adds the two pieces the V2 plan called for that
-- weren't there yet: (1) a profile-level "community tag" shown elsewhere in
-- the app (Discord-style), and (2) an approval gate on banner/icon uploads,
-- which currently go live the instant an owner uploads them.
-- ============================================================

-- ── profiles.primary_community_id ────────────────────────────
-- The one community whose tag a user "wears" elsewhere in the app (event
-- attendee lists, chat rows). One at a time in V2, per the master plan.
alter table profiles add column if not exists primary_community_id uuid references communities(id) on delete set null;

-- Enforce "must actually be a member of that community" at the DB layer —
-- RLS's existing profiles_update policy (auth.uid() = id) doesn't check
-- membership, so without this a user could set any community's id here.
create or replace function check_primary_community_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_community_id is not null then
    if not exists (
      select 1 from community_members
      where community_id = new.primary_community_id and user_id = new.id
    ) then
      raise exception 'Cannot set primary_community_id to a community you are not a member of';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_primary_community_membership on profiles;
create trigger enforce_primary_community_membership
  before insert or update of primary_community_id on profiles
  for each row execute function check_primary_community_membership();


-- ── community_banner_submissions ─────────────────────────────
-- Approval queue for banner/icon art. The existing storage-upload flow
-- (see community_banner_storage.sql / community_icon_storage.sql) is
-- unchanged — owners can still upload a file to the bucket. What changes is
-- what happens after upload: the uploaded asset_url goes into a pending
-- submission row here instead of straight into communities.banner_url /
-- icon_url. Only an admin approval (service-role, via /api/admin/*) copies
-- it into the live communities row.
create table if not exists community_banner_submissions (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  asset_type    text not null check (asset_type in ('banner','icon')),
  asset_url     text not null,
  submitted_by  uuid not null references profiles(id),
  approved      boolean not null default false,
  rejected      boolean not null default false,
  submitted_at  timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   uuid references profiles(id)
);

create index if not exists community_banner_submissions_pending_idx
  on community_banner_submissions(community_id) where approved = false and rejected = false;

alter table community_banner_submissions enable row level security;

drop policy if exists "banner_submissions_select" on community_banner_submissions;
drop policy if exists "banner_submissions_insert" on community_banner_submissions;

-- Community owners can see their own submissions (to show "pending approval"
-- in the UI); nobody else needs to.
create policy "banner_submissions_select" on community_banner_submissions
  for select using (
    exists (select 1 from communities c where c.id = community_id and c.owner_id = auth.uid())
  );

create policy "banner_submissions_insert" on community_banner_submissions
  for insert with check (
    auth.uid() = submitted_by
    and approved = false and rejected = false -- can't self-approve at insert time
    and exists (select 1 from communities c where c.id = community_id and c.owner_id = auth.uid())
  );

-- No update/delete policy for anon/authenticated — approval/rejection is a
-- service-role-only action (admin queue), same posture as community_banners
-- in the master plan's original spec.


-- ── lock down direct writes to communities.banner_url / icon_url ────────
-- The existing communities_update-equivalent policy (defined wherever the
-- owner-can-edit-their-community policy lives) still allows an owner to
-- update their community row in general (name/description/rules/accent
-- color are all still fine to self-serve). This trigger specifically blocks
-- banner_url/icon_url from changing except via a service-role connection
-- (the admin approval route), so the approval queue above can't be bypassed
-- by calling `.update()` directly from the client.
create or replace function block_direct_banner_icon_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if new.banner_url is distinct from old.banner_url or new.icon_url is distinct from old.icon_url then
      raise exception 'banner_url/icon_url can only be changed via the approval queue';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_banner_icon_approval on communities;
create trigger enforce_banner_icon_approval
  before update of banner_url, icon_url on communities
  for each row execute function block_direct_banner_icon_update();
