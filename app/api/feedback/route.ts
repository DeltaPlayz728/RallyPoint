import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { requireMatchingUser } from '@/lib/sessionAuth'
import { getAdminUser } from '@/lib/adminAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Logged-in users submit feedback during the playtest.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(`feedback:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too much feedback submitted — try again later' }, { status: 429 })
  }

  const { userId, message, pageUrl } = await req.json()

  if (!userId || !message || !message.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }
  // userId must match the actual signed-in session — same impersonation
  // guard as the report endpoint, otherwise anyone could file feedback "as"
  // another user.
  if (!(await requireMatchingUser(req, userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('feedback').insert({
    user_id: userId,
    message: message.trim(),
    page_url: typeof pageUrl === 'string' ? pageUrl.slice(0, 500) : null,
    status: 'new',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Admin-only: list feedback for the live admin queue.
export async function GET(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('feedback')
    .select('id, user_id, message, page_url, status, created_at, profiles!feedback_user_id_fkey(username, full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Admin-only: mark a feedback item reviewed.
export async function PATCH(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, status } = await req.json()
  if (!id || !['new', 'reviewed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('feedback')
    .update({ status })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
