import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Verifies the request carries a valid Supabase session and returns that
 * user's id, or null if there's no valid session.
 *
 * Several API routes (friends, report, assistant/*) accept a `userId` /
 * `requesterId` / `reporterId` field straight from the request body and use
 * it to attribute the action, with nothing checking that the caller is
 * actually that user. That's an impersonation/IDOR gap — anyone who can see
 * another user's id (visible all over the UI: profile pages, attendee
 * lists, etc.) could send friend requests, accept/decline friend requests,
 * file reports, or chat with the assistant as them.
 *
 * Routes should call this, then compare the returned id against the
 * claimed id and reject on mismatch — see requireMatchingUser below.
 */
export async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // No-op: route handlers don't need to write cookies back for a read-only auth check.
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Convenience check for the common case: the request body claims to be
 * acting as `claimedUserId`, and we need to confirm the actual session
 * matches. Returns true if they match (caller may proceed), false otherwise
 * (caller should respond 401/403).
 */
export async function requireMatchingUser(req: NextRequest, claimedUserId: string | null | undefined): Promise<boolean> {
  if (!claimedUserId) return false
  const sessionUserId = await getSessionUserId(req)
  return sessionUserId === claimedUserId
}
