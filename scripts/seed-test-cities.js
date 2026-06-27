// One-off script: seeds one real, bot-hosted "casual coffee meetup" event
// near each playtest city so testers don't open the app to an empty map.
//
// Run locally with:  node scripts/seed-test-cities.js
// (Run from the project root — it reads .env.local automatically.)

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// --- load .env.local manually (no dotenv dependency in this project) ---
const envPath = path.join(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
for (const line of envText.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  const value = trimmed.slice(idx + 1).trim()
  if (!process.env[key]) process.env[key] = value
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UA = 'RallyPoint-App/1.0 (event-seeding)'

const CITIES = [
  { query: 'Cypress, Texas, USA', city: 'Cypress' },
  { query: 'Nashville, Tennessee, USA', city: 'Nashville' },
]

const CATEGORY = {
  osmTags: ['amenity=cafe'],
  title: 'Casual coffee meetup',
  description: 'A low-key coffee hangout — come meet a few people and see who else is around.',
}

async function geocode(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`,
    { headers: { 'User-Agent': UA } }
  )
  const data = await res.json()
  if (!data?.[0]) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function findVenue(lat, lng) {
  const filters = CATEGORY.osmTags
    .map((tag) => {
      const [k, v] = tag.split('=')
      return `node["${k}"="${v}"](around:5000,${lat},${lng});way["${k}"="${v}"](around:5000,${lat},${lng});`
    })
    .join('\n')
  const query = `[out:json][timeout:15];(${filters});out center 20;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  const data = await res.json()
  const named = (data.elements ?? []).filter((el) => el.tags?.name)
  if (named.length === 0) return null
  const pick = named[Math.floor(Math.random() * named.length)]
  const pLat = pick.lat ?? pick.center?.lat
  const pLng = pick.lon ?? pick.center?.lon
  const tags = pick.tags
  const addrParts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean)
  return { name: tags.name, address: addrParts.length ? addrParts.join(' ') : null, lat: pLat, lng: pLng }
}

function nextSaturdayEvening() {
  const d = new Date()
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  d.setHours(19, 0, 0, 0)
  return d.toISOString()
}

async function main() {
  const { data: bot, error: botError } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_bot', true)
    .maybeSingle()

  if (botError || !bot) {
    console.error('Could not find bot profile (is_bot=true):', botError?.message)
    process.exit(1)
  }

  const startsAt = nextSaturdayEvening()
  const results = []

  for (const c of CITIES) {
    const coords = await geocode(c.query)
    if (!coords) {
      console.error(`Could not geocode ${c.query}`)
      continue
    }
    await new Promise((r) => setTimeout(r, 1000)) // be polite to Nominatim
    const venue = await findVenue(coords.lat, coords.lng)

    const title = venue ? `${CATEGORY.title} at ${venue.name}` : CATEGORY.title

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        created_by: bot.id,
        title,
        description: CATEGORY.description,
        type: 'casual',
        location: c.city,
        city: c.city,
        starts_at: startsAt,
        max_attendees: 8,
        price: 0,
        lat: venue?.lat ?? coords.lat,
        lng: venue?.lng ?? coords.lng,
        venue_name: venue?.name ?? null,
        venue_address: venue?.address ?? null,
        status: 'active',
        is_suggested: true,
        suggested_by: bot.id,
      })
      .select()
      .single()

    if (eventError) {
      console.error(`Failed to insert event for ${c.city}:`, eventError.message)
      continue
    }

    await supabase.from('event_chats').insert({ event_id: event.id })

    results.push({ city: c.city, title: event.title, venue_address: event.venue_address, event_id: event.id })
    await new Promise((r) => setTimeout(r, 1000))
  }

  console.log(JSON.stringify(results, null, 2))
}

main()
