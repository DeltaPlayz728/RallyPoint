'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { MapPin, Check, X, Reply } from 'lucide-react'
import HoverActions from '@/components/chat/HoverActions'
import ReactionPills from '@/components/chat/ReactionPills'
import { useMessageReactions } from '@/lib/useMessageReactions'
import { moderateContent, flagForReview } from '@/lib/contentModeration'
import { dotTextureBackground } from '@/lib/color'

type Message = {
  id: string
  content: string
  created_at: string
  sender_id: string
}

type OtherProfile = {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  is_bot: boolean
}

export default function DmThreadPage() {
  const { userId: otherUserId } = useParams() as { userId: string }
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [other, setOther] = useState<OtherProfile | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [resolvedProposals, setResolvedProposals] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // The set of message ids already on screen the moment this thread finished its
  // initial load. Anything that arrives afterward (via realtime) and isn't from
  // me gets a "New messages" divider rendered before the first one — a session-
  // scoped approximation of Discord's unread marker (no persisted read-cursor
  // exists yet, so this resets on next visit rather than surviving a reload).
  const seenAtLoadRef = useRef<Set<string> | null>(null)
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null)
  // Own accent color, used to tint the wallpaper (the personal analog of a
  // community's banner_color, since a DM has no community to draw one from).
  const [myBannerColor, setMyBannerColor] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('profile_banner_color')
        .eq('id', user.id)
        .maybeSingle()
      if (myProfile?.profile_banner_color) setMyBannerColor(myProfile.profile_banner_color)

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_bot')
        .eq('id', otherUserId)
        .single()

      if (!otherProfile) { router.push('/friends'); return }
      setOther(otherProfile)

      // Get or create the thread — user_a/user_b must be sorted (user_a < user_b)
      const userA = user.id < otherUserId ? user.id : otherUserId
      const userB = user.id < otherUserId ? otherUserId : user.id

      let { data: thread } = await supabase
        .from('dm_threads')
        .select('id')
        .eq('user_a', userA)
        .eq('user_b', userB)
        .maybeSingle()

      if (!thread) {
        const { data: newThread, error: insertError } = await supabase
          .from('dm_threads')
          .insert({ user_a: userA, user_b: userB })
          .select('id')
          .single()

        if (insertError) {
          // Two people can open this DM for the first time at nearly the same
          // moment — both see "no thread yet" and both try to create one. The
          // (user_a, user_b) unique constraint lets exactly one insert win;
          // the loser used to just get stuck on the loading screen forever.
          // Re-fetch instead of giving up — the row is there now either way.
          const { data: existing } = await supabase
            .from('dm_threads')
            .select('id')
            .eq('user_a', userA)
            .eq('user_b', userB)
            .maybeSingle()
          thread = existing
        } else {
          thread = newThread
        }
      }

      if (!thread) { setLoading(false); return }
      setThreadId(thread.id)

      const { data: msgs } = await supabase
        .from('dm_messages')
        .select('id, content, created_at, sender_id')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])
      seenAtLoadRef.current = new Set((msgs ?? []).map(m => m.id))
      setLoading(false)
    }

    load()
  }, [otherUserId])

  // Realtime subscription
  useEffect(() => {
    if (!threadId) return

    const channel = supabase
      .channel(`dm:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
          if (seenAtLoadRef.current && !seenAtLoadRef.current.has(msg.id) && msg.sender_id !== userId) {
            setFirstUnreadId((prev) => prev ?? msg.id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId, userId])

  const messageIds = useMemo(() => messages.map(m => m.id), [messages])
  const { forMessage, toggle: toggleReaction } = useMessageReactions('dm', messageIds, userId)

  const REPLY_RE = /^\[\[REPLYTO:([^\]]*)\]\]/

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !threadId || !userId || !other) return
    // No reply-to column on dm_messages — quote the source line inline with the
    // same bracket-marker convention the bot proposal flow already uses
    // ([[PROPOSAL:...]]), so no schema change is needed to support replies.
    const quotePrefix = replyingTo ? `[[REPLYTO:${replyingTo.content.slice(0, 80).replace(/[\[\]]/g, '')}]]` : ''
    const content = quotePrefix + newMessage.trim()

    const modResult = moderateContent(content)
    if (!modResult.allowed && modResult.action === 'block') {
      alert('This message can\'t be sent — please rephrase it.')
      return
    }

    setSending(true)
    setNewMessage('')
    setReplyingTo(null)

    if (other.is_bot) {
      // Route through the assistant API so it can store + generate a reply
      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message: content }),
        })
        if (!res.ok) {
          // Optimistically show the user's own message even if the bot reply failed
          setMessages(prev => [...prev, {
            id: `local-${Date.now()}`, content, created_at: new Date().toISOString(), sender_id: userId,
          }])
        }
      } catch {
        setMessages(prev => [...prev, {
          id: `local-${Date.now()}`, content, created_at: new Date().toISOString(), sender_id: userId,
        }])
      }
    } else {
      const { data: inserted, error } = await supabase.from('dm_messages').insert({
        thread_id: threadId,
        sender_id: userId,
        content,
      }).select('id').single()

      if (!error && !modResult.allowed && inserted) {
        flagForReview(userId, 'dm_message', inserted.id, modResult.reason)
      }

      if (!error) {
        const { data: sender } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', userId)
          .single()

        const senderName = sender?.username ? `@${sender.username}` : sender?.full_name ?? 'Someone'

        await supabase.from('notifications').insert({
          user_id: other.id,
          type: 'dm',
          title: `${senderName} sent you a message`,
          body: content.length > 60 ? content.slice(0, 60) + '…' : content,
          link: `/inbox/dm/${userId}`,
        })
      }
    }

    setSending(false)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const PROPOSAL_RE = /\[\[PROPOSAL:([a-f0-9-]+)\]\]/i

  const respondToProposal = async (proposalId: string, accept: boolean) => {
    if (!userId) return
    setRespondingTo(proposalId)
    const res = await fetch('/api/assistant/seed-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, proposalId, accept }),
    })
    setRespondingTo(null)
    if (!res.ok) {
      alert('Something went wrong. Please try again.')
      return
    }
    setResolvedProposals(prev => new Set(prev).add(proposalId))
  }

  if (loading || !other) return (
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
  )

  const displayName = other.username ? `@${other.username}` : other.full_name

  return (
    <div className="flex flex-col h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16]">
        <Link href="/friends" className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">←</Link>
        {other.avatar_url ? (
          <img src={other.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-black dark:text-[#fdf6ec] ${
            other.is_bot ? 'bg-accent' : 'bg-gray-700'
          }`}>
            {other.is_bot ? <MapPin size={16} /> : displayName[1]?.toUpperCase() ?? displayName[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm flex items-center gap-1.5">
            {displayName}
            {other.is_bot && (
              <span className="text-[10px] bg-orange-100 text-accent px-1.5 py-0.5 rounded-full font-semibold">
                AI
              </span>
            )}
          </div>
          {other.is_bot && <div className="text-xs text-gray-500 dark:text-gray-400">RallyPoint's assistant</div>}
        </div>
        <Logo size={22} className="ml-auto" />
      </div>

      {/* Messages — subtle repeating dot texture behind the bubbles (WhatsApp-style
          depth) instead of a flat page color. Kept as a CSS background-image so it
          costs nothing at runtime and follows the theme via two different SVGs. */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#fdf6ec] dark:bg-[#15110d]"
        style={dotTextureBackground(myBannerColor)}
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-10">
            {other.is_bot ? "Say hi — I can help you find or plan something to do." : 'No messages yet. Say hi!'}
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId
          const proposalMatch = msg.content.match(PROPOSAL_RE)
          let displayContent = msg.content.replace(PROPOSAL_RE, '').trim()
          const proposalId = proposalMatch?.[1]
          const resolved = proposalId ? resolvedProposals.has(proposalId) : false
          const replyMatch = displayContent.match(REPLY_RE)
          const quoted = replyMatch?.[1]
          if (replyMatch) displayContent = displayContent.replace(REPLY_RE, '').trim()

          return (
            <div key={msg.id}>
              {firstUnreadId === msg.id && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-accent/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">New messages</span>
                  <div className="flex-1 h-px bg-accent/40" />
                </div>
              )}
              {/* Discord-style hover: the highlight spans the FULL row width (bleeds past
                  the message bubble to the container edges via -mx-4/px-4), not just the
                  bubble itself, the timestamp fades in on hover, and a hover action
                  toolbar (react/reply/copy) appears at the row's outer edge. */}
              <div
                className="group relative flex flex-col -mx-4 px-4 py-1 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}
              >
                {quoted && (
                  <div className="max-w-xs text-xs text-gray-500 dark:text-gray-400 border-l-2 border-gray-300 dark:border-gray-600 pl-2 mb-1 truncate">
                    {quoted}
                  </div>
                )}
                {/* HoverActions is positioned relative to THIS wrapper (sized to the
                    bubble, not the full-width row) so it lands next to the bubble's
                    actual edge instead of translating off past the row/screen edge. */}
                <div className="relative inline-block max-w-xs">
                  <HoverActions
                    isMe={isMe}
                    content={displayContent}
                    onReply={() => setReplyingTo(msg)}
                    onReact={(emoji) => toggleReaction(msg.id, emoji)}
                  />
                  <div className={`px-4 py-2 rounded-2xl text-sm text-[#15110d] dark:text-[#fdf6ec] ${
                    isMe
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-gray-200 dark:bg-gray-700 rounded-bl-sm'
                  }`}>
                    {displayContent}
                  </div>
                </div>
                <ReactionPills reactions={forMessage(msg.id)} currentUserId={userId} onToggle={(emoji) => toggleReaction(msg.id, emoji)} />
                {proposalId && !resolved && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => respondToProposal(proposalId, true)}
                      disabled={respondingTo === proposalId}
                      className="text-xs bg-accent hover:brightness-90 text-white px-3 py-1.5 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      {respondingTo === proposalId ? 'Creating…' : 'Yes, set it up'}
                    </button>
                    <button
                      onClick={() => respondToProposal(proposalId, false)}
                      disabled={respondingTo === proposalId}
                      className="text-xs border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-xl transition hover:border-gray-500 disabled:opacity-50"
                    >
                      No thanks
                    </button>
                  </div>
                )}
                {proposalId && resolved && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 inline-flex items-center gap-1"><Check size={11} /> Responded</span>
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#221c16] border-t border-gray-200 dark:border-gray-700 text-xs">
          <Reply size={12} className="text-accent shrink-0" />
          <span className="flex-1 truncate text-gray-600 dark:text-gray-400">Replying to: {replyingTo.content.replace(REPLY_RE, '').slice(0, 60)}</span>
          <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-black dark:hover:text-white shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
      <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16] flex gap-2 pb-20">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-gray-200 dark:bg-gray-700 text-[#15110d] dark:text-[#fdf6ec] rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="bg-accent hover:brightness-90 text-white px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
