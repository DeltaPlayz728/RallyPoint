import { createClient } from '@supabase/supabase-js'

// Server-side only. Service-role key so this works for logged-out visitors
// (events_select RLS requires auth.role() = 'authenticated', which anon
// share-link viewers never satisfy). We deliberately select a narrow,
// public-safe field list here rather than `select('*')` — exact street
// address (`location`), the full attendee roster, and anything else
// sensitive must never flow through this helper. If you need another
// field, add it to the select list explicitly and re-check it's safe to
// show a logged-out stranger.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type PublicEvent = {
  id: string
  title: string
  description: string | null
  type: 'casual' | 'social'
  city: string
  starts_at: string
  max_attendees: number | null
  price: number
  is_suggested?: boolean
  hostName: string
  attendeeCount: number
  rules: { id: string; text: string; category: string | null }[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Fetch the public-safe teaser view of an event for logged-out share-link
 * viewers. Returns null if the id is malformed, the event doesn't exist,
 * or the event isn't active (cancelled/etc. events aren't shareable).
 * Never returns the exact `location`, host id, or attendee list.
 */
export async function getPublicEvent(id: string): Promise<PublicEvent | null> {
  if (!UUID_RE.test(id)) return null

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title, description, type, city, starts_at, max_attendees, price, status, is_suggested, created_by')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (!event) return null

  const [{ data: host }, { count }, { data: ruleRows }] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name, username').eq('id', event.created_by).maybeSingle(),
    supabaseAdmin.from('event_attendees').select('*', { count: 'exact', head: true }).eq('event_id', id).eq('rsvp_status', 'going'),
    supabaseAdmin.from('event_rules').select('id, custom_text, position, rule_templates(category, body_text)').eq('event_id', id).order('position', { ascending: true }),
  ])

  const hostName = host?.username ? `@${host.username}` : host?.full_name ?? 'A RallyPoint host'
  const rules = (ruleRows ?? []).map((r: any) => ({
    id: r.id,
    text: r.custom_text ?? r.rule_templates?.body_text ?? '',
    category: r.rule_templates?.category ?? null,
  }))

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    city: event.city,
    starts_at: event.starts_at,
    max_attendees: event.max_attendees,
    price: event.price,
    is_suggested: event.is_suggested,
    hostName,
    attendeeCount: count ?? 0,
    rules,
  }
}
