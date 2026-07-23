@AGENTS.md

# RallyPoint — project briefing for Claude Code

This repo is `DeltaPlayz728/RallyPoint`, deployed on Vercel as `rally-point-eb1q`
(production: https://rally-point-eb1q.vercel.app), branch `main`, this
directory (`C:\RallyPoint\app`) is the repo root. Backend is Supabase Postgres
+ Auth + RLS (project ref `twdqjwzxqdpzckpgwsag`, name "rallypoint", Free
plan). Persistent rate limiting runs on Upstash Redis via plain REST `fetch`
calls (see `lib/rateLimit.ts`) — no SDK dependency, works on Edge or Node.
Signup and login are gated by Cloudflare Turnstile, enforced server-side by
Supabase's own Auth "Attack Protection" captcha setting (this applies to
*every* auth endpoint — signup, login, password recovery — not just signup;
that gap caused a real production outage on 2026-07-23 where login was
silently broken until Turnstile was wired into `app/auth/login/page.tsx` too).

## Standing rules from John (the developer/owner)
- Before pushing anything, run `npm run build` locally to catch build-breaking
  errors — don't rely on `tsc --noEmit` alone if a full build is available to
  you (a prior sandboxed assistant session couldn't run full builds due to a
  FUSE/EPERM limitation and substituted `tsc --noEmit`; you likely don't have
  that limitation running natively on John's machine, so prefer the real
  build).
- **Do not collect new user PII** (e.g., phone numbers, ID verification,
  photo-in-chat) until a legal/privacy guideline is established. This doesn't
  block CAPTCHA (no new data collected) or normal signup/login (pre-existing
  features).
- Don't mass-create fake signups or test accounts against production without
  a clear reason; clean up any test data you create.
- Avoid destructive Supabase operations (mass deletes, dropping tables)
  without calling it out explicitly first.

## Current state (as of 2026-07-23)
A QA pass found and fixed: PII leak in chat previews, PostgREST filter
injection in admin search, missing venue coordinate validation, weak
admin/bot secret comparison, missing rate limits on friends endpoints, a feed
hydration mismatch, in-memory-only (non-durable) rate limiting, and missing
CAPTCHA on signup/login. All of the above are fixed and deployed.

The only open item from that pass is an **accessibility pass** (task: keyboard
nav, screen-reader labels, color contrast, focus states across the app) —
not started yet, and explicitly flagged as lowest priority by John.

## Gotchas
- `middleware.ts` rate-limits all `/auth/*` page loads to 10 requests per IP
  per 15 minutes (via Upstash key `auth:<ip>`) — repeated manual testing of
  `/auth/login` or `/auth/signup` will trip this and show a plain "Too many
  requests" page. Clear it via the Upstash console CLI
  (`console.upstash.com` → the `rallypoint-ratelimit` database → CLI tab →
  `KEYS auth:*` then `DEL <key>`) rather than waiting it out.
- `/api/*` routes are intentionally bypassed by the middleware's auth-cookie
  gate (Stripe webhooks and the public waitlist form need to be reachable
  without a session cookie) — don't "fix" that bypass without checking those
  two call sites first.
- Supabase's "Prevent use of leaked passwords" toggle is genuinely gated
  behind the Pro plan (this project is Free) — greyed out is expected, not a
  bug.
