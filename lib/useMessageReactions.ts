import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Reaction = { message_id: string; emoji: string; user_id: string }

// Shared reaction-loading + realtime-sync + toggle logic for the three chat
// surfaces (DM, event chat, community channel chat). One `message_reactions`
// table backs all three, discriminated by `source`.
export function useMessageReactions(source: 'dm' | 'event' | 'community', messageIds: string[], userId: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([])

  useEffect(() => {
    if (messageIds.length === 0) { setReactions([]); return }
    let cancelled = false
    supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .eq('message_source', source)
      .in('message_id', messageIds)
      .then(({ data }) => { if (!cancelled) setReactions(data ?? []) })
    return () => { cancelled = true }
    // Re-fetch when the visible message set changes (new messages loaded/arrived).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, messageIds.join(',')])

  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${source}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `message_source=eq.${source}` },
        (payload) => {
          const r = payload.new as Reaction
          setReactions((prev) => (prev.some((p) => p.message_id === r.message_id && p.user_id === r.user_id && p.emoji === r.emoji) ? prev : [...prev, r]))
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: `message_source=eq.${source}` },
        (payload) => {
          const r = payload.old as Reaction
          setReactions((prev) => prev.filter((p) => !(p.message_id === r.message_id && p.user_id === r.user_id && p.emoji === r.emoji)))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [source])

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return
    const mine = reactions.some((r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji)
    if (mine) {
      setReactions((prev) => prev.filter((r) => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji)))
      await supabase.from('message_reactions').delete()
        .eq('message_source', source).eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
    } else {
      setReactions((prev) => [...prev, { message_id: messageId, emoji, user_id: userId }])
      await supabase.from('message_reactions').insert({ message_source: source, message_id: messageId, user_id: userId, emoji })
    }
  }, [source, userId, reactions])

  const forMessage = useCallback((messageId: string) => reactions.filter((r) => r.message_id === messageId), [reactions])

  return { forMessage, toggle }
}
