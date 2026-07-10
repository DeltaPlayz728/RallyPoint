-- ============================================================
-- RallyPoint V2 — Pillar 5/6 (numbering per Master Plan): Notification Framework
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §6, Launch Kit Part 5,
--      RallyPoint_V2_EXECUTION_PLAN.md
--
-- This sits ON TOP OF the existing `notifications` table (the live inbox —
-- unchanged, still the delivery row TopBar/inbox page read). This migration
-- adds the framework layer around it: editable copy, per-type priority for
-- the saturation guard, and send/open telemetry.
-- ============================================================

-- ── notification_templates ──────────────────────────────────
-- Copy editable without a deploy. {placeholders} are rendered by lib/notify.ts.
create table if not exists notification_templates (
  id             uuid primary key default gen_random_uuid(),
  type           text not null unique,
  channel        text not null default 'in_app' check (channel in ('in_app','email','both')),
  title_template text not null,
  body_template  text not null,
  link_template  text,  -- e.g. '/events/{event_id}' — {placeholders} rendered same as title/body
  -- Priority governs the saturation-guard tie-break (§6): payment/safety >
  -- event reminders > milestones > social urgency > digest. 'critical'
  -- notifications bypass the daily cap entirely; everything else is subject
  -- to it.
  priority       text not null default 'reminder' check (priority in ('critical','reminder','milestone','social','digest')),
  loop_tag       text not null default 'system' check (loop_tag in ('create','join','share','system')),
  active         boolean not null default true
);

-- ── notification_log ─────────────────────────────────────────
-- Telemetry only — separate from the `notifications` inbox row. Every send
-- attempt logs here, including suppressed ones (saturation cap hit), so
-- open-rate and suppression-rate are both visible per type.
create table if not exists notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,
  channel     text not null default 'in_app',
  suppressed  boolean not null default false,
  sent_at     timestamptz not null default now(),
  opened_at   timestamptz
);

create index if not exists notification_log_user_recent_idx on notification_log(user_id, sent_at desc);

alter table notification_log enable row level security;
drop policy if exists "notification_log_select" on notification_log;

-- Users can see their own send history (not required by any current UI, but
-- harmless and matches the "users can read their own X" pattern used
-- elsewhere — e.g. invite_tokens_select).
create policy "notification_log_select" on notification_log
  for select using (auth.uid() = user_id);

-- No insert/update policy for anon/authenticated — only the service-role
-- notify helper (server routes) and the browser client acting as the
-- *sender* on behalf of another user write here, same trust model as the
-- existing `notifications` table (see note below).


-- ── cron_runs heartbeat ──────────────────────────────────────
-- Every scheduled job writes a row here on start and finish. A missing
-- heartbeat is how you notice a cron silently died — per Master Plan/Game
-- Plan, this is the same table that should eventually also cover the
-- seed-event bot's health, not just these new jobs.
create table if not exists cron_runs (
  id            uuid primary key default gen_random_uuid(),
  job           text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_affected int,
  error         text
);

create index if not exists cron_runs_job_started_idx on cron_runs(job, started_at desc);

alter table cron_runs enable row level security;
-- No policies at all — this table is service-role only, never read/written
-- by the client. (An admin dashboard view can query it later via a
-- service-role-backed API route, same as everything else under /api/admin.)


-- ── event capacity-milestone flags ───────────────────────────
-- Prevents re-notifying on every join once a threshold's already fired
-- (someone joining/leaving/rejoining around the 25%/75% line shouldn't spam
-- the host or attendees repeatedly).
alter table events add column if not exists notified_25pct boolean not null default false;
alter table events add column if not exists notified_75pct boolean not null default false;


-- ── seed: notification_templates ─────────────────────────────
-- Copy from Launch Kit Part 5, in-app channel only for now (no email
-- provider wired up yet — Resend/Postmark is a follow-up, see lib/notify.ts).
insert into notification_templates (type, channel, title_template, body_template, link_template, priority, loop_tag) values
  ('event_published',      'in_app', '{event_name} is live.', 'Share it now — events shared in the first hour fill 3x faster.', '/events/{event_id}', 'reminder', 'create'),
  ('event_no_rsvp_48h',    'in_app', '{event_name} needs a spark.', 'No RSVPs yet — share it to your contacts or post it in a community room. One share usually breaks the seal.', '/events/{event_id}', 'reminder', 'create'),
  ('event_25_capacity',    'in_app', 'It''s happening.', '{event_name} just hit 25% full. {count} people are in.', '/events/{event_id}', 'milestone', 'create'),
  ('rsvp_confirmed',       'in_app', 'You''re in — {event_name}.', '{date_short} at {venue_name}. The group chat is open; say hi.', '/events/{event_id}', 'reminder', 'join'),
  ('event_reminder_24h',   'in_app', 'Tomorrow: {event_name}.', '{time} at {venue_name}. {attendee_count} people going.', '/events/{event_id}', 'reminder', 'join'),
  ('event_reminder_2h',    'in_app', 'Starting soon: {event_name}.', 'Tap for directions.', '/events/{event_id}', 'reminder', 'join'),
  ('invite_converted',     'in_app', 'Your invite worked.', '{friend_name} just joined through your link.', '/profile', 'social', 'share'),
  ('event_75_capacity',    'in_app', '{event_name} is almost full.', '{spots_left} spots left — know someone who''d love this?', '/events/{event_id}', 'social', 'share'),
  ('feedback_prompt',      'in_app', 'How was {event_name}?', '60 seconds of honesty helps the host make the next one better.', '/events/{event_id}', 'reminder', 'system')
on conflict (type) do nothing;
