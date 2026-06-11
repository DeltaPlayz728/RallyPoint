-- ============================================================
-- RallyPoint — Friend System Schema
-- Run in Supabase SQL Editor
-- ============================================================

drop table if exists friendships cascade;

create table friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (requester_id, receiver_id)
);

-- Index for fast lookups from either side
create index if not exists friendships_requester on friendships(requester_id);
create index if not exists friendships_receiver  on friendships(receiver_id);

-- RLS
alter table friendships enable row level security;

-- Either party can see the friendship
create policy "friendships_select" on friendships
  for select using (
    auth.uid() = requester_id or auth.uid() = receiver_id
  );

-- Only the requester can send a request
create policy "friendships_insert" on friendships
  for insert with check (auth.uid() = requester_id);

-- Only the receiver can accept/decline; requester can cancel (delete)
create policy "friendships_update" on friendships
  for update using (auth.uid() = receiver_id);

create policy "friendships_delete" on friendships
  for delete using (
    auth.uid() = requester_id or auth.uid() = receiver_id
  );

-- Auto-update updated_at
create or replace function update_friendship_timestamp()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_friendship_updated_at on friendships;
create trigger trg_friendship_updated_at
  before update on friendships
  for each row execute function update_friendship_timestamp();
