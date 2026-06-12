'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { EventPin, Venue } from '@/components/MapView'
import TopBar from '@/components/TopBar'

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
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 bottom-[72px] z-50 bg-[#0f0f0f] border border-gray-800 rounded-t-3xl px-5 pt-5 pb-6 max-h-[65vh] overflow-y-auto"
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
  onClose,
}: {
  event: EventPin
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-[72px] z-50 bg-[#0f0f0f] border border-gray-800 rounded-t-3xl px-5 pt-5 pb-6"
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
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const router = useRouter()
  const [events, setEvents]               = useState<EventPin[]>([])
  const [venues, setVenues]               = useState<Venue[]>([])
  const [loading, setLoading]             = useState(true)
  const [activeFilter, setActiveFilter]   = useState<Filter>('all')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventPin | null>(null)

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

      const mapped: EventPin[] = (eventData ?? []).map((e: any) => ({
        ...e,
        attendee_count: e.event_attendees?.[0]?.count ?? 0,
      }))
      setEvents(mapped)
      setLoading(false)

      // Fetch venues (non-blocking — map shows events immediately)
      try {
        const res = await fetch('/api/venues?lat=51.5719&lng=4.7683&city=Breda')
        const data = await res.json()
        if (data.venues) setVenues(data.venues)
      } catch {
        // Venue layer is optional — silently skip on error
      }
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
    setSelectedVenue(venue)
  }

  const handleEventClick = (event: EventPin) => {
    setSelectedVenue(null)
    setSelectedEvent(event)
  }

  const closeSheets = () => {
    setSelectedVenue(null)
    setSelectedEvent(null)
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

      {/* Filter chips */}
      <div className="px-4 pt-2 pb-2 shrink-0 z-10">
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
      <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-500 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          Casual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          Social
        </span>
        {venues.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none">📍</span>
            Venue
          </span>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 pb-[72px]">
        <MapView
          events={filteredEvents}
          venues={venues}
          selectedVenueId={selectedVenue?.place_id ?? null}
          onVenueClick={handleVenueClick}
          onEventClick={handleEventClick}
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
          onClose={closeSheets}
        />
      )}
    </div>
  )
}
