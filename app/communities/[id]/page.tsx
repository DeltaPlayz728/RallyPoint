'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Camera, Pin, ClipboardList, MessageCircle, Users, Check, Settings, Home, Calendar, type LucideIcon } from 'lucide-react'

type Community = {
  id: string
  owner_id: string
  name: string
  description: string | null
  rules: string | null
  banner_color: string
  banner_url: string | null
  icon_url: string | null
}

// Preset accent colors owners can pick for their community — same set as the
// personal app-wide accent picker in Settings, applied scoped to this page only.
const COMMUNITY_ACCENT_PRESETS = ['#f97316', '#14b8a6', '#a855f7', '#ec4899', '#3b82f6', '#22c55e']

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  channel_id: string | null
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
  role: 'member' | 'moderator'
}

type BannedUser = {
  user_id: string
  name: string
  reason: string | null
}

type Channel = {
  id: string
  name: string
}

type MainTab = 'home' | 'chat' | 'events' | 'you' | 'settings'
type HomeView = 'list' | 'announcements' | 'about'

export default function CommunityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const communityId = params.id as string
  const bottomRef = useRef<HTMLDivElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

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
  const [bans, setBans] = useState<BannedUser[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [draft, setDraft] = useState('')
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [savingAccent, setSavingAccent] = useState(false)
  const [pendingBanner, setPendingBanner] = useState(false)
  const [pendingIcon, setPendingIcon] = useState(false)

  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [rulesDraft, setRulesDraft] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: c } = await supabase
        .from('communities')
        .select('id, owner_id, name, description, rules, banner_color, banner_url, icon_url')
        .eq('id', communityId)
        .maybeSingle()

      if (!c) { router.push('/communities'); return }
      setCommunity(c)
      setNameDraft(c.name ?? '')
      setDescDraft(c.description ?? '')
      setRulesDraft(c.rules ?? '')

      const { data: membership } = await supabase
        .from('community_members')
        .select('user_id, role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsMember(!!membership)

      if (c.owner_id === user.id) {
        const { data: pending } = await supabase
          .from('community_banner_submissions')
          .select('asset_type')
          .eq('community_id', communityId)
          .eq('approved', false)
          .eq('rejected', false)
        setPendingBanner((pending ?? []).some((p: any) => p.asset_type === 'banner'))
        setPendingIcon((pending ?? []).some((p: any) => p.asset_type === 'icon'))
      }

      await refreshAll()
      setLoading(false)
    }

    const refreshAll = async () => {
      const [{ data: msgs }, { data: ann }, { data: mem }, { data: chans }, { data: banned }] = await Promise.all([
        supabase
          .from('community_messages')
          .select('id, sender_id, content, created_at, channel_id, profiles(full_name, username)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: true })
          .limit(300),
        supabase
          .from('community_announcements')
          .select('id, author_id, content, created_at, profiles(full_name, username)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('community_members')
          .select('user_id, role, profiles(full_name, username, avatar_url)')
          .eq('community_id', communityId),
        supabase
          .from('community_channels')
          .select('id, name')
          .eq('community_id', communityId)
          .order('created_at', { ascending: true }),
        supabase
          .from('community_bans')
          .select('user_id, reason, profiles(full_name, username)')
          .eq('community_id', communityId),
      ])

      setMessages((msgs ?? []).map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        channel_id: m.channel_id,
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
        role: m.role ?? 'member',
      })))

      setChannels((chans ?? []).map((c: any) => ({ id: c.id, name: c.name })))

      setBans((banned ?? []).map((b: any) => ({
        user_id: b.user_id,
        name: b.profiles?.username ? `@${b.profiles.username}` : (b.profiles?.full_name ?? 'User'),
        reason: b.reason ?? null,
      })))
    }

    load()

    const channel = supabase
      .channel(`community-${communityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_announcements', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_channels', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [communityId, router])

  // Default the active channel to "general" (or the first available channel) until the user picks one explicitly
  const activeChannelId = selectedChannelId ?? (channels.find((c) => c.name === 'general') ?? channels[0])?.id ?? null

  useEffect(() => {
    if (mainTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, mainTab, activeChannelId])

  const isOwner = community?.owner_id === userId
  const currentMember = members.find((m) => m.user_id === userId)
  const canModerate = isOwner || currentMember?.role === 'moderator'

  const handleJoin = async () => {
    if (!userId) return
    const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: userId })
    if (error) { alert('Could not join — you may have been removed from this community.'); return }
    setIsMember(true)
  }

  const handleLeave = async () => {
    if (!userId) return
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
    router.push('/communities')
  }

  const handleSend = async () => {
    if (!userId || !draft.trim() || !activeChannelId) return
    setSending(true)
    await supabase.from('community_messages').insert({
      community_id: communityId,
      sender_id: userId,
      channel_id: activeChannelId,
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

  // Uploads still go straight to storage (unchanged), but the URL now goes
  // into an approval queue (community_banner_submissions) instead of
  // straight into communities.banner_url — a DB trigger actively blocks a
  // direct client update to that column now, so this is enforced, not just
  // a UI convention. See supabase/community_tag_and_banner_approval_schema.sql.
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !community || !userId) return
    setUploadingBanner(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${community.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community-banners')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data: pub } = supabase.storage.from('community-banners').getPublicUrl(path)
      const bannerUrl = `${pub.publicUrl}?t=${Date.now()}`
      const { error: submitError } = await supabase.from('community_banner_submissions').insert({
        community_id: community.id, asset_type: 'banner', asset_url: bannerUrl, submitted_by: userId,
      })
      if (submitError) alert('Could not submit banner for approval. Please try again.')
      else setPendingBanner(true)
    } else {
      alert('Could not upload banner. Please try again.')
    }
    setUploadingBanner(false)
  }

  const handleIconPick = () => iconInputRef.current?.click()

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !community || !userId) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploadingIcon(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${community.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community-icons')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (!uploadError) {
      const { data: pub } = supabase.storage.from('community-icons').getPublicUrl(path)
      const iconUrl = `${pub.publicUrl}?t=${Date.now()}`
      const { error: submitError } = await supabase.from('community_banner_submissions').insert({
        community_id: community.id, asset_type: 'icon', asset_url: iconUrl, submitted_by: userId,
      })
      if (submitError) alert('Could not submit picture for approval. Please try again.')
      else setPendingIcon(true)
    } else {
      alert('Could not upload community picture. Please try again.')
    }
    setUploadingIcon(false)
  }

  const handleSetAccent = async (hex: string) => {
    if (!community || !isOwner) return
    setSavingAccent(true)
    const { error } = await supabase.from('communities').update({ banner_color: hex }).eq('id', community.id)
    if (!error) setCommunity({ ...community, banner_color: hex })
    setSavingAccent(false)
  }

  const handleSaveInfo = async () => {
    if (!community || !isOwner) return
    setSavingInfo(true)
    const { error } = await supabase
      .from('communities')
      .update({ name: nameDraft.trim() || community.name, description: descDraft.trim() || null, rules: rulesDraft.trim() || null })
      .eq('id', community.id)
    if (!error) {
      setCommunity({ ...community, name: nameDraft.trim() || community.name, description: descDraft.trim() || null, rules: rulesDraft.trim() || null })
    } else {
      alert('Could not save changes.')
    }
    setSavingInfo(false)
  }

  const handleCreateChannel = async () => {
    if (!userId || !newChannelName.trim()) return
    const { error } = await supabase.from('community_channels').insert({
      community_id: communityId,
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      created_by: userId,
    })
    if (error) {
      alert('Could not create channel — name may already be taken.')
    } else {
      setNewChannelName('')
    }
  }

  const handleDeleteChannel = async (channelId: string, name: string) => {
    if (name === 'general') return
    if (!confirm(`Delete the #${name} channel? Its messages will be deleted too.`)) return
    await supabase.from('community_channels').delete().eq('id', channelId)
    if (activeChannelId === channelId) {
      const general = channels.find((c) => c.name === 'general')
      setSelectedChannelId(general?.id ?? null)
    }
  }

  const handleKick = async (memberId: string) => {
    if (memberId === community?.owner_id) return
    if (!confirm('Remove this member from the community?')) return
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', memberId)
  }

  const handleBan = async (memberId: string) => {
    if (!userId || memberId === community?.owner_id) return
    if (!confirm('Ban this user? They will be removed and unable to rejoin.')) return
    await supabase.from('community_bans').insert({ community_id: communityId, user_id: memberId, banned_by: userId })
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', memberId)
  }

  const handleUnban = async (memberId: string) => {
    await supabase.from('community_bans').delete().eq('community_id', communityId).eq('user_id', memberId)
  }

  const handleSetRole = async (memberId: string, role: 'member' | 'moderator') => {
    if (!isOwner) return
    await supabase.from('community_members').update({ role }).eq('community_id', communityId).eq('user_id', memberId)
  }

  if (loading || !community) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex flex-col">
      <div className="h-12 bg-accent flex items-center px-4">
        <span className="text-white text-sm">←</span>
      </div>
      <div className="flex items-center justify-center pt-20 text-gray-500">Loading...</div>
    </div>
  )

  const activeChannel = channels.find((c) => c.id === activeChannelId)
  const channelMessages = messages.filter((m) => m.channel_id === activeChannelId)
  const latestAnnouncement = announcements[0]
  const lastMessageByChannel = (channelId: string) => {
    const msgs = messages.filter((m) => m.channel_id === channelId)
    return msgs[msgs.length - 1]
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col pb-0">

      {/* Orange top bar */}
      <div className="h-12 bg-accent flex items-center justify-between px-4 shrink-0 relative">
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
                className="block w-full text-left px-4 py-2.5 text-accent hover:bg-gray-50 dark:hover:bg-[#2b241c]"
              >
                Join community
              </button>
            )}
            {canModerate && (
              <button
                onClick={() => { setShowMenu(false); setMainTab('settings') }}
                className="block w-full text-left px-4 py-2.5 text-[#15110d] dark:text-[#fdf6ec] hover:bg-gray-50 dark:hover:bg-[#2b241c]"
              >
                Community settings
              </button>
            )}
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
              {uploadingBanner ? '…' : <Camera size={14} />}
            </button>
            {pendingBanner && (
              <span className="absolute top-2.5 right-11 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
                Pending approval
              </span>
            )}
          </>
        )}
        <div className="px-4 pb-2.5 flex items-center gap-2.5">
          {/* Group icon — Discord/WhatsApp-style circular avatar overlapping the banner */}
          <div className="relative shrink-0">
            <div
              className="w-11 h-11 rounded-full border-2 border-white/80 overflow-hidden flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ backgroundColor: community.banner_color }}
            >
              {community.icon_url ? (
                <img src={community.icon_url} alt={community.name} className="w-full h-full object-cover" />
              ) : (
                community.name.charAt(0).toUpperCase()
              )}
            </div>
            {isOwner && (
              <>
                <input ref={iconInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleIconUpload} />
                <button
                  onClick={handleIconPick}
                  disabled={uploadingIcon}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px]"
                  title="Edit community picture"
                >
                  {uploadingIcon ? '…' : <Camera size={10} />}
                </button>
              </>
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white drop-shadow">{community.name}</h1>
            <p className="text-[11px] text-white/90 drop-shadow">
              {members.length} member{members.length === 1 ? '' : 's'}
              {pendingIcon && <span className="ml-1.5">· picture pending approval</span>}
            </p>
          </div>
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
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm shrink-0 text-white"><Pin size={16} /></div>
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
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm shrink-0 text-white"><ClipboardList size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#15110d] dark:text-[#fdf6ec]">About &amp; rules</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs truncate">Community guidelines</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>

            <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Chat
              </p>
              {canModerate && (
                <button
                  onClick={() => setMainTab('settings')}
                  className="text-[11px] font-semibold text-accent"
                >
                  + New channel
                </button>
              )}
            </div>
            {channels.map((ch) => {
              const preview = lastMessageByChannel(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => { setSelectedChannelId(ch.id); setMainTab('chat') }}
                  className="flex items-center gap-3 mx-2 mb-1.5 px-3 py-2.5 bg-orange-50 dark:bg-[#2b241c] rounded-2xl w-[calc(100%-1rem)] text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm shrink-0 text-white"><MessageCircle size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec]">#{ch.name}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                      {preview ? `${preview.senderName}: ${preview.content}` : 'No messages yet'}
                    </p>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">›</span>
                </button>
              )
            })}

            <p className="px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Upcoming events
            </p>
            <p className="px-4 text-gray-400 dark:text-gray-500 text-sm">No events linked to this community yet.</p>

            <button
              onClick={() => setShowMembers(true)}
              className="flex items-center gap-3 mx-2 mt-5 px-3 py-3 border-t border-gray-200 dark:border-gray-700 w-[calc(100%-1rem)] text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2b241c] flex items-center justify-center text-sm shrink-0 text-gray-500"><Users size={16} /></div>
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
            <button onClick={() => setHomeView('list')} className="text-sm text-accent mb-3">‹ Back</button>
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
                  className="bg-accent text-white rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-60"
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
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1.5 inline-flex items-center gap-1">
                      <Pin size={10} /> {a.authorName} · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainTab === 'home' && homeView === 'about' && (
          <div className="px-4 pt-4">
            <button onClick={() => setHomeView('list')} className="text-sm text-accent mb-3">‹ Back</button>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">About</p>
            <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] whitespace-pre-wrap mb-5">
              {community.description || 'No description set for this community yet.'}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Rules</p>
            <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] whitespace-pre-wrap">
              {community.rules || 'No rules set for this community yet.'}
            </p>
          </div>
        )}

        {mainTab === 'chat' && (
          <div className="flex flex-col px-4 pt-3">
            {channels.length > 1 && (
              <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      ch.id === activeChannelId
                        ? 'bg-accent text-white'
                        : 'bg-white dark:bg-[#221c16] text-gray-500 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    #{ch.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3 mb-3">
              {channelMessages.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center pt-6">No messages yet in #{activeChannel?.name ?? 'general'}.</p>
              )}
              {channelMessages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender_id === userId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">{m.senderName}</span>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender_id === userId
                      ? 'bg-accent text-white'
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
                {isOwner ? "You're the owner of this community" : isMember ? `You're a member of this community${currentMember?.role === 'moderator' ? ' (moderator)' : ''}` : "You haven't joined yet"}
              </p>
              {!isMember ? (
                <button onClick={handleJoin} className="mt-2 bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium">
                  Join community
                </button>
              ) : !isOwner ? (
                <button onClick={handleLeave} className="mt-2 bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300 rounded-xl px-4 py-2 text-sm font-medium">
                  Leave community
                </button>
              ) : null}
            </div>
            {canModerate && (
              <button
                onClick={() => setMainTab('settings')}
                className="w-full bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-left text-sm font-medium text-[#15110d] dark:text-[#fdf6ec] inline-flex items-center gap-1.5"
              >
                <Settings size={16} /> Community settings
              </button>
            )}
          </div>
        )}

        {mainTab === 'settings' && canModerate && (
          <div className="px-4 pt-4 pb-8">
            <button onClick={() => setMainTab('home')} className="text-sm text-accent mb-4">‹ Back</button>

            {isOwner && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Community info</p>
                <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 mb-5 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 dark:text-gray-500">Name</label>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="w-full mt-1 bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 dark:text-gray-500">Description</label>
                    <textarea
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={3}
                      className="w-full mt-1 bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 dark:text-gray-500">Rules</label>
                    <textarea
                      value={rulesDraft}
                      onChange={(e) => setRulesDraft(e.target.value)}
                      rows={4}
                      placeholder="e.g. 1. Be respectful  2. No spam  3. Stay on topic"
                      className="w-full mt-1 bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveInfo}
                    disabled={savingInfo}
                    className="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {savingInfo ? 'Saving…' : 'Save changes'}
                  </button>
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Community theme</p>
                <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 mb-5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                    The accent color members see on this community's banner and icon.
                  </p>
                  <div className="flex gap-3">
                    {COMMUNITY_ACCENT_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => handleSetAccent(hex)}
                        disabled={savingAccent}
                        aria-label={`Set accent ${hex}`}
                        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition disabled:opacity-60"
                        style={{
                          backgroundColor: hex,
                          boxShadow: community.banner_color === hex ? '0 0 0 2px white, 0 0 0 4px ' + hex : 'none',
                        }}
                      >
                        {community.banner_color === hex && <Check size={14} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Channels</p>
            <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 mb-5">
              <div className="space-y-2 mb-3">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between bg-[#fdf6ec] dark:bg-[#15110d] rounded-xl px-3 py-2">
                    <span className="text-sm text-[#15110d] dark:text-[#fdf6ec]">#{ch.name}</span>
                    {ch.name !== 'general' && (
                      <button onClick={() => handleDeleteChannel(ch.id, ch.name)} className="text-red-500 text-xs font-medium">
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel() }}
                  placeholder="e.g. photography"
                  className="flex-1 bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm outline-none"
                />
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim()}
                  className="bg-accent text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  Create
                </button>
              </div>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Members</p>
            <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 mb-5 space-y-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between bg-[#fdf6ec] dark:bg-[#15110d] rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] truncate">
                      {m.name}{m.user_id === community.owner_id ? ' · Owner' : m.role === 'moderator' ? ' · Mod' : ''}
                    </p>
                  </div>
                  {m.user_id !== community.owner_id && (
                    <div className="flex gap-2 shrink-0">
                      {isOwner && (
                        <button
                          onClick={() => handleSetRole(m.user_id, m.role === 'moderator' ? 'member' : 'moderator')}
                          className="text-accent text-xs font-medium"
                        >
                          {m.role === 'moderator' ? 'Demote' : 'Make mod'}
                        </button>
                      )}
                      <button onClick={() => handleKick(m.user_id)} className="text-gray-500 text-xs font-medium">
                        Kick
                      </button>
                      <button onClick={() => handleBan(m.user_id)} className="text-red-500 text-xs font-medium">
                        Ban
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {bans.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Banned users</p>
                <div className="bg-white dark:bg-[#221c16] rounded-2xl p-4 space-y-2">
                  {bans.map((b) => (
                    <div key={b.user_id} className="flex items-center justify-between bg-[#fdf6ec] dark:bg-[#15110d] rounded-xl px-3 py-2.5">
                      <span className="text-sm text-[#15110d] dark:text-[#fdf6ec]">{b.name}</span>
                      <button onClick={() => handleUnban(b.user_id)} className="text-accent text-xs font-medium">
                        Unban
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
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
            placeholder={`Message #${activeChannel?.name ?? 'general'}...`}
            className="flex-1 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm outline-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="bg-accent text-white rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            Send
          </button>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#221c16] shrink-0">
        {([
          { key: 'home', label: 'Home', icon: Home },
          { key: 'chat', label: 'Chat', icon: MessageCircle },
          { key: 'events', label: 'Events', icon: Calendar },
        ] as { key: MainTab; label: string; icon: LucideIcon }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setMainTab(t.key); if (t.key === 'home') setHomeView('list') }}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
          >
            <t.icon size={18} className={mainTab === t.key ? 'opacity-100' : 'opacity-50'} />
            <span className={`text-[10px] ${mainTab === t.key ? 'text-accent font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
              {t.label}
            </span>
          </button>
        ))}
        <button onClick={() => setMainTab('you')} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
          <div className={`w-[18px] h-[18px] rounded-full ${mainTab === 'you' ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`} />
          <span className={`text-[10px] ${mainTab === 'you' ? 'text-accent font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
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
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                      {m.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-[#15110d] dark:text-[#fdf6ec]">
                    {m.name}{m.user_id === community.owner_id ? ' · Owner' : m.role === 'moderator' ? ' · Mod' : ''}
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
