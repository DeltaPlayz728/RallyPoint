-- ============================================================
-- RallyPoint — AI Assistant + DM schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── profiles: mark bot/persona accounts ────────────────────────
alter table profiles add column if not exists is_bot boolean not null default false;

-- ── events: disclose AI-suggested seed events ──────────────────
alter table events add column if not exists is_suggested boolean not null default false;
alter table events add column if not exists suggested_by uuid references auth.users(id);

-- ── events: real venue tied to AI-suggested events ──────────────
alter table events add column if not exists venue_name text;
alter table events add column if not exists venue_address text;

-- ── dm_threads ───────────────────────────────────────────────
create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dm_threads_ordered check (user_a < user_b),
  constraint dm_threads_unique unique (user_a, user_b)
);

create index if not exists dm_threads_user_a_idx on dm_threads(user_a);
create index if not exists dm_threads_user_b_idx on dm_threads(user_b);

-- ── dm_messages ──────────────────────────────────────────────
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_idx on dm_messages(thread_id, created_at);

-- ── RLS: dm_threads ──────────────────────────────────────────
alter table dm_threads enable row level security;

drop policy if exists "dm_threads_select" on dm_threads;
drop policy if exists "dm_threads_insert" on dm_threads;

create policy "dm_threads_select" on dm_threads
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy "dm_threads_insert" on dm_threads
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- ── RLS: dm_messages ─────────────────────────────────────────
alter table dm_messages enable row level security;

drop policy if exists "dm_messages_select" on dm_messages;
drop policy if exists "dm_messages_insert" on dm_messages;

create policy "dm_messages_select" on dm_messages
  for select using (
    exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

create policy "dm_messages_insert" on dm_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

-- Enable realtime on dm_messages (safe to ignore error if already added)
alter publication supabase_realtime add table dm_messages;

-- ── event_proposals — bot-suggested events awaiting user accept/decline ──
create table if not exists event_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'casual',
  city text not null,
  lat double precision not null,
  lng double precision not null,
  venue_name text,
  venue_address text,
  starts_at timestamptz not null,
  max_attendees int,
  price numeric not null default 0,
  status text not null default 'pending', -- pending | accepted | declined
  created_event_id uuid references events(id),
  created_at timestamptz not null default now()
);

create index if not exists event_proposals_user_idx on event_proposals(user_id, status);

alter table event_proposals enable row level security;

drop policy if exists "event_proposals_select" on event_proposals;
drop policy if exists "event_proposals_update" on event_proposals;

create policy "event_proposals_select" on event_proposals
  for select using (auth.uid() = user_id);

create policy "event_proposals_update" on event_proposals
  for update using (auth.uid() = user_id);

-- Note: inserts to event_proposals happen via the service-role API route only.
