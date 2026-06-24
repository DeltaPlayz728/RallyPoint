import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'

// Reads use the anon key (public data); writes use the service role key so the
// overly-permissive "any authenticated user can write venues" RLS policies can be
// removed without breaking this server-side cache job.
const supabaseRead = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const supabaseWrite = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Venue types to pull from Google Places
const VENUE_TYPES = [
  'bowling_alley',
  'bar',
  'cafe',
  'park',
  'night_club',
  'gym',
  'restaurant',
  'movie_theater',
  'amusement_park',
  'stadium',
]

const CACHE_HOURS = 24

export async function GET(req: NextRequest) {
  // Rate limit: 60 venue fetches per IP per hour (generous — it's cached anyway)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(`venues:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') || '51.5719'
  const lng  = searchParams.get('lng')  || '4.7683'
  const city = searchParams.get('city') || 'Breda'

  // Return cached venues if fresh enough
  const cacheThreshold = new Date(
    Date.now() - CACHE_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data: cached } = await supabaseRead
    .from('venues')
    .select('*')
    .eq('city', city)
    .gt('cached_at', cacheThreshold)
    .limit(200)

  if (cached && cached.length > 5) {
    return NextResponse.json({ venues: cached })
  }

  // No API key = return whatever is cached (may be stale or empty)
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      venues: cached ?? [],
      note: 'GOOGLE_PLACES_API_KEY not configured — showing cached venues only',
    })
  }

  // Fetch from Google Places Nearby Search
  const seen = new Set<string>()
  const allVenues: any[] = []

  await Promise.all(
    VENUE_TYPES.map(async (type) => {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?location=${lat},${lng}&radius=5000&type=${type}&key=${apiKey}`
        const res = await fetch(url, { next: { revalidate: 0 } })
        const data = await res.json()
        if (data.results) {
          for (const place of data.results) {
            if (!seen.has(place.place_id)) {
              seen.add(place.place_id)
              allVenues.push(place)
            }
          }
        }
      } catch {
        // Skip this type on error
      }
    })
  )

  // Upsert to cache
  if (allVenues.length > 0) {
    const toUpsert = allVenues.map((v) => ({
      place_id: v.place_id,
      name: v.name,
      lat: v.geometry.location.lat,
      lng: v.geometry.location.lng,
      types: v.types ?? [],
      vicinity: v.vicinity ?? '',
      city,
      cached_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabaseWrite
      .from('venues')
      .upsert(toUpsert, { onConflict: 'place_id' })
    if (upsertError) {
      console.error('venues upsert failed:', upsertError.message)
    }

    return NextResponse.json({ venues: toUpsert })
  }

  return NextResponse.json({ venues: cached ?? [] })
}
