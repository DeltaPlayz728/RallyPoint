'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import FriendButton from '@/components/FriendButton'

const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center font-black text-black text-sm shrink-0"
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
  status: 'pending' | 'accepted'
  iRequested: boolean
}

export default function FriendsPage() {
  const [userId, setUserId]     = useState<string | null>(null)
  const [friends, setFriends]   = useState<FriendRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'requests' | 'friends'>('requests')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('friendships')
        .select(`
          id,
          status,
          requester_id,
          receiver_id,
          requester:profiles!friendships_requester_id_fkey(full_name, username),
          receiver:profiles!friendships_receiver_id_fkey(full_name, username)
        `)
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .neq('status', 'declined')
        .order('created_at', { ascending: false })

      const rows: FriendRow[] = (data ?? []).map((f: any) => {
        const iRequested = f.requester_id === user.id
        const other = iRequested ? f.receiver : f.requester
        const otherId = iRequested ? f.receiver_id : f.requester_id
        return {
          friendshipId: f.id,
          userId: otherId,
          name: other?.full_name ?? 'Unknown',
          username: other?.username ?? null,
          status: f.status,
          iRequested,
        }
      })

      setFriends(rows)
      setLoading(false)
    }
    load()
  }, [])

  const pendingReceived = friends.filter(f => f.status === 'pending' && !f.iRequested)
  const pendingSent     = friends.filter(f => f.status === 'pending' && f.iRequested)
  const accepted        = friends.filter(f => f.status === 'accepted')

  const handleRespond = async (friendshipId: string, action: 'accepted' | 'declined') => {
    if (!userId) return
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId, action }),
    })
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
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId }),
    })
    setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId))
  }

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 sticky top-0 bg-black/95 backdrop-blur-sm border-b border-gray-900/60 z-10">
        <h1 className="text-xl font-bold mb-4">Friends</h1>
        <div className="flex gap-2">
          {(['requests', 'friends'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                tab === t
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-transparent border-gray-800 text-gray-400'
              }`}
            >
              {t}
              {t === 'requests' && pendingReceived.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {pendingReceived.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 bg-[#111] rounded-2xl border border-gray-800/50">
                <div className="w-11 h-11 rounded-full bg-gray-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'requests' ? (
          <>
            {/* Incoming requests */}
            {pendingReceived.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                  Incoming
                </p>
                <div className="space-y-2">
                  {pendingReceived.map((f, i) => (
                    <div key={f.friendshipId} className="flex items-center gap-3 p-4 bg-[#111] rounded-2xl border border-gray-800/50">
                      <Link href={`/profile/${f.userId}`}>
                        <Avatar name={f.name} index={i} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${f.userId}`}>
                          <p className="text-white font-semibold text-sm truncate">
                            {f.username ? `@${f.username}` : f.name}
                          </p>
                        </Link>
                        <p className="text-gray-600 text-xs">Wants to be friends</p>
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
                          className="text-xs border border-gray-700 text-gray-500 px-3 py-1.5 rounded-xl transition hover:border-gray-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent requests */}
            {pendingSent.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                  Sent
                </p>
                <div className="space-y-2">
                  {pendingSent.map((f, i) => (
                    <div key={f.friendshipId} className="flex items-center gap-3 p-4 bg-[#111] rounded-2xl border border-gray-800/50">
                      <Link href={`/profile/${f.userId}`}>
                        <Avatar name={f.name} index={i} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {f.username ? `@${f.username}` : f.name}
                        </p>
                        <p className="text-gray-600 text-xs">Request pending</p>
                      </div>
                      <button
                        onClick={() => handleRemove(f.friendshipId)}
                        className="text-xs border border-gray-800 text-gray-600 px-3 py-1.5 rounded-xl transition hover:border-gray-600 hover:text-gray-400"
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
                <p className="text-white font-bold mb-1">No pending requests</p>
                <p className="text-gray-500 text-sm">
                  Add friends from event attendee lists
                </p>
              </div>
            )}
          </>
        ) : (
          /* Friends list */
          <>
            {accepted.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-20 text-center">
                <div className="text-4xl mb-4">🤝</div>
                <p className="text-white font-bold mb-1">No friends yet</p>
                <p className="text-gray-500 text-sm max-w-xs">
                  Join events and add people from the attendee list
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-600 text-xs mb-3">{accepted.length} friend{accepted.length !== 1 ? 's' : ''}</p>
                {accepted.map((f, i) => (
                  <div key={f.friendshipId} className="flex items-center gap-3 p-4 bg-[#111] rounded-2xl border border-gray-800/50">
                    <Link href={`/profile/${f.userId}`}>
                      <Avatar name={f.name} index={i} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${f.userId}`}>
                        <p className="text-white font-semibold text-sm truncate hover:text-orange-400 transition">
                          {f.username ? `@${f.username}` : f.name}
                        </p>
                      </Link>
                      {f.username && (
                        <p className="text-gray-600 text-xs">{f.name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(f.friendshipId)}
                      className="text-xs border border-gray-800 text-gray-600 px-3 py-1.5 rounded-xl transition hover:border-red-900 hover:text-red-500"
                    >
                      Unfriend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
