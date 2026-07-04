import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUserId } from '@/lib/sessionAuth'

// GDPR account deletion — permanently removes the requesting user and all their
// data. Most tables cascade from auth.users; prepare_user_deletion() first clears
// the few references that would otherwise block the cascade.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error: prepErr } = await admin.rpc('prepare_user_deletion', { p_uid: uid })
  if (prepErr) {
    return NextResponse.json({ error: 'Deletion prep failed: ' + prepErr.message }, { status: 500 })
  }

  // Removes the auth user + cascades profiles and all remaining user rows.
  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr) {
    return NextResponse.json({ error: 'Account deletion failed: ' + delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
