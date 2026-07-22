import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { startCronRun, finishCronRun } from '@/lib/cronHeartbeat'
import { sendNotification } from '@/lib/notify'

// Runs hourly (see vercel.json). Nudges attendees to rate an event ~3h after
// it ends. The app has no explicit event-duration field, so this reuses the
// same "+2h = end time" assumption the in-app rating prompt already uses
// (see the showRating logic in app/events/[id]/page.tsx) — end time = 2h
// after starts_at, so the 3h-post-end prompt fires ~5h after starts_at.
// This notification is a nudge only; the actual rating UI (RatingModal)
// already exists and self-triggers when the attendee opens the event page.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ASSUMED_DURATION_HRS = 2
const PROMPT_DELAY_HRS = 3

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun(supabaseAdmin, 'feedback-prompts')
  try {
    const now = Date.now()
    const totalOffsetHrs = ASSUMED_DURATION_HRS + PROMPT_DELAY_HRS // 5h after starts_at
    // 4.5-5.5h window tolerates hourly drift
    const from = new Date(now - (totalOffsetHrs + 0.5) * 3600_000).toISOString()
    const to = new Date(now - (totalOffsetHrs - 0.5) * 3600_000).toISOString()

    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, title')
      .eq('status', 'active')
      .gte('starts_at', from)
      .lte('starts_at', to)

    let sent = 0
    for (const event of events ?? []) {
      const { data: attendees } = await supabaseAdmin
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('rsvp_status', 'going')

      const { data: rated } = await supabaseAdmin
        .from('event_ratings')
        .select('user_id')
        .eq('event_id', event.id)
      const ratedUserIds = new Set((rated ?? []).map(r => r.user_id))

      for (const a of attendees ?? []) {
        if (ratedUserIds.has(a.user_id)) continue

        const { count: alreadyNotified } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', a.user_id)
          .eq('type', 'feedback_prompt')
          .eq('link', `/events/${event.id}`)
        if ((alreadyNotified ?? 0) > 0) continue

        const result = await sendNotification(supabaseAdmin, {
          userId: a.user_id,
          type: 'feedback_prompt',
          vars: { event_name: event.title, event_id: event.id },
        })
        if (result.sent) sent++
      }
    }

    await finishCronRun(supabaseAdmin, runId, sent)
    return NextResponse.json({ ok: true, sent })
  } catch (err: any) {
    await finishCronRun(supabaseAdmin, runId, 0, err?.message ?? 'unknown error')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
