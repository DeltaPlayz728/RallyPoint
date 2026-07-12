-- ============================================================
-- Community Forum Channels (Discord-style forum posts)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Adds a second channel "type" alongside the existing plain chat
-- channels: a forum channel where each message is a titled post with
-- tags + an optional image, and replies are threaded under the post
-- instead of one continuous log. Reuses existing helper functions
-- (is_community_owner / is_community_member / is_community_moderator /
-- is_banned_from_community) so RLS posture matches community_messages.
-- ============================================================

-- ── community_channels.type ──────────────────────────────────
alter table community_channels add column if not exists type text not null default 'chat' check (type in ('chat', 'forum'));

-- ── community_forum_posts ────────────────────────────────────
create table if not exists community_forum_posts (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references community_channels(id) on delete cascade,
  community_id  uuid not null references communities(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  title         text not null,
  body          text,
  image_url     text,
  tags          text[] not null default '{}',
  pinned        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists forum_posts_channel_idx on community_forum_posts(channel_id, pinned desc, created_at desc);

alter table community_forum_posts enable row level security;

drop policy if exists "forum_posts_select" on community_forum_posts;
create policy "forum_posts_select" on community_forum_posts
  for select using (
    is_community_owner(community_id, auth.uid()) or is_community_member(community_id, auth.uid())
  );

drop policy if exists "forum_posts_insert" on community_forum_posts;
create policy "forum_posts_insert" on community_forum_posts
  for insert with check (
    auth.uid() = author_id
    and not is_banned_from_community(community_id, auth.uid())
    and (is_community_owner(community_id, auth.uid()) or is_community_member(community_id, auth.uid()))
  );

drop policy if exists "forum_posts_update" on community_forum_posts;
create policy "forum_posts_update" on community_forum_posts
  for update using (
    auth.uid() = author_id or is_community_owner(community_id, auth.uid()) or is_community_moderator(community_id, auth.uid())
  );

drop policy if exists "forum_posts_delete" on community_forum_posts;
create policy "forum_posts_delete" on community_forum_posts
  for delete using (
    auth.uid() = author_id or is_community_owner(community_id, auth.uid()) or is_community_moderator(community_id, auth.uid())
  );


-- ── community_forum_replies ──────────────────────────────────
create table if not exists community_forum_replies (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references community_forum_posts(id) on delete cascade,
  community_id  uuid not null references communities(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists forum_replies_post_idx on community_forum_replies(post_id, created_at);

alter table community_forum_replies enable row level security;

drop policy if exists "forum_replies_select" on community_forum_replies;
create policy "forum_replies_select" on community_forum_replies
  for select using (
    is_community_owner(community_id, auth.uid()) or is_community_member(community_id, auth.uid())
  );

drop policy if exists "forum_replies_insert" on community_forum_replies;
create policy "forum_replies_insert" on community_forum_replies
  for insert with check (
    auth.uid() = author_id
    and not is_banned_from_community(community_id, auth.uid())
    and (is_community_owner(community_id, auth.uid()) or is_community_member(community_id, auth.uid()))
  );

drop policy if exists "forum_replies_delete" on community_forum_replies;
create policy "forum_replies_delete" on community_forum_replies
  for delete using (
    auth.uid() = author_id or is_community_owner(community_id, auth.uid()) or is_community_moderator(community_id, auth.uid())
  );


-- ── community_forum_reactions ────────────────────────────────
-- Single star/bookmark toggle per user per post for V1 (matches the
-- star icon seen on Discord forum posts). More reaction types (❌, 💰)
-- can be added later by widening the emoji check constraint.
create table if not exists community_forum_reactions (
  post_id   uuid not null references community_forum_posts(id) on delete cascade,
  user_id   uuid not null references profiles(id),
  emoji     text not null default 'star' check (emoji in ('star')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table community_forum_reactions enable row level security;

drop policy if exists "forum_reactions_select" on community_forum_reactions;
create policy "forum_reactions_select" on community_forum_reactions
  for select using (
    exists (
      select 1 from community_forum_posts p
      where p.id = post_id
        and (is_community_owner(p.community_id, auth.uid()) or is_community_member(p.community_id, auth.uid()))
    )
  );

drop policy if exists "forum_reactions_insert" on community_forum_reactions;
create policy "forum_reactions_insert" on community_forum_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from community_forum_posts p
      where p.id = post_id
        and (is_community_owner(p.community_id, auth.uid()) or is_community_member(p.community_id, auth.uid()))
    )
  );

drop policy if exists "forum_reactions_delete" on community_forum_reactions;
create policy "forum_reactions_delete" on community_forum_reactions
  for delete using (auth.uid() = user_id);


-- ── realtime ──────────────────────────────────────────────────
alter publication supabase_realtime add table community_forum_posts;
alter publication supabase_realtime add table community_forum_replies;
alter publication supabase_realtime add table community_forum_reactions;
