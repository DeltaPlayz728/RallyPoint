import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'

// Overpass's public instance is frequently slow (10-25s+ for a first-time
// query in a new area) — the platform default function timeout is well
// under that, so a cold lookup could get killed mid-request with nothing
// logged. Give it real headroom.
export const maxDuration = 30

// Server-side only. Service-role key so it can read/write the shared venues table
// regardless of RLS (venues are no longer anon-readable).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RADIUS_M = 5000
// If the shared DB already has at least this many venues near the user, serve those
// and skip Overpass. Otherwise this user "fills in" the area (crowdsourced hubs).
const ENOUGH_NEARBY = 12

// "Destination" venues auto-circled as Event Hubs (where you'd host/attend an event),
// around any user worldwide. Everyday spots (cafe/bar/restaurant/park/gym) stay as
// small pins so the map doesn't turn into a wall of circles. Tune this set to taste.
const HUB_CATEGORIES = new Set(['bowling_alley', 'movie_theater', 'amusement_park', 'stadium', 'night_club'])

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
  if (await isRateLimited(`venues:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  let lat = parseFloat(searchParams.get('lat') || '51.5719')
  let lng = parseFloat(searchParams.get('lng') || '4.7683')

  // Garbage/out-of-range coordinates (NaN, "999999", etc.) were previously
  // accepted as-is and still forwarded to the public Overpass API — free
  // cost-abuse vector with no benefit to a real user. Fall back to the
  // default location instead of trusting unvalidated input.
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) lat = 51.5719
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) lng = 4.7683

  const city = searchParams.get('city') || `@${lat.toFixed(1)},${lng.toFixed(1)}`

  // Bounding box (~RADIUS_M) around the user.
  const dLat = RADIUS_M / 111000
  const dLng = RADIUS_M / (111000 * Math.cos((lat * Math.PI) / 180))

  // Serve the shared, permanent venue set near this location — everything any user
  // has ever contributed here. This is the "users as hubs" effect.
  const { data: nearby } = await supabase
    .from('cached_venues')
    .select('*')
    .gte('lat', lat - dLat).lte('lat', lat + dLat)
    .gte('lng', lng - dLng).lte('lng', lng + dLng)
    .limit(300)
  if (nearby && nearby.length >= ENOUGH_NEARBY) {
    return NextResponse.json({ venues: nearby })
  }

  // Sparse area → this user fills it in: pull from OpenStreetMap and save permanently.
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

  const fresh: any[] = []
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: AbortSignal.timeout(28000),
    })
    if (!res.ok) {
      console.error(`venues: Overpass returned ${res.status} for (${lat},${lng})`)
      return NextResponse.json({ venues: nearby ?? [] })
    }
    const data = await res.json()
    console.log(`venues: Overpass returned ${data.elements?.length ?? 0} raw elements for (${lat},${lng})`)
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
      fresh.push({
        place_id: pid,
        name,
        lat: vlat,
        lng: vlng,
        types: [t],
        vicinity: [[tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '), tags['addr:city']].filter(Boolean).join(', '),
        city,
        is_hub: HUB_CATEGORIES.has(t),
        cached_at: new Date().toISOString(),
      })
    }
  } catch (e: any) {
    console.error(`venues: Overpass fetch failed for (${lat},${lng}):`, e?.message ?? e)
    return NextResponse.json({ venues: nearby ?? [] })
  }

  if (fresh.length > 0) {
    const { error } = await supabase.from('cached_venues').upsert(fresh, { onConflict: 'place_id' })
    if (error) console.error('venues upsert failed:', error.message)
    // Merge what was already there with the new finds (dedup on place_id).
    const freshIds = new Set(fresh.map((v) => v.place_id))
    const merged = [...fresh, ...(nearby ?? []).filter((v: any) => !freshIds.has(v.place_id))]
    return NextResponse.json({ venues: merged })
  }
  return NextResponse.json({ venues: nearby ?? [] })
}
