// RallyPoint — real-venue lookup for AI-suggested events.
//
// Primary mechanism: OpenStreetMap (Overpass + Nominatim) — free, no API key,
// works right now. Fallback mechanism: Anthropic's web_search tool — only
// runs if ANTHROPIC_API_KEY is set. Until that key is added (deliberately
// deferred to the full launch phase), this fallback is a no-op and the
// feature relies entirely on the free OSM path. No tokens are spent unless
// OSM genuinely finds nothing AND the key exists.

export type VenueLookup = {
  name: string
  address: string
  lat: number
  lng: number
}

type TemplateCategory = {
  osmTags: string[]   // 'amenity=cafe' style filters, tried in order, first match wins
  searchTerm: string  // used only by the web-search fallback
}

const CATEGORY_MAP: Record<string, TemplateCategory> = {
  'Casual coffee meetup': { osmTags: ['amenity=cafe'], searchTerm: 'coffee shop' },
  'Board game night': { osmTags: ['amenity=cafe', 'amenity=pub'], searchTerm: 'board game cafe or pub' },
  'Pickup sports meetup': { osmTags: ['leisure=pitch', 'leisure=park'], searchTerm: 'public park or sports field' },
  'Trivia night': { osmTags: ['amenity=pub', 'amenity=bar'], searchTerm: 'pub or bar' },
  'Sunset walk & talk': { osmTags: ['leisure=park'], searchTerm: 'park' },
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const RADIUS_M = 5000
const UA = 'RallyPoint-App/1.0 (event-suggestions)'

async function findViaOSM(lat: number, lng: number, category: TemplateCategory): Promise<VenueLookup | null> {
  const filters = category.osmTags
    .map((tag) => {
      const [k, v] = tag.split('=')
      return `node["${k}"="${v}"](around:${RADIUS_M},${lat},${lng});way["${k}"="${v}"](around:${RADIUS_M},${lat},${lng});`
    })
    .join('\n')

  const query = `[out:json][timeout:10];(${filters});out center 20;`

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!res.ok) return null
    const data = await res.json()
    const named = (data.elements ?? []).filter((el: any) => el.tags?.name)
    if (named.length === 0) return null

    const pick = named[Math.floor(Math.random() * named.length)]
    const pLat = pick.lat ?? pick.center?.lat
    const pLng = pick.lon ?? pick.center?.lon
    if (pLat == null || pLng == null) return null

    const address = formatOsmAddress(pick.tags) ?? (await reverseGeocode(pLat, pLng))

    return { name: pick.tags.name, address, lat: pLat, lng: pLng }
  } catch {
    return null
  }
}

function formatOsmAddress(tags: Record<string, string>): string | null {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`, {
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return 'nearby'
    const data = await res.json()
    return data.display_name ?? 'nearby'
  } catch {
    return 'nearby'
  }
}

async function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`${NOMINATIM_URL}/search?q=${encodeURIComponent(address)}&format=jsonv2&limit=1`, {
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// Fallback only — dormant until ANTHROPIC_API_KEY exists. Capped at 1 search
// (max_uses) so a single venue lookup never costs more than $0.01 + a few
// hundred tokens.
async function findViaWebSearch(
  lat: number,
  lng: number,
  city: string,
  category: TemplateCategory
): Promise<VenueLookup | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
        messages: [
          {
            role: 'user',
            content: `Find one real, currently-operating ${category.searchTerm} near ${city} (around lat ${lat}, lng ${lng}). Reply with ONLY a JSON object on one line: {"name": "...", "address": "..."}. No other text, no markdown.`,
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const textBlock = (data?.content ?? []).find((b: any) => b.type === 'text')
    if (!textBlock?.text) return null
    const match = textBlock.text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!parsed.name || !parsed.address) return null

    const geo = await forwardGeocode(parsed.address)
    return {
      name: parsed.name,
      address: parsed.address,
      lat: geo?.lat ?? lat,
      lng: geo?.lng ?? lng,
    }
  } catch {
    return null
  }
}

// Tries the free OSM lookup first; only spends AI tokens via web search if
// OSM finds nothing AND a key is configured. Returns null (never throws) so
// callers can gracefully fall back to the generic city-level proposal.
export async function findRealVenue(opts: {
  lat: number
  lng: number
  city: string
  templateTitle: string
}): Promise<VenueLookup | null> {
  const category = CATEGORY_MAP[opts.templateTitle]
  if (!category) return null

  const osmResult = await findViaOSM(opts.lat, opts.lng, category)
  if (osmResult) return osmResult

  return findViaWebSearch(opts.lat, opts.lng, opts.city, category)
}
