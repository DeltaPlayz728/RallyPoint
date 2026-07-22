# RallyPoint — Progress / Handoff

Last updated: 2026-07-04

Source of truth for current state. Session-by-session history (June 2026) lives in `PROGRESS_ARCHIVE.md` — don't load it unless you need historical detail. The auto-memory `MEMORY.md` index loads automatically each session and is the fastest orientation; `MASTER_PROMPT.md` is an optional fuller cold-start brief (no need to read it every session).

## Most recent work (2026-07-04)

**Map system overhaul (this is now the map "core"):**
- Swapped Leaflet → **MapLibre GL JS**. Light style = OpenFreeMap, dark = Carto dark-matter (both keyless); optional MapTiler via `NEXT_PUBLIC_MAPTILER_KEY`. Markers are DOM overlays so they survive `setStyle` when the theme toggles. See `components/MapView.tsx`.
- **Crowdsourced global venues:** `app/api/venues/route.ts` now pulls real POIs from the OpenStreetMap **Overpass API** (keyless) around any user's location worldwide, caching them into a new `cached_venues` table. (The old `venues` table has no lat/lng and is reserved for owner-registered hubs — that mismatch was why venue pins silently failed before.) Coverage grows as users open the app in new areas.
- **Event Hubs:** select venue categories (bowling, cinema, amusement park, stadium, night club) render as Snapchat-style circular "ping" pins that pulse when they have live events. The hub panel lists events happening AT that establishment plus a "Host an event here" CTA. Curated for v1 (no owner self-registration yet).
- **Discovery tabs** on `/map` (all / trending / popular / visited / liked), a **friends-attending badge** on event sheets, and per-user venue likes (`venue_likes` table, RLS user-scoped).

**Payments (Stripe):**
- Subscription Price objects created via the Stripe plugin (test mode). Tiers/prices in `lib/subscription.ts`; Stripe price IDs read from `NEXT_PUBLIC_STRIPE_PRICE_*` env vars.
- **Playtest unlock:** `hasFeature()` returns true for everything while `NEXT_PUBLIC_PLAYTEST_MODE !== 'false'`, so testers get Communities + all tier-locked tools free WITHOUT altering the tier→feature map (`FEATURE_MIN_TIER` is untouched, so Founders Edition perks stay intact). Gating re-engages when PLAYTEST_MODE is set to `false` at launch.

**GDPR (EU-launch legal blocker — done):**
- `app/api/account/export` downloads all of a user's data as JSON; `app/api/account/delete` clears the FK blockers via the `prepare_user_deletion()` DB function, then deletes the auth user so the rest cascades. Wired to a "Data & privacy" section in `app/settings/page.tsx`.

