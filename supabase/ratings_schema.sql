-- ============================================================
-- RallyPoint — Event Ratings Schema
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists event_ratings (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  note       text,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table event_ratings enable row level security;

-- Users can only see their own ratings
create policy "ratings_select" on event_ratings
  for select using (auth.uid() = user_id);

-- Users can only submit their own rating
create policy "ratings_insert" on event_ratings
  for insert with check (auth.uid() = user_id);

-- Users can update their own rating
create policy "ratings_update" on event_ratings
  for update using (auth.uid() = user_id);


-- ── Host reputation view ──────────────────────────────────────
-- Aggregates ratings per host for display on profiles
create or replace view host_reputation as
  select
    e.created_by as host_id,
    count(r.id)::int          as total_ratings,
    round(avg(r.rating), 1)   as avg_rating,
    count(distinct e.id)::int as total_events
  from events e
  left join event_ratings r on r.event_id = e.id
  group by e.created_by;
