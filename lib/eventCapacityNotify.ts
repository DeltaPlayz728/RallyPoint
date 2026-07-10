// Capacity-threshold notifications (25% → host, 75% → attendees), triggered
// inline right after an attendee joins rather than on a polling cron — the
// spec (Master Plan §6) lists these under cron-driven "Create/Share phase"
// triggers, but a capacity crossing is an event-driven state change tied
// directly to a join action, so checking it inline is both simpler and more
// timely than waiting for a poll. Deviation from the doc, noted here
// deliberately.
//
// Call this after any successful event_attendees insert.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/lib/notify'

export async function checkCapacityMilestones(client: SupabaseClient, eventId: string) {
  const { data: event } = await client
    .from('events')
    .select('id, title, created_by, max_attendees, notified_25pct, notified_75pct')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || !event.max_attendees) return // "open to all" events have no capacity to measure against

  const { count } = await client
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)

  const attendeeCount = count ?? 0
  const ratio = attendeeCount / event.max_attendees

  if (ratio >= 0.25 && !event.notified_25pct) {
    await sendNotification(client, {
      userId: event.created_by,
      type: 'event_25_capacity',
      vars: { event_name: event.title, count: attendeeCount, event_id: event.id },
    })
    await client.from('events').update({ notified_25pct: true }).eq('id', eventId)
  }

  if (ratio >= 0.75 && !event.notified_75pct) {
    const spotsLeft = Math.max(0, event.max_attendees - attendeeCount)
    const { data: attendees } = await client
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
    for (const a of attendees ?? []) {
      await sendNotification(client, {
        userId: a.user_id,
        type: 'event_75_capacity',
        vars: { event_name: event.title, spots_left: spotsLeft, event_id: event.id },
      })
    }
    await client.from('events').update({ notified_75pct: true }).eq('id', eventId)
  }
}
