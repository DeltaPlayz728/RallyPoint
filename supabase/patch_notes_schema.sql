-- ============================================================
-- RallyPoint V2 — Pillar 10 (Patch Note System)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §11
--
-- NOTE: this is separate from the existing lib/changelog.ts +
-- WhatsNewModal.tsx — that's a lightweight, code-deployed, device-local
-- "what's new" popup that already works fine and isn't touched here. This
-- migration adds the DB-backed, severity-aware, notification-framework-
-- integrated system the V2 plan calls for: publishable without a redeploy,
-- with a critical-severity banner and (once an email provider is wired up)
-- a weekly digest.
-- ============================================================

create table if not exists patch_notes (
  id             uuid primary key default gen_random_uuid(),
  version        text not null,
  title          text not null,
  body_markdown  text not null,
  severity       text not null default 'standard' check (severity in ('minor','standard','critical')),
  published_at   timestamptz not null default now(),
  notify_in_app  boolean not null default true,
  notify_email   boolean not null default true
);

create index if not exists patch_notes_published_idx on patch_notes(published_at desc);

alter table patch_notes enable row level security;
drop policy if exists "patch_notes_select" on patch_notes;
-- Public read — every signed-in user needs to see these, and there's
-- nothing sensitive in release notes.
create policy "patch_notes_select" on patch_notes
  for select using (true);
-- No insert/update/delete policy for anon/authenticated — publishing is an
-- admin-only action via /api/admin/patch-notes (service role).


create table if not exists user_patch_reads (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  patch_id  uuid not null references patch_notes(id) on delete cascade,
  read_at   timestamptz not null default now(),
  unique(user_id, patch_id)
);

alter table user_patch_reads enable row level security;

drop policy if exists "user_patch_reads_select" on user_patch_reads;
drop policy if exists "user_patch_reads_insert" on user_patch_reads;

create policy "user_patch_reads_select" on user_patch_reads
  for select using (auth.uid() = user_id);

create policy "user_patch_reads_insert" on user_patch_reads
  for insert with check (auth.uid() = user_id);


-- Lets a user turn off the (future) weekly email digest without affecting
-- the critical in-app banner, which per the spec can't be turned off.
alter table profiles add column if not exists patch_email_opt_out boolean not null default false;


-- Patch notes ride the existing notification framework (lib/notify.ts) —
-- one more template row, same trigger map/saturation-cap machinery already
-- built for Pillar 2.
insert into notification_templates (type, channel, title_template, body_template, link_template, priority, loop_tag) values
  ('patch_note', 'in_app', '{title}', 'Tap to read what changed.', '/patch-notes', 'reminder', 'system')
on conflict (type) do nothing;
