-- ============================================================
-- RallyPoint V2 — Pillar 4/5 (Reputation + Accommodations)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §4/§5, Launch Kit Part 3
-- ============================================================

-- ── reputation_events (append-only ledger) ───────────────────
-- The load-bearing design choice here: rows are written ONLY by DB triggers
-- on the tables that already are the source of truth for these actions
-- (event_attendees, events, event_ratings, reports) — never by app code and
-- never by a client insert. That makes the ledger genuinely tamper-proof
-- (nobody can insert a fake "I attended 1000 events" row) and means the
-- daily recompute cron can rebuild any user's score from nothing but this
-- table + their current profile fields — the actual definition of
-- "recomputable from history" the master plan calls for.
create table if not exists reputation_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('event_attended','event_hosted','positive_rating','endorsement_received','report_upheld')),
  source_id   uuid,
  created_at  timestamptz not null default now()
);

create index if not exists reputation_events_user_signal_idx on reputation_events(user_id, signal_type);

alter table reputation_events enable row level security;
drop policy if exists "reputation_events_select" on reputation_events;
create policy "reputation_events_select" on reputation_events
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy for anon/authenticated — triggers below run
-- as the table owner (SECURITY DEFINER) regardless of RLS, which is exactly
-- the point: the client can never write here directly.


-- ── reputation_scores ─────────────────────────────────────────
create table if not exists reputation_scores (
  user_id          uuid primary key references profiles(id) on delete cascade,
  raw_score        numeric not null default 0,
  display_tier     text not null default 'New Explorer',
  last_computed_at timestamptz not null default now()
);

