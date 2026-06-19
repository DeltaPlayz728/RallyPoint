import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { findRealVenue } from '@/lib/venueFinder'
import { requireMatchingUser } from '@/lib/sessionAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EMPTY_RADIUS_KM = 15
const EMPTY_THRESHOLD = 0 // no upcoming events within radius counts as "empty"
const ALTERNATE_COUNT = 2 // how many extra ideas to propose alongside the auto-created event

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

// Score a template against the user's interests (e.g. "🎮 Gaming", "⚽ Sports") —
// strips the emoji prefix, lowercases, and checks for word-level overlap with the
// template's title/description. Best-effort personalization, not exact matching.
function interestScore(template: { title: string; description: string }, interests: string[]): number {
  if (!interests?.length) return 0
  const haystack = `${template.title} ${template.description}`.toLowerCase()
  return interests.filter(i => {
    const word = i.replace(/^[^\s]+\s/, '').toLowerCase().split(' ')[0].replace(/s$/, '')
    return word.length > 3 && haystack.includes(word)
  }).length
}

// Rank all templates for this user (highest interest match first, ties broken randomly)
function rankTemplates(interests: string[]) {
  return [...TEMPLATES]
    .map(t => ({ t, score: interestScore(t, interests), jitter: Math.random() }))
    .sort((a, b) => (b.score - a.score) || (b.jitter - a.jitter))
    .map(x => x.t)
}

// POST — check if an area looks empty; if so, auto-create one event outright and
// propose a couple of alternate ideas (picked using the user's interests) via DM.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(`seed-check:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { userId, lat, lng, city } = await req.json()
  if (!userId || typeof lat !== 'number' || typeof lng !== 'number' || !city) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!(await requireMatchingUser(req, userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: bot } = await supabaseAdmin.from('profiles').select('id').eq('is_bot', true).maybeSingle()
  if (!bot) return NextResponse.json({ error: 'Assistant not set up' }, { status: 503 })

  // Don't re-propose if the user already has a pending alternate proposal sitting unanswered
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
    .limit(500)

  const nearbyCount = (nearby ?? []).filter(
    (e: any) => e.lat != null && e.lng != null && distanceKm(lat, lng, e.lat, e.lng) <= EMPTY_RADIUS_KM
  ).length

  if (nearbyCount > EMPTY_THRESHOLD) {
    return NextResponse.json({ proposed: false, reason: 'not_empty', nearbyCount })
  }

  // Pull the user's interests (best-effort — fine if missing) to personalize which
  // idea gets auto-created vs. just suggested.
  const { data: userProfile } = await supabaseAdmin
    .from('profiles').select('interests').eq('id', userId).maybeSingle()
  const interests: string[] = userProfile?.interests ?? []

  const ranked = rankTemplates(interests)
  const primaryTemplate = ranked[0]
  const altTemplates = ranked.slice(1, 1 + ALTERNATE_COUNT)

  // Get or create the bot DM thread up front — needed either way
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

  // ── Auto-create the primary event outright (no waiting on accept) ──────────
  // Anchor it to a real nearby venue when we can find one — only worth the lookup
  // for the event that's actually going to exist.
  const venue = await findRealVenue({ lat, lng, city, templateTitle: primaryTemplate.title })
  const startsAt = nextSaturdayEvening().toISOString()

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .insert({
      created_by: bot.id,
      title: venue ? `${primaryTemplate.title} at ${venue.name}` : primaryTemplate.title,
      description: primaryTemplate.description,
      type: primaryTemplate.type,
      location: city,
      city,
      starts_at: startsAt,
      max_attendees: 8,
      price: 0,
      lat: venue?.lat ?? lat,
      lng: venue?.lng ?? lng,
      venue_name: venue?.name ?? null,
      venue_address: venue?.address ?? null,
      status: 'active',
      is_suggested: true,
      suggested_by: bot.id,
    })
    .select()
    .single()

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })

  const when = new Date(startsAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const venueLine = event.venue_name
    ? ` at ${event.venue_name}${event.venue_address ? ` (${event.venue_address})` : ''}`
    : ` around ${city}`

  await supabaseAdmin.from('dm_messages').insert({
    thread_id: thread.id,
    sender_id: bot.id,
    content: `Hey — it's pretty quiet around ${city} right now, so I went ahead and set up "${event.title}"${venueLine} for ${when}. It's live now — check it out in Events, invite people, or tweak the details. You're not auto-joined, so hop on if you're in. 🎉`,
  })

  // ── Propose a couple of alternate ideas, leaning on the user's interests ───
  const alternateProposalIds: string[] = []
  for (const altTemplate of altTemplates) {
    const altStartsAt = nextSaturdayEvening().toISOString()
    const { data: altProposal, error: altError } = await supabaseAdmin
      .from('event_proposals')
      .insert({
        user_id: userId,
        title: altTemplate.title,
        description: altTemplate.description,
        type: altTemplate.type,
        city,
        lat,
        lng,
        starts_at: altStartsAt,
        max_attendees: 8,
        price: 0,
        status: 'pending',
      })
      .select()
      .single()

    if (altError || !altProposal) continue // alternates are a bonus — don't fail the whole request over one

    const altWhen = new Date(altStartsAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })

    await supabaseAdmin.from('dm_messages').insert({
      thread_id: thread.id,
      sender_id: bot.id,
      content: `Also thought you might be into this one — "${altTemplate.title}" for ${altWhen}. Want me to set this one up too? [[PROPOSAL:${altProposal.id}]]`,
    })

    alternateProposalIds.push(altProposal.id)
  }

  return NextResponse.json({
    proposed: true,
    eventId: event.id,
    alternateProposalIds,
    threadId: thread.id,
  })
}
