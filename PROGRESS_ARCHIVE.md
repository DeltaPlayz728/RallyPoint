# RallyPoint — Progress Archive

Historical session logs (June 2026). Not loaded by default — kept for reference only. Current state lives in PROGRESS.md.

## Update 2026-06-27 (Live feedback form for tomorrow's playtest — needs git push)

Added a way for playtesters to report bugs/feedback in-app, with you able to see submissions live in the admin panel — you asked for this ahead of the 2026-06-28 playtest.

- **DB**: new `feedback` table (live in Supabase already) — `user_id`, `message`, `page_url`, `status` (`new`/`reviewed`), `created_at`. RLS: users can only insert their own; only the admin API (service role) can read/update.
- **API**: `app/api/feedback/route.ts` — `POST` to submit (rate-limited 10/hour/IP, enforces the caller can only submit as themselves — same impersonation guard as the existing report endpoint), `GET`/`PATCH` admin-only for the queue.
- **UI**: `components/FeedbackButton.tsx` — a small orange floating button, bottom-right, visible on every screen for logged-in users (hidden on auth/onboarding/legal pages). Tapping it opens a modal with a text box; submitting shows a confirmation. Deliberately positioned at `bottom-24` (well clear of the global `BottomNav`'s footprint) to avoid the exact click-overlap bug class fixed earlier today on the Communities page.
- **Admin**: new "Feedback" tab in `/admin` (`app/admin/page.tsx`), with an unread-count badge, showing who sent each item, their message, what page they were on, and a "Mark reviewed" button. Refresh button to pull in new submissions — no auto-polling, so refresh the tab when you want the latest.

Tested the RLS/impersonation logic directly against Supabase (self-submit allowed, submitting "as" another user blocked) — confirmed correct. **The UI itself is not live yet** — it's all in your working tree uncommitted. **Action needed:** `git add -A && git commit -m "feat: add live feedback form for playtest" && git push` before tomorrow.

## Update 2026-06-27 (Communities/Group Chat adversarial QA + fixes — READ THIS FIRST, action needed)

Ran the same adversarial QA pass on Communities/Group Chat that was done on Map Events and Friends, using TestBot1/Testbot2 plus direct Supabase REST calls. Full report: `QA_Bug_Report_Communities_2026-06-27.md`. Found and fixed **one critical, playtest-blocking bug**, found and fixed **a second critical bug that still needs a `git push` to go live**, and confirmed every authorization/impersonation attack was blocked.

1. **FIXED (live in Supabase now): joining any community was completely broken.** `INSERT` into `community_members` always failed with Postgres error `42P17` ("infinite recursion detected in policy"). Root cause: combining an `INSERT` policy's correlated subquery against `community_bans` with another policy's correlated subquery against `communities` on the same table tripped Postgres's RLS recursion guard, even with no direct self-reference. Fixed by replacing the inline subqueries with three new `SECURITY DEFINER` helper functions (`is_community_owner`, `is_banned_from_community`, `is_community_moderator`) and rewriting all four `community_members` policies to use them. Applied directly via Supabase migration and verified — joining now works.
2. **FIXED IN CODE, NOT YET LIVE — needs your `git push`: the "Join community" button was unreachable.** The Communities detail page (`app/communities/[id]/page.tsx`) has its own in-flow bottom tab bar (Home/Chat/Events/You), but the global fixed-position `BottomNav` (z-50) sits on top of it and eats every tap, so the "You" tab — and therefore "Join community"/"Leave community" — could never actually be clicked by a real user. Root cause: `components/BottomNavWrapper.tsx` only hides the global nav via an exact-match list (`NO_NAV_ROUTES.includes(pathname)`), which can structurally never match a dynamic route like `/communities/[id]`. **Fix applied**: added a `NO_NAV_PREFIXES` check (`/communities/`) alongside the exact-match list. **This is sitting uncommitted in your working tree — you need to `git add`, `commit`, and `push` this before the playtest, or the Join button will still be broken in production.**
3. **Confirmed blocked, no fix needed:** non-members posting into a community's chat (403), chat-message sender impersonation by a real member (403), self role-escalation to moderator (silently filtered, 0 rows), a non-mod forging a ban on another member (403), a non-mod forging a kick/removal of another member (silently filtered, 0 rows), and a banned user attempting to rejoin (403, correctly caught by the new `is_banned_from_community` check). No auth bypass found anywhere in Communities.

All test data created during this pass (test ban row, membership churn) has been cleaned up — production community state is back to just John (owner) + Testbot2 (member).

**Action needed from you:** `git add -A && git commit -m "fix: hide global bottom nav on community detail pages" && git push` — that's the one uncommitted change from tonight.

## Update 2026-06-27 (Map Events adversarial QA + fixes)

Ran a full adversarial QA pass on Map Events (create → discover → join → chat → cancel) using two disposable test accounts plus direct Supabase REST calls to probe auth boundaries. Full report: `QA_Bug_Report_2026-06-27.md`. Good news first: Supabase RLS correctly blocked every forged cross-account attack tried (event cancellation, chat impersonation, RSVP impersonation), and duplicate RSVPs are blocked by a unique constraint. No auth bypass found. Then fixed everything that needed fixing:

1. **Fixed: no validation on `max_attendees`/`starts_at`.** Found via direct API bypass that the `events` table accepted `max_attendees: -5` and a `starts_at` of 2020. Added two DB constraints: `events_max_attendees_positive` (CHECK, validated against all existing rows — passed clean) and `events_starts_at_after_created` (CHECK, applied `NOT VALID` since one legacy real event predates this rule — new/edited rows are enforced, old data untouched). Also added matching client-side guards in `app/events/create/page.tsx` (rejects past dates and `max_attendees < 2` with a visible error instead of relying solely on native browser validation).
2. **Fixed: event chat had no live sync.** The realtime subscription code in `app/events/[id]/chat/page.tsx` was already correct — the actual bug was that Supabase's `messages` table was never added to the `supabase_realtime` publication, so the subscription never received anything. Added it (`alter publication supabase_realtime add table public.messages`). Re-tested live: a message sent from one account now appears on a second account's open chat tab with no reload.
3. **Fixed: empty event-creation form failed silently.** Added an explicit check + visible error message in `app/events/create/page.tsx` for blank title/location/city/date instead of relying only on native HTML `required` tooltips (which didn't render in headless testing and could read as a dead button).
4. **Investigated, not changed: auth session cookie isn't httpOnly.** This is inherent to the `@supabase/ssr` `createBrowserClient` pattern used in `lib/supabase.ts` — the client-side SDK needs `document.cookie` access to read/refresh the session, which is mutually exclusive with httpOnly. Making it httpOnly would require a bigger refactor (server-side BFF auth pattern) and would break every page's client-side `supabase.auth.getUser()` calls. No exploit was found that uses this gap; flagging as a known tradeoff rather than an open bug.
5. **Not a bug, re-verified:** an earlier note about a "triple avatar" rendering glitch on the attendee list turned out to be both test accounts' names starting with the same letter ("TestBot1"/"TestBot2") rendering correctly in both the avatar stack and the individual rows — not a duplicate-render bug. Did fix one real small inconsistency while in that file: the per-row `Avatar` in `app/events/[id]/page.tsx` fell back straight to `'?'` if `full_name` was null instead of trying `username` first like the avatar stack above it does — made it consistent.

All disposable test data (test events, attendees, chat messages) created during testing has been deleted from production. The original QA test event is still live and can be cancelled or left for the playtest.

**Still open from before, unchanged:** #27 (Google Places API key), #71 (Anthropic API key), #83 (register business + activate live Stripe), #151 (Extrovert perks + profile view count), reacting to `PHASE_6_7_DRAFT.md` pricing.

## Update 2026-06-26 (playtest-prep bug pass)

Four items closed out, in order, per John's request:

1. **Fixed: "Become an Organizer" modal hidden behind BottomNav.** Same bug class as the earlier cancel-event/meetup/report modals (`app/profile/page.tsx`'s bottom sheet was `z-50`, tied with `BottomNav`'s own `z-50`, and `BottomNav` mounts after `{children}` so it won stacking ties and ate taps). Bumped to `z-[60]`. Grepped the whole codebase afterward — confirmed no other instance of this bug class remains.
2. **Logo rolled out beyond the 5 main tabs.** John chose "sub-pages with back buttons" scope (not auth/legal/onboarding). Added `Logo` to: `app/profile/[id]/page.tsx`, `app/profile/setup/page.tsx`, `app/inbox/page.tsx`, `app/inbox/dm/[userId]/page.tsx`, `app/events/create/page.tsx`, `app/admin/page.tsx`, `app/events/[id]/chat/page.tsx`, `app/events/[id]/page.tsx`. Also fixed a real gap: `/profile` (one of the 5 main bottom-nav tabs) was the only main tab missing `TopBar`/logo entirely — added it.
3. **OG share image added.** Generated `public/og-image.png` (1200×630, branded — logo mark + wordmark + tagline on the cream theme) and wired it into `app/layout.tsx`'s `openGraph.images` / `twitter.images`. This closes the gap flagged in the 2026-06-20 update below ("no OG image yet").
4. **Mobile safe-area padding — turned out already done.** The gap flagged in item #8 of the 2026-06-20 update (`BottomNav` missing `env(safe-area-inset-bottom)`) was already fixed in a later session before tonight — `components/BottomNav.tsx` already has `pb-[max(0.25rem,env(safe-area-inset-bottom))]` and `app/layout.tsx`'s viewport already sets `viewportFit: "cover"`. No action needed; verified and closed.

Committed as `1718fdd`, pushed to `main`, confirmed live: fetched `https://rally-point-eb1q.vercel.app` post-deploy and verified the `og:image`/`twitter:image` meta tags resolve to the new image.

**Still open from before, unchanged:** #27 (Google Places API key), #71 (Anthropic API key), #83 (register business + activate live Stripe), #151 (Extrovert perks + profile view count), reacting to `PHASE_6_7_DRAFT.md` pricing.

## Update 2026-06-20 (overnight session)

### 0. Security fixes: confirmed actually live (closed out)
The 4 commits from earlier (`9c36af8`, `c26cedd`, `9e3d101`, `87531d8`) were pushed to `origin/main` but **Vercel's GitHub auto-deploy never triggered for them** — no deployment appeared for those commits despite the GitHub App integration showing connected. Worked around by manually triggering a deploy: Vercel Deployments page → `...` menu → "Create Deployment" → entered commit `87531d8` → "Deploy to Production". Verified live via an in-browser `fetch()` with `credentials: 'omit'` against `/api/admin/reports` and `/api/admin/suspensions` — both now correctly return `401 {"error":"Unauthorized"}`.

**Heads up for next time:** if a future push doesn't show up on `https://rally-point-eb1q.vercel.app` after a few minutes, don't assume it's deployed just because GitHub shows the commit — check the Vercel Deployments list for an entry matching that commit hash. If it's missing, use the same manual "Create Deployment" trick. Worth checking Vercel's GitHub App installation settings at some point (`github.com/settings/installations`) to see why auto-deploy stopped firing — I didn't dig further since that page wanted a "Verify via email" step I wasn't going to push through without you there.

### 1. Phase 5 (open public web access) — done
Checked: there was never an actual gate blocking signups (middleware's `publicRoutes` already includes `/welcome`, `/auth/signup`, `/`; the "early access" banner is just a waitlist/marketing page, not a block). Also checked Vercel's Deployment Protection settings directly — Vercel Authentication and Password Protection are both off, so there's no infra-level wall either. The site has genuinely been publicly reachable this whole time.

What I added to round out "ready for public traffic / sharing links":
- `app/robots.ts` — allows crawling, disallows `/api/`, `/admin`, `/auth/`, `/inbox/`, `/events/create`.
- `app/sitemap.ts` — lists the public unauthenticated routes.
- `app/layout.tsx` — proper Open Graph + Twitter card metadata (title template, description) so links shared on social/Discord/etc. render a real preview instead of a bare URL. **Note: no OG image yet** — `openGraph`/`twitter` have no `images` field because there's no branded image asset in `public/`. Worth adding a 1200×630 image (`public/og-image.png`) and wiring it in when you have one — currently shared links will have no preview image, just text.

### 2. Phase 6 & 7 (subscription tiers, revenue share) — drafted, not built
I did **not** wire real Stripe subscription products or a pricing page tonight. Two reasons: the actual tier pricing/feature-gating and the revenue-share % are product decisions I shouldn't invent unilaterally on a real app, and (see #3 below) I lost the ability to verify TypeScript compiles in this session, which made me unwilling to ship untested payment-flow code.

Instead: wrote `supabase/subscriptions_schema.sql` (additive DB columns for `profiles` — safe to apply any time, not yet applied) and `PHASE_6_7_DRAFT.md` (a concrete proposed tier table with prices/features, plus the open Stripe Connect vs. manual-payout question for Phase 7). **Read `PHASE_6_7_DRAFT.md` and react to it** — once you've picked numbers, the actual pricing page + Stripe subscription checkout + feature gating is maybe an afternoon of work.

### 3. New sandbox bug found: bash mount caches stale file content after edits
Discovered while trying to `npx tsc --noEmit` after editing `app/layout.tsx`: the Edit/Write tools write the real file correctly (confirmed by reading it back — full, correct content), but this session's bash shell kept seeing an old, truncated cached copy (`stat` showed a modify time from 2026-06-10, i.e. before tonight's edits) even after `sync` and waiting. This means **I could not run `tsc`/`npm run build` to verify anything I touched tonight compiles.** I kept tonight's edits deliberately simple and low-risk for this reason (declarative SQL, a couple of small well-known Next.js metadata patterns), but **please run `npx tsc --noEmit` and `npm run build` yourself before pushing**, just in case.

### Files touched tonight (uncommitted — same situation as before, I can't push from this sandbox)
```
app/robots.ts                      (new)
app/sitemap.ts                     (new)
app/layout.tsx                     (modified — OG/Twitter metadata)
supabase/subscriptions_schema.sql  (new — draft, not applied to DB)
PHASE_6_7_DRAFT.md                 (new — read this)
```
Suggested commit from your machine:
```
git add app/robots.ts app/sitemap.ts app/layout.tsx supabase/subscriptions_schema.sql PHASE_6_7_DRAFT.md
git commit -m "Phase 5: SEO/OG metadata, robots.txt, sitemap; draft Phase 6/7 subscription schema + pricing proposal"
git push
```
(Remember: after pushing, double-check the Vercel Deployments list actually picked it up — see item #0 above.)

### Still blocked on you (unchanged + one addition)
- **#27**: Google Places API key.
- **#71**: Anthropic API key.
- **#83**: Register the business + activate live Stripe.
- **New**: React to `PHASE_6_7_DRAFT.md`'s pricing table so Phase 6/7 can actually be built.

## What RallyPoint is

A social app for spontaneous, low-pressure real-world meetups (casual hangouts, pickup sports, organizer-run events). Stack: Next.js (App Router) + Supabase (Postgres, Auth, RLS) + Stripe + Vercel. Deployed at https://rally-point-eb1q.vercel.app, auto-deploys from GitHub on push.

## Current phase

Phase 3 (final end-to-end smoke test) is in progress. Phase 4 (launch polish) work was pulled forward this session because it surfaced real bugs blocking Phase 3.

## What got done this session

### 0. Live-verified the cancel-event-as-host bug — turned out to be a different bug than the RLS fix
John ran the RLS SQL fix from item #1 below. Re-tested live by creating a fresh event, clicking Cancel, and confirming in the modal — the event stayed active and the page silently navigated to `/friends` instead. Reproduced it twice. Read `app/events/[id]/page.tsx` and found the real cause: the cancel-confirm modal (and the meetup-request modal, and `ReportModal.tsx`) are bottom-anchored sheets (`fixed inset-0 z-50 flex items-end ... pb-4`) at the **same** `z-50` as `BottomNav`. `BottomNav` mounts after `{children}` in `app/layout.tsx`, so it wins the stacking tie and sits on top of the lower part of these sheets — taps meant for "Cancel event" / "Keep event" / "Send Request" / "Submit Report" were landing on whatever nav icon was underneath instead (in this case, the Friends tab).

Fixed by bumping all three sheets to `z-[60]` (above `BottomNav`'s `z-50`): `app/events/[id]/page.tsx` (cancel-confirm sheet + `MeetupModal`) and `components/ReportModal.tsx`. Ran `npx tsc --noEmit` clean, committed (`acfb12d`) — **but could not push**, the sandbox has no stored GitHub credentials. John needs to run `git push origin main` from his own machine, then this needs re-verifying live once Vercel redeploys.

Side note: while fixing this I hit the same "file truncated after edit" issue referenced in an earlier commit (`79fcfb0`) — both edited files lost their closing `}` after the edit tool wrote them, caught by running `tsc` before committing. Worth always running `tsc --noEmit` before committing in this environment.

### 1. Found and fixed a production bug: hosts got bounced out of their own cancelled event
Root cause: the `events_select` RLS policy only allowed reading rows where `status = 'active'`. The moment a host cancels their event, the event detail page's lookup-by-id returns 0 rows (RLS, not "not found") and the page redirects the host to `/feed`. Fix is written to `supabase/rls_policies.sql`. **Note: this fix is real and worth keeping, but it was not the cause of the cancel-event bug John asked to re-verify — see item #0 above for the actual cause and fix.**

**Update 2026-06-19: now live.** The Supabase MCP connector started working this session — ran the fix directly and verified against the DB (`pg_policy` confirms the `events_select` USING expr is exactly `(auth.role() = 'authenticated' AND (status = 'active' OR auth.uid() = created_by))`). No longer blocked.

```sql
drop policy if exists "events_select" on events;
create policy "events_select" on events
  for select using (
    auth.role() = 'authenticated' and (status = 'active' or auth.uid() = created_by)
  );
```

**Update 2026-06-19 (later same session): #85 verified live, closed out.** John pushed the z-index fix (`acfb12d`). Re-tested live after redeploy: confirmed via JS that the deployed modal now computes `z-[60]` (above `BottomNav`'s `z-50`), the confirm modal renders fully on-screen (not cut off), and clicking "Cancel event" correctly hit `handleCancelEvent` — DB updated to `status: 'cancelled'`, notification sent, redirected to `/events`, and the event no longer appears in the events list. Task #85 marked complete.

One minor follow-up gap found while verifying (not blocking, not yet fixed): visiting a cancelled event's detail page directly by URL (as the host) still renders the normal active-event UI — host controls, "You're hosting this event," and the Cancel button — because the page component has no `status === 'cancelled'` branch. This only became visible/reachable after the RLS fix in item #1 above (previously the host would've been redirected to `/feed` before ever seeing this). Worth a small follow-up: show a "This event was cancelled" state and hide the Cancel button when `event.status !== 'active'`.

### 2. Found and fixed: admin API routes had zero authentication
`/api/admin/reports` and `/api/admin/suspensions` were callable by anyone on the internet — no auth check at all. Worst case: anyone could `DELETE /api/admin/suspensions` to un-suspend any user, completely undermining the moderation system. The only "protection" was a client-side email check in `app/admin/page.tsx`, which doesn't protect the API routes themselves.

Fixed by adding `lib/adminAuth.ts` (`getAdminUser(req)` — verifies the caller's Supabase session server-side and checks their email against the admin allowlist) and wiring it into both routes' handlers, returning 401 on failure. This is now deployed in the codebase (pushed via normal git flow — confirm it's on `main` and deployed before relying on it).

### 3. Found and fixed: checkout let the client set its own price
`/api/create-checkout` took a `price` field straight from the request body and charged that amount via Stripe — meaning anyone could open devtools (or just curl the endpoint) and pay €0.01 for a paid event. Fixed: the route now looks up the event's real price from the database itself and ignores any client-supplied price/title.

### 4. Found and fixed: several routes trusted a client-supplied user id with no session check
`/api/friends` (POST/PATCH/DELETE), `/api/report`, and `/api/assistant/chat` + `/api/assistant/seed-check` + `/api/assistant/seed-confirm` all took a `userId`/`requesterId`/`reporterId` field from the request body and acted as that user, with nothing verifying the caller's actual session matched. That meant anyone who knew another user's id (visible all over the UI) could send friend requests as them, accept/decline their friend requests, file reports as them, or read/send their assistant DMs.

Fixed by adding `lib/sessionAuth.ts` (`requireMatchingUser(req, claimedId)` — verifies the real session and compares ids) and wiring it into all six call sites. Verified the client-side `fetch()` calls in `app/friends/page.tsx`, `app/map/page.tsx`, and `app/inbox/dm/[userId]/page.tsx` are same-origin with default credentials, so cookies are sent automatically — no client changes were needed.

Ran `npx tsc --noEmit` after all edits — compiles clean.

### 5. Smoke test #86 (post-event rating prompt) — verified live, closed out
John ran a seed SQL script to create a fake past event (`starts_at` = 3 hrs ago, status `active`) hosted by and attended by him, with no existing `event_ratings` row. Visited the event detail page live: the rating modal ("How was it?") popped up automatically as expected. Selected 4 stars, hit Submit — it correctly transitioned to the ShareCard ("I showed up.") per the `onDone` handler. Reloaded the page afterward: the modal did NOT reappear, confirming the rating actually persisted to `event_ratings` and the `existingRating` check is working. Task #86 marked complete.

Cleanup still needed: the seeded test event (id `2dff18e4-3964-44db-93a3-d898f67457a7`) and its `event_attendees`/`event_ratings` rows should be deleted from Supabase — John has the cleanup SQL.

### 6. Code audit (#91) — found and fixed real bugs, closed out
Grepped every client-side `fetch()` call site in `app/` for missing `res.ok` checks. Found three places where the UI optimistically updated local state regardless of whether the request actually succeeded — meaning a failed accept/decline/remove/report/proposal-response action would silently show success to the user while the backend change never happened:
- `app/friends/page.tsx` — `handleRespond` (accept/decline friend request), `handleRemove` (remove friend)
- `app/admin/page.tsx` — `updateReport`, `liftSuspension`
- `app/inbox/dm/[userId]/page.tsx` — `respondToProposal` (bot seed-event proposal accept/decline)

Fixed all five by checking `res.ok` before mutating state, with an `alert()` on failure (matches the existing error-feedback pattern used elsewhere, e.g. `app/map/page.tsx`). Committed as `e85f88b`. Also checked for TODOs/FIXMEs/console.logs/placeholder content — nothing concerning found (one benign server-side `console.log` in the Stripe webhook handler, one low-priority empty `catch {}` around a geocoding fallback in `app/events/create/page.tsx` that's safe since `lat`/`lng` are nullable).

### 7. Performance pass (#92) — capped unbounded list queries
Feed, Events, and Map pages all fetched **every** active/upcoming event in the database with no `.limit()` — fine at current (near-zero) volume, but would degrade as events accumulate. The notifications inbox had the same issue per-user (fetches full history, descending, unbounded). Added caps: Feed `.limit(100)`, Events `.limit(100)`, Map `.limit(200)`, Notifications `.limit(50)`. Committed as `96c90dc`.

Looked at `<img>` usage as a possible `next/image` swap (5 small avatar images across friends/profile/DM pages) but skipped it: `next.config.ts` has no remote image domains configured yet, these are all small (32–64px) avatars where the payoff is minor, and adding `remotePatterns` for the Supabase storage host is an untested config change I can't verify against the live bucket from this sandbox. Worth doing later if image weight becomes a real issue, but not now.

Not done (didn't seem worth the risk/complexity for an MVP at this stage): no infinite-scroll/cursor pagination was added — the `.limit()` caps are a quick safety net, not real pagination. If event/notification volume grows past a few hundred rows, revisit with proper cursor-based pagination.

**Still need to push:** `e85f88b`, `96c90dc`, and `5bf0980` are committed locally but not pushed (no GitHub credentials in this sandbox). Run from your machine:
```
git pull --ff-only   # if needed
git push origin main
```

### 8. Mobile/responsive pass (#93) — code-level review only, live click-through blocked by tooling
**Important caveat: I could not actually shrink the browser viewport in this sandbox** — `resize_window` reports success but `window.innerWidth` stayed locked at 1568px regardless of what size I requested (confirmed via JS). So I was not able to do a real narrow-viewport click-through like I did for the earlier smoke tests. Don't take this section as "verified live on mobile" — it's a code review only. **Please do a real 2-minute check on your phone before considering Phase 4 done**: open the feed, create-event flow, an event detail page, and a DM thread on your actual device.

What the code review did check, and came back clean:
- Viewport meta tag: confirmed via live JS (`document.querySelector('meta[name="viewport"]')`) that Next.js is correctly auto-injecting `width=device-width, initial-scale=1` — no explicit `viewport` export needed.
- No fixed oversized pixel widths (`w-[Npx]` ≥ 400px) anywhere in `app/` or `components/` — layout is mobile-first (`grid-cols-1` default, `sm:` breakpoints scale *up* for desktop, not down).
- Form inputs use the browser default 16px font (no `text-xs`/`text-sm` on `<input>`/`<textarea>` elements) — avoids the classic iOS Safari auto-zoom-on-focus bug.
- Bottom-sheet modals (cancel-event, meetup request, report) already fixed at `z-[60]` above `BottomNav`'s `z-50` from an earlier session (#85) — checked this didn't regress.

One real gap found at the time, not fixed yet in this session: `components/BottomNav.tsx` was `fixed bottom-0` with `py-2` padding but no `padding-bottom: env(safe-area-inset-bottom)`. **Fixed 2026-06-26** — see the update at the top of this file; `BottomNav.tsx` now has `pb-[max(0.25rem,env(safe-area-inset-bottom))]`.

### 9. Bot seed-event reliability + autonomy (#82) — bugs fixed, both product decisions made and implemented

Read the full trigger path: `app/map/page.tsx` (client) → `app/api/assistant/seed-check/route.ts` (server). Found and fixed three real bugs:

- **Unbounded query in `seed-check/route.ts`**: it fetched every active future event in the whole DB with no `.limit()` to compute "is this area empty" — same class of bug as #92, just in a server route instead of a page. Added `.limit(500)`.
- **Misleading Breda fallback**: when a user denies location permission, the map was fetching and showing real venues for Breda, NL regardless of where the user actually is — actively wrong for anyone not in Breda. Removed it; venue layer is now just empty if location is denied (map still works, just without the venue layer).
- **Once-per-browser-session gate was backwards**: `sessionStorage` resets on every new tab, so an active user got re-checked constantly while a returning user (same tab, area status changed since last visit) never got re-checked at all. Changed to a real once-per-day gate using a `localStorage` timestamp.

The task also called out two product decisions to make before public release. I flagged both instead of resolving them silently — John's answers and what got built:

1. **Propose-and-wait vs. auto-create → "Auto Create one event and Propose different Ideas based on user File."** Rewrote `seed-check/route.ts`: when an area looks empty, it now ranks the 5 seed templates against the user's `profiles.interests` (best-effort keyword overlap), auto-creates the top-ranked one directly into `events` (real venue lookup via `findRealVenue`, `status: 'active'`, disclosed via `is_suggested`/`suggested_by`), and sends one informational DM about it — no accept needed, user isn't auto-joined. It then also creates up to 2 more `event_proposals` for the next-ranked templates (no venue lookup, to save latency/cost on ideas that may never be accepted), each sent as its own separate DM with a `[[PROPOSAL:id]]` marker the user can still accept/decline like before. (Each DM can only carry one marker — `app/inbox/dm/[userId]/page.tsx`'s `PROPOSAL_RE` is a non-global match — hence separate messages per alternate.)
2. **Map-only trigger → "Also Feed + Events."** Pulled the trigger logic (geolocate → reverse-geocode → POST `/api/assistant/seed-check`) out of `app/map/page.tsx` into a shared helper, `lib/seedCheck.ts` (`triggerSeedCheck(userId)`), and called it from `app/feed/page.tsx` and `app/events/page.tsx` too, not just Map. The once-per-day gate is keyed off one shared `localStorage` timestamp, so visiting more than one of these pages in a day doesn't double-fire.

Verified with `npx tsc --noEmit` — clean. Not yet committed (see git note below).

**Heads up on auto-created events:** the auto-created primary event has no attendee cap behavior different from normal — it's created with `max_attendees: 8`, free, next Saturday evening. Nobody is auto-joined to it (including the user who triggered it), unlike accepting a proposal which does auto-join. If you'd rather the triggering user be auto-joined to the event made just for them, that's a quick follow-up — wasn't asked for, so I left it out.

**Git note:** this session's git state looks inconsistent — `.git/index.lock` and `HEAD.lock` are still stuck (can't be removed, same as the original issue), and `git show HEAD:...` for `seed-check/route.ts` came back *missing* the `requireMatchingUser` auth fix from item #4, even though that fix is already live in the working files and (per earlier notes) already pushed. That means local HEAD here doesn't reliably reflect what's on GitHub/deployed. Given that, I didn't try to force a commit through the lock workaround this time — too much risk of committing on top of a stale/diverged HEAD. All of the above is sitting as uncommitted changes in the working tree only. **Recommend committing straight from your machine** (where git isn't in this broken state):
```
git add app/map/page.tsx app/feed/page.tsx app/events/page.tsx app/api/assistant/seed-check/route.ts lib/seedCheck.ts
git commit -m "Bot seed-event: auto-create + personalized alternates, fire from Feed/Events too, fix 3 reliability bugs"
git push
```

