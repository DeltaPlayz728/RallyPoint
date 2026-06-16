import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// POST — accept or decline a bot-proposed event
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(`seed-confirm:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { userId, proposalId, accept } = await req.json()
  if (!userId || !proposalId || typeof accept !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: proposal } = await supabaseAdmin
    .from('event_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'Proposal already resolved' }, { status: 409 })
  }

  const { data: bot } = await supabaseAdmin.from('profiles').select('id').eq('is_bot', true).maybeSingle()
  if (!bot) return NextResponse.json({ error: 'Assistant not set up' }, { status: 503 })

  const userA = userId < bot.id ? userId : bot.id
  const userB = userId < bot.id ? bot.id : userId
  const { data: thread } = await supabaseAdmin
    .from('dm_threads').select('id').eq('user_a', userA).eq('user_b', userB).maybeSingle()

  if (!accept) {
    await supabaseAdmin.from('event_proposals').update({ status: 'declined' }).eq('id', proposalId)
    if (thread) {
      await supabaseAdmin.from('dm_messages').insert({
        thread_id: thread.id,
        sender_id: bot.id,
        content: 'No worries — I\'ll keep an eye out and check back if it stays quiet.',
      })
    }
    return NextResponse.json({ accepted: false })
  }

  // Create the real event, owned by the bot but disclosed as suggested
  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .insert({
      created_by: bot.id,
      title: proposal.title,
      description: proposal.description,
      type: proposal.type,
      location: proposal.city,
      city: proposal.city,
      starts_at: proposal.starts_at,
      max_attendees: proposal.max_attendees,
      price: proposal.price,
      lat: proposal.lat,
      lng: proposal.lng,
      status: 'active',
      is_suggested: true,
      suggested_by: bot.id,
    })
    .select()
    .single()

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })

  // Auto-join the accepting user + auto-create chat room, matching normal event creation
  await supabaseAdmin.from('event_attendees').insert({ event_id: event.id, user_id: userId })
  await supabaseAdmin.from('event_chats').insert({ event_id: event.id })

  await supabaseAdmin.from('event_proposals')
    .update({ status: 'accepted', created_event_id: event.id })
    .eq('id', proposalId)

  if (thread) {
    await supabaseAdmin.from('dm_messages').insert({
      thread_id: thread.id,
      sender_id: bot.id,
      content: `Done — "${event.title}" is live and you're on the list. Invite a few people to get it going! 🎉`,
    })
  }

  return NextResponse.json({ accepted: true, event })
}
