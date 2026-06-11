'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type EventWithOrganizer = {
  id: string
  title: string
  description: string
  location: string
  city: string
  starts_at: string
  max_attendees: number | null
  price: number
  type: string
  attendee_count: number
  organizer: {
    full_name: string
    username: string
    account_type: string
    venue_name: string | null
  } | null
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventWithOrganizer[]>([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Fetch social events + organizer-hosted events
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          organizer:profiles!events_created_by_fkey(full_name, username, account_type, venue_name),
          event_attendees(count)
        `)
        .eq('status', 'active')
        .eq('type', 'social')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })

      const formatted = (data ?? []).map((e: any) => ({
        ...e,
        attendee_count: e.event_attendees?.[0]?.count ?? 0,
      }))

      setEvents(formatted)
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isToday = d.toDateString() === now.toDateString()
    const isTomorrow = d.toDateString() === tomorrow.toDateString()

    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Today at ${time}`
    if (isTomorrow) return `Tomorrow at ${time}`
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
  }

  const filtered = cityFilter
    ? events.filter(e => e.city.toLowerCase().includes(cityFilter.toLowerCase()))
    : events

  // Group by organizer
  const grouped: Record<string, EventWithOrganizer[]> = {}
  for (const event of filtered) {
    const key = event.organizer?.venue_name ?? event.organizer?.full_name ?? 'Independent'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(event)
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading events...</div>
  )

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">Events</h1>
          <span className="text-xs text-gray-500">{filtered.length} upcoming</span>
        </div>
        <p className="text-gray-400 text-sm mb-4">Venues and organizers near you.</p>

        {/* City filter */}
        <input
          type="text"
          placeholder="Filter by city..."
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm mb-6 focus:outline-none focus:border-orange-500"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🎳</div>
            <p className="font-medium text-white mb-1">No events yet</p>
            <p className="text-sm">Venues and organizers will show up here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([organizerName, orgEvents]) => {
              const organizer = orgEvents[0].organizer
              const isVenue = organizer?.account_type === 'organizer' && organizer?.venue_name
              return (
                <section key={organizerName}>
                  {/* Organizer header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-lg">
                      {isVenue ? '🏟️' : '🎯'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{organizerName}</span>
                        {isVenue && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Venue</span>
                        )}
                        {organizer?.account_type === 'organizer' && !isVenue && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Organizer</span>
                        )}
                      </div>
                      {organizer?.username && (
                        <span className="text-xs text-gray-500">@{organizer.username}</span>
                      )}
                    </div>
                  </div>

                  {/* Events from this organizer */}
                  <div className="space-y-3 pl-1">
                    {orgEvents.map(event => (
                      <Link key={event.id} href={`/events/${event.id}`}>
                        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition cursor-pointer">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-white leading-tight pr-2">{event.title}</h3>
                            {event.price > 0
                              ? <span className="text-orange-400 font-semibold text-sm shrink-0">${event.price}</span>
                              : <span className="text-green-400 font-semibold text-sm shrink-0">Free</span>
                            }
                          </div>
                          {event.description && (
                            <p className="text-gray-400 text-xs mb-3 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>📍 {event.location}</span>
                            <span>🕐 {formatDate(event.starts_at)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500">
                              👥 {event.attendee_count} going
                              {event.max_attendees ? ` · ${event.max_attendees - event.attendee_count} spots left` : ''}
                            </span>
                            <span className="text-xs text-orange-400 font-medium">View →</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
