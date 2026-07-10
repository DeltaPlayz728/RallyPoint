-- ============================================================
-- RallyPoint V2 — Pillar 7 (Feedback Upgrade)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Ref: RallyPoint_V2_Master_Plan_RECONCILED.md §8
--
-- Extends the existing event_ratings table (rating = "overall", already
-- live) rather than creating a parallel event_feedback table — the master
-- plan explicitly prefers extending, and this table already carries the
-- UNIQUE(event_id, user_id) constraint that closes review-bombing from
-- non-attendees, no need to duplicate that.
-- ============================================================

alter table event_ratings add column if not exists venue_score int check (venue_score between 1 and 5);
alter table event_ratings add column if not exists organization_score int check (organization_score between 1 and 5);
alter table event_ratings add column if not exists return_intent boolean;

-- No RLS changes here — event_ratings stays owner-only-select (existing
-- "ratings_select" policy: auth.uid() = user_id). Hosts get access to the
-- aggregate/anonymized view exclusively through the service-role
-- /api/events/[id]/feedback route (see that file for why this can't safely
-- be a client-facing RLS policy: the row itself carries user_id, and RLS
-- can't conditionally hide a single column or shuffle/aggregate rows —
-- exposing raw rows to the host at all would let them match notes to
-- specific attendees, which is exactly what the 5-response anonymity
-- threshold is meant to prevent).
