'use client'

import { useState } from 'react'
import { useFriendship } from '@/lib/useFriendship'

interface Props {
  currentUserId: string
  targetUserId: string
  size?: 'sm' | 'md'
}

export default function FriendButton({ currentUserId, targetUserId, size = 'md' }: Props) {
  const { status, friendshipId, loading } = useFriendship(currentUserId, targetUserId)
  const [optimistic, setOptimistic] = useState<typeof status | null>(null)
  const [acting, setActing] = useState(false)

  const current = optimistic ?? status

  const sendRequest = async () => {
    setActing(true)
    setOptimistic('pending_sent')
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: currentUserId, receiverId: targetUserId }),
    })
    setActing(false)
  }

  const respond = async (action: 'accepted' | 'declined') => {
    if (!friendshipId) return
    setActing(true)
    setOptimistic(action === 'accepted' ? 'accepted' : 'declined')
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId: currentUserId, action }),
    })
    setActing(false)
  }

  const unfriend = async () => {
    if (!friendshipId) return
    setActing(true)
    setOptimistic('none')
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, userId: currentUserId }),
    })
    setActing(false)
  }

  const sm = size === 'sm'
  const base = sm
    ? 'text-xs px-2.5 py-1 rounded-full font-semibold border transition'
    : 'text-sm px-4 py-2 rounded-xl font-semibold border transition'

  if (loading) return null

  if (current === 'accepted') {
    return (
      <button
        onClick={unfriend}
        disabled={acting}
        className={`${base} bg-green-950/40 border-green-800 text-green-400 hover:bg-red-950/40 hover:border-red-800 hover:text-red-400`}
      >
        ✓ Friends
      </button>
    )
  }

  if (current === 'pending_sent') {
    return (
      <button
        onClick={unfriend}
        disabled={acting}
        className={`${base} bg-gray-900 border-gray-700 text-gray-500`}
      >
        Pending…
      </button>
    )
  }

  if (current === 'pending_received') {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => respond('accepted')}
          disabled={acting}
          className={`${base} bg-orange-500 border-orange-500 text-white hover:bg-orange-600`}
        >
          Accept
        </button>
        <button
          onClick={() => respond('declined')}
          disabled={acting}
          className={`${base} bg-transparent border-gray-700 text-gray-500 hover:border-gray-500`}
        >
          Decline
        </button>
      </div>
    )
  }

  // none or declined — show Add Friend
  return (
    <button
      onClick={sendRequest}
      disabled={acting}
      className={`${base} bg-transparent border-orange-500/40 text-orange-400 hover:bg-orange-500/10`}
    >
      + Add Friend
    </button>
  )
}
