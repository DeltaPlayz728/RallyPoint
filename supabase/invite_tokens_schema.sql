-- ============================================================
-- RallyPoint V2 — Pillar 1: Share / Referral Engine
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §2, RallyPoint_V2_EXECUTION_PLAN.md
-- ============================================================

-- ── invite_tokens ───────────────────────────────────────────
-- One row per share action. token rides the URL as ?ref=<token>.
create table if not exists invite_tokens (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid not null references profiles(id) on delete cascade,
  event_id       uuid references events(id) on delete cascade,
  community_id   uuid,  -- FK added when the communities table ships (§3) — nullable, unused for now
  token          text not null unique,
  recipient_hash text,
  created_at     timestamptz not null default now(),
  converted_at   timestamptz,
  reward_issued  boolean not null default false
);

create index if not exists invite_tokens_created_by_idx on invite_tokens(created_by);
create index if not exists invite_tokens_token_idx on invite_tokens(token);
create index if not exists invite_tokens_event_id_idx on invite_tokens(event_id) where event_id is not null;

alter table invite_tokens enable row level security;

drop policy if exists "invite_tokens_select" on invite_tokens;
drop policy if exists "invite_tokens_insert" on invite_tokens;

-- Users can see their own minted tokens (e.g. a future "my invites" screen)
create policy "invite_tokens_select" on invite_tokens
  for select using (auth.uid() = created_by);

-- Users can only mint tokens attributed to themselves
create policy "invite_tokens_insert" on invite_tokens
  for insert with check (auth.uid() = created_by);

-- No update/delete policy for anon/authenticated roles on purpose — conversion
-- writes (converted_at, reward_issued) only ever happen via the service-role
-- key inside app/api/referral/convert, never from the client. This is the
-- concrete enforcement of "conversion is written server-side, never client-side."


-- ── profiles.referral_count ─────────────────────────────────
alter table profiles add column if not exists referral_count int not null default 0;


-- ── referral_milestones ──────────────────────────────────────
-- Idempotent ledger of which cosmetic milestones a user has already crossed,
-- so the (single) conversion endpoint can safely run concurrently without
-- double-issuing a badge — the unique constraint is the race guard, no cron
-- required for this part. (Master Plan calls for a daily cron specifically to
-- avoid inline recomputation races; here the "computation" is a single atomic
-- increment + a unique-constrained insert, which is race-safe by construction.)
create table if not exists referral_milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  milestone   int not null,
  reached_at  timestamptz not null default now(),
  unique(user_id, milestone)
);

alter table referral_milestones enable row level security;

drop policy if exists "referral_milestones_select" on referral_milestones;

-- Users can read their own milestone badges (profile display)
create policy "referral_milestones_select" on referral_milestones
  for select using (auth.uid() = user_id);

-- No insert policy for anon/authenticated — only the service-role conversion
-- endpoint writes these rows.


-- ── atomic increment function ────────────────────────────────
-- Used by the conversion endpoint so referral_count++ and the milestone
-- check happen against a single locked row, closing the race window between
-- "read count" and "write count" that a naive select-then-update would have.
create or replace function increment_referral_count(p_user_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update profiles
  set referral_count = referral_count + 1
  where id = p_user_id
  returning referral_count;
$$;

-- Lock this down like the other internal RPCs (see PROGRESS.md — anon-callable
-- SECURITY DEFINER RPCs were a CRITICAL finding in the security probe). Only
-- the service role should ever call this.
revoke execute on function increment_referral_count(uuid) from public, anon, authenticated;
