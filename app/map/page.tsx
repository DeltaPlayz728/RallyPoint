'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { EventPin, Venue } from '@/components/MapView'
import TopBar from '@/components/TopBar'
import { triggerSeedCheck } from '@/lib/seedCheck'

// Leaflet must be loaded client-side only
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

// ─── Filter config ────────────────────────────────────────────────────────────

type Filter = 'all' | 'today' | 'week' | 'casual' | 'social'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',    label: 'All'       },
  { id: 'today',  label: 'Today'     },
  { id: 'week',   label: 'This Week' },
  { id: 'casual', label: 'Casual'    },
  { id: 'social', label: 'Social'    },
]

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}
function isThisWeek(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return d >= now && d <= weekOut
}

// ─── Distance helper (metres) ─────────────────────────────────────────────────

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today · ${time}`
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ` · ${time}`
  )
}

function getVenueEmoji(types: string[]): string {
  if (types.includes('bowling_alley'))  return '🎳'
  if (types.includes('night_club'))     return '🎵'
  if (types.includes('bar'))            return '🍺'
  if (types.includes('cafe'))           return '☕'
  if (types.includes('park'))           return '🌳'
  if (types.includes('gym'))            return '💪'
  if (types.includes('movie_theater'))  return '🎬'
  if (types.includes('amusement_park')) return '🎡'
  if (types.includes('stadium'))        return '🏟️'
  if (types.includes('restaurant'))     return '🍽️'
  return '📍'
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function VenueSheet({
  venue,
  nearbyEvents,
  onClose,
}: {
  venue: Venue
  nearbyEvents: EventPin[]
  onClose: () => void
}) {
  const emoji = getVenueEmoji(venue.types)
  const venueTypeLabel = (() => {
    if (venue.types.includes('bowling_alley'))  return 'Bowling Alley'
    if (venue.types.includes('night_club'))     return 'Night Club'
    if (venue.types.includes('bar'))            return 'Bar'
    if (venue.types.includes('cafe'))           return 'Café'
    if (venue.types.includes('park'))           return 'Park'
    if (venue.types.includes('gym'))            return 'Gym'
    if (venue.types.includes('movie_theater'))  return 'Cinema'
    if (venue.types.includes('amusement_park')) return 'Amusement Park'
    if (venue.types.includes('stadium'))        return 'Stadium'
    if (venue.types.includes('restaurant'))     return 'Restaurant'
    return 'Venue'
  })()

  const createHref = `/events/create?venue=${encodeURIComponent(venue.name)}&lat=${venue.lat}&lng=${venue.lng}`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[1000]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 bottom-[72px] z-[1001] bg-[#0f0f0f] border border-gray-800 rounded-t-3xl px-5 pt-5 pb-6 max-h-[65vh] overflow-y-auto"
        style={{ animation: 'rpSheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        {/* Venue header */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{emoji}</span>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{venue.name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{venueTypeLabel} · {venue.vicinity}</p>
          </div>
        </div>

        <div className="h-px bg-gray-800 my-4" />

        {/* Events at this venue */}
        {nearbyEvents.length > 0 ? (
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              {nearbyEvents.length} event{nearbyEvents.length > 1 ? 's' : ''} here
            </p>
            <div className="space-y-2">
              {nearbyEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-orange-500 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{event.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatDate(event.starts_at)}</p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-bold ${event.price > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {event.price > 0 ? `€${event.price}` : 'Free'}
                    </span>
                    {event.attendee_count > 0 && (
                      <span className="text-gray-500 text-xs">👥 {event.attendee_count}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href={createHref}
              className="mt-3 flex items-center justify-center gap-2 w-full border border-dashed border-gray-700 text-gray-400 hover:text-orange-400 hover:border-orange-500 rounded-xl py-3 text-sm transition"
            >
              + Add another event here
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-white font-semibold mb-1">No events here yet</p>
            <p className="text-gray-500 text-sm mb-5">Be the first to host something at {venue.name}</p>
            <Link
              href={createHref}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              🎉 Create event here
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Event sheet (tap on event pin) ──────────────────────────────────────────

function EventSheet({
  event,
  nearbyEvents,
  onClose,
}: {
  event: EventPin
  nearbyEvents: EventPin[]
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[1000]" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-[72px] z-[1001] bg-[#0f0f0f] border border-gray-800 rounded-t-3xl px-5 pt-5 pb-6 max-h-[70vh] overflow-y-auto"
        style={{ animation: 'rpSheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between mb-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            event.type === 'casual'
              ? 'bg-green-900/60 text-green-400 border border-green-800'
              : 'bg-orange-900/60 text-orange-400 border border-orange-800'
          }`}>
            {event.type === 'casual' ? '😊 Casual' : '🎳 Social'}
          </span>
          <span className={`font-bold text-sm ${event.price > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {event.price > 0 ? `€${event.price}` : 'Free'}
          </span>
        </div>

        <h2 className="text-white font-bold text-xl mb-1">{event.title}</h2>
        <p className="text-gray-400 text-sm mb-1">📍 {event.location}</p>
        <p className="text-gray-400 text-sm mb-1">🕐 {formatDate(event.starts_at)}</p>
        {event.attendee_count > 0 && (
          <p className="text-gray-400 text-sm mb-4">👥 {event.attendee_count} going</p>
        )}

        <Link
          href={`/events/${event.id}`}
          className="flex items-center justify-center w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition"
        >
          View Event →
        </Link>

        {/* Nearby events */}
        {nearbyEvents.length > 0 && (
          <div className="mt-5">
            <div className="h-px bg-gray-800 mb-4" />
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Also nearby
            </p>
            <div className="space-y-2">
              {nearbyEvents.map((nearby) => (
                <Link
                  key={nearby.id}
                  href={`/events/${nearby.id}`}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-orange-500 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{nearby.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatDate(nearby.starts_at)}</p>
                  </div>
                  <span className={`ml-3 text-xs font-bold shrink-0 ${nearby.price > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {nearby.price > 0 ? `€${nearby.price}` : 'Free'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── City search sheet ────────────────────────────────────────────────────────

function CitySheet({
  cityName,
  events,
  onClose,
}: {
  cityName: string
  events: EventPin[]
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[1000]" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-[72px] z-[1001] bg-[#0f0f0f] border border-gray-800 rounded-t-3xl px-5 pt-5 pb-6 max-h-[70vh] overflow-y-auto"
        style={{ animation: 'rpSheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        <h2 className="text-white font-bold text-lg mb-1">
          {cityName}
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          {events.length} event{events.length !== 1 ? 's' : ''} in this area
        </p>

        {events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No upcoming events in this area yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-orange-500 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{event.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {formatDate(event.starts_at)} · {event.location}
                  </p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-bold ${event.price > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {event.price > 0 ? `€${event.price}` : 'Free'}
                  </span>
                  {event.attendee_count > 0 && (
                    <span className="text-gray-500 text-xs">👥 {event.attendee_count}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FALLBACK_CENTER: [number, number] = [51.5719, 4.7683] // Breda

export default function MapPage() {
  const router = useRouter()
  const [events, setEvents]               = useState<EventPin[]>([])
  const [venues, setVenues]               = useState<Venue[]>([])
  const [loading, setLoading]             = useState(true)
  const [activeFilter, setActiveFilter]   = useState<Filter>('all')
  const [selectedVenue, setSelectedVenue]   = useState<Venue | null>(null)
  const [selectedEvent, setSelectedEvent]   = useState<EventPin | null>(null)
  const [nearbyEvents, setNearbyEvents]     = useState<EventPin[]>([])
  const [userCenter, setUserCenter]         = useState<[number, number]>(FALLBACK_CENTER)
  const [userDot, setUserDot]               = useState<[number, number] | null>(null)
  const [cityQuery, setCityQuery]           = useState('')
  const [citySearching, setCitySearching]   = useState(false)
  const [citySheet, setCitySheet]           = useState<{ name: string; events: EventPin[] } | null>(null)
  const [mapCenter, setMapCenter]           = useState<[number, number]>(FALLBACK_CENTER)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Fetch events with attendee counts
      const { data: eventData } = await supabase
        .from('events')
        .select('id, title, type, location, price, starts_at, lat, lng, event_attendees(count)')
        .eq('status', 'active')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('starts_at', new Date().toISOString())
        .limit(200)

      // Which of these events has the current user already joined? Drives the
      // map pin's "planted flag" state (see MapView's createEventIcon).
      const { data: attendeeRows } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id)
      const joinedIds = new Set((attendeeRows ?? []).map((r: any) => r.event_id))

      const mapped: EventPin[] = (eventData ?? []).map((e: any) => ({
        ...e,
        attendee_count: e.event_attendees?.[0]?.count ?? 0,
        joined: joinedIds.has(e.id),
      }))
      setEvents(mapped)
      setLoading(false)

      // Get user location — center map + fetch local venues
      navigator.geolocation?.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          setUserCenter([lat, lng])
          setMapCenter([lat, lng])
          setUserDot([lat, lng])

          // Fetch venues near the user
          try {
            const res = await fetch(`/api/venues?lat=${lat}&lng=${lng}&city=`)
            const data = await res.json()
            if (data.venues) setVenues(data.venues)
          } catch { /* venue layer optional */ }

          // If this area looks empty, let the assistant propose a seed event. This used
          // to be inline here (once-per-session, Map-only); now shared via lib/seedCheck.ts
          // so Feed and Events trigger it too, with one shared once-per-day gate.
          triggerSeedCheck(user.id)
        },
        async () => {
          // Location denied — we don't actually know where this user is, so showing
          // hardcoded Breda, NL venues to someone anywhere else in the world was just
          // wrong (and meant the seed-event bot never even ran for these users). Leave
          // the venue layer empty rather than silently lying about location.
        },
        { timeout: 6000, maximumAge: 60000 }
      )
    }

    load()
  }, [])

  // Inject sheet animation CSS
  useEffect(() => {
    const id = 'rp-sheet-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes rpSheetUp {
        from { transform: translateY(100%); opacity: 0.5; }
        to   { transform: translateY(0);    opacity: 1;   }
      }
    `
    document.head.appendChild(style)
  }, [])

  // Client-side filter for event pins
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (activeFilter === 'today')  return isToday(e.starts_at)
      if (activeFilter === 'week')   return isThisWeek(e.starts_at)
      if (activeFilter === 'casual') return e.type === 'casual'
      if (activeFilter === 'social') return e.type === 'social'
      return true
    })
  }, [events, activeFilter])

  // Events within 150m of selected venue
  const venueEvents = useMemo(() => {
    if (!selectedVenue) return []
    return events.filter(
      (e) => distanceM(selectedVenue.lat, selectedVenue.lng, e.lat, e.lng) < 150
    )
  }, [selectedVenue, events])

  const handleVenueClick = (venue: Venue) => {
    setSelectedEvent(null)
    setCitySheet(null)
    setSelectedVenue(venue)
  }

  const handleEventClick = (event: EventPin) => {
    setSelectedVenue(null)
    setCitySheet(null)
    const nearby = events.filter(
      (e) => e.id !== event.id && distanceM(event.lat, event.lng, e.lat, e.lng) < 300
    )
    setNearbyEvents(nearby)
    setSelectedEvent(event)
  }

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = cityQuery.trim()
    if (!q) return
    setCitySearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data.length === 0) {
        alert(`Couldn't find "${q}"`)
        setCitySearching(false)
        return
      }
      const { lat, lon, display_name } = data[0]
      const center: [number, number] = [parseFloat(lat), parseFloat(lon)]
      setMapCenter(center)
      // Events within 25km of the city center
      const cityEvents = events.filter(
        (ev) => distanceM(center[0], center[1], ev.lat, ev.lng) < 25000
      )
      const shortName = display_name.split(',')[0]
      setCitySheet({ name: shortName, events: cityEvents })
      setSelectedEvent(null)
      setSelectedVenue(null)
      searchRef.current?.blur()
    } catch {
      alert('Search failed. Please try again.')
    }
    setCitySearching(false)
  }

  const closeSheets = () => {
    setSelectedVenue(null)
    setSelectedEvent(null)
    setCitySheet(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading map…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">

      <TopBar title={`${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}${venues.length > 0 ? ` · ${venues.length} venues` : ''}`} />

      {/* City search bar */}
      <form onSubmit={handleCitySearch} className="px-4 pt-2 pb-1 shrink-0 z-10">
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2">
          <span className="text-gray-500 text-sm">🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Search a city or area…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
          />
          {cityQuery && (
            <button
              type="button"
              onClick={() => setCityQuery('')}
              className="text-gray-600 hover:text-gray-400 text-xs"
            >
              ✕
            </button>
          )}
          {citySearching && (
            <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </form>

      {/* Filter chips */}
      <div className="px-4 pt-1 pb-2 shrink-0 z-10">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeFilter === f.id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-500 shrink-0 overflow-x-auto scrollbar-hide">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          Casual
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          Social
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-gray-500">🏳️</span>
          Not joined
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-orange-500">🚩</span>
          Joined
        </span>
        {venues.length > 0 && (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-base leading-none">📍</span>
            Venue
          </span>
        )}
      </div>

      {/* Map */}
      <div
        className={`flex-1 min-h-0 pb-[72px] transition-opacity duration-200 ${
          selectedVenue || selectedEvent || citySheet ? 'opacity-30 pointer-events-none' : ''
        }`}
      >
        <MapView
          events={filteredEvents}
          venues={venues}
          selectedVenueId={selectedVenue?.place_id ?? null}
          onVenueClick={handleVenueClick}
          onEventClick={handleEventClick}
          center={mapCenter}
          userDot={userDot}
        />
      </div>

      {/* Venue bottom sheet */}
      {selectedVenue && (
        <VenueSheet
          venue={selectedVenue}
          nearbyEvents={venueEvents}
          onClose={closeSheets}
        />
      )}

      {/* Event bottom sheet */}
      {selectedEvent && (
        <EventSheet
          event={selectedEvent}
          nearbyEvents={nearbyEvents}
          onClose={closeSheets}
        />
      )}

      {/* City search sheet */}
      {citySheet && (
        <CitySheet
          cityName={citySheet.name}
          events={citySheet.events}
          onClose={closeSheets}
        />
      )}
    </div>
  )
}
