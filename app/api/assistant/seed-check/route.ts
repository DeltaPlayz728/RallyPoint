import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EMPTY_RADIUS_KM = 15
const EMPTY_THRESHOLD = 0 // no upcoming events within radius counts as "empty"

const TEMPLATES = [
  { title: 'Casual coffee meetup', type: 'casual', description: 'A low-key coffee hangout — come meet a few people and see who else is around.' },
  { title: 'Board game night', type: 'casual', description: "Bring a game or just show up — we'll figure it out together." },
  { title: 'Pickup sports meetup', type: 'casual', description: 'Whoever shows up plays. No pressure, just movement and fresh air.' },
  { title: 'Trivia night', type: 'social', description: "Casual trivia, no team required — we'll sort teams when people arrive." },
  { title: 'Sunset walk & talk', type: 'casual', description: 'An easy walk for anyone who wants to get outside and meet people nearby.' },
]

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nextSaturdayEvening(): Date {
  const d = new Date()
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  d.setHours(19, 0, 0, 0)
  return d
}

// POST — check if an area looks empty; if so, create a pending proposal + bot DM
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(`seed-check:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { userId, lat, lng, city } = await req.json()
  if (!userId || typeof lat !== 'number' || typeof lng !== 'number' || !city) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: bot } = await supabaseAdmin.from('profiles').select('id').eq('is_bot', true).maybeSingle()
  if (!bot) return NextResponse.json({ error: 'Assistant not set up' }, { status: 503 })

  // Don't re-propose if the user already has a pending proposal
  const { data: pending } = await supabaseAdmin
    .from('event_proposals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) {
    return NextResponse.json({ proposed: false, reason: 'already_pending' })
  }

  // Check if the area genuinely looks empty
  const { data: nearby } = await supabaseAdmin
    .from('events')
    .select('id, lat, lng')
    .eq('status', 'active')
    .gte('starts_at', new Date().toISOString())

  const nearbyCount = (nearby ?? []).filter(
    (e: any) => e.lat != null && e.lng != null && distanceKm(lat, lng, e.lat, e.lng) <= EMPTY_RADIUS_KM
  ).length

  if (nearbyCount > EMPTY_THRESHOLD) {
    return NextResponse.json({ proposed: false, reason: 'not_empty', nearbyCount })
  }

  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]

  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from('event_proposals')
    .insert({
      user_id: userId,
      title: template.title,
      description: template.description,
      type: template.type,
      city,
      lat,
      lng,
      starts_at: nextSaturdayEvening().toISOString(),
      max_attendees: 8,
      price: 0,
      status: 'pending',
    })
    .select()
    .single()

  if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 500 })

  // Get or create the bot DM thread, sorted per the user_a < user_b constraint
  const userA = userId < bot.id ? userId : bot.id
  const userB = userId < bot.id ? bot.id : userId

  let { data: thread } = await supabaseAdmin
    .from('dm_threads').select('id').eq('user_a', userA).eq('user_b', userB).maybeSingle()

  if (!thread) {
    const { data: created } = await supabaseAdmin
      .from('dm_threads').insert({ user_a: userA, user_b: userB }).select('id').single()
    thread = created
  }
  if (!thread) return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })

  const when = new Date(proposal.starts_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  await supabaseAdmin.from('dm_messages').insert({
    thread_id: thread.id,
    sender_id: bot.id,
    content: `Hey — it's pretty quiet around ${city} right now. Want me to set up a "${template.title}" for ${when}? It'd be marked as suggested by me, and you (or anyone) can still tweak the details after. [[PROPOSAL:${proposal.id}]]`,
  })

  return NextResponse.json({ proposed: true, proposalId: proposal.id, threadId: thread.id })
}
