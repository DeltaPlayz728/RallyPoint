# RallyPoint Communities / Group Chat — QA Bug Report

**Date:** 2026-06-27 (ahead of playtest 2026-06-28)
**Scope:** Communities feature — joining, leaving, multi-channel chat, roles, bans/kicks. Tested live on production using two disposable test accounts (TestBot1, Testbot2) plus direct Supabase REST API calls to probe authorization boundaries.
**Status:** Both real bugs found are fixed. One fix is live in Supabase already; one fix is written but needs `git push` to reach production (see PROGRESS.md).

## Summary

Found two critical bugs — one that made joining any community completely impossible, one that made the Join/Leave button unreachable even after the first bug was fixed. Both are now fixed. Every adversarial authorization attack tried (impersonation, role escalation, forged bans/kicks, banned-user rejoin) was correctly blocked by RLS.

## Bugs Found — Fixed

### 1. Joining any community was completely broken — FIXED (live)

`INSERT` into `community_members` always failed with Postgres error `42P17`, "infinite recursion detected in policy for relation community_members". This meant **no user could join any community**, ever, in production.

**Root cause:** the `members_insert_self` policy's `WITH CHECK` had a correlated `EXISTS` subquery against `community_bans`, while the `community_members_select` policy (active on the same table during the same `INSERT ... RETURNING`) had a correlated `EXISTS` subquery against `communities`. Combining two correlated subqueries against different tables, both active during the same statement on `community_members`, triggered Postgres's RLS recursion-prevention guard — even though neither subquery textually references `community_members` itself.

**Fix:** replaced the inline correlated subqueries with three new `SECURITY DEFINER` SQL helper functions — `is_community_owner`, `is_banned_from_community`, `is_community_moderator` (mirroring the existing `is_community_member` helper, which never caused recursion because functions owned by `postgres` bypass RLS internally). Rewrote all four `community_members` policies to call these functions instead of inlining subqueries. Applied via Supabase migration `fix_community_members_rls_recursion` and verified directly with transactional SQL tests — INSERT now succeeds cleanly.

### 2. "Join community" button physically unreachable — FIXED (needs git push)

Even after fixing #1, a real user still couldn't join: the Communities detail page's own bottom tab bar (Home/Chat/Events/You — rendered in-flow, not fixed-position) was completely covered by the app's global fixed-position bottom nav (`z-50`), which intercepts all taps in that screen region. The "You" tab, and therefore the "Join community"/"Leave community" button underneath it, could never actually be clicked.

**Root cause:** `components/BottomNavWrapper.tsx` hides the global nav via `NO_NAV_ROUTES.includes(pathname)` — an exact-string-match check. `usePathname()` on a dynamic route returns the resolved path (e.g. `/communities/23e71f0c-...`), which can never equal a literal string in that array, so this route (or any other dynamic route with its own internal tab bar) could never successfully hide the global nav.

**Fix:** added a `NO_NAV_PREFIXES` array (`['/communities/']`) checked via `pathname.startsWith(...)` alongside the existing exact-match list. **This change is written to `components/BottomNavWrapper.tsx` but not yet committed/pushed** — needs `git push` before the playtest to take effect in production.

## Things I Tried to Break That Held Up (good news)

- **Non-member posting in chat**: blocked, RLS returned 403.
- **Chat message sender impersonation** (a real member posting with another user's `sender_id`): blocked, 403.
- **Self role-escalation** (member trying to PATCH their own role to `moderator`): silently filtered by RLS, 0 rows affected — no escalation possible.
- **Forged ban** (non-mod inserting a `community_bans` row targeting another member): blocked, 403.
- **Forged kick** (non-mod deleting another member's `community_members` row): silently filtered by RLS, 0 rows affected.
- **Banned-user rejoin**: a user with an active ban row attempting to re-insert their own `community_members` row was blocked, 403 — confirms the new `is_banned_from_community` check works correctly.

## Verified Working

- A member can join a community via the real insert path (confirmed via direct API call replicating the app's join action, post-fix).
- Channel-gated chat (`general`, `photography` channels in the test community) correctly returns empty for non-members and populates for members — RLS-gated as designed, not a bug.

## Cleanup

All test churn (a temporary ban row used to test the rejoin block, membership add/remove cycles) has been cleaned up. Production state for the test community ("QA Test Community") is back to John (owner) + Testbot2 (member) only.

## Outstanding Action

Run from `C:\RallyPoint\app`:
```
git add -A
git commit -m "fix: hide global bottom nav on community detail pages"
git push
```
This deploys fix #2 above. Fix #1 (the RLS recursion) is already live in Supabase and needs no git action.
