'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      // Check user is an attendee
      const { data: attendee } = await supabase
        .from('event_attendees')
        .select('id')
        .eq('event_id', id)
        .eq('user_id', user.id)
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
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !chatId || !userId) return
    setSending(true)

    const content = newMessage.trim()

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, user_id: userId, content })
      .select('*, profiles(username, full_name)')
      .single()

    if (error) {
      console.error('Send error:', error.message)
    } else {
      setNewMessage('')

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
            body: content.length > 60 ? content.slice(0, 60) + '…' : content,
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-10">
            No messages yet. Say hi! 👋
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const name = msg.profiles?.username
            ? `@${msg.profiles.username}`
            : msg.profiles?.full_name ?? 'Someone'

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{name}</span>
              )}
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                isMe
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-gray-200 dark:bg-gray-700 dark:bg-[#2b241c] text-[#15110d] dark:text-[#fdf6ec] rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">{formatTime(msg.created_at)}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16] flex gap-2 pb-20">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-gray-200 dark:bg-gray-700 dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}

