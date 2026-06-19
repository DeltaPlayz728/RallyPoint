# RallyPoint — Progress / Handoff

Last updated: 2026-06-19 (autonomous session, while John was away ~3 hrs)

This file is the source of truth for "where things stand." Read this before doing anything else in a new session.

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

**This fix is NOT yet live.** I have no DB credentials in this sandbox — only John can run DDL against the production Supabase instance. Run this in the Supabase SQL Editor:

```sql
drop policy if exists "events_select" on events;
create policy "events_select" on events
  for select using (
    auth.role() = 'authenticated' and (status = 'active' or auth.uid() = created_by)
  );
```

Once that's run, re-verify task #85 (cancel event as host) live.

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

One real gap found, not fixed (low priority, cosmetic): `components/BottomNav.tsx` is `fixed bottom-0` with `py-2` padding but no `padding-bottom: env(safe-area-inset-bottom)`. On notched/home-indicator iPhones this means the nav icons sit close to the gesture bar instead of being padded above it. Worth a smal