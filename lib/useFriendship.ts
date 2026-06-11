import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type FriendshipStatus =
  | 'none'
  | 'pending_sent'      // current user sent the request
  | 'pending_received'  // current user received the request
  | 'accepted'
  | 'declined'

export type FriendshipState = {
  status: FriendshipStatus
  friendshipId: string | null
  loading: boolean
}

export function useFriendship(currentUserId: string | null, targetUserId: string | null): FriendshipState {
  const [state, setState] = useState<FriendshipState>({
    status: 'none',
    friendshipId: null,
    loading: true,
  })

  useEffect(() => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      setState({ status: 'none', friendshipId: null, loading: false })
      return
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('friendships')
        .select('id, status, requester_id, receiver_id')
        .or(
          `and(requester_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),` +
          `and(requester_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
        )
        .maybeSingle()

      if (!data) {
        setState({ status: 'none', friendshipId: null, loading: false })
        return
      }

      let status: FriendshipStatus = 'none'
      if (data.status === 'accepted') {
        status = 'accepted'
      } else if (data.status === 'declined') {
        status = 'declined'
      } else if (data.status === 'pending') {
        status = data.requester_id === currentUserId ? 'pending_sent' : 'pending_received'
      }

      setState({ status, friendshipId: data.id, loading: false })
    }

    fetch()
  }, [currentUserId, targetUserId])

  return state
}