alter table reputation_scores enable row level security;
drop policy if exists "reputation_scores_select" on reputation_scores;
-- Publicly readable — the whole point is other users see your tier. Never
-- exposes raw_score in the UI (client code's choice, not an RLS concern),
-- but there's nothing sensitive in the number itself either.
create policy "reputation_scores_select" on reputation_scores
  for select using (true);
-- No insert/update policy for anon/authenticated — only the daily cron
-- (service role) writes this table.


-- ── Ledger-writing triggers ───────────────────────────────────

create or replace function log_reputation_event_attended()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into reputation_events (user_id, signal_type, source_id) values (new.user_id, 'event_attended', new.event_id);
  return new;
end;
$$;
drop trigger if exists trg_reputation_event_attended on event_attendees;
create trigger trg_reputation_event_attended
  after insert on event_attendees
  for each row execute function log_reputation_event_attended();

create or replace function log_reputation_event_hosted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into reputation_events (user_id, signal_type, source_id) values (new.created_by, 'event_hosted', new.id);
  return new;
end;
$$;
drop trigger if exists trg_reputation_event_hosted on events;
create trigger trg_reputation_event_hosted
  after insert on events
  for each row execute function log_reputation_event_hosted();

-- "Positive" = 4 or 5 stars. Ratings are given about a host's event, so the
-- signal credits the event's host, not the rater.
create or replace function log_reputation_positive_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  host_id uuid;
begin
  if new.rating >= 4 then
    select created_by into host_id from events where id = new.event_id;
    if host_id is not null then
      insert into reputation_events (user_id, signal_type, source_id) values (host_id, 'positive_rating', new.event_id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reputation_positive_rating on event_ratings;
create trigger trg_reputation_positive_rating
  after insert on event_ratings
  for each row execute function log_reputation_positive_rating();

-- Reports: only fires the FIRST time a report against this user flips to
-- 'actioned' (not on every unrelated status update to the row).
create or replace function log_reputation_report_upheld()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'user' and new.status = 'actioned' and (old.status is distinct from 'actioned') then
    insert into reputation_events (user_id, signal_type, source_id) values (new.target_id, 'report_upheld', new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reputation_report_upheld on reports;
create trigger trg_reputation_report_upheld
  after update on reports
  for each row execute function log_reputation_report_upheld();


-- ── accommodation_types ───────────────────────────────────────
create table if not exists accommodation_types (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  icon_url             text,
  milestone_thresholds int[] not null default '{5,25,100}',
  created_by_community uuid references communities(id),
  approved             boolean not null default true,
  is_platform_default  boolean not null default true
);

alter table accommodation_types enable row level security;
drop policy if exists "accommodation_types_select" on accommodation_types;
create policy "accommodation_types_select" on accommodation_types
  for select using (approved = true);
-- No insert policy — community-created accommodation types are
-- feature-flagged off per the master plan (moderation capacity isn't there
-- yet); only platform defaults, seeded below, exist for now.


-- ── user_accommodations ──────────────────────────────────────
create table if not exists user_accommodations (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles(id) on delete cascade,
  accommodation_type_id  uuid not null references accommodation_types(id) on delete cascade,
  endorsement_count      int not null default 0,
  current_milestone      int not null default 0,
  display_selected       boolean not null default false,
  unique(user_id, accommodation_type_id)
);

alter table user_accommodations enable row level security;

drop policy if exists "user_accommodations_select" on user_accommodations;
drop policy if exists "user_accommodations_update" on user_accommodations;

-- Public — these are meant to show on profiles.
create policy "user_accommodations_select" on user_accommodations
  for select using (true);

-- Owner can update their own row (to toggle display_selected) — a trigger
-- below blocks them from also editing endorsement_count/current_milestone
-- through the same door, same lockdown pattern used for community banners.
create policy "user_accommodations_update" on user_accommodations
  for update using (auth.uid() = user_id);

create or replace function block_direct_accommodation_count_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if new.endorsement_count is distinct from old.endorsement_count
      or new.current_milestone is distinct from old.current_milestone then
      raise exception 'endorsement_count/current_milestone can only change via an endorsement';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_accommodation_count_lock on user_accommodations;
create trigger enforce_accommodation_count_lock
  before update on user_accommodations
  for each row execute function block_direct_accommodation_count_edit();

-- Display limit: at most 3 selected accommodations, enforced at the DB
-- layer (not just UI) — a partial unique-ish check isn't expressible as a
-- CHECK constraint across rows, so this is a trigger too.
create or replace function enforce_display_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_selected = true then
    if (select count(*) from user_accommodations where user_id = new.user_id and display_selected = true and id <> new.id) >= 3 then
      raise exception 'Only 3 accommodations can be displayed at once — deselect one first';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_accommodation_display_limit on user_accommodations;
create trigger enforce_accommodation_display_limit
  before update on user_accommodations
  for each row execute function enforce_display_limit();


-- ── endorsements ──────────────────────────────────────────────
-- Note on cadence: the master plan's prose says "one endorsement per person,
-- per accommodation type, per 30 days," but its own schema (reproduced
-- here) has a lifetime UNIQUE(endorser,recipient,type) with no time
-- dimension — a permanent unique constraint already makes re-endorsing the
-- same pairing+type impossible at all, not just within 30 days, which is
-- the simpler and safer reading, so that's what's enforced. Growth comes
-- from *different* endorsers giving the same accommodation, not repeats.
create table if not exists endorsements (
  id                    uuid primary key default gen_random_uuid(),
  endorser_id           uuid not null references profiles(id) on delete cascade,
  recipient_id          uuid not null references profiles(id) on delete cascade,
  accommodation_type_id uuid not null references accommodation_types(id) on delete cascade,
  created_at            timestamptz not null default now(),
  unique(endorser_id, recipient_id, accommodation_type_id)
);

alter table endorsements enable row level security;

drop policy if exists "endorsements_select" on endorsements;
drop policy if exists "endorsements_insert" on endorsements;

create policy "endorsements_select" on endorsements
  for select using (true);

-- Co-attendance requirement enforced at the DB layer: endorser and
-- recipient must share at least one event_attendees row for some event —
-- this structurally kills endorsement rings between strangers who've never
-- actually been in a room together, per the master plan's design rule.
create policy "endorsements_insert" on endorsements
  for insert with check (
    auth.uid() = endorser_id
    and endorser_id <> recipient_id
    and exists (
      select 1 from event_attendees ea1
      join event_attendees ea2 on ea1.event_id = ea2.event_id
      where ea1.user_id = endorser_id and ea2.user_id = recipient_id
    )
  );

-- After an endorsement lands, atomically bump (or create) the recipient's
-- user_accommodations row and log the reputation ledger event — both in one
-- trigger so there's no window where an endorsement exists but isn't
-- reflected in either place.
create or replace function bump_user_accommodation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_count int;
  thresholds int[];
  new_milestone int := 0;
  t int;
begin
  insert into user_accommodations (user_id, accommodation_type_id, endorsement_count)
  values (new.recipient_id, new.accommodation_type_id, 1)
  on conflict (user_id, accommodation_type_id)
  do update set endorsement_count = user_accommodations.endorsement_count + 1
  returning endorsement_count into new_count;

  select milestone_thresholds into thresholds from accommodation_types where id = new.accommodation_type_id;
  if thresholds is not null then
    foreach t in array thresholds loop
      if new_count >= t then new_milestone := t; end if;
    end loop;
  end if;

  update user_accommodations set current_milestone = new_milestone
    where user_id = new.recipient_id and accommodation_type_id = new.accommodation_type_id;

  insert into reputation_events (user_id, signal_type, source_id) values (new.recipient_id, 'endorsement_received', new.id);

  return new;
end;
$$;
drop trigger if exists trg_bump_user_accommodation on endorsements;
create trigger trg_bump_user_accommodation
  after insert on endorsements
  for each row execute function bump_user_accommodation();


-- ── seed: 25 platform-default accommodation types ────────────
-- Copy from Launch Kit Part 3.
insert into accommodation_types (name, milestone_thresholds) values
  ('Professional Planner', '{5,25,100}'),
  ('Detail Master', '{5,25,100}'),
  ('Smooth Operator', '{5,25,100}'),
  ('Venue Whisperer', '{5,25,100}'),
  ('Fair Referee', '{5,25,100}'),
  ('Punctual Host', '{5,25,100}'),
  ('Budget Wizard', '{5,25,100}'),
  ('Comeback King/Queen', '{5,25,100}'),
  ('Certified Extrovert', '{5,25,100}'),
  ('Always On Time', '{5,25,100}'),
  ('Great First Impression', '{5,25,100}'),
  ('Deep Talker', '{5,25,100}'),
  ('Good Sport', '{5,25,100}'),
  ('Reliable RSVP', '{5,25,100}'),
  ('Positive Energy', '{5,25,100}'),
  ('Awesome Listener', '{5,25,100}'),
  ('Hype Machine', '{5,25,100}'),
  ('Connector', '{5,25,100}'),
  ('Safe Space Creator', '{5,25,100}'),
  ('Newcomer''s Guide', '{5,25,100}'),
  ('Photographer', '{5,25,100}'),
  ('Snack Legend', '{5,25,100}'),
  ('Group Glue', '{5,25,100}'),
  ('Local Legend', '{5,25,100}'),
  ('Founding Spirit', '{1,5,10}')
on conflict (name) do nothing;
