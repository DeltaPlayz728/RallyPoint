import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Single source of truth for "who is allowed to use admin routes."
 * Mirrors app/admin/page.tsx's client-side check, but this is the copy that
 * actually matters — the API routes under /api/admin/* are reachable
 * directly (curl, fetch, etc.) regardless of whether anyone ever loads the
 * /admin page, so the page-level check alone provides no real protection.
 *
 * Backed by the admin_users table (migration create_admin_users_table)
 * rather than a single hardcoded email — that email (rallypoint.admin@
 * gmail.com) never actually matched a real account, which meant admin
 * access was effectively already broken. Adding/removing admins is now a
 * row insert/delete, not a code deploy.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Verifies the request carries a valid Supabase session for a user listed in
 * admin_users. Returns the user on success, or null if the caller is not an
 * admin — callers should respond 401/403 on null.
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
  if (!user) return null

  // admin_users has no anon/authenticated RLS policies, so this lookup must
  // go through the service-role client, not the session-scoped one above.
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return null
  return user
}
