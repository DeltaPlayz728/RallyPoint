# RallyPoint — Progress / Handoff

Last updated: 2026-06-30

Source of truth for current state. Session-by-session history (June 2026) lives in `PROGRESS_ARCHIVE.md` — don't load it unless you need historical detail. The auto-memory `MEMORY.md` index loads automatically each session and is the fastest orientation; `MASTER_PROMPT.md` is an optional fuller cold-start brief (no need to read it every session).

## Most recent work (2026-06-30)

**Home/Events consolidation + token cleanup (latest):**
- `/feed` is now the home AND event screen. `middleware.ts` redirects logged-in users from `/` to `/feed`; the bottom-nav Events tab (`components/BottomNav.tsx`) points to `/feed`. The older `app/events/page.tsx` (social/venue events + Near-me) is now orphaned from the nav (still reachable by URL).
- Opaque pastel background bubbles added to `/feed` and `app/events/page.tsx` (3 bubbles, `fixed inset-0 z-0 pointer-events-none`; content wrapped `relative z-[1]` so cards stay on top).
- Steam-style "What's New" popup: `components/WhatsNewModal.tsx` + `lib/changelog.ts`. To publish an update: add an entry to the top of `RELEASES` and bump `CURRENT_VERSION`. Shows once per version per device (localStorage `rallypoint:whatsNewSeen`).

**Emoji cleanup, build fix, caching fix, Events redesign (earlier same day):**
- Removed remaining emoji app-wide (replaced with lucide-react icons).
- Fixed a Vercel build break: invalid `Instagram` import in `app/profile/[id]/page.tsx` → `Camera` (lucide has no brand icons).
- Fixed stale-page-on-tab-switch: `middleware.ts` sets `Cache-Control: private, no-store, must-revalidate` on app pages.
- Redesigned `app/events/page.tsx` to the Bold & Expressive style.

## Pending git push (run from your machine — git isn't usable from the sandbox)
Everything above is uncommitted. From `C:\RallyPoint\app`:
```
git add -A
git commit -m "Feed as home/event screen, background bubbles, What's New popup; emoji cleanup, build + caching fixes"
git push
```
After pushing, confirm the Vercel Deployments list shows the new commit actually deploying (auto-deploy has silently no-op'd before — manually "Create Deployment" if missing). Then do a live phone check of the Cache-Control fix and the Feed/Events redesign.

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
- #27: Google Places API key (map venue pins fall back to cache-only).
- #30: Rotate the Stripe keys (flagged compromised in an earlier session).
- #71: Anthropic API key (assistant bot runs in template mode — deliberate, deferred to launch).
- #83: Register the business + activate live Stripe.
- React to `PHASE_6_7_DRAFT.md` pricing.

## Files worth knowing about
- `lib/adminAuth.ts` — admin-only auth check for `/api/admin/*`.
- `lib/sessionAuth.ts` — session-matches-claimed-user check for friends/report/assistant routes.
- `lib/seedCheck.ts` — shared "this area looks empty → propose/seed event" trigger (fires from Feed/Events/Map, once/day).
- `lib/changelog.ts` + `components/WhatsNewModal.tsx` — What's New popup.
- `supabase/rls_policies.sql` — RLS policy reference.

## Suggested next steps
1. Push the pending changes (above) and verify live on a phone.
2. Decide whether to surface the orphaned social/venue events (`/events`) inside the feed, or leave them URL-only.
3. Continue Phase 4 launch polish.
