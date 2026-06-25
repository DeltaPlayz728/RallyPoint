'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { effectiveTier, hasFeature, TIER_LABELS, SubscriptionTier } from '@/lib/subscription'

const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']
const BANNER_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#eab308']

type Event = {
  id: string
  title: string
  type: 'casual' | 'social'
  location: string
  starts_at: string
  price: number
  created_by: string
}

const VIBE_LABELS: Record<string, string> = {
  chill:  '😌 Chill & Low-Key',
  social: '🗣️ Social & Talkative',
  active: '⚡ High Energy',
  deep:   '🧠 Deep Conversations',
}

const BATTERY_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  full:   { icon: '🔋', label: 'Full battery',   color: 'text-green-600' },
  medium: { icon: '🪫', label: 'Medium battery', color: 'text-yellow-600' },
  low:    { icon: '🔴', label: 'Low battery',    color: 'text-red-500' },
}

const TIME_LABELS: Record<string, string> = {
  morning: '🌅 Mornings', afternoon: '☀️ Afternoons', evening: '🌙 Evenings', any: '🔄 Any time',
}

type Profile = {
  full_name: string
  username: string
  bio: string
  city: string
  interests: string[]
  vibe: string
  social_battery: string
  available_this_week: boolean
  preferred_time: string
  account_type: string
  venue_name: string | null
  avatar_url: string | null
  created_at: string
  subscription_tier?: string | null
  subscription_status?: string | null
  profile_banner_color?: string | null
  is_founding_member?: boolean
}

