'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { triggerSeedCheck } from '@/lib/seedCheck'
import { Bell, Building2, MapPin, Clock, Users } from 'lucide-react'
import EmptyIllustration from '@/components/EmptyIllustration'
import MeshBackdrop from '@/components/MeshBackdrop'
import { useTheme } from '@/components/ThemeProvider'
import { boundingBox, EVENT_RADIUS_KM } from '@/lib/geo'
import { AGE_GATING_ENABLED, canSeeAgeRestricted } from '@/lib/ageGating'

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
  age_restricted: boolean
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
      <div className="bg-white dark:bg-[#221c16] border-2 border-black dark:border-gray-600 rounded-3xl overflow-hidden active:scale-[0.985] transition-transform duration-100 cursor-pointer">
        <div className="h-1 w-full bg-accent" />
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-2">
              {isVenue && (
                <span className="text-[10px] uppercase tracking-wide bg-accent text-white border-2 border-black px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 mb-2">
                  <Building2 size={11} className="shrink-0" /> {event.organizer?.venue_name}
                </span>
              )}
              {event.age_restricted && (
                <span className="text-[10px] uppercase tracking-wide bg-red-500 text-white border-2 border-black px-2 py-0.5 rounded-full font-bold inline-block mb-1">
                  18+
                </span>
              )}
              <h3 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-[15px] leading-snug">{event.title}</h3>
            </div>
            <span className={`text-base font-black shrink-0 ${event.price > 0 ? 'text-accent' : 'text-[#15110d] dark:text-[#fdf6ec]'}`}>
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
  const { backgroundStyle, accentHex } = useTheme()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [slide, setSlide] = useState<Slide>('social')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    const load = async (pos: { lat: number; lng: number } | null) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Notification bell unread state — same check used in TopBar/Feed
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnread((count ?? 0) > 0)

      // If this area looks empty, let the assistant propose a seed event (at most
      // once/day across Map/Feed/Events — see lib/seedCheck.ts).
      triggerSeedCheck(user.id)

      // 18+ gating — scaffold; only queries the flag when AGE_GATING_ENABLED is on (lib/ageGating.ts)
      let restrictAge = false
      if (AGE_GATING_ENABLED) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('age_verified, is_minor')
          .eq('id', user.id)
          .maybeSingle()
        restrictAge = !canSeeAgeRestricted(prof as any)
      }

      // Social/paid events reach a wider radius than casual hangouts (see lib/geo.ts).
      let query = supabase
        .from('events')
        .select(`
          *,
          organizer:profiles!events_created_by_fkey(full_name, username, account_type, venue_name),
          event_attendees(count)
        `)
        // Filters the embedded aggregate, not the parent rows — "Interested"/
        // "Can't Go" RSVPs shouldn't inflate the attendee count shown here.
        .eq('event_attendees.rsvp_status', 'going')
        .eq('status', 'active')
        .eq('type', 'social')
        .gte('starts_at', new Date().toISOString())
      if (restrictAge) query = query.eq('age_restricted', false)
      if (pos) {
        const b = boundingBox(pos.lat, pos.lng, EVENT_RADIUS_KM)
        query = query
          .gte('lat', b.minLat).lte('lat', b.maxLat)
          .gte('lng', b.minLng).lte('lng', b.maxLng)
      }
      const { data } = await query
        .order('starts_at', { ascending: true })
        .limit(100)

      setEvents((data ?? []).map((e: any) => ({
        ...e,
        attendee_count: e.event_attendees?.[0]?.count ?? 0,
      })))
      setLoading(false)
    }
    // Scope to the user's area (wider radius than casual hangouts); the resolved
    // position also drives the "Near me" sort. Fall back to unscoped if denied.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
          setUserPos(pos)
          load(pos)
        },
        () => load(null),
        { timeout: 8000 }
      )
    } else {
      load(null)
    }
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
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">

      {/* Background — mesh gradient by default (Profile > Background style
          can switch back to the old flat bubbles). Cards stay solid on top
          either way; this is purely a fixed, pointer-events-none backdrop. */}
      {backgroundStyle === 'mesh' ? (
        <MeshBackdrop accent={accentHex} />
      ) : (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-[22%] -left-16 w-40 h-40 rounded-full bg-[#f6d9bf] dark:bg-accent/10" />
          <div className="absolute top-[56%] -right-12 w-32 h-32 rounded-full bg-[#cfeede] dark:bg-teal-500/10" />
          <div className="absolute -bottom-12 left-[18%] w-44 h-44 rounded-full bg-[#dcd2ef] dark:bg-purple-500/10" />
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-8 pb-4 sticky top-0 bg-[#fdf6ec] dark:bg-[#15110d]/95 backdrop-blur-sm z-10 border-b border-gray-300 dark:border-gray-700">
        {/* Decorative blobs — matches the Feed header treatment */}
        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-accent pointer-events-none" aria-hidden="true" />
        <div className="absolute top-6 -right-6 w-16 h-16 rounded-full bg-purple-500 pointer-events-none" aria-hidden="true" />

        <div className="relative flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">
              Find a
            </p>
            <h1 className="text-2xl font-black text-[#15110d] dark:text-[#fdf6ec] mt-1 leading-tight">
              <span className="inline-block -rotate-2">Crowd</span>{' '}
              <span className="inline-block bg-accent text-white px-2 py-0.5 rounded-lg rotate-2 border-2 border-black">
                nearby
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/inbox"
              className="relative w-11 h-11 rounded-full bg-white dark:bg-[#221c16] border-2 border-black dark:border-gray-600 flex items-center justify-center active:scale-95 transition"
            >
              <Bell size={18} className="text-[#15110d] dark:text-[#fdf6ec]" />
              {unread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white dark:border-[#221c16]" />
              )}
            </Link>
          </div>
        </div>

        {/* Slide tabs */}
        <div className="relative flex gap-2">
          {([
            { id: 'social', label: 'Social', Icon: Users },
            { id: 'nearme', label: 'Near me', Icon: MapPin },
          ] as { id: Slide; label: string; Icon: typeof Users }[]).map(s => (
            <button
              key={s.id}
              onClick={() => setSlide(s.id)}
              className={`relative shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border-2 border-black transition inline-flex items-center gap-1.5 ${
                slide === s.id
                  ? 'bg-accent text-white'
                  : 'bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec]'
              }`}
            >
              <s.Icon size={13} className="shrink-0" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-[1] px-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-[#221c16] border-2 border-black dark:border-gray-600 rounded-3xl p-4 space-y-3">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-center px-6">
            <div className="mb-4">
              <EmptyIllustration variant="events" />
            </div>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-lg mb-1">No events yet</h2>
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
