import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { requireMatchingUser } from '@/lib/sessionAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(`report:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many reports submitted' }, { status: 429 })
  }

  const { reporterId, targetType, targetId, reason, details } = await req.json()

  if (!reporterId || !targetType || !targetId || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  // reporterId must match the actual signed-in session — otherwise anyone
  // could file reports "as" someone else, polluting moderation data and
  // potentially triggering auto-suspension logic attributed to the wrong user.
  if (!(await requireMatchingUser(req, reporterId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details ?? null,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
