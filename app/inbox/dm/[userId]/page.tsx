'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

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
        const { data: newThread } = await supabase
          .from('dm_threads')
          .insert({ user_a: userA, user_b: userB })
          .select('id')
          .single()
        thread = newThread
      }

      if (!thread) { setLoading(false); return }
      setThreadId(thread.id)

      const { data: msgs } = await supabase
        .from('dm_messages')
        .select('id, content, created_at, sender_id')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])
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
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !threadId || !userId || !other) return
    const content = newMessage.trim()
    setSending(true)
    setNewMessage('')

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
      const { error } = await supabase.from('dm_messages').insert({
        thread_id: threadId,
        sender_id: userId,
        content,
      })

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
    <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading...</div>
  )

  const displayName = other.username ? `@${other.username}` : other.full_name

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950">
        <Link href="/friends" className="text-gray-400 hover:text-white">←</Link>
        {other.avatar_url ? (
          <img src={other.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-black ${
            other.is_bot ? 'bg-orange-500' : 'bg-gray-700'
          }`}>
            {other.is_bot ? '📍' : displayName[1]?.toUpperCase() ?? displayName[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm flex items-center gap-1.5">
            {displayName}
            {other.is_bot && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-semibold">
                AI
              </span>
            )}
          </div>
          {other.is_bot && <div className="text-xs text-gray-500">RallyPoint's assistant</div>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-10">
            {other.is_bot ? "Say hi — I can help you find or plan something to do. 👋" : 'No messages yet. Say hi! 👋'}
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId
          const proposalMatch = msg.content.match(PROPOSAL_RE)
          const displayContent = msg.content.replace(PROPOSAL_RE, '').trim()
          const proposalId = proposalMatch?.[1]
          const resolved = proposalId ? resolvedProposals.has(proposalId) : false

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                isMe
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-gray-800 text-white rounded-bl-sm'
              }`}>
                {displayContent}
              </div>
              {proposalId && !resolved && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => respondToProposal(proposalId, true)}
                    disabled={respondingTo === proposalId}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl font-semibold transition disabled:opacity-50"
                  >
                    {respondingTo === proposalId ? 'Creating…' : 'Yes, set it up'}
                  </button>
                  <button
                    onClick={() => respondToProposal(proposalId, false)}
                    disabled={respondingTo === proposalId}
                    className="text-xs border border-gray-700 text-gray-400 px-3 py-1.5 rounded-xl transition hover:border-gray-500 disabled:opacity-50"
                  >
                    No thanks
                  </button>
                </div>
              )}
              {proposalId && resolved && (
                <span className="text-xs text-gray-500 mt-1">✓ Responded</span>
              )}
              <span className="text-xs text-gray-600 mt-1">{formatTime(msg.created_at)}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-800 bg-gray-950 flex gap-2 pb-20">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
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
