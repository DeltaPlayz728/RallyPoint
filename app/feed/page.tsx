'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { triggerSeedCheck } from '@/lib/seedCheck'
import { Bell, Lock, MapPin, Clock, Coffee, Users, Search, Sparkles } from 'lucide-react'

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
  { id: 'foryou',   label: 'For You'   },
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
    <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
        <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-px bg-gray-200 dark:bg-gray-700/60" />
        <div className="flex justify-between items-center pt-1">
          <div className="space-y-2">
            <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex -space-x-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse border-2 border-black" />
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
      <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden active:scale-[0.985] transition-transform duration-100 cursor-pointer">
        {/* Type colour strip */}
        <div className={`h-0.5 w-full ${isCasual ? 'bg-green-500' : 'bg-accent'}`} />

        <div className="p-4">
          {/* Badges row */}
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 ${
              isCasual
                ? 'bg-purple-500 text-white border-black'
                : 'bg-accent text-white border-black'
            }`}>
              {isCasual ? <Coffee size={12} strokeWidth={2.5} /> : <Users size={12} strokeWidth={2.5} />}
              {isCasual ? 'Casual' : 'Social'}
            </span>
            <span className={`text-sm font-bold ${event.price > 0 ? 'text-accent' : 'text-[#15110d] dark:text-[#fdf6ec]'}`}>
              {event.price > 0 ? `€${event.price}` : 'Free'}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-[15px] leading-snug mb-1">
            {event.title}
          </h3>

          {/* Description */}
          {event.description && (
            <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-1 mb-3">
              {event.description}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-gray-700/70 mb-3" />

          {/* Bottom row: location/time left · avatars right */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                <Clock size={13} className="shrink-0" />
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
                      className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-black"
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
              <span className="text-gray-500 dark:text-gray-400 text-xs">
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
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    event.attendee_count / event.max_attendees > 0.8
                      ? 'bg-red-500'
                      : isCasual ? 'bg-green-500' : 'bg-accent'
                  }`}
                  style={{ width: `${Math.min(100, (event.attendee_count / event.max_attendees) * 100)}%` }}
                />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[10px] mt-1">
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
  const [unread, setUnread]             = useState(false)

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

      // Notification bell unread state — same check used in TopBar
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnread((count ?? 0) > 0)

      // If this area looks empty, let the assistant propose a seed event (at most
      // once/day across Map/Feed/Events — see lib/seedCheck.ts).
      triggerSeedCheck(user.id)

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
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">

      {/* Minor mode banner */}
      {isMinor && (
        <div className="bg-blue-100 dark:bg-blue-950 border-b border-blue-300 dark:border-blue-800 px-4 py-2.5 flex items-center gap-2">
          <Lock size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-400 text-xs">You're browsing the under-18 feed — casual meetups only.</p>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-8 pb-4 sticky top-0 bg-[#fdf6ec] dark:bg-[#15110d]/95 backdrop-blur-sm z-10 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">
              {greeting}{username ? `, ${username}` : ''}
            </p>
            <h1 className="text-xl font-bold text-[#15110d] dark:text-[#fdf6ec] mt-0.5">What's the move</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/inbox"
              className="relative w-10 h-10 rounded-full bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 flex items-center justify-center active:scale-95 transition"
            >
              <Bell size={18} className="text-[#15110d] dark:text-[#fdf6ec]" />
              {unread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white dark:border-[#221c16]" />
              )}
            </Link>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeFilter === f.id
                  ? 'bg-accent border-accent text-white'
                  : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600'
              }`}
            >
              {f.id === 'foryou' && <Sparkles size={12} strokeWidth={2.5} />}
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
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-4">
              {activeFilter === 'all'
                ? <MapPin size={28} className="text-gray-400" />
                : <Search size={28} className="text-gray-400" />}
            </div>
            <h2 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-lg mb-1">
              {activeFilter === 'all' ? 'No events yet' : `Nothing ${activeFilter === 'today' ? 'today' : activeFilter === 'tomorrow' ? 'tomorrow' : 'this week'}`}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {activeFilter === 'all'
                ? 'Be the first to create a meetup in your city.'
                : 'Try a different filter or create your own.'}
            </p>
            <Link
              href="/events/create"
              className="bg-accent hover:brightness-90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition"
            >
              Create a Meetup
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
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
