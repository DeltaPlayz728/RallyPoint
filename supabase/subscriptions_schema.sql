-- Phase 6 scaffolding: subscription tiers (Go Getter / Extrovert / Planner)
-- Drafted 2026-06-20 overnight session. NOT YET APPLIED to the live DB.
--
-- This is infrastructure only — it does not encode final pricing or feature
-- gating, both of which are product decisions for John to make (see
-- PHASE_6_7_DRAFT.md in the repo root for the open questions). Safe to apply
-- any time since it only adds nullable/defaulted columns; it doesn't change
-- existing behavior until the app code actually reads these fields.

alter table profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'go_getter', 'extrovert', 'planner')),
  add column if not exists subscription_status text
    check (subscription_status in ('active', 'past_due', 'canceled', 'incomplete') or subscription_status is null),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_current_period_end timestamptz;

-- Lets a user (or service role) read their own subscription state — same
-- pattern as the rest of the profiles RLS. No new policy needed if profiles
-- already has a "select own row" policy; double-check with:
--   select * from pg_policies where tablename = 'profiles';

create index if not exists idx_profiles_stripe_customer_id on profiles (stripe_customer_id);

-- Phase 7 (revenue share) will likely need a column on `events` recording
-- what cut RallyPoint takes on a paid event hosted by a Planner-tier
-- organizer, e.g.:
--   alter table events add column if not exists platform_fee_bps integer;
-- Left out for now since the revenue-share % itself is an open business
-- decision (see PHASE_6_7_DRAFT.md) — adding the column before the number
-- is decided risks shipping a silently-wrong default.
