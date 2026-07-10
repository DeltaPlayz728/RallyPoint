import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUserId } from '@/lib/sessionAuth'

// Server-side only, service role. This is the ONLY place a host's feedback
// is ever read — deliberately not an RLS policy on event_ratings, because
// RLS can't conditionally withhold a single column (user_id) or shuffle/
// aggregate rows. Exposing raw rows to the host at all, even with user_id
// present, would let them match a note to a specific attendee by
// elimination against the attendee list. This route enforces two things
// no RLS policy could: (1) nothing at all comes back below 5 responses,
// and (2) the notes that do come back never carry who wrote them.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MIN_RESPONSES = 5

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params

  const sessionUserId = await getSessionUserId(req)
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title, created_by')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (event.created_by !== sessionUserId) {
    return NextResponse.json({ error: 'Only the host can view this event\'s feedback' }, { status: 403 })
  }

  const { data: ratings } = await supabaseAdmin
    .from('event_ratings')
    .select('rating, venue_score, organization_score, return_intent, note')
    .eq('event_id', eventId)

  const rows = ratings ?? []
  const responseCount = rows.length

  if (responseCount < MIN_RESPONSES) {
    return NextResponse.json({ ready: false, responseCount, threshold: MIN_RESPONSES })
  }

  const avg = (vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v !== null && v !== undefined)
    return present.length > 0 ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null
  }

  const returnIntents = rows.map(r => r.return_intent).filter((v): v is boolean => v !== null && v !== undefined)
  const returnIntentRate = returnIntents.length > 0
    ? Math.round((returnIntents.filter(Boolean).length / returnIntents.length) * 100)
    : null

  const notes = shuffle(rows.map(r => r.note).filter((n): n is string => !!n && n.trim().length > 0))

  return NextResponse.json({
    ready: true,
    responseCount,
    avgOverall: avg(rows.map(r => r.rating)),
    avgVenue: avg(rows.map(r => r.venue_score)),
    avgOrganization: avg(rows.map(r => r.organization_score)),
    returnIntentRate,
    notes,
  })
}
