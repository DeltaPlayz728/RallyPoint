'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { playMessageSound, playNotificationSound, playJoinSound } from '@/lib/sounds'

// Always-mounted (see app/layout.tsx) global listener that plays a sound
// cue no matter what page the user is on — mirrors how CriticalPatchBanner
// and ReferralCapture are already mounted app-wide for the same reason.
// Renders nothing; it's purely a set of realtime subscriptions.
//
// Three sources, three sounds:
//  - `notifications` INSERT for me                       -> notification chime
//  - `community_messages` / `dm_messages` INSERT from someone else -> message blip
//  - `event_attendees` INSERT on an event I host, by someone else  -> join chime
//
// event_attendees has no community/host filter available at the DB level
// (its RLS is "any authenticated user can read", since attendee lists are
// visible on public event pages), so this subscribes broadly and filters
// client-side against a Set of event ids the current user hosts, fetched
// once on mount. Notifications and messages are scoped tighter already —
// notifications by user_id filter, messages implicitly by RLS (a user only
// receives realtime rows for chats they can actually SELECT).
export default function SoundCueListener() {
  useEffect(() => {
    let cancelled = false
    const channels: ReturnType<typeof supabase.channel>[] = []

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: hosted } = await supabase
        .from('events')
        .select('id')
        .eq('created_by', user.id)
      const hostedEventIds = new Set((hosted ?? []).map((e: any) => e.id))

      if (cancelled) return

      const notifChannel = supabase
        .channel('sound-cues-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => playNotificationSound()
        )
        .subscribe()
      channels.push(notifChannel)

      const messageChannel = supabase
        .channel('sound-cues-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, (payload: any) => {
          if (payload.new?.sender_id !== user.id) playMessageSound()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, (payload: any) => {
          if (payload.new?.sender_id !== user.id) playMessageSound()
        })
        .subscribe()
      channels.push(messageChannel)

      const attendeeChannel = supabase
        .channel('sound-cues-attendees')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_attendees' }, (payload: any) => {
          const row = payload.new
          // Interested/Can't Go RSVPs also insert a row now (three-state RSVP) —
          // only an actual "going" join should chime for the host.
          if (row && row.rsvp_status === 'going' && hostedEventIds.has(row.event_id) && row.user_id !== user.id) playJoinSound()
        })
        .subscribe()
      channels.push(attendeeChannel)
    }

    init()

    return () => {
      cancelled = true
      channels.forEach((c) => supabase.removeChannel(c))
    }
  }, [])

  return null
}
