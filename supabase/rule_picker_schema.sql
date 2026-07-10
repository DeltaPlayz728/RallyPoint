-- ============================================================
-- RallyPoint V2 — Pillar 9 (Event Posting Revamp): Rule Picker
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §10, Launch Kit Part 4
-- ============================================================

-- ── rule_templates ────────────────────────────────────────────
-- Platform-defined rule chips a host toggles at event creation instead of
-- writing free-text rules. Read by anyone (including anon on the public
-- /e/[id] share page) — this is non-sensitive reference config, not user data.
create table if not exists rule_templates (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null check (category in ('age','byob','dress_code','photography','refund','behavior')),
  key                text not null unique, -- stable slug, e.g. 'age_18' — used by app code, not just a display id
  title              text not null,
  body_text          text not null,
  is_platform_default boolean not null default true,
  active             boolean not null default true
);

alter table rule_templates enable row level security;
drop policy if exists "rule_templates_select" on rule_templates;
create policy "rule_templates_select" on rule_templates
  for select using (true);
-- No insert/update/delete policy for anon/authenticated — template
-- authoring is an admin/service-role action (community-authored templates,
-- per the master plan, are feature-flagged off until moderation capacity
-- scales, so there's no user-facing write path to this table yet).


-- ── event_rules ───────────────────────────────────────────────
-- One row per rule attached to an event. rule_template_id set + custom_text
-- set means "this template, host-edited wording." rule_template_id null +
-- custom_text set would mean a fully custom rule (not exposed in the UI yet,
-- but the schema allows it per the master plan's "null = custom" note).
create table if not exists event_rules (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  rule_template_id uuid references rule_templates(id),
  custom_text      text,
  position         int not null default 0
);

create index if not exists event_rules_event_id_idx on event_rules(event_id);

alter table event_rules enable row level security;

drop policy if exists "event_rules_select" on event_rules;
drop policy if exists "event_rules_insert" on event_rules;
drop policy if exists "event_rules_delete" on event_rules;

-- Rules are exactly as public as the event itself is meant to be — the
-- public /e/[id] teaser shows them to logged-out visitors on purpose (rules
-- carry no sensitive info, unlike the exact address), so this is a public
-- read, same posture as rule_templates above.
create policy "event_rules_select" on event_rules
  for select using (true);

-- Only the event's host can attach rules to it (mirrors events_insert/update:
-- auth.uid() = created_by, checked via a subquery against events).
create policy "event_rules_insert" on event_rules
  for insert with check (
    exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid())
  );

create policy "event_rules_delete" on event_rules
  for delete using (
    exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid())
  );


-- ── seed: rule_templates ──────────────────────────────────────
-- Copy from Launch Kit Part 4.
insert into rule_templates (category, key, title, body_text) values
  ('age', 'age_18',    '18+ only',        '18+ event. Age is checked against your profile at RSVP.'),
  ('age', 'age_all',   'All ages',        'All ages welcome. Under-16s bring an adult.'),
  ('age', 'age_21',    '21+ only',        '21+ only (venue policy).'),

  ('byob', 'byob_yes',        'BYOB',              'BYOB — bring what you like, share if you''re feeling generous.'),
  ('byob', 'byob_no',         'No outside drinks', 'No outside drinks — the venue sells their own.'),
  ('byob', 'snacks_potluck',  'Potluck',           'Potluck style: bring one thing to share. Coordinate in the event chat.'),
  ('byob', 'alcohol_free',    'Alcohol-free',      'Alcohol-free event, on purpose. Great vibes only.'),

  ('dress_code', 'dress_casual', 'Come as you are', 'Come as you are.'),
  ('dress_code', 'dress_active', 'Activewear',       'Activewear + shoes you can move in.'),
  ('dress_code', 'dress_theme',  'Themed',           'Themed! Check the description — effort is appreciated, costumes optional.'),
  ('dress_code', 'dress_smart',  'Smart casual',     'Smart casual — the venue cares even if we don''t.'),

  ('photography', 'photo_ok',   'Photos welcome', 'Photos welcome. Tag the event if you post!'),
  ('photography', 'photo_ask',  'Ask first',       'Ask before photographing people. Group shots announced in advance.'),
  ('photography', 'photo_none', 'No photos',       'No-photo event. What happens here stays here.'),

  ('refund', 'refund_48h',     'Refund up to 48h',   'Full refund up to 48 hours before start. After that, tickets are transferable — post in the event chat.'),
  ('refund', 'refund_anytime', 'Refund any time',    'Full refund any time before the event starts. Zero risk to say yes.'),
  ('refund', 'refund_none',    'No refunds',         'No refunds — the venue is prepaid per head. Tickets are transferable.'),

  ('behavior', 'behave_standard', 'Be cool',          'Be cool. Respect people, respect the venue. Hosts can remove anyone — RallyPoint''s report system applies here like everywhere.'),
  ('behavior', 'behave_newbie',   'Newcomer-friendly','Newcomer-friendly: if you see someone standing alone, that''s your cue.'),
  ('behavior', 'behave_quiet',   'Low-key',          'Low-key event. Loud is for other nights.')
on conflict (key) do nothing;
