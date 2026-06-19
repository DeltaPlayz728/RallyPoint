'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Avatar colour palette — used for attendee dot row
const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

type Event = {
  id: string
  title: string
  description: string
  type: 'casual' | 'social'
  location: string
  city: string
  starts_at: string
  max_attendees: number | null
  price: number
  created_by: string
  attendee_count: number
}

type Filter = 'foryou' | 'all' | 'today' | 'tomorrow' | 'week'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'foryou',   label: '⚡ For You' },
  { id: 'all',      label: 'All'       },
  { id: 'today',    label: 'Today'     },
  { id: 'tomorrow', label: 'Tomorrow'  },
  { id: 'week',     label: 'This Week' },
]

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return startOfDay(d).getTime() === startOfDay(now).getTime()
}

function isTomorrow(iso: string) {
  const d = new Date(iso)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return startOfDay(d).getTime() === startOfDay(tomorrow).getTime()
}

function isThisWeek(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return d >= now && d <= weekOut
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(); tomorrow.setDate(now.getDate() + 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (d.toDateString() === now.toDateString())       return `Today · ${time}`
  if (d.toDateString() === tomorrow.toDateString())  return `Tomorrow · ${time}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-gray-800/50 rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gray-800 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-5 w-20 bg-gray-800 rounded-full animate-pulse" />
          <div className="h-4 w-10 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="h-5 w-3/4 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-px bg-gray-800/60" />
        <div className="flex justify-between items-center pt-1">
          <div className="space-y-2">
            <div className="h-3 w-28 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="flex -space-x-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-gray-800 animate-pulse border-2 border-black" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: Event }) {
  const isCasual = event.type === 'casual'
  const dotCount = Math.min(event.attendee_count, 4)
  const overflow = event.attendee_count > 4 ? event.attendee_count - 4 : 0

  return (
    <Link href={`/events/${event.id}`}>
      <div className="bg-[#111] border border-gray-800/50 rounded-2xl overflow-hidden active:scale-[0.985] transition-transform duration-100 cursor-pointer">
        {/* Type colour strip */}
        <div className={`h-0.5 w-full ${isCasual ? 'bg-green-500' : 'bg-orange-500'}`} />

        <div className="p-4">
          {/* Badges row */}
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              isCasual
                ? 'bg-green-950/70 text-green-400 border-green-900/80'
                : 'bg-orange-950/70 text-orange-400 border-orange-900/80'
            }`}>
              {isCasual ? '😊 Casual' : '🎳 Social'}
            </span>
            <span className={`text-sm font-bold ${event.price > 0 ? 'text-orange-400' : 'text-green-400'}`}>
              {event.price > 0 ? `€${event.price}` : 'Free'}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-white font-bold text-[15px] leading-snug mb-1">
            {event.title}
          </h3>

          {/* Description */}
          {event.description && (
            <p className="text-gray-500 text-sm line-clamp-1 mb-3">
              {event.description}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-800/70 mb-3" />

          {/* Bottom row: location/time left · avatars right */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-gray-400 text-xs flex items-center gap-1.5">
                <span className="shrink-0">📍</span>
                <span className="truncate">{event.location}</span>
              </span>
              <span className="text-gray-400 text-xs flex items-center gap-1.5">
                <span className="shrink-0">🕐</span>
                <span>{formatDate(event.starts_at)}</span>
              </span>
            </div>

            {/* Attendee dots + count */}
            <div className="flex items-center gap-1.5 shrink-0">
              {event.attendee_count > 0 && (
                <div className="flex -space-x-1.5">
                  {[...Array(dotCount)].map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border-2 border-[#111] flex items-center justify-center text-[8px] font-black text-black"
                      style={{
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        zIndex: dotCount - i,
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-gray-500 text-xs">
                {event.attendee_count === 0
                  ? 'Be first'
                  : overflow > 0
                  ? `+${overflow} going`
                  : `${event.attendee_count} going`}
              </span>
            </div>
          </div>

          {/* Capacity bar if max set */}
          {event.max_attendees && event.attendee_count > 0 && (
            <div className="mt-3">
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    event.attendee_count / event.max_attendees > 0.8
                      ? 'bg-red-500'
                      : isCasual ? 'bg-green-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min(100, (event.attendee_count / event.max_attendees) * 100)}%` }}
                />
              </div>
              <p className="text-gray-600 text-[10px] mt-1">
                {Math.max(0, event.max_attendees - event.attendee_count)} spots left
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [events, setEvents]             = useState<Event[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [username, setUsername]         = useState<string>('')
  const [isMinor, setIsMinor]           = useState(false)
  const [userInterests, setUserInterests] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load display name + minor flag + interests
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name, is_minor, interests')
        .eq('id', user.id)
        .maybeSingle()
      setUsername(profile?.username || profile?.full_name?.split(' ')[0] || '')
      setIsMinor(profile?.is_minor ?? false)
      setUserInterests(profile?.interests ?? [])

      // Load casual events with attendee count — only upcoming events
      const { data, error } = await supabase
        .from('events')
        .select('*, event_attendees(count)')
        .eq('status', 'active')
        .eq('type', 'casual')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(100)

      if (!error && data) {
        setEvents(data.map((e: any) => ({
          ...e,
          attendee_count: e.event_attendees?.[0]?.count ?? 0,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  // Score an event by how many of the user's interests appear in its title/description
  const interestScore = (event: Event): number => {
    if (userInterests.length === 0) return 0
    const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
    return userInterests.filter(i =>
      haystack.includes(i.replace(/^[^\s]+\s/, '').toLowerCase()) // strip emoji prefix
    ).length
  }

  const filteredEvents = useMemo(() => {
    let list = events.filter(e => {
      if (activeFilter === 'today')    return isToday(e.starts_at)
      if (activeFilter === 'tomorrow') return isTomorrow(e.starts_at)
      if (activeFilter === 'week')     return isThisWeek(e.starts_at)
      return true // 'all' and 'foryou' show everything
    })

    // For You: sort by interest match score descending, then by date
    if (activeFilter === 'foryou') {
      list = [...list].sort((a, b) => {
        const scoreDiff = interestScore(b) - interestScore(a)
        if (scoreDiff !== 0) return scoreDiff
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      })
    }

    return list
  }, [events, activeFilter, userInterests])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="min-h-screen bg-black text-white pb-28">

      {/* Minor mode banner */}
      {isMinor && (
        <div className="bg-blue-950/60 border-b border-blue-900/40 px-4 py-2.5 flex items-center gap-2">
          <span className="text-blue-400 text-xs">🔒</span>
          <p className="text-blue-300 text-xs">You're browsing the under-18 feed — casual meetups only.</p>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-8 pb-4 sticky top-0 bg-black/95 backdrop-blur-sm z-10 border-b border-gray-900/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
              {greeting}{username ? `, ${username}` : ''}
            </p>
            <h1 className="text-xl font-bold text-white mt-0.5">What's happening</h1>
          </div>
          <Link
            href="/events/create"
            className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
          >
            + Create
          </Link>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeFilter === f.id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center text-3xl mb-4">
              {activeFilter === 'all' ? '📍' : '🔍'}
            </div>
            <h2 className="text-white font-bold text-lg mb-1">
              {activeFilter === 'all' ? 'No events yet' : `Nothing ${activeFilter === 'today' ? 'today' : activeFilter === 'tomorrow' ? 'tomorrow' : 'this week'}`}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {activeFilter === 'all'
                ? 'Be the first to create a meetup in your city.'
                : 'Try a different filter or create your own.'}
            </p>
            <Link
              href="/events/create"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-sm transition"
            >
              Create a Meetup
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-600 text-xs mb-3">
              {filteredEvents.length} meetup{filteredEvents.length !== 1 ? 's' : ''}
              {activeFilter !== 'all' && ` · ${FILTERS.find(f => f.id === activeFilter)?.label}`}
            </p>
            <div className="space-y-3">
              {filteredEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
