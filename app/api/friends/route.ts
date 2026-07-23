import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { requireMatchingUser } from '@/lib/sessionAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST — send friend request
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(`friends:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { requesterId, receiverId } = await req.json()
  if (!requesterId || !receiverId || requesterId === receiverId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  // receiverId is interpolated into the PostgREST .or() filter below and used
  // as an insert value — require a well-formed UUID so it can't inject filter
  // syntax or create junk friendship rows / notifications for bogus ids.
  if (!UUID_RE.test(receiverId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  // requesterId must match the actual signed-in session — otherwise anyone
  // could send friend requests "as" someone else just by knowing their id.
  if (!(await requireMatchingUser(req, requesterId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if a friendship already exists in either direction
  const { data: existing } = await supabaseAdmin
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${requesterId},receiver_id.eq.${receiverId}),` +
      `and(requester_id.eq.${receiverId},receiver_id.eq.${requesterId})`
    )
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Friendship already exists', status: existing.status }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('friendships')
    .insert({ requester_id: requesterId, receiver_id: receiverId, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify receiver
  const { data: requesterProfile } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name')
    .eq('id', requesterId)
    .maybeSingle()

  const name = requesterProfile?.username
    ? `@${requesterProfile.username}`
    : requesterProfile?.full_name ?? 'Someone'

  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'friend_request',
    title: `${name} wants to be friends`,
    body: 'Tap to accept or decline.',
    link: '/friends',
  })

  return NextResponse.json({ friendship: data })
}

// PATCH — accept or decline
export async function PATCH(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(`friends-patch:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { friendshipId, userId, action } = await req.json()
  if (!friendshipId || !userId || !['accepted', 'declined'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!(await requireMatchingUser(req, userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('friendships')
    .update({ status: action })
    .eq('id', friendshipId)
    .eq('receiver_id', userId) // only receiver can accept/decline
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify requester if accepted
  if (action === 'accepted') {
    const { data: receiverProfile } = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .maybeSingle()

    const name = receiverProfile?.username
      ? `@${receiverProfile.username}`
      : receiverProfile?.full_name ?? 'Someone'

    await supabaseAdmin.from('notifications').insert({
      user_id: data.requester_id,
      type: 'friend_accepted',
      title: `${name} accepted your friend request`,
      body: 'You are now friends on RallyPoint.',
      link: `/profile/${userId}`,
    })
  }

  return NextResponse.json({ friendship: data })
}

// DELETE — cancel request or unfriend
export async function DELETE(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (await isRateLimited(`friends-delete:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { friendshipId, userId } = await req.json()
  if (!(await requireMatchingUser(req, userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabaseAdmin
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
