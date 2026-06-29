'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/TopBar'

const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

function Avatar({ name, avatarUrl, index, size = 'md' }: {
  name: string
  avatarUrl?: string | null
  index: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0`} />
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-black text-black dark:text-[#fdf6ec] shrink-0`}
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
    >
      {(name ?? '?')[0].toUpperCase()}
    </div>
  )
}

type FriendRow = {
  friendshipId: string
  userId: string
  name: string
  username: string | null
  avatarUrl: string | null
  status: 'pending' | 'accepted'
  iRequested: boolean
  recentEvent?: string | null
}

type DmRow = {
  id: string
  otherUserId: string
  otherName: string
  otherUsername: string | null
  otherAvatar: string | null
  lastMessage: string
  lastAt: string
  unread: boolean
}

type EventChatRow = {
  id: string
  eventId: string
  eventTitle: string
  lastMessage: string
  lastAt: string
  unread: boolean
  emoji: string
}

type JoinedCommunityRow = {
  id: string
  name: string
  bannerColor: string
  iconUrl: string | null
}

type View = 'chat' | 'requests'

export default function FriendsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [dms, setDms] = useState<DmRow[]>([])
  const [eventChats, setEventChats] = useState<EventChatRow[]>([])
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunityRow[]>([])
  const [botId, setBotId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('chat')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      // Load friendships
      const { data: friendData } = await supabase
        .from('friendships')
        .select(`
          id, status, requester_id, receiver_id,
          requester:profiles!friendships_requester_id_fkey(full_name, username, avatar_url),
          receiver:profiles!friendships_receiver_id_fkey(full_name, username, avatar_url)
        `)
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .neq('status', 'declined')
        .order('created_at', { ascending: false })

      const rows: FriendRow[] = (friendData ?? []).map((f: any) => {
        const iRequested = f.requester_id === user.id
        const other = iRequested ? f.receiver : f.requester
        const otherId = iRequested ? f.receiver_id : f.requester_id
        return {
          friendshipId: f.id,
          userId: otherId,
          name: other?.full_name ?? 'Unknown',
          username: other?.username ?? null,
          avatarUrl: other?.avatar_url ?? null,
          status: f.status,
          iRequested,
          recentEvent: null,
        }
      })
      setFriends(rows)

      // RallyPoint Assistant — always pinned at the top, even with 0 friends
      const { data: bot } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_bot', true)
        .maybeSingle()
      setBotId(bot?.id ?? null)

      // Load event chats (events the user has joined)
      const { data: attendeeData } = await supabase
        .from('event_attendees')
        .select('event_id, events(id, title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      const chatRows: EventChatRow[] = (attendeeData ?? []).map((a: any, i: number) => ({
        id: a.event_id,
        eventId: a.event_id,
        eventTitle: a.events?.title ?? 'Event',
        lastMessage: 'Tap to open chat',
        lastAt: '',
        unread: false,
        emoji: ['🎳', '🎵', '🍕', '🎨', '⚽', '🎭'][i % 6],
      }))
      setEventChats(chatRows)

      // Load communities the user has joined — shown as a row above the search bar
      const { data: membershipData } = await supabase
        .from('community_members')
        .select('community_id, communities(id, name, banner_color, icon_url)')
        .eq('user_id', user.id)

      const communityRows: JoinedCommunityRow[] = (membershipData ?? [])
        .map((m: any) => m.communities)
        .filter(Boolean)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          bannerColor: c.banner_color ?? '#f97316',
          iconUrl: c.icon_url ?? null,
        }))
      setJoinedCommunities(communityRows)

      setLoading(false)
    }
    load()
  }, [router])

  const accepted = friends.filter(f => f.status === 'accepted')
  const pendingReceived = friends.filter(f => f.status === 'pending' && !f.iRequested)
  const pendingSent = friends.filter(f => f.status === 'pending' && f.iRequested)

  const filteredFriends = accepted.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.username?.toLowerCase().includes(search.toLowerCase())
  )

  const handleRespond = async (friendshipId: string, action: 'accepted' | 'declined') => {
    if (!userId) return
    const res = await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId, action }),
    })
    if (!res.ok) {
      alert('Something went wrong. Please try again.')
      return
    }
    if (action === 'accepted') {
      setFriends(prev => prev.map(f =>
        f.friendshipId === friendshipId ? { ...f, status: 'accepted' as const } : f
      ))
    } else {
      setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId))
    }
  }

  const handleRemove = async (friendshipId: string) => {
    if (!userId) return
    const res = await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId }),
    })
    if (!res.ok) {
      alert('Something went wrong. Please try again.')
      return
    }
    setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId))
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="Friends" />

      {/* Joined communities — horizontal bubble row, Instagram Notes style */}
      {joinedCommunities.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            {joinedCommunities.map((c) => (
              <Link key={c.id} href={`/communities/${c.id}`} className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-lg shrink-0 border-2 border-white dark:border-[#221c16] shadow-sm overflow-hidden"
                  style={{ background: c.bannerColor }}
                >
                  {c.iconUrl ? (
                    <img src={c.iconUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    c.name[0]?.toUpperCase() ?? '?'
                  )}
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[60px] truncate text-center">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 pt-3 pb-2 sticky top-[72px] bg-[#fdf6ec] dark:bg-[#15110d] z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-[#221c16] rounded-2xl px-4 py-2.5" style={{ width: '80%' }}>
            <span className="text-gray-600 dark:text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-[#15110d] dark:text-[#fdf6ec] placeholder-gray-600 outline-none flex-1"
            />
          </div>
          <Link
            href="/communities"
            className="flex items-center justify-center gap-1 bg-white dark:bg-[#221c16] rounded-2xl py-2.5 text-sm text-[#15110d] dark:text-[#fdf6ec] font-medium"
            style={{ width: '20%' }}
            title="Communities"
          >
            🏘️
          </Link>
        </div>
      </div>

      {/* Friends activity row */}
      {accepted.length > 0 && (
        <div className="px-4 pt-2 pb-3 border-b border-gray-300 dark:border-gray-700">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            {accepted.map((f, i) => (
              <Link key={f.friendshipId} href={`/profile/${f.userId}`} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <Avatar name={f.name} avatarUrl={f.avatarUrl} index={i} size="lg" />
                  {f.recentEvent && (
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full text-[10px] px-1.5 py-0.5 border-2 border-black">
                      {f.recentEvent}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[52px] truncate text-center">
                  {f.username ?? f.name.split(' ')[0]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        {(['chat', 'requests'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
              view === v
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {v === 'chat' ? 'Messages' : 'Requests'}
            {v === 'requests' && pendingReceived.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingReceived.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto">

        {view === 'chat' ? (
          <div className="pb-4">

            {/* DMs section */}
            <div className="px-4 pt-4 pb-1">
              <p className="text-gray-600 dark:text-gray-400 text-[11px] font-semibold uppercase tracking-widest mb-2">
                💬 Messages &amp; Groups
              </p>
            </div>

            {/* RallyPoint Assistant — pinned, always visible */}
            {botId && !search && (
              <Link
                href={`/inbox/dm/${botId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-[#221c16] active:bg-white transition"
              >
                <div className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center text-lg shrink-0">
                  📍
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-sm truncate flex items-center gap-1.5">
                    RallyPoint Assistant
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
                      AI
                    </span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs truncate">Find something to do, or plan your own</p>
                </div>
                <span className="text-gray-700 dark:text-gray-300 text-lg">›</span>
              </Link>
            )}

            {loading ? (
              <div className="space-y-1 px-4">
                {[0, 1].map(i => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="w-11 h-11 rounded-full bg-white dark:bg-[#221c16] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 bg-white dark:bg-[#221c16] rounded animate-pulse" />
                      <div className="h-3 w-40 bg-white dark:bg-[#221c16] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {search ? 'No friends match your search' : 'No friends yet — join events to meet people'}
                </p>
              </div>
            ) : (
              <div>
                {filteredFriends.map((f, i) => (
                  <Link
                    key={f.friendshipId}
                    href={`/inbox/dm/${f.userId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-[#221c16] active:bg-white transition"
                  >
                    <Avatar name={f.name} avatarUrl={f.avatarUrl} index={i} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-sm truncate">
                        {f.username ? `@${f.username}` : f.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-xs truncate">Tap to message</p>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-lg">›</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Event & Venue Chats section */}
            {eventChats.length > 0 && (
              <>
                <div className="px-4 pt-5 pb-1">
                  <p className="text-gray-600 dark:text-gray-400 text-[11px] font-semibold uppercase tracking-widest mb-2">
                    🎳 Event &amp; Venue Chats
                  </p>
                </div>
                <div>
                  {eventChats.map(ec => (
                    <Link
                      key={ec.id}
                      href={`/events/${ec.eventId}/chat`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-[#221c16] active:bg-white transition"
                    >
                      <div className="w-11 h-11 bg-orange-500 border border-black rounded-2xl flex items-center justify-center text-xl shrink-0">
                        {ec.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-sm truncate">{ec.eventTitle}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs truncate">{ec.lastMessage}</p>
                      </div>
                      {ec.unread && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />
                      )}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

        ) : (
          /* Requests view */
          <div className="px-4 pt-4">
            {/* Incoming */}
            {pendingReceived.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Incoming</p>
                <div className="space-y-2">
                  {pendingReceived.map((f, i) => (
                    <div key={f.friendshipId} className="flex items-center gap-3 p-4 bg-white dark:bg-[#221c16] rounded-2xl border border-gray-200 dark:border-gray-700">
                      <Link href={`/profile/${f.userId}`}>
                        <Avatar name={f.name} avatarUrl={f.avatarUrl} index={i} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${f.userId}`}>
                          <p className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-sm truncate">
                            {f.username ? `@${f.username}` : f.name}
                          </p>
                        </Link>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Wants to connect</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespond(f.friendshipId, 'accepted')}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl font-semibold transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespond(f.friendshipId, 'declined')}
                          className="text-xs border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-xl transition hover:border-gray-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent */}
            {pendingSent.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Sent</p>
                <div className="space-y-2">
                  {pendingSent.map((f, i) => (
                    <div key={f.friendshipId} className="flex items-center gap-3 p-4 bg-white dark:bg-[#221c16] rounded-2xl border border-gray-200 dark:border-gray-700">
                      <Link href={`/profile/${f.userId}`}>
                        <Avatar name={f.name} avatarUrl={f.avatarUrl} index={i} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#15110d] dark:text-[#fdf6ec] font-semibold text-sm truncate">
                          {f.username ? `@${f.username}` : f.name}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Request pending</p>
                      </div>
                      <button
                        onClick={() => handleRemove(f.friendshipId)}
                        className="text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-xl transition hover:border-gray-600 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingReceived.length === 0 && pendingSent.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-20 text-center">
                <div className="text-4xl mb-4">👋</div>
                <p className="text-[#15110d] dark:text-[#fdf6ec] font-bold mb-1">No pending requests</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Add friends from event attendee lists</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
