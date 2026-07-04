import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUserId } from '@/lib/sessionAuth'

// GDPR data export — returns everything we hold on the requesting user as a
// downloadable JSON. Service role so it can read across the user's rows.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // (label, table, column that references the user)
  const sources: [string, string, string][] = [
    ['profile', 'profiles', 'id'],
    ['events_created', 'events', 'created_by'],
    ['event_rsvps', 'event_attendees', 'user_id'],
    ['event_ratings', 'event_ratings', 'user_id'],
    ['event_chat_messages', 'messages', 'user_id'],
    ['meetup_requests_sent', 'meetup_requests', 'sender_id'],
    ['meetup_requests_received', 'meetup_requests', 'receiver_id'],
    ['friendships_sent', 'friendships', 'requester_id'],
    ['friendships_received', 'friendships', 'receiver_id'],
    ['dm_messages', 'dm_messages', 'sender_id'],
    ['notifications', 'notifications', 'user_id'],
    ['feedback', 'feedback', 'user_id'],
    ['liked_places', 'venue_likes', 'user_id'],
    ['payments', 'payments', 'user_id'],
    ['communities_owned', 'communities', 'owner_id'],
    ['community_memberships', 'community_members', 'user_id'],
    ['community_messages', 'community_messages', 'sender_id'],
  ]

  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: uid }
  for (const [label, table, col] of sources) {
    const { data } = await admin.from(table).select('*').eq(col, uid)
    out[label] = data ?? []
  }

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="rallypoint-my-data.json"',
      'Cache-Control': 'no-store',
    },
  })
}
