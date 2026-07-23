'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import CommunityTag from '@/components/CommunityTag'
import { getCommunityTags, CommunityTag as CommunityTagData } from '@/lib/communityTags'
import { X, Reply } from 'lucide-react'
import HoverActions from '@/components/chat/HoverActions'
import ReactionPills from '@/components/chat/ReactionPills'
import { useMessageReactions } from '@/lib/useMessageReactions'
import { moderateContent, flagForReview } from '@/lib/contentModeration'
import { dotTextureBackground, DEFAULT_ACCENT } from '@/lib/color'

type Message = {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { username: string; full_name: string } | null
}

export default function EventChatPage() {
  const { id } = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [chatId, setChatId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [communityTags, setCommunityTags] = useState<Record<string, CommunityTagData>>({})
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenAtLoadRef = useRef<Set<string> | null>(null)
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null)
  const REPLY_RE = /^\[\[REPLYTO:([^\]]*)\]\]/

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      // Check user is a *going* attendee — "Interested"/"Can't Go" no longer
      // qualify for chat access (the messages_select/insert RLS policies enforce
      // this same rule server-side; this check just gives a friendlier redirect
      // instead of an empty/broken chat).
      const { data: attendee } = await supabase
        .from('event_attendees')
        .select('id')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .eq('rsvp_status', 'going')
        .maybeSingle()

      if (!attendee) { router.push(`/events/${id}`); return }

      // Get event title
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', id)
        .single()

      setEventTitle(event?.title ?? 'Event')

      // Get or create chat
      let { data: chat } = await supabase
        .from('event_chats')
        .select('id')
        .eq('event_id', id)
        .maybeSingle()

      if (!chat) {
        const { data: newChat } = await supabase
          .from('event_chats')
          .upsert({ event_id: id }, { onConflict: 'event_id' })
          .select()
          .single()
        chat = newChat
      }

      if (!chat) {
        setLoading(false)
        return
      }
      setChatId(chat.id)

      // Load existing messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, profiles(username, full_name)')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])
      seenAtLoadRef.current = new Set((msgs ?? []).map(m => m.id))
      getCommunityTags((msgs ?? []).map(m => m.user_id)).then(setCommunityTags)
      setLoading(false)
    }

    load()
  }, [id])

  // Realtime subscription — runs when chatId is set
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const { data: msgWithProfile } = await supabase
            .from('messages')
            .select('*, profiles(username, full_name)')
            .eq('id', (payload.new as any).id)
            .single()

          if (msgWithProfile) {
            setMessages(prev => [...prev, msgWithProfile])
            if (seenAtLoadRef.current && !seenAtLoadRef.current.has(msgWithProfile.id) && msgWithProfile.user_id !== userId) {
              setFirstUnreadId((prev) => prev ?? msgWithProfile.id)
            }
            getCommunityTags([msgWithProfile.user_id]).then(tag => setCommunityTags(prev => ({ ...prev, ...tag })))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, userId])

  const messageIds = useMemo(() => messages.map(m => m.id), [messages])
  const { forMessage, toggle: toggleReaction } = useMessageReactions('event', messageIds, userId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !chatId || !userId) return

    const rawText = newMessage.trim()
    const quotePrefix = replyingTo ? `[[REPLYTO:${replyingTo.content.slice(0, 80).replace(/[\[\]]/g, '')}]]` : ''
    const content = quotePrefix + rawText

    const modResult = moderateContent(content)
    if (!modResult.allowed && modResult.action === 'block') {
      alert('This message can\'t be sent — please rephrase it.')
      return
    }

    setSending(true)

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, user_id: userId, content })
      .select('*, profiles(username, full_name)')
      .single()

    if (!error && !modResult.allowed && inserted) {
      flagForReview(userId, 'message', inserted.id, modResult.reason)
    }

    if (error) {
      console.error('Send error:', error.message)
    } else {
      setNewMessage('')
      setReplyingTo(null)

      // Show it immediately rather than waiting on the realtime subscription —
      // dedupe in case the realtime event also delivers it.
      if (inserted) {
        setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted])
      }

      // Notify all other attendees
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', id)
        .neq('user_id', userId)

      if (attendees && attendees.length > 0) {
        const { data: sender } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', userId)
          .single()

        const senderName = sender?.username ? `@${sender.username}` : sender?.full_name ?? 'Someone'

        await supabase.from('notifications').insert(
          attendees.map((a: any) => ({
            user_id: a.user_id,
            type: 'group_chat',
            title: `${senderName} sent a message in ${eventTitle}`,
            body: rawText.length > 60 ? rawText.slice(0, 60) + '…' : rawText,
            link: `/events/${id}/chat`,
          }))
        )
      }
    }
    setSending(false)
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center text-gray-500 dark:text-gray-400">Loading chat...</div>
  )

  return (
    <div className="flex flex-col h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16]">
        <Link href={`/events/${id}`} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">←</Link>
        <div>
          <div className="font-semibold text-sm">{eventTitle}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Group Chat</div>
        </div>
        <Logo size={22} className="ml-auto" />
      </div>

      {/* Messages — same subtle dot texture + full-row hover highlight as the DM view */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#fdf6ec] dark:bg-[#15110d]"
        style={dotTextureBackground(DEFAULT_ACCENT)}
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-10">
            No messages yet. Say hi!
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const name = msg.profiles?.username
            ? `@${msg.profiles.username}`
            : msg.profiles?.full_name ?? 'Someone'
          const replyMatch = msg.content.match(REPLY_RE)
          const quoted = replyMatch?.[1]
          const displayContent = replyMatch ? msg.content.replace(REPLY_RE, '').trim() : msg.content

          return (
            <div key={msg.id}>
              {firstUnreadId === msg.id && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-accent/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">New messages</span>
                  <div className="flex-1 h-px bg-accent/40" />
                </div>
              )}
              <div
                className="group relative flex flex-col -mx-4 px-4 py-1 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}
              >
                {!isMe && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1 inline-flex items-center gap-1">
                    {name}
                    <CommunityTag tag={communityTags[msg.user_id]} />
                  </span>
                )}
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
                  <div className={`px-4 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-gray-200 dark:bg-gray-700 dark:bg-[#2b241c] text-[#15110d] dark:text-[#fdf6ec] rounded-bl-sm'
                  }`}>
                    {displayContent}
                  </div>
                </div>
                <ReactionPills reactions={forMessage(msg.id)} currentUserId={userId} onToggle={(emoji) => toggleReaction(msg.id, emoji)} />
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
          className="flex-1 bg-gray-200 dark:bg-gray-700 dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
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

