-- ============================================================
-- RallyPoint — Waitlist Schema
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  city       text,
  referrer   text,
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

-- Anyone can insert (public signup form)
create policy "waitlist_insert" on waitlist
  for insert with check (true);

-- Only service role can read (admin only)
