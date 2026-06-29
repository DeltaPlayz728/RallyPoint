'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { triggerSeedCheck } from '@/lib/seedCheck'
import { Building2, MapPin, Clock, Users } from 'lucide-react'

const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

type EventRow = {
  id: string
  title: string
  description: string
  location: string
  city: string
  lat: number | null
  lng: number | null
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

type Slide = 'social' | 'nearme'

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function EventCard({ event, distKm }: { event: EventRow; distKm?: number }) {
  const isVenue = event.organizer?.account_type === 'organizer' && event.organizer?.venue_name
  const dotCount = Math.min(event.attendee_count, 4)

  return (
    <Link href={`/events/${event.id}`}>
      <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden active:scale-[0.985] transition-transform duration-100">
        <div className="h-0.5 w-full bg-accent" />
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-1.5 mb-1">
                {isVenue && (
                  <span className="text-[10px] bg-accent text-white border border-black px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                    <Building2 size={11} className="shrink-0" /> {event.organizer?.venue_name}
                  </span>
                )}
              </div>
              <h3 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-[15px] leading-snug">{event.title}</h3>
            </div>
            <span className={`text-sm font-bold shrink-0 ${event.price > 0 ? 'text-accent' : 'text-[#15110d] dark:text-[#fdf6ec]'}`}>
              {event.price > 0 ? `€${event.price}` : 'Free'}
            </span>
          </div>

          {event.description && (
            <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-1 mb-3">{event.description}</p>
          )}

          <div className="h-px bg-gray-200 dark:bg-gray-700/70 mb-3" />

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{event.location}</span>
                {distKm !== undefined && (
                  <span className="text-gray-600 dark:text-gray-400 shrink-0">· {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}</span>
                )}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                <Clock size={13} className="shrink-0" />
                <span>{formatDate(event.starts_at)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {event.attendee_count > 0 && (
                <div className="flex -space-x-1.5">
                  {[...Array(dotCount)].map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-black"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], zIndex: dotCount - i }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                {event.attendee_count === 0 ? 'Be first' : `${event.attendee_count} going`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [slide, setSlide] = useState<Slide>('social')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // If this area looks empty, let the assistant propose a seed event (at most
      // once/day across Map/Feed/Events — see lib/seedCheck.ts).
      triggerSeedCheck(user.id)

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
        .limit(100)

      setEvents((data ?? []).map((e: any) => ({
        ...e,
        attendee_count: e.event_attendees?.[0]?.count ?? 0,
      })))
      setLoading(false)
    }
    load()

    // Get user location for Near Me sort
    navigator.geolocation?.getCurrentPosition(pos => {
      setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })
  }, [])

  const socialEvents = useMemo(() => events, [events])

  const nearMeEvents = useMemo(() => {
    if (!userPos) return [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    return [...events].sort((a, b) => {
      const distA = a.lat && a.lng ? haversineKm(userPos.lat, userPos.lng, a.lat, a.lng) : 999
      const distB = b.lat && b.lng ? haversineKm(userPos.lat, userPos.lng, b.lat, b.lng) : 999
      return distA - distB
    })
  }, [events, userPos])

  const displayed = slide === 'social' ? socialEvents : nearMeEvents

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="Events" />

      {/* Slide tabs */}
      <div className="px-4 pt-3 pb-3 border-b border-gray-300 dark:border-gray-700 sticky top-[72px] bg-[#fdf6ec] dark:bg-[#15110d] z-10">
        <div className="flex gap-2">
          {([
            { id: 'social', label: 'Social', Icon: Users },
            { id: 'nearme', label: 'Near me', Icon: MapPin },
          ] as { id: Slide; label: string; Icon: typeof Users }[]).map(s => (
            <button
              key={s.id}
              onClick={() => setSlide(s.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition inline-flex items-center gap-1.5 ${
                slide === s.id
                  ? 'bg-accent border-accent text-white'
                  : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600'
              }`}
            >
              <s.Icon size={14} className="shrink-0" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-center px-6">
            <Users size={40} className="text-gray-400 mb-4" />
            <p className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-lg mb-1">No events yet</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {slide === 'nearme' ? 'Nothing nearby right now — check back soon.' : 'Venues and organizers will show up here.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
              {displayed.length} event{displayed.length !== 1 ? 's' : ''}
              {slide === 'nearme' && !userPos ? ' · enable location for distance sorting' : ''}
            </p>
            <div className="space-y-3">
              {displayed.map(event => {
                const distKm = slide === 'nearme' && userPos && event.lat && event.lng
                  ? haversineKm(userPos.lat, userPos.lng, event.lat, event.lng)
                  : undefined
                return <EventCard key={event.id} event={event} distKm={distKm} />
              })}
            </div>
          </>
        )}
      </div>
    </div>
)
}
