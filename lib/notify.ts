// Notification framework (V2 Pillar — Master Plan §6). Sits on top of the
// existing `notifications` inbox table: this is the piece that was missing
// per the plan — a defined trigger map, editable copy, a saturation guard,
// and telemetry — not a new delivery mechanism.
//
// Works with either the browser client or a service-role client — pass
// whichever the caller already has. Several existing call sites already
// insert directly into `notifications` from the browser client on behalf of
// *other* users (meetup requests, chat pings, cancellations), so that trust
// model already exists in this app; this helper doesn't change it, just adds
// the template/cap/telemetry layer in front of it.

import type { SupabaseClient } from '@supabase/supabase-js'

const DAILY_CAP = 4
const CAP_WINDOW_MS = 24 * 60 * 60 * 1000

function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
}

export type NotifyResult = { sent: boolean; reason?: 'no_template' | 'inactive' | 'capped' | 'error' }

export async function sendNotification(
  client: SupabaseClient,
  params: { userId: string; type: string; vars?: Record<string, string | number> }
): Promise<NotifyResult> {
  const { userId, type, vars = {} } = params

  const { data: template } = await client
    .from('notification_templates')
    .select('title_template, body_template, link_template, priority, active')
    .eq('type', type)
    .maybeSingle()

  if (!template) return { sent: false, reason: 'no_template' }
  if (!template.active) return { sent: false, reason: 'inactive' }

  const isCritical = template.priority === 'critical'

  if (!isCritical) {
    const since = new Date(Date.now() - CAP_WINDOW_MS).toISOString()
    const { count } = await client
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('suppressed', false)
      .gte('sent_at', since)

    if ((count ?? 0) >= DAILY_CAP) {
      // Log the suppression too — this is the telemetry the plan calls out
      // as necessary to tune the cap after launch.
      await client.from('notification_log').insert({
        user_id: userId, type, channel: 'in_app', suppressed: true,
      })
      return { sent: false, reason: 'capped' }
    }
  }

  const title = render(template.title_template, vars)
  const body = render(template.body_template, vars)
  const link = template.link_template ? render(template.link_template, vars) : null

  const { error: insertError } = await client.from('notifications').insert({
    user_id: userId, type, title, body, link,
  })
  if (insertError) return { sent: false, reason: 'error' }

  await client.from('notification_log').insert({
    user_id: userId, type, channel: 'in_app', suppressed: false,
  })

  return { sent: true }
}
