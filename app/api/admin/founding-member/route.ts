import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/adminAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/admin/founding-member?q=username — search profiles by username
// or full name so the admin panel can find a user to grant the role to.
export async function GET(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) {
    // No query — show current founding members so the admin can see/revoke them.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, avatar_url, is_founding_member, subscription_tier')
      .eq('is_founding_member', true)
      .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // `q` gets interpolated into a raw PostgREST .or() filter string below.
  // Commas and parens are filter-syntax metacharacters there (comma separates
  // clauses, parens group them), so an admin-controlled q containing them
  // could inject additional filter clauses. Strip them — a legit username/
  // name search never needs them.
  const safeQ = q.replace(/[,()]/g, '')

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, avatar_url, is_founding_member, subscription_tier')
    .or(`username.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%`)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/admin/founding-member { userId, grant: boolean }
export async function PATCH(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, grant } = await req.json()
  if (!userId || typeof grant !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or grant' }, { status: 400 })
  }

  // Reset last_celebrated_tier on grant so the celebration effect fires next
  // time the user loads the app — revoking leaves it alone (no "downgrade"
  // celebration needed).
  const update: Record<string, unknown> = { is_founding_member: grant }
  if (grant) update.last_celebrated_tier = null

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(update)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
