# RallyPoint

A social app for spontaneous, low-pressure real-world meetups — casual hangouts, pickup sports, and organizer-run events. Find what's happening nearby, RSVP, chat with attendees, and meet up.

Live: https://rally-point-eb1q.vercel.app

For current build status, known issues, and what's blocked, see [PROGRESS.md](./PROGRESS.md).

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security, Storage
- [Stripe](https://stripe.com) — paid event checkout
- [Tailwind CSS](https://tailwindcss.com)
- [Leaflet](https://leafletjs.com) / react-leaflet — map view
- Deployed on [Vercel](https://vercel.com), auto-deploy from `main`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a `.env.local` with Supabase, Stripe, and app URL variables (see the project's environment config — not committed). Without `GOOGLE_PLACES_API_KEY` or `ANTHROPIC_API_KEY` set, the map falls back to cached venues only and the assistant bot runs in canned/template-reply mode — both are deliberate fallbacks, not bugs.

## Project structure

- `app/` — routes (App Router), one folder per page; `app/api/*/route.ts` for API routes
- `lib/` — shared server/client helpers (Supabase clients, rate limiting, auth checks, assistant logic)
- `supabase/*.sql` — schema and Row Level Security policy definitions, run manually in the Supabase SQL Editor
- `scripts/` — one-off Node scripts (seeding, migrations) that use the Supabase service-role key

## Security model

- Row Level Security on every table — see `supabase/rls_policies.sql` for the full policy set and rationale comments.
- API routes that act on behalf of a specific user verify the caller's real Supabase session matches the claimed user id (`lib/sessionAuth.ts`) rather than trusting a client-supplied id.
- Admin routes (`/api/admin/*`) require a verified session matching the admin allowlist (`lib/adminAuth.ts`) — there is no client-side-only gate left anywhere.
- Stripe checkout amounts are always looked up server-side from the database, never taken from the client.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
