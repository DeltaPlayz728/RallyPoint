import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'

// Server-side only. Uses the service-role key so it can read/write the venues
// cache regardless of RLS (venues are no longer anon-readable).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CACHE_HOURS = 24
const RADIUS_M = 5000

// Map an OSM element's tags to one of the app's venue "types" (drives the pin icon).
function osmType(tags: Record<string, string> = {}): string | null {
  const a = tags.amenity
  const l = tags.leisure
  if (a === 'bar' || a === 'pub') return 'bar'
  if (a === 'cafe') return 'cafe'
  if (a === 'nightclub') return 'night_club'
  if (a === 'cinema') return 'movie_theater'
  if (a === 'restaurant' || a === 'fast_food') return 'restaurant'
  if (l === 'bowling_alley') return 'bowling_alley'
  if (l === 'amusement_arcade') return 'amusement_park'
  if (l === 'fitness_centre' || l === 'sports_centre') return 'gym'
  if (l === 'park') return 'park'
  if (l === 'stadium') return 'stadium'
  if (tags.tourism === 'theme_park') return 'amusement_park'
  return null
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(`venues:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '51.5719')
  const lng = parseFloat(searchParams.get('lng') || '4.7683')
  // Cache key: the real city if provided, else a coarse lat/lng cell (~11 km) so
  // users in different areas don't share one cache bucket.
  const city = searchParams.get('city') || `@${lat.toFixed(1)},${lng.toFixed(1)}`

  // Cache by city — Overpass is a shared free service, so lean on the 24h cache.
  const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('venues')
    .select('*')
    .eq('city', city)
    .gt('cached_at', cacheThreshold)
    .limit(200)
  if (cached && cached.length > 5) {
    return NextResponse.json({ venues: cached })
  }

  // Query OpenStreetMap via Overpass (free, no API key).
  const filters = [
    'node["amenity"~"^(bar|pub|cafe|nightclub|cinema|restaurant|fast_food)$"]',
    'way["amenity"~"^(bar|pub|cafe|nightclub|cinema|restaurant|fast_food)$"]',
    'node["leisure"~"^(bowling_alley|amusement_arcade|fitness_centre|sports_centre|park|stadium)$"]',
    'way["leisure"~"^(bowling_alley|amusement_arcade|fitness_centre|sports_centre|park|stadium)$"]',
    'node["tourism"="theme_park"]',
    'way["tourism"="theme_park"]',
  ]
    .map((f) => `${f}(around:${RADIUS_M},${lat},${lng});`)
    .join('')
  const query = `[out:json][timeout:25];(${filters});out center 80;`

  const venues: any[] = []
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    })
    const data = await res.json()
    const seen = new Set<string>()
    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {}
      const name: string | undefined = tags.name
      const t = osmType(tags)
      if (!name || !t) continue
      const pid = `osm:${el.type}/${el.id}`
      if (seen.has(pid)) continue
      const vlat = el.lat ?? el.center?.lat
      const vlng = el.lon ?? el.center?.lon
      if (vlat == null || vlng == null) continue
      seen.add(pid)
      venues.push({
        place_id: pid,
        name,
        lat: vlat,
        lng: vlng,
        types: [t],
        vicinity: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', '),
        city,
        cached_at: new Date().toISOString(),
      })
    }
  } catch {
    return NextResponse.json({ venues: cached ?? [] })
  }

  if (venues.length > 0) {
    const { error } = await supabase.from('venues').upsert(venues, { onConflict: 'place_id' })
    if (error) console.error('venues upsert failed:', error.message)
    return NextResponse.json({ venues })
  }
  return NextResponse.json({ venues: cached ?? [] })
}
