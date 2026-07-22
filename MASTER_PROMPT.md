# RallyPoint — Master Handoff Prompt

Paste this whole file (or tell the new agent to read it) at the start of a fresh session to pick up work with no prior context. It's meant to replace re-deriving everything from scratch.

## What this is

RallyPoint: a social app for spontaneous, low-pressure real-world meetups (casual hangouts, pickup sports, organizer-run paid events). Solo-founder build (John), some coding experience, ~3hrs/day, using AI-assisted development. Hard deadline: app running independently before a July 2026 trip to Spain.

**Stack:** Next.js (App Router) + Supabase (Postgres/Auth/RLS) + Stripe + Vercel. Deployed at `https://rally-point-eb1q.vercel.app`, auto-deploys from `main` on push (occasionally Vercel's auto-deploy silently doesn't trigger — check the Deployments list for the actual commit hash before assuming a push went live; manually trigger via Deployments → "..." → "Create Deployment" if it's missing).

**Local path:** `C:\RallyPoint\app`. **Supabase project:** id `twdqjwzxqdpzckpgwsag`, name "rallypoint" — use the Supabase MCP for schema/migrations, no separate local migration files are maintained. **GitHub repo:** `https://github.com/DeltaPlayz728/RallyPoint.git`, branch `main`.

## Read this first, in order

1. `PROGRESS.md` (repo root) — full chronological history of every session's work, what's fixed, what's pending, what needs John's action. This is the real source of truth.
2. This file, for the standing rules below that don't change session to session.
3. `CLAUDE.md` / `AGENTS.md` (repo root) — project-level instructions already loaded automatically; mostly a Next.js-version warning.

## Standing workflow rules (do not relearn these the hard way)

- **Never run `git add`/`commit`/`push` yourself if you're in a sandboxed environment without real git credentials.** John runs all git commands himself from his own machine. Always hand off the exact commands instead.
- **Windows/PowerShell path quoting:** any path with brackets, e.g. `app/events/[id]/page.tsx` or `app/profile/[id]/page.tsx`, must be **double-quoted** in git commands (`git add "app/events/[id]/page.tsx"`), not backslash-escaped — PowerShell/git-on-Windows treats unescaped brackets as a glob character class and fails with a pathspec error.
- **Sandbox bash can serve stale file content after Edit/Write tool changes.** If `npx tsc --noEmit` or `npm run build` run via the bash/shell tool shows errors in files you didn't touch (especially files previously verified working), don't trust it — re-verify the actual file via the Read tool instead. This has previously caused bad commits when `git add` ran via bash and staged a stale pre-edit copy. If you must verify a build, ask John to run it on his own machine, or diff bash's view of the file against a fresh Read before staging.
- **lucide-react has no brand/logo icons** (no Instagram, no TikTok logo, etc.) — it's a generic icon set. Use a generic stand-in (`Camera` for Instagram, `Music` for TikTok, `Ghost` for Snapchat) and never assume a brand-name import exists; importing one that doesn't exist breaks the Vercel build with no helpful error beyond "undefined component."
- **No emoji anywhere in the app.** All emoji have been replaced with `lucide-react` icons app-wide (verified clean as of 2026-06-30). Keep it that way — use lucide icons, not emoji, for any new UI.
- **Design language: "Bold & Expressive."** Established on `app/feed/page.tsx`, now also on `app/events/page.tsx`: `border-2 border-black` (or `dark:border-gray-600`) on cards/buttons, `rounded-3xl` cards / `rounded-full` pills, bold (`font-black`/`font-bold`) headers with a rotated accent-colored badge word, decorative solid (not blurred) color blobs bleeding off header corners, custom bordered circular bell button instead of the plain `TopBar` component. If a page still uses the older thin-border `TopBar` + `border-gray-200` style, it has **not** been redesigned yet — that's a gap, not a different intentional style. Cream/black theme: `bg-[#fdf6ec] dark:bg-[#15110d]`, text `text-[#15110d] dark:text-[#fdf6ec]`, accent orange via `bg-accent`/`text-accent` (CSS var, `#f97316`).
- **Caching:** every app page must stay `Cache-Control: private, no-store, must-revalidate` (set centrally in `middleware.ts`) — personalized client-rendered pages must never be edge- or browser-cached, or users see stale UI after tab-switch/back-nav. Don't remove or weaken this header.
- **Business/pricing decisions are not engineering's to make.** Phase 6 (subscription tiers) and Phase 7 (revenue share %) pricing is drafted in `PHASE_6_7_DRAFT.md` but not finalized — don't treat the draft numbers as approved without John confirming.
- **Phase 5 (public launch) is intentionally on hold** pending John's explicit go-ahead for marketing timing, not engineering readiness — the waitlist on `/early-access` is deliberate, don't remove it preemptively.

## Open items blocked on John (not actionable by an agent)

- Google Places API key (map venue pins currently cache-only)
- Anthropic API key (assistant bot currently runs in template-reply mode, deliberately — don't add this proactively, wait for John to say he's entering full launch phase)
- Register the business + activate live Stripe
- React to `PHASE_6_7_DRAFT.md` pricing numbers
- Extrovert tier perks + profile view count (task #151)

## Most recent session (2026-06-30) — needs verification + push

Removed remaining app emoji, fixed a real Vercel build break (invalid `Instagram` lucide import), fixed a stale-page-on-tab-switch bug (`Cache-Control` header), and redesigned `app/events/page.tsx` to match Feed's Bold & Expressive style. Full detail and the exact git commands to run are in `PROGRESS.md`'s top section ("Update 2026-06-30"). **None of this is pushed yet** — that's the first thing to confirm with John in a new session.
