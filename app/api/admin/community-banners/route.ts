import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/adminAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('community_banner_submissions')
    .select('*, communities(name), profiles!submitted_by(username, full_name)')
    .eq('approved', false)
    .eq('rejected', false)
    .order('submitted_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Approving is the ONLY path that's allowed to write communities.banner_url /
// icon_url — the DB trigger (block_direct_banner_icon_update) rejects the
// same write from an authenticated (non-service-role) connection, so this
// route is genuinely the sole way that column changes, not just the
// intended one.
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, decision } = await req.json() // decision: 'approve' | 'reject'
  if (!id || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: submission } = await supabaseAdmin
    .from('community_banner_submissions')
    .select('id, community_id, asset_type, asset_url')
    .eq('id', id)
    .maybeSingle()

  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (decision === 'approve') {
    const column = submission.asset_type === 'banner' ? 'banner_url' : 'icon_url'
    const { error: updateError } = await supabaseAdmin
      .from('communities')
      .update({ [column]: submission.asset_url })
      .eq('id', submission.community_id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error } = await supabaseAdmin
    .from('community_banner_submissions')
    .update({
      approved: decision === 'approve',
      rejected: decision === 'reject',
      approved_at: new Date().toISOString(),
      approved_by: admin.id,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
