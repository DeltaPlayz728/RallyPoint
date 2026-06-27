# Phase 6 & 7 — Subscription Tiers + Revenue Share (DRAFT, needs your decisions)

Written 2026-06-20, overnight autonomous session. This is a proposal, not a
shipped feature — I deliberately did not wire real pricing or Stripe
subscription products without your sign-off. Inventing the actual €/month
numbers and revenue-share % myself isn't something I should freelance on a
real product; that's a business call. Below is a concrete starting proposal
so you can just react to it (keep/change/reject) rather than starting from a
blank page.

## What exists so far
- `supabase/subscriptions_schema.sql` — adds `subscription_tier`,
  `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`,
  `subscription_current_period_end` to `profiles`. Not yet applied to the
  live DB. Safe to run any time (additive, defaults to `'free'`).
- Nothing else yet — no pricing page, no Stripe subscription checkout route,
  no feature gating in the app. See "Why I stopped here" below.

## Proposed tier structure (draft — react, don't assume final)

| Tier | Suggested price | Suggested unlock |
|---|---|---|
| Free | €0 | Everything that exists today: feed, map, RSVP, chat, 1:1 meetups, profile. |
| Go Getter | €4.99/mo | Priority placement in the feed/map for your own events; see who viewed your profile; unlimited 1:1 meetup requests (vs. a free-tier cap, if you want one). |
| Extrovert | €9.99/mo | Everything in Go Getter + advanced filters (vibe/interest match %), read receipts in chat, "boost" one event per week to the top of nearby feeds. |
| Planner | €19.99/mo | Everything above + organizer tools: can host paid (ticketed) events, analytics on attendance/ratings, lower platform fee on ticket sales (see Phase 7). |

This mirrors a fairly standard free/plus/pro ladder. Open questions only you
can answer:
1. Do these price points make sense for your target market (18–30, Breda
   launch)? Early-access page already promises "free to join" — that's
   still true under this proposal (free tier keeps full core functionality).
2. Is "Planner" the *only* tier that can host paid events, or should that be
   a free capability and Planner just lowers the platform fee?
3. Annual pricing / discount?

## Phase 7 — paid-event revenue share (depends on Phase 6 being decided)

Today, `app/api/create-checkout/route.ts` charges the event's full listed
price via Stripe Checkout with no platform cut at all — RallyPoint currently
takes 0%. Phase 7 presumably means RallyPoint keeps a percentage of paid
ticket sales. Open questions:
1. What's the platform fee — flat %, or does it scale down by tier (e.g.
   free organizers pay a higher % than Planner-tier organizers, as a perk)?
2. Stripe Connect (split the payment automatically at checkout, organizer
   gets paid out directly) vs. RallyPoint collects 100% via the existing
   Stripe account and pays organizers out manually/later? Connect is the
   standard approach for marketplace-style payouts but requires onboarding
   each organizer to Stripe Connect (KYC) — bigger lift, but the "right"
   long-term answer. Manual payout is faster to ship but doesn't scale and
   means you're personally responsible for sending people money.

## Why I stopped here instead of building the full checkout flow

- These are genuine pricing/business decisions, not engineering ones — I
  didn't want to silently ship monetization terms you haven't approved.
- I also can't run `npx tsc --noEmit` or `npm run build` from tonight's
  sandbox session to verify new code compiles (see the caching bug noted in
  PROGRESS.md's update below) — for something as sensitive as a payment
  flow, I'd rather hand you a clean spec than untested code with real Stripe
  calls in it.
- Stripe subscription *Products*/*Prices* need to be created in your Stripe
  dashboard (test mode is fine to start) before any checkout code can
  reference real price IDs — that's an account action I left for you rather
  than logging into your Stripe account myself overnight.

## Suggested next step
Reply with which parts of the table above you want to keep vs. change, and
an answer on the Phase 7 fee/Connect question. Once that's settled I (or a
future session) can build the actual pricing page, Stripe subscription
checkout route, and feature-gating middleware in an afternoon.
