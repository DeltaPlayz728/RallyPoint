import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { startCronRun, finishCronRun } from '@/lib/cronHeartbeat'
import { sendNotification } from '@/lib/notify'

// Runs hourly (see vercel.json) — nudges a host whose event has zero RSVPs
// 48h after publish. "Zero RSVPs" excludes the host's own auto-join row
// (every event creator is auto-inserted into event_attendees at creation —
// see app/events/create/page.tsx — so the real signal is attendee count
// among non-hosts).

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun(supabaseAdmin, 'no-rsvp-nudge')
  try {
    const now = Date.now()
    // Published 47-49h ago — a 2h window tolerates hourly drift; the
    // notifications-table idempotency check below prevents double-sends if
    // more than one run catches the same event.
    const from = new Date(now - 49 * 3600_000).toISOString()
    const to = new Date(now - 47 * 3600_000).toISOString()

    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, title, created_by, created_at')
      .eq('status', 'active')
      .gte('created_at', from)
      .lte('created_at', to)

    let sent = 0
    for (const event of events ?? []) {
      const { count: nonHostAttendees } = await supabaseAdmin
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('rsvp_status', 'going')
        .neq('user_id', event.created_by)

      if ((nonHostAttendees ?? 0) > 0) continue

      const { count: alreadyNotified } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', event.created_by)
        .eq('type', 'event_no_rsvp_48h')
        .eq('link', `/events/${event.id}`)
      if ((alreadyNotified ?? 0) > 0) continue

      const result = await sendNotification(supabaseAdmin, {
        userId: event.created_by,
        type: 'event_no_rsvp_48h',
        vars: { event_name: event.title, event_id: event.id },
      })
      if (result.sent) sent++
    }

    await finishCronRun(supabaseAdmin, runId, sent)
    return NextResponse.json({ ok: true, sent })
  } catch (err: any) {
    await finishCronRun(supabaseAdmin, runId, 0, err?.message ?? 'unknown error')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
