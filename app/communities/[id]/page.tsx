'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  banner_color: string
}

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  senderName: string
}

type Announcement = {
  id: string
  author_id: string
  content: string
  created_at: string
  authorName: string
}

type Member = {
  user_id: string
  name: string
  avatar_url: string | null
}

export default function CommunityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const communityId = params.id as string
  const bottomRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [community, setCommunity] = useState<Community | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [tab, setTab] = useState<'chat' | 'announcements' | 'members'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [draft, setDraft] = useState('')
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: c } = await supabase
        .from('communities')
        .select('id, owner_id, name, description, banner_color')
        .eq('id', communityId)
        .maybeSingle()

      if (!c) { router.push('/communities'); return }
      setCommunity(c)

      const { data: membership } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsMember(!!membership)

      await refreshAll()
      setLoading(false)
    }

    const refreshAll = async () => {
      const [{ data: msgs }, { data: ann }, { data: mem }] = await Promise.all([
        supabase
          .from('community_messages')
          .select('id, sender_id, content, created_at, profiles(full_name, username)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase
          .from('community_announcements')
          .select('id, author_id, content, created_at, profiles(full_name, username)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('community_members')
          .select('user_id, profiles(full_name, username, avatar_url)')
          .eq('community_id', communityId),
      ])

      setMessages((msgs ?? []).map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        senderName: m.profiles?.username ? `@${m.profiles.username}` : (m.profiles?.full_name ?? 'Someone'),
      })))

      setAnnouncements((ann ?? []).map((a: any) => ({
        id: a.id,
        author_id: a.author_id,
        content: a.content,
        created_at: a.created_at,
        authorName: a.profiles?.username ? `@${a.profiles.username}` : (a.profiles?.full_name ?? 'Someone'),
      })))

      setMembers((mem ?? []).map((m: any) => ({
        user_id: m.user_id,
        name: m.profiles?.username ? `@${m.profiles.username}` : (m.profiles?.full_name ?? 'Member'),
        avatar_url: m.profiles?.avatar_url ?? null,
      })))
    }

    load()

    const channel = supabase
      .channel(`community-${communityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_announcements', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [communityId, router])

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, tab])

  const handleJoin = async () => {
    if (!userId) return
    await supabase.from('community_members').insert({ community_id: communityId, user_id: userId })
    setIsMember(true)
  }

  const handleLeave = async () => {
    if (!userId) return
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
    router.push('/communities')
  }

  const handleSend = async () => {
    if (!userId || !draft.trim()) return
    setSending(true)
    await supabase.from('community_messages').insert({
      community_id: communityId,
      sender_id: userId,
      content: draft.trim(),
    })
    setDraft('')
    setSending(false)
  }

  const handlePostAnnouncement = async () => {
    if (!userId || !announcementDraft.trim()) return
    setSending(true)
    await supabase.from('community_announcements').insert({
      community_id: communityId,
      author_id: userId,
      content: announcementDraft.trim(),
    })
    setAnnouncementDraft('')
    setSending(false)
  }

  if (loading || !community) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500">
      <TopBar title="Community" />
      <div className="flex items-center justify-center pt-20">Loading...</div>
    </div>
  )

  const isOwner = community.owner_id === userId

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title={community.name} />

      <div className="h-16" style={{ background: community.banner_color }} />

      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold">{community.name}</h1>
            {community.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{community.description}</p>
            )}
          </div>
          {!isMember ? (
            <button onClick={handleJoin} className="shrink-0 bg-orange-500 text-white rounded-lg px-4 py-1.5 text-xs font-medium">
              Join
            </button>
          ) : !isOwner ? (
            <button onClick={handleLeave} className="shrink-0 bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-medium">
              Leave
            </button>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 pt-4 pb-3">
          {(['chat', 'announcements', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                tab === t
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {!isMember && (
          <p className="text-gray-400 dark:text-gray-500 text-xs text-center pb-3">
            Join to chat and post — you can still read announcements.
          </p>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col">
            <div className="space-y-3 mb-3 max-h-[55vh] overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center pt-6">No messages yet.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender_id === userId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">{m.senderName}</span>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender_id === userId
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-200 dark:border-gray-700'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {isMember && (
              <div className="flex gap-2 sticky bottom-20">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Message the community..."
                  className="flex-1 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="bg-orange-500 text-white rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'announcements' && (
          <div>
            {isOwner && (
              <div className="flex gap-2 mb-4">
                <input
                  value={announcementDraft}
                  onChange={(e) => setAnnouncementDraft(e.target.value)}
                  placeholder="Pin an announcement..."
                  className="flex-1 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm outline-none"
                />
                <button
                  onClick={handlePostAnnouncement}
                  disabled={sending || !announcementDraft.trim()}
                  className="bg-orange-500 text-white rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  Post
                </button>
              </div>
            )}
            {announcements.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center pt-6">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <p className="text-sm text-[#15110d] dark:text-[#fdf6ec]">{a.content}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1.5">
                      📌 {a.authorName} · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {m.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-[#15110d] dark:text-[#fdf6ec]">
                  {m.name}{m.user_id === community.owner_id ? ' · Owner' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
