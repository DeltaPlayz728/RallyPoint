-- ============================================================
-- RallyPoint — Full RLS Policy Audit
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
alter table profiles enable row level security;

drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_update" on profiles;

-- Anyone logged in can read profiles (needed for event attendee lists)
create policy "profiles_select" on profiles
  for select using (auth.role() = 'authenticated');

-- Only the owner can update their own profile
create policy "profiles_update" on profiles
  for update using (auth.uid() = id);


-- ── events ──────────────────────────────────────────────────
alter table events enable row level security;

drop policy if exists "events_select" on events;
drop policy if exists "events_insert" on events;
drop policy if exists "events_update" on events;
drop policy if exists "events_delete" on events;

-- Anyone logged in can read active events; hosts can always read their own
-- (otherwise a host loses all access to their event the instant they cancel it —
-- the event detail page's lookup-by-id starts returning 0 rows and bounces them away)
create policy "events_select" on events
  for select using (
    auth.role() = 'authenticated' and (status = 'active' or auth.uid() = created_by)
  );

-- Any logged-in user can create an event
create policy "events_insert" on events
  for insert with check (auth.uid() = created_by);

-- Only the host can update their own event
create policy "events_update" on events
  for update using (auth.uid() = created_by);

-- Only the host can delete (soft delete preferred — set status = 'cancelled')
create policy "events_delete" on events
  for delete using (auth.uid() = created_by);


-- ── event_attendees ─────────────────────────────────────────
alter table event_attendees enable row level security;

drop policy if exists "attendees_select" on event_attendees;
drop policy if exists "attendees_insert" on event_attendees;
drop policy if exists "attendees_delete" on event_attendees;

-- Anyone logged in can see who's attending (needed for event detail page)
create policy "attendees_select" on event_attendees
  for select using (auth.role() = 'authenticated');

-- Users can only insert their own attendance
create policy "attendees_insert" on event_attendees
  for insert with check (auth.uid() = user_id);

-- Users can only remove themselves (hosts remove others via service role)
create policy "attendees_delete" on event_attendees
  for delete using (auth.uid() = user_id);


-- ── event_chats ─────────────────────────────────────────────
alter table event_chats enable row level security;

drop policy if exists "chats_select" on event_chats;
drop policy if exists "chats_insert" on event_chats;

-- Only event attendees can see the chat room
create policy "chats_select" on event_chats
  for select using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from event_attendees
      where event_attendees.event_id = event_chats.event_id
        and event_attendees.user_id = auth.uid()
    )
  );

-- Service role handles insert (via webhook + join flow) — no direct user insert
create policy "chats_insert" on event_chats
  for insert with check (false);


-- ── messages ─────────────────────────────────────────────────
alter table messages enable row level security;

drop policy if exists "messages_select" on messages;
drop policy if exists "messages_insert" on messages;
drop policy if exists "messages_delete" on messages;

-- Only attendees of the event can read messages
create policy "messages_select" on messages
  for select using (
    exists (
      select 1 from event_attendees ea
      join event_chats ec on ec.event_id = ea.event_id
      where ec.id = messages.chat_id
        and ea.user_id = auth.uid()
    )
  );

-- Only attendees can send messages
create policy "messages_insert" on messages
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from event_attendees ea
      join event_chats ec on ec.event_id = ea.event_id
      where ec.id = messages.chat_id
        and ea.user_id = auth.uid()
    )
  );

-- Users can only delete their own messages
create policy "messages_delete" on messages
  for delete using (auth.uid() = user_id);


-- ── meetup_requests ──────────────────────────────────────────
alter table meetup_requests enable row level security;

drop policy if exists "meetup_select" on meetup_requests;
drop policy if exists "meetup_insert" on meetup_requests;
drop policy if exists "meetup_update" on meetup_requests;

-- Only sender or receiver can see the request
create policy "meetup_select" on meetup_requests
  for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

-- Only the sender can create a request
create policy "meetup_insert" on meetup_requests
  for insert with check (auth.uid() = sender_id);

-- Only the receiver can update status (accept/decline)
create policy "meetup_update" on meetup_requests
  for update using (auth.uid() = receiver_id);


-- ── notifications ────────────────────────────────────────────
alter table notifications enable row level security;

drop policy if exists "notifs_select" on notifications;
drop policy if exists "notifs_update" on notifications;

-- Users can only see their own notifications
create policy "notifs_select" on notifications
  for select using (auth.uid() = user_id);

-- Users can mark their own as read
create policy "notifs_update" on notifications
  for update using (auth.uid() = user_id);


-- ── venues (cache table) ─────────────────────────────────────
alter table venues enable row level security;

drop policy if exists "venues_select" on venues;

-- Anyone logged in can read venue cache
create policy "venues_select" on venues
  for select using (auth.role() = 'authenticated');

-- Only service role can write venue cache (API route uses service role key)
-- No insert/update policy = only service_role bypasses RLS to write


-- ── payments ─────────────────────────────────────────────────
create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  event_id          uuid not null references events(id) on delete cascade,
  stripe_session_id text not null unique,
  amount            numeric not null,
  currency          text not null default 'eur',
  status            text not null default 'paid',
  created_at        timestamptz default now()
);

alter table payments enable row level security;

drop policy if exists "payments_select" on payments;

-- Users can only see their own payment records
create policy "payments_select" on payments
  for select using (auth.uid() = user_id);

-- Only webhook (service role) inserts payments — no direct user insert policy
