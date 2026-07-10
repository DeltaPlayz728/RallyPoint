import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/adminAuth'
import { sendNotification } from '@/lib/notify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('patch_notes')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Publishing fans out an in-app notification to every user via the existing
// notification framework (lib/notify.ts) — same template/saturation-cap
// machinery as every other notification type. At current user counts this
// loop is trivial; if the user base grows meaningfully this should become a
// batched/cron-driven fan-out instead of an inline loop in the request
// handler, same caveat as the rest of the notification framework's
// in-memory rate limiter (lib/rateLimit.ts already documents the same
// "fine for MVP, revisit before scaling" posture).
export async function POST(req: NextRequest) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { version, title, body_markdown, severity } = await req.json()
  if (!version || !title || !body_markdown) {
    return NextResponse.json({ error: 'version, title, and body_markdown are required' }, { status: 400 })
  }

  const { data: patch, error } = await supabaseAdmin
    .from('patch_notes')
    .insert({ version, title, body_markdown, severity: severity ?? 'standard' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await supabaseAdmin.from('profiles').select('id')
  let notified = 0
  for (const p of profiles ?? []) {
    const result = await sendNotification(supabaseAdmin, {
      userId: p.id,
      type: 'patch_note',
      vars: { title: patch.title },
    })
    if (result.sent) notified++
  }

  return NextResponse.json({ patch, notified })
}
