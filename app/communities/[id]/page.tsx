'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setPendingRedirect } from '@/lib/postAuthRedirect'
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
  type: 'chat' | 'forum'
}

type CommunityEvent = {
  id: string
  title: string
  starts_at: string
  location: string
  city: string
}

type ForumPost = {
  id: string
  channel_id: string
  author_id: string
  authorName: string
  title: string
  body: string | null
  image_url: string | null
  tags: string[]
  pinned: boolean
  created_at: string
  starCount: number
  myStar: boolean
  replyCount: number
}

type ForumReply = {
  id: string
  post_id: string
  author_id: string
  authorName: string
  content: string
  created_at: string
}

// Fixed tag set surfaced as chips on new posts — kept small and
// church/community-appropriate rather than the gaming-forum tag set this
// was modeled after (Discord forum channels, e.g. #build-ideas).
const FORUM_TAGS = ['Idea', 'Question', 'Feedback', 'Volunteer', 'Logistics']

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
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<'chat' | 'forum'>('chat')
  const [draft, setDraft] = useState('')

  // Forum channel state
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [forumReplies, setForumReplies] = useState<ForumReply[]>([])
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostBody, setNewPostBody] = useState('')
  const [newPostImageUrl, setNewPostImageUrl] = useState('')
  const [newPostTags, setNewPostTags] = useState<string[]>([])
  const [postingForum, setPostingForum] = useState(false)
  const [forumReplyDraft, setForumReplyDraft] = useState('')
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [savingAccent, setSavingAccent] = useState(false)

  const [linkCopied, setLinkCopied] = useState(false)

  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [rulesDraft, setRulesDraft] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // sessionStorage, not a query param — consumePendingRedirect() is
        // already checked at the end of both the login flow AND the signup
        // → onboarding chain (see postAuthRedirect.ts / SharedEventCta.tsx),
        // so this gets a shared invite link back to the community either way.
        setPendingRedirect(`/communities/${communityId}`)
        router.push('/auth/login')
        return
      }
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

      await refreshAll()
      setLoading(false)
    }

    const refreshAll = async () => {
      const [{ data: msgs }, { data: ann }, { data: mem }, { data: chans }, { data: banned }, { data: evts }] = await Promise.all([
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
          .select('id, name, type')
          .eq('community_id', communityId)
          .order('created_at', { ascending: true }),
        supabase
          .from('community_bans')
          .select('user_id, reason, profiles(full_name, username)')
          .eq('community_id', communityId),
        supabase
          .from('events')
          .select('id, title, starts_at, location, city')
          .eq('community_id', communityId)
          .eq('status', 'active')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true }),
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

      setChannels((chans ?? []).map((c: any) => ({ id: c.id, name: c.name, type: c.type === 'forum' ? 'forum' : 'chat' })))

      setBans((banned ?? []).map((b: any) => ({
        user_id: b.user_id,
        name: b.profiles?.username ? `@${b.profiles.username}` : (b.profiles?.full_name ?? 'User'),
        reason: b.reason ?? null,
      })))

      setCommunityEvents((evts ?? []).map((e: any) => ({
        id: e.id, title: e.title, starts_at: e.starts_at, location: e.location, city: e.city,
      })))
    }

    load()

    const channel = supabase
      .channel(`community-${communityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_announcements', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_channels', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `community_id=eq.${communityId}` }, () => refreshAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [communityId, router])

  // Default the active channel to "general" (or the first available channel) until the user picks one explicitly
  const activeChannelId = selectedChannelId ?? (channels.find((c) => c.name === 'general') ?? channels[0])?.id ?? null

  useEffect(() => {
    if (mainTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, mainTab, activeChannelId])

  const activeChannelForForum = channels.find((c) => c.id === activeChannelId)
  const isForumChannel = activeChannelForForum?.type === 'forum'

  // Forum data — only fetched/subscribed while a forum-type channel is active,
  // since plain chat channels never touch these tables.
  useEffect(() => {
    if (!isForumChannel || !activeChannelId || !userId) return

    const loadForum = async () => {
      const [{ data: posts }, { data: reactions }, { data: replies }] = await Promise.all([
        supabase
          .from('community_forum_posts')
          .select('id, channel_id, author_id, title, body, image_url, tags, pinned, created_at, profiles(full_name, username)')
          .eq('channel_id', activeChannelId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('community_forum_reactions')
          .select('post_id, user_id'),
        supabase
          .from('community_forum_replies')
          .select('id, post_id, author_id, content, created_at, profiles(full_name, username)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: true }),
      ])

      const postIds = new Set((posts ?? []).map((p: any) => p.id))
      const relevantReactions = (reactions ?? []).filter((r: any) => postIds.has(r.post_id))
      const relevantReplies = (replies ?? []).filter((r: any) => postIds.has(r.post_id))

      setForumPosts((posts ?? []).map((p: any) => ({
        id: p.id,
        channel_id: p.channel_id,
        author_id: p.author_id,
        authorName: p.profiles?.username ? `@${p.profiles.username}` : (p.profiles?.full_name ?? 'Someone'),
        title: p.title,
        body: p.body,
        image_url: p.image_url,
        tags: p.tags ?? [],
        pinned: p.pinned,
        created_at: p.created_at,
        starCount: relevantReactions.filter((r: any) => r.post_id === p.id).length,
        myStar: relevantReactions.some((r: any) => r.post_id === p.id && r.user_id === userId),
        replyCount: relevantReplies.filter((r: any) => r.post_id === p.id).length,
      })))

      setForumReplies(relevantReplies.map((r: any) => ({
        id: r.id,
        post_id: r.post_id,
        author_id: r.author_id,
        authorName: r.profiles?.username ? `@${r.profiles.username}` : (r.profiles?.full_name ?? 'Someone'),
        content: r.content,
        created_at: r.created_at,
      })))
    }

    loadForum()

    const forumChannel = supabase
      .channel(`community-forum-${activeChannelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_forum_posts', filter: `channel_id=eq.${activeChannelId}` }, () => loadForum())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_forum_replies', filter: `community_id=eq.${communityId}` }, () => loadForum())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_forum_reactions' }, () => loadForum())
      .subscribe()

    return () => { supabase.removeChannel(forumChannel) }
  }, [isForumChannel, activeChannelId, userId, communityId])

  const handleCreateForumPost = async () => {
    if (!userId || !activeChannelId || !newPostTitle.trim()) return
    setPostingForum(true)
    const { error } = await supabase.from('community_forum_posts').insert({
      channel_id: activeChannelId,
      community_id: communityId,
      author_id: userId,
      title: newPostTitle.trim(),
      body: newPostBody.trim() || null,
      image_url: newPostImageUrl.trim() || null,
      tags: newPostTags,
    })
    if (error) alert('Could not create post. Please try again.')
    else {
      setNewPostTitle('')
      setNewPostBody('')
      setNewPostImageUrl('')
      setNewPostTags([])
      setShowNewPost(false)
    }
    setPostingForum(false)
  }

  const handleToggleStar = async (postId: string, currentlyStarred: boolean) => {
    if (!userId) return
    if (currentlyStarred) {
      await supabase.from('community_forum_reactions').delete().eq('post_id', postId).eq('user_id', userId).eq('emoji', 'star')
    } else {
      await supabase.from('community_forum_reactions').insert({ post_id: postId, user_id: userId, emoji: 'star' })
    }
  }

  const handlePostForumReply = async () => {
    if (!userId || !selectedPostId || !forumReplyDraft.trim()) return
    await supabase.from('community_forum_replies').insert({
      post_id: selectedPostId,
      community_id: communityId,
      author_id: userId,
      content: forumReplyDraft.trim(),
    })
    setForumReplyDraft('')
  }

  const handleDeleteForumPost = async (postId: string) => {
    if (!confirm('Delete this post? Its replies will be deleted too.')) return
    await supabase.from('community_forum_posts').delete().eq('id', postId)
    if (selectedPostId === postId) setSelectedPostId(null)
  }

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

  // Plain deep link — communities are open-join today, so this doesn't mint
  // an attributed token like the event share flow does. If communities ever
  // get gated (private/invite-only), this is the spot to swap in a token.
  const handleCopyInviteLink = async () => {
    const url = `${window.location.origin}/communities/${communityId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this link:', url)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1800)
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

  // Uploads go straight to storage, then straight into communities.banner_url
  // — no approval queue. (Previously routed through community_banner_submissions
  // with a DB trigger blocking direct writes; that trigger's been dropped and
  // this now matches how name/description/rules already worked.)
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
      const { error: updateError } = await supabase.from('communities').update({ banner_url: bannerUrl }).eq('id', community.id)
      if (updateError) alert('Could not save banner. Please try again.')
      else setCommunity({ ...community, banner_url: bannerUrl })
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
      const { error: updateError } = await supabase.from('communities').update({ icon_url: iconUrl }).eq('id', community.id)
      if (updateError) alert('Could not save community picture. Please try again.')
      else setCommunity({ ...community, icon_url: iconUrl })
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
      type: newChannelType,
    })
    if (error) {
      alert('Could not create channel — name may already be taken.')
    } else {
      setNewChannelName('')
      setNewChannelType('chat')
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
            <button
              onClick={handleCopyInviteLink}
              className="block w-full text-left px-4 py-2.5 text-[#15110d] dark:text-[#fdf6ec] hover:bg-gray-50 dark:hover:bg-[#2b241c]"
            >
              {linkCopied ? 'Link copied!' : 'Copy invite link'}
            </button>
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
              const forumPostCount = ch.type === 'forum' ? forumPosts.filter((p) => p.channel_id === ch.id).length : 0
              return (
                <button
                  key={ch.id}
                  onClick={() => { setSelectedChannelId(ch.id); setSelectedPostId(null); setMainTab('chat') }}
                  className="flex items-center gap-3 mx-2 mb-1.5 px-3 py-2.5 bg-orange-50 dark:bg-[#2b241c] rounded-2xl w-[calc(100%-1rem)] text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm shrink-0 text-white">
                    {ch.type === 'forum' ? <ClipboardList size={16} /> : <MessageCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec]">
                      {ch.type === 'forum' ? '' : '#'}{ch.name}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                      {ch.type === 'forum'
                        ? (activeChannelId === ch.id && forumPostCount > 0 ? `${forumPostCount} post${forumPostCount === 1 ? '' : 's'}` : 'Forum channel')
                        : (preview ? `${preview.senderName}: ${preview.content}` : 'No messages yet')}
                    </p>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">›</span>
                </button>
              )
            })}

            <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Upcoming events
              </p>
              {canModerate && (
                <a href={`/events/create?community=${communityId}`} className="text-[11px] font-semibold text-accent">
                  + Create event
                </a>
              )}
            </div>
            {communityEvents.length === 0 ? (
              <p className="px-4 text-gray-400 dark:text-gray-500 text-sm">No events linked to this community yet.</p>
            ) : (
              communityEvents.map((e) => (
                <a
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-[#221c16] transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Calendar size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec] truncate">{e.title}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                      {new Date(e.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(e.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {e.location}
                    </p>
                  </div>
                </a>
              ))
            )}

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
                    onClick={() => { setSelectedChannelId(ch.id); setSelectedPostId(null); setShowNewPost(false) }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      ch.id === activeChannelId
                        ? 'bg-accent text-white'
                        : 'bg-white dark:bg-[#221c16] text-gray-500 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {ch.type === 'forum' ? '' : '#'}{ch.name}
                  </button>
                ))}
              </div>
            )}

            {isForumChannel ? (
              <div className="pb-4">
                {selectedPostId ? (
                  (() => {
                    const post = forumPosts.find((p) => p.id === selectedPostId)
                    if (!post) return null
                    const replies = forumReplies.filter((r) => r.post_id === post.id)
                    return (
                      <div>
                        <button onClick={() => setSelectedPostId(null)} className="text-sm text-accent mb-3">‹ Back to posts</button>
                        <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4">
                          {post.tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mb-2">
                              {post.tags.map((t) => (
                                <span key={t} className="text-[10px] font-semibold bg-accent/10 text-accent rounded-full px-2 py-0.5">{t}</span>
                              ))}
                            </div>
                          )}
                          <p className="font-bold text-[#15110d] dark:text-[#fdf6ec] mb-1">{post.title}</p>
                          {post.body && <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] whitespace-pre-wrap mb-2">{post.body}</p>}
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="w-full rounded-xl mb-2 object-cover max-h-64" />
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-2">
                            <span>{post.authorName} · {new Date(post.created_at).toLocaleDateString()}</span>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleToggleStar(post.id, post.myStar)} className={`inline-flex items-center gap-1 ${post.myStar ? 'text-amber-500 font-semibold' : ''}`}>
                                ★ {post.starCount}
                              </button>
                              {(post.author_id === userId || canModerate) && (
                                <button onClick={() => handleDeleteForumPost(post.id)} className="text-red-500">Delete</button>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                          Replies · {replies.length}
                        </p>
                        <div className="space-y-2 mb-4">
                          {replies.length === 0 && <p className="text-gray-400 dark:text-gray-500 text-sm">No replies yet.</p>}
                          {replies.map((r) => (
                            <div key={r.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                              <p className="text-sm text-[#15110d] dark:text-[#fdf6ec]">{r.content}</p>
                              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{r.authorName} · {new Date(r.created_at).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                        {isMember && (
                          <div className="flex gap-2">
                            <input
                              value={forumReplyDraft}
                              onChange={(e) => setForumReplyDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handlePostForumReply() }}
                              placeholder="Reply..."
                              className="flex-1 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm outline-none"
                            />
                            <button
                              onClick={handlePostForumReply}
                              disabled={!forumReplyDraft.trim()}
                              className="bg-accent text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()
                ) : (
                  <>
                    {isMember && !showNewPost && (
                      <button
                        onClick={() => setShowNewPost(true)}
                        className="w-full bg-accent text-white rounded-lg py-2.5 text-sm font-medium mb-4"
                      >
                        + New post
                      </button>
                    )}
                    {showNewPost && (
                      <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4 space-y-2.5">
                        <input
                          value={newPostTitle}
                          onChange={(e) => setNewPostTitle(e.target.value)}
                          placeholder="Post title"
                          className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                        />
                        <textarea
                          value={newPostBody}
                          onChange={(e) => setNewPostBody(e.target.value)}
                          rows={3}
                          placeholder="What's the idea? (optional)"
                          className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                        />
                        <input
                          value={newPostImageUrl}
                          onChange={(e) => setNewPostImageUrl(e.target.value)}
                          placeholder="Image URL (optional)"
                          className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {FORUM_TAGS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setNewPostTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                              className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                                newPostTags.includes(tag) ? 'bg-accent text-white' : 'bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500 border border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setShowNewPost(false)}
                            className="flex-1 bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300 rounded-xl py-2 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateForumPost}
                            disabled={postingForum || !newPostTitle.trim()}
                            className="flex-1 bg-accent text-white rounded-xl py-2 text-sm font-medium disabled:opacity-60"
                          >
                            {postingForum ? 'Posting…' : 'Post'}
                          </button>
                        </div>
                      </div>
                    )}
                    {forumPosts.length === 0 ? (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center pt-6">No posts yet in #{activeChannel?.name}.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {forumPosts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPostId(p.id)}
                            className="w-full text-left bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-gray-400 dark:text-gray-500">{p.authorName}</span>
                              {p.pinned && <Pin size={10} className="text-accent" />}
                            </div>
                            <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec] mb-1.5">{p.title}</p>
                            {p.image_url && (
                              <img src={p.image_url} alt="" className="w-full rounded-xl mb-2 object-cover max-h-40" />
                            )}
                            {p.tags.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap mb-2">
                                {p.tags.map((t) => (
                                  <span key={t} className="text-[10px] font-semibold bg-accent/10 text-accent rounded-full px-2 py-0.5">{t}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                              <span className="inline-flex items-center gap-1"><MessageCircle size={11} /> {p.replyCount}</span>
                              <span className={`inline-flex items-center gap-1 ${p.myStar ? 'text-amber-500 font-semibold' : ''}`}>★ {p.starCount}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
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
            )}
          </div>
        )}

        {mainTab === 'events' && (
          <div className="px-4 pt-4">
            {canModerate && (
              <a
                href={`/events/create?community=${communityId}`}
                className="block w-full text-center bg-accent text-white rounded-lg py-2.5 text-sm font-medium mb-4"
              >
                + Create event
              </a>
            )}
            {communityEvents.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center pt-4">No events linked to this community yet.</p>
            ) : (
              <div className="space-y-2">
                {communityEvents.map((e) => (
                  <a
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Calendar size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec] truncate">{e.title}</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs truncate">
                        {new Date(e.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(e.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {e.location}, {e.city}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
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
                    <span className="text-sm text-[#15110d] dark:text-[#fdf6ec]">
                      {ch.type === 'forum' ? '' : '#'}{ch.name}
                      {ch.type === 'forum' && <span className="ml-1.5 text-[10px] font-semibold text-accent">FORUM</span>}
                    </span>
                    {ch.name !== 'general' && (
                      <button onClick={() => handleDeleteChannel(ch.id, ch.name)} className="text-red-500 text-xs font-medium">
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setNewChannelType('chat')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${newChannelType === 'chat' ? 'bg-accent text-white' : 'bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500 border border-gray-200 dark:border-gray-700'}`}
                >
                  Chat channel
                </button>
                <button
                  onClick={() => setNewChannelType('forum')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${newChannelType === 'forum' ? 'bg-accent text-white' : 'bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500 border border-gray-200 dark:border-gray-700'}`}
                >
                  Forum channel
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel() }}
                  placeholder={newChannelType === 'forum' ? 'e.g. Event Ideas' : 'e.g. photography'}
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

      {/* Chat input — only on the Chat tab, while a member, and only for plain chat channels (forum channels compose via the post/reply UI above) */}
      {mainTab === 'chat' && isMember && !isForumChannel && (
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
