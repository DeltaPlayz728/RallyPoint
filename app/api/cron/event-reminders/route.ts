import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { startCronRun, finishCronRun } from '@/lib/cronHeartbeat'
import { sendNotification } from '@/lib/notify'

// Hourly cron (see vercel.json). Handles both the 24h and 2h attendee
// reminders in one job, per the consolidated cron table in
// RallyPoint_V2_EXECUTION_PLAN.md (adopted from the Development Game Plan).
//
// Idempotency: rather than adding a new table, this checks the existing
// `notifications` inbox for a prior row of the same type + link for that
// user — since notifications already stores exactly that, a dedicated
// dedup table would just be replicating it. A 2-hour match window per
// reminder tolerates the hourly cadence without double-sending (the inbox
// check catches the case where two runs both fall inside the window).

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

async function alreadySent(userId: string, type: string, eventId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('link', `/events/${eventId}`)
  return (count ?? 0) > 0
}

async function runWindow(type: 'event_reminder_24h' | 'event_reminder_2h', windowStartHrs: number, windowEndHrs: number) {
  const now = Date.now()
  const from = new Date(now + windowStartHrs * 3600_000).toISOString()
  const to = new Date(now + windowEndHrs * 3600_000).toISOString()

  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id, title, location, starts_at')
    .eq('status', 'active')
    .gte('starts_at', from)
    .lte('starts_at', to)

  let sent = 0
  for (const event of events ?? []) {
    const { data: attendees } = await supabaseAdmin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', event.id)

    for (const a of attendees ?? []) {
      if (await alreadySent(a.user_id, type, event.id)) continue
      const result = await sendNotification(supabaseAdmin, {
        userId: a.user_id,
        type,
        vars: {
          event_name: event.title,
          venue_name: event.location,
          date_short: formatShortDate(event.starts_at),
          time: formatTime(event.starts_at),
          attendee_count: attendees?.length ?? 0,
          event_id: event.id,
        },
      })
      if (result.sent) sent++
    }
  }
  return sent
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun(supabaseAdmin, 'event-reminders')
  try {
    const sent24h = await runWindow('event_reminder_24h', 23, 25)
    const sent2h = await runWindow('event_reminder_2h', 1.5, 2.5)
    const total = sent24h + sent2h
    await finishCronRun(supabaseAdmin, runId, total)
    return NextResponse.json({ ok: true, sent24h, sent2h })
  } catch (err: any) {
    await finishCronRun(supabaseAdmin, runId, 0, err?.message ?? 'unknown error')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
