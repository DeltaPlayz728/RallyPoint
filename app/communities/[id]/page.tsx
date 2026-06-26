'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  banner_color: string
  banner_url: string | null
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

type MainTab = 'home' | 'chat' | 'events' | 'you'
type HomeView = 'list' | 'announcements' | 'about'

export default function CommunityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const communityId = params.id as string
  const bottomRef = useRef<HTMLDivElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [community, setCommunity] = useState<Community | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>('home')
  const [homeView, setHomeView] = useState<HomeView>('list')
  const [showMembers, setShowMembers] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [draft, setDraft] = useState('')
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: c } = await supabase
        .from('communities')
        .select('id, owner_id, name, description, banner_color, banner_url')
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
    if (mainTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, mainTab])

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

  const handleBannerPick = () => bannerInputRef.current?.click()

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !community) return
    setUploadingBanner(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${community.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community-banners')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data: pub } = supabase.storage.from('community-banners').getPublicUrl(path)
      const bannerUrl = `${pub.publicUrl}?t=${Date.now()}`
      await supabase.from('communities').update({ banner_url: bannerUrl }).eq('id', community.id)
      setCommunity({ ...community, banner_url: bannerUrl })
    } else {
      alert('Could not upload banner. Please try again.')
    }
    setUploadingBanner(false)
  }

  if (loading || !community) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex flex-col">
      <div className="h-12 bg-orange-500 flex items-center px-4">
        <span className="text-white text-sm">←</span>
      </div>
      <div className="flex items-center justify-center pt-20 text-gray-500">Loading...</div>
    </div>
  )

  const isOwner = community.owner_id === userId
  const generalPreview = messages[messages.length - 1]
  const latestAnnouncement = announcements[0]

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col pb-0">

      {/* Orange top bar */}
      <div className="h-12 bg-orange-500 flex items-center justify-between px-4 shrink-0 relative">
        <button onClick={() => router.push('/communities')} className="text-white text-lg leading-none">←</button>
        <span className="text-white text-sm font-semibold truncate max-w-[60%]">{community.name}</span>
        <button onClick={() => setShowMenu(v => !v)} className="text-white text-lg leading-none">⋯</button>

        {showMenu && (
          <div className="absolute top-12 right-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md overflow-hidden z-20 text-sm">
            {isMember && !isOwner && (
              <button
                onClick={() => { setShowMenu(false); handleLeave() }}
                className="block w-full text-left px-4 py-2.5 text-red-500 hover:bg-gray-50 dark:hover:bg-[#2b241c]"
              >
                Leave community
              </button>
            )}
            {!isMember && (
              <button
                onClick={() => { setShowMenu(false); handleJoin() }}
                className="block w-full text-left px-4 py-2.5 text-orange-500 hover:bg-gray-50 dark:hover:bg-[#2b241c]"
              >
                Join community
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); setMainTab('you') }}
              className="block w-full text-left px-4 py-2.5 text-[#15110d] dark:text-[#fdf6ec] hover:bg-gray-50 dark:hover:bg-[#2b241c]"
            >
              Community settings
            </button>
          </div>
        )}
      </div>

      {/* Banner slot */}
      <div
        className="relative h-24 shrink-0 flex items-end"
        style={{
          backgroundImage: community.banner_url
            ? `url(${community.banner_url})`
            : `linear-gradient(135deg, ${community.banner_color}, #fb923c)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {isOwner && (
          <>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
            <button
              onClick={handleBannerPick}
              disabled={uploadingBanner}
              className="absolute top-2.5 right-3 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-white text-xs"
              title="Edit banner"
            >
              {uploadingBanner ? '…' : '📷'}
            </button>
          </>
        )}
        <div className="px-4 pb-2.5">
          <h1 className="text-lg font-semibold text-white drop-shadow">{community.name}</h1>
          <p className="text-[11px] text-white/90 drop-shadow">{members.length} member{members.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {mainTab === 'home' && homeView === 'list' && (
          <div className="pb-4">
            {!isMember && (
              <p className="text-gray-400 dark:text-gray-500 text-xs text-center pt-3 pb-1">
                Join to chat and post — you can still read announcements.
              </p>
            )}

            <p className="px-4 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Information
            </p>
            <button
              onClick={() => setHomeView('announcements')}
              className="flex items-center gap-3 mx-2 mb-1.5 px-3 py-2.5 bg-white dark:bg-[#221c16] rounded-2xl w-[calc(100%-1rem)] text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-sm shrink-0">📌</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#15110d] dark:text-[#fdf6ec]">Announcements</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                  {latestAnnouncement ? `${latestAnnouncement.authorName}: ${latestAnnouncement.content}` : 'Nothing pinned yet'}
                </p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>
            <button
              onClick={() => setHomeView('about')}
              className="flex items-center gap-3 mx-2 px-3 py-2.5 bg-white dark:bg-[#221c16] rounded-2xl w-[calc(100%-1rem)] text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-sm shrink-0">📋</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#15110d] dark:text-[#fdf6ec]">About &amp; rules</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs truncate">Community guidelines</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>

            <p className="px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Chat
            </p>
            <button
              onClick={() => setMainTab('chat')}
              className="flex items-center gap-3 mx-2 px-3 py-2.5 bg-orange-50 dark:bg-[#2b241c] rounded-2xl w-[calc(100%-1rem)] text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-sm shrink-0">💬</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec]">general</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                  {generalPreview ? `${generalPreview.senderName}: ${generalPreview.content}` : 'No messages yet'}
                </p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>

            <p className="px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Upcoming events
            </p>
            <p className="px-4 text-gray-400 dark:text-gray-500 text-sm">No events linked to this community yet.</p>

            <button
              onClick={() => setShowMembers(true)}
              className="flex items-center gap-3 mx-2 mt-5 px-3 py-3 border-t border-gray-200 dark:border-gray-700 w-[calc(100%-1rem)] text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2b241c] flex items-center justify-center text-sm shrink-0 text-gray-500">👥</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec]">Members</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs">{members.length} total</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">⌄</span>
            </button>
          </div>
        )}

        {mainTab === 'home' && homeView === 'announcements' && (
          <div className="px-4 pt-4">
            <button onClick={() => setHomeView('list')} className="text-sm text-orange-500 mb-3">‹ Back</button>
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

        {mainTab === 'home' && homeView === 'about' && (
          <div className="px-4 pt-4">
            <button onClick={() => setHomeView('list')} className="text-sm text-orange-500 mb-3">‹ Back</button>
            <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] whitespace-pre-wrap">
              {community.description || 'No description set for this community yet.'}
            </p>
          </div>
        )}

        {mainTab === 'chat' && (
          <div className="flex flex-col px-4 pt-3">
            <div className="space-y-3 mb-3">
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
          </div>
        )}

        {mainTab === 'events' && (
          <div className="px-4 pt-6 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No events linked to this community yet.</p>
          </div>
        )}

        {mainTab === 'you' && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Your membership</p>
            <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 mb-4">
              <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] font-medium mb-1">
                {isOwner ? "You're the owner of this community" : isMember ? "You're a member of this community" : "You haven't joined yet"}
              </p>
              {!isMember ? (
                <button onClick={handleJoin} className="mt-2 bg-orange-500 text-white rounded-xl px-4 py-2 text-sm font-medium">
                  Join community
                </button>
              ) : !isOwner ? (
                <button onClick={handleLeave} className="mt-2 bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-medium">
                  Leave community
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Chat input — only on the Chat tab, while a member */}
      {mainTab === 'chat' && isMember && (
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-[#fdf6ec] dark:bg-[#15110d] shrink-0">
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

      {/* Bottom tab bar */}
      <div className="flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16] shrink-0">
        {([
          { key: 'home', label: 'Home', icon: '🏠' },
          { key: 'chat', label: 'Chat', icon: '💬' },
          { key: 'events', label: 'Events', icon: '📅' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setMainTab(t.key); if (t.key === 'home') setHomeView('list') }}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
          >
            <span className={`text-base ${mainTab === t.key ? 'opacity-100' : 'opacity-50'}`}>{t.icon}</span>
            <span className={`text-[10px] ${mainTab === t.key ? 'text-orange-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
              {t.label}
            </span>
          </button>
        ))}
        <button onClick={() => setMainTab('you')} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
          <div className={`w-[18px] h-[18px] rounded-full ${mainTab === 'you' ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          <span className={`text-[10px] ${mainTab === 'you' ? 'text-orange-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
            You
          </span>
        </button>
      </div>

      {/* Members sheet */}
      {showMembers && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[1000]" onClick={() => setShowMembers(false)} />
          <div
            className="fixed left-0 right-0 bottom-[72px] z-[1001] bg-[#fdf6ec] dark:bg-[#15110d] w-full max-h-[70vh] rounded-t-3xl overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <p className="text-sm font-semibold text-[#15110d] dark:text-[#fdf6ec] mb-3">Members · {members.length}</p>
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
          </div>
        </>
      )}
    </div>
  )
}
