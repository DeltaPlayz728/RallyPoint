import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Single source of truth for "who is allowed to use admin routes."
 * Mirrors app/admin/page.tsx's client-side check, but this is the copy that
 * actually matters — the API routes under /api/admin/* are reachable
 * directly (curl, fetch, etc.) regardless of whether anyone ever loads the
 * /admin page, so the page-level check alone provides no real protection.
 */
const ADMIN_EMAIL = 'rallypoint.admin@gmail.com' // keep in sync with app/admin/page.tsx

/**
 * Verifies the request carries a valid Supabase session for the admin
 * account. Returns the user on success, or null if the caller is not
 * authenticated as the admin — callers should respond 401/403 on null.
 */
export async function getAdminUser(req: NextRequest) {
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
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}