type Stats = {
  eventsHosted: number
  eventsAttended: number
  friendCount: number
  avgRating: number | null
  totalRatings: number
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl py-3 px-2 text-center">
      <p className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-xl">{value}</p>
      <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5">{label}</p>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [hosting, setHosting]   = useState<Event[]>([])
  const [attending, setAttending] = useState<Event[]>([])
  const [stats, setStats]       = useState<Stats>({ eventsHosted: 0, eventsAttended: 0, friendCount: 0, avgRating: null, totalRatings: 0 })
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState<string | null>(null)
  const [showOrganizerModal, setShowOrganizerModal] = useState(false)
  const [venueName, setVenueName] = useState('')
  const [upgradingOrganizer, setUpgradingOrganizer] = useState(false)
  const [activeTab, setActiveTab] = useState<'hosting' | 'attending'>('hosting')
  const [savingBanner, setSavingBanner] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const [profileRes, hostingRes, attendingRes, friendsRes, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('created_by', user.id).eq('status', 'active').order('starts_at', { ascending: true }),
        supabase.from('event_attendees').select('events(*)').eq('user_id', user.id),
        supabase.from('friendships').select('id').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('host_reputation').select('avg_rating, total_ratings').eq('host_id', user.id).maybeSingle(),
      ])

      const profileData = profileRes.data
      setProfile(profileData)
      if (profileData?.venue_name) setVenueName(profileData.venue_name)

      const hostingEvents = hostingRes.data ?? []
      setHosting(hostingEvents)

      const attendingEvents = attendingRes.data
        ?.map((a: any) => a.events)
        .filter((e: any) => e && e.created_by !== user.id && e.status === 'active') ?? []
      setAttending(attendingEvents)

      setStats({
        eventsHosted:   hostingEvents.length,
        eventsAttended: attendingEvents.length,
        friendCount:    friendsRes.data?.length ?? 0,
        avgRating:      ratingsRes.data?.avg_rating ?? null,
        totalRatings:   ratingsRes.data?.total_ratings ?? 0,
      })

      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const handleBecomeOrganizer = async () => {
    if (!userId || !venueName.trim()) return
    setUpgradingOrganizer(true)
    const { error } = await supabase.from('profiles').update({
      account_type: 'organizer',
      venue_name: venueName.trim(),
    }).eq('id', userId)
    if (!error) setProfile(prev => prev ? { ...prev, account_type: 'organizer', venue_name: venueName.trim() } : prev)
    setShowOrganizerModal(false)
    setUpgradingOrganizer(false)
  }

  const isFoundingMember = profile?.is_founding_member === true

  const isOrganizer = profile?.account_type === 'organizer'
  const tier = effectiveTier(profile) as SubscriptionTier
  const isSupporter = hasFeature(tier, 'supporter_badge')
  const canCustomizeBanner = hasFeature(tier, 'profile_banner_color')

  const handleBannerColor = async (color: string) => {
    if (!userId) return
    setSavingBanner(true)
    await supabase.from('profiles').update({ profile_banner_color: color }).eq('id', userId)
    setProfile(prev => prev ? { ...prev, profile_banner_color: color } : prev)
    setSavingBanner(false)
  }

  const avatarInitial = (profile?.full_name ?? profile?.username ?? '?')[0].toUpperCase()
  const avatarColor   = AVATAR_COLORS[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] px-4 pt-8 pb-24">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-[#221c16] animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 bg-white dark:bg-[#221c16] rounded animate-pulse" />
              <div className="h-3 w-20 bg-white dark:bg-[#221c16] rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            {[0,1,2,3].map(i => <div key={i} className="flex-1 h-16 bg-white dark:bg-[#221c16] rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">

      {/* Organizer upgrade modal */}
      {showOrganizerModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center px-4 pb-6">
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-3xl w-full max-w-md p-5">
            <h3 className="font-bold text-lg mb-1">Become an Organizer</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Post events to the Events tab, visible to everyone in your city.</p>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Venue or Organization Name</label>
            <input
              type="text"
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder="e.g. Lucky Lanes Bowling"
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowOrganizerModal(false)} className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 py-3 rounded-2xl text-sm">Cancel</button>
              <button onClick={handleBecomeOrganizer} disabled={upgradingOrganizer || !venueName.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl text-sm transition disabled:opacity-50">
                {upgradingOrganizer ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supporter banner */}
      {profile?.profile_banner_color && (
        <div className="h-14 -mb-6" style={{ background: profile.profile_banner_color }} />
      )}

      <div className="px-4 pt-8 max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-black text-black"
                  style={{ background: avatarColor }}
                >
                  {avatarInitial}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold leading-tight">{profile?.full_name}</h1>
                {isSupporter && (
                  <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
                    💛 {TIER_LABELS[tier]}
                  </span>
                )}
                {isFoundingMember && (
                  <span className="text-[10px] bg-orange-500 text-white border border-black px-2 py-0.5 rounded-full font-semibold">
                    ⚡ Founding Member
                  </span>
                )}
                {isOrganizer && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:text-blue-400 border border-blue-300 px-2 py-0.5 rounded-full font-semibold">
                    🎯 Organizer
                  </span>
                )}
              </div>
              {profile?.username && <p className="text-gray-500 dark:text-gray-400 text-sm">@{profile.username}</p>}
              {profile?.city && <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">📍 {profile.city}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings"
              aria-label="Settings"
              className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition border border-gray-200 dark:border-gray-700 p-2 rounded-xl"
            >
              ⚙️
            </Link>
            <button onClick={handleSignOut} className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-400 transition border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl">
              Sign out
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">{profile.bio}</p>
        )}

        {/* Interests */}
        {(profile?.interests?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {profile!.interests.map(i => (
              <span key={i} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs px-2.5 py-1 rounded-full">
                {i}
              </span>
            ))}
          </div>
        )}

        {/* Vibe + Availability row */}
        {(profile?.vibe || profile?.social_battery) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {profile?.vibe && (
              <span className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2.5 py-1 rounded-full">
                {VIBE_LABELS[profile.vibe] ?? profile.vibe}
              </span>
            )}
            {profile?.social_battery && (
              <span className={`bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1 rounded-full ${BATTERY_LABELS[profile.social_battery]?.color ?? 'text-gray-500 dark:text-gray-400'}`}>
                {BATTERY_LABELS[profile.social_battery]?.icon} {BATTERY_LABELS[profile.social_battery]?.label}
              </span>
            )}
            {profile?.available_this_week && (
              <span className="bg-purple-500 border border-black text-white text-xs px-2.5 py-1 rounded-full">
                ✅ Open this week
              </span>
            )}
            {profile?.preferred_time && profile.preferred_time !== 'any' && (
              <span className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs px-2.5 py-1 rounded-full">
                {TIME_LABELS[profile.preferred_time]}
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-2 mb-5">
          <StatBox value={stats.eventsAttended} label="Attended" />
          <StatBox value={stats.eventsHosted} label="Hosted" />
          <StatBox value={stats.friendCount} label="Friends" />
          <StatBox
            value={stats.avgRating ? `${stats.avgRating}★` : '—'}
            label={stats.totalRatings > 0 ? `${stats.totalRatings} ratings` : 'No ratings'}
          />
        </div>

        {/* Banner color picker — Go Getter+ perk */}
        {canCustomizeBanner && (
          <div className="mb-5">
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">Profile banner color</p>
            <div className="flex gap-2">
              {BANNER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => handleBannerColor(c)}
                  disabled={savingBanner}
                  className={`w-7 h-7 rounded-full shrink-0 ${
                    profile?.profile_banner_color === c
                      ? 'ring-2 ring-offset-2 ring-orange-500 ring-offset-[#fdf6ec] dark:ring-offset-[#15110d]'
                      : ''
                  }`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <Link href="/profile/setup?edit=true" className="flex-1 text-center border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600 hover:text-black dark:hover:text-white text-sm py-2.5 rounded-2xl transition">
            Edit Profile
          </Link>
          <Link href="/friends" className="flex-1 text-center border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-orange-500 hover:text-orange-600 text-sm py-2.5 rounded-2xl transition">
            🤝 Friends
          </Link>
          {!isOrganizer && (
            <button onClick={() => setShowOrganizerModal(true)} className="flex-1 text-center border border-orange-500/40 text-orange-600 hover:bg-orange-100 text-sm py-2.5 rounded-2xl transition">
              🎯 Organizer
            </button>
          )}
        </div>

        {/* Events tabs */}
        <div className="flex gap-2 mb-4">
          {(['hosting', 'attending'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                activeTab === t
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t} ({t === 'hosting' ? hosting.length : attending.length})
            </button>
          ))}
        </div>

        {/* Events list */}
        {activeTab === 'hosting' ? (
          hosting.length === 0 ? (
            <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">No events hosted yet.</p>
              <Link href="/events/create" className="text-orange-600 text-sm font-medium">Create your first event →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {hosting.map(event => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 hover:border-orange-500/50 rounded-2xl p-4 transition">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-[#15110d] dark:text-[#fdf6ec] text-sm">{event.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${event.type === 'casual' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {event.type}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">📍 {event.location} · 🕐 {formatDate(event.starts_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          attending.length === 0 ? (
            <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Not attending any events yet.</p>
              <Link href="/feed" className="text-orange-600 text-sm font-medium">Browse events →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {attending.map(event => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 hover:border-orange-500/50 rounded-2xl p-4 transition">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-[#15110d] dark:text-[#fdf6ec] text-sm">{event.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${event.type === 'casual' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {event.type}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">📍 {event.location} · 🕐 {formatDate(event.starts_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