**Security hardening (Fable find-and-fix pass):**
- Found + fixed a **HIGH billing-portal IDOR** (`create-billing-portal` trusted `userId` from the body with no session check → anyone could open/cancel another user's Stripe portal). Added `requireMatchingUser` guards to `create-billing-portal`, `create-subscription-checkout`, `create-checkout`, plus a UUID-format check on `friends` `receiverId` (a `.or()` filter-injection surface). Committed as `86a76a2`.
- Known follow-up (not done yet): the Stripe/checkout routes return raw `err.message` to the client — worth a "generic message to client, log detail server-side" pass.

**Also since 2026-06-30:** geo-scoping for events (`lib/geo.ts`); an 18+ age-siloing scaffold (`lib/ageGating.ts`, OFF by default); a DB-advisor cleanup (RLS `(select auth.uid())` wrapping, permissive-policy consolidation, rate-limit triggers on events/messages/meetup_requests).

## Git state
All of the above is committed and pushed — HEAD `86a76a2`. Nothing pending.

## Still open (near-term)
- **Security probe — DONE (2026-07-05).** Fixed a CRITICAL: internal `SECURITY DEFINER` RPCs (`prepare_user_deletion`, `seed_test_data`, `teardown_test_data`) were anon-callable via `/rest/v1/rpc`; locked down with migration `lockdown_definer_functions_from_client_roles`. RLS isolation verified sound. A true high-volume load sim still needs Pro (throwaway branch).
- **Trailer render** — deferred to a fresh art-only agent (see `TRAILER_AGENT_HANDOFF.md`).
- Flip `NEXT_PUBLIC_PLAYTEST_MODE=false` + activate live Stripe at launch.

## What RallyPoint is
A social app for spontaneous, low-pressure real-world meetups (casual hangouts, pickup sports, organizer-run events). Stack: Next.js (App Router) + Supabase (Postgres, Auth, RLS) + Stripe + Vercel. Deployed at https://rally-point-eb1q.vercel.app, auto-deploys from GitHub on push.

## Current phase
Phase 3 (end-to-end smoke test) → Phase 4 (launch polish). Phase 5 (public launch) is deliberately on hold pending John's go-ahead (the `/early-access` waitlist is intentional).

## Standing workflow rules (don't relearn the hard way)
- John runs all git from his own machine; the sandbox has no credentials. Always hand off exact commands.
- **Sandbox bash serves stale/truncated file content after Edit/Write.** Don't trust `npx tsc` / `npm run build` from bash — it produces phantom errors (e.g. "unclosed JSX") in files that are actually fine. Verify edits with the Read tool, or have John build on his machine.
- No emoji in the app — use lucide-react icons. lucide has no brand/logo icons (use Camera/Music/Ghost as stand-ins; importing a non-existent icon breaks the build).
- Design language "Bold & Expressive": `border-2 border-black`, `rounded-3xl` cards, rotated accent badges, solid decorative blobs. Cream/black theme, accent orange (`--accent` #f97316; Tailwind v4 `@theme`, so `bg-accent/10` opacity works via color-mix).
- Keep `Cache-Control: private, no-store, must-revalidate` (middleware) on all app pages.
- Pricing (Phase 6/7) is John's call — see `PHASE_6_7_DRAFT.md`; don't treat draft numbers as approved.

## What's still blocked on you (not actionable by an agent)
- #27: Google Places API key (OPTIONAL now — the map runs on keyless Overpass/OpenStreetMap; a Places key would only add richer venue metadata/photos).
- #30: Rotate the Stripe keys (flagged compromised in an earlier session).
- #71: Anthropic API key (assistant bot runs in template mode — deliberate, deferred to launch).
- #83: Register the business + activate live Stripe.
- React to `PHASE_6_7_DRAFT.md` pricing.

## Files worth knowing about
- `lib/adminAuth.ts` — admin-only auth check for `/api/admin/*`.
- `lib/sessionAuth.ts` — session-matches-claimed-user check for friends/report/assistant routes.
- `lib/seedCheck.ts` — shared "this area looks empty → propose/seed event" trigger (fires from Feed/Events/Map, once/day).
- `lib/changelog.ts` + `components/WhatsNewModal.tsx` — What's New popup.
- `components/MapView.tsx` + `app/map/page.tsx` + `app/api/venues/route.ts` — MapLibre map, discovery tabs, Overpass venue/hub source.
- `lib/subscription.ts` — tiers, prices, feature-gating + playtest unlock (`FEATURE_MIN_TIER` = the untouchable tier map).
- `app/api/account/export/route.ts` + `app/api/account/delete/route.ts` + `prepare_user_deletion()` DB fn — GDPR export/deletion.
- `lib/geo.ts` (radius/bounding-box), `lib/ageGating.ts` (18+ scaffold, OFF).
- `supabase/rls_policies.sql` — RLS policy reference.

## Suggested next steps
1. Security probe done (see above). Remaining hardening (needs your action, not code): enable leaked-password protection in Auth settings; tighten public storage-bucket listing; consider Pro for a real load-sim branch.
2. Fresh art-only agent renders the trailer — see `TRAILER_AGENT_HANDOFF.md`.
3. At launch: flip `NEXT_PUBLIC_PLAYTEST_MODE=false`, activate live Stripe, rotate keys (#30 / #83).
4. Continue Phase 4 launch polish; decide whether to surface the orphaned `/events` inside the feed.
