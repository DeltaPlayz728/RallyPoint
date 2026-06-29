'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  MapPin, Trophy, Check, Instagram, Music, Ghost, Lock, Handshake,
  BatteryFull, BatteryMedium, BatteryLow,
  type LucideIcon,
} from 'lucide-react'

type Profile = {
  id: string
  full_name: string
  username: string
  bio: string
  city: string
  interests: string[]
  vibe: string
  social_battery: string
  available_this_week: boolean
  preferred_time: string
  avatar_url: string | null
  account_type: string
  venue_name: string | null
  instagram: string | null
  tiktok: string | null
  snapchat: string | null
}

export default function PublicProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sharedEvent, setSharedEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      // Redirect to own profile page if viewing self
      if (user.id === id) { router.push('/profile'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, bio, city, interests, vibe, social_battery, available_this_week, preferred_time, avatar_url, account_type, venue_name, instagram, tiktok, snapchat')
        .eq('id', id)
        .single()

      if (!profileData) { router.push('/feed'); return }
      setProfile(profileData)

      // Check if viewer and profile owner attended any event together
      const { data: myEvents } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id)

      const myEventIds = (myEvents ?? []).map((e: any) => e.event_id)

      if (myEventIds.length > 0) {
        const { data: shared } = await supabase
          .from('event_attendees')
          .select('event_id')
          .eq('user_id', id)
          .in('event_id', myEventIds)

        setSharedEvent((shared ?? []).length > 0)
      }

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
  )

  if (!profile) return null

  const vibeLabels: Record<string, string> = {
    chill: 'Chill & Low-Key',
    social: 'Social & Talkative',
    active: 'High Energy',
    deep: 'Deep Conversations',
  }

  const batteryLabels: Record<string, { icon: LucideIcon; color: string }> = {
    full:   { icon: BatteryFull,   color: 'text-green-600' },
    medium: { icon: BatteryMedium, color: 'text-yellow-700' },
    low:    { icon: BatteryLow,    color: 'text-red-600' },
  }

  const hasSocials = profile.instagram || profile.tiktok || profile.snapchat

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-500 dark:text-gray-400 text-sm"
          >
            ← Back
          </button>
          <Logo size={24} />
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 dark:bg-[#221c16] shrink-0 border border-gray-300 dark:border-gray-700">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#15110d] dark:text-[#fdf6ec] bg-gray-200 dark:bg-gray-700 dark:bg-[#221c16]">
                {profile.full_name[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{profile.full_name}</h1>
              {profile.account_type === 'organizer' && (
                <span className="text-xs bg-orange-100 text-accent px-2 py-0.5 rounded-full">
                  {profile.venue_name ? 'Venue' : 'Organizer'}
                </span>
              )}
            </div>
            {profile.username && <p className="text-gray-500 dark:text-gray-400 text-sm">@{profile.username}</p>}
            {profile.city && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 inline-flex items-center gap-1">
                <MapPin size={12} /> {profile.city}
              </p>
            )}
            {profile.venue_name && (
              <p className="text-accent text-xs mt-0.5 inline-flex items-center gap-1">
                <Trophy size={12} /> {profile.venue_name}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{profile.bio}</p>
        )}

        {/* Vibe + availability */}
        {(profile.vibe || profile.social_battery || profile.available_this_week) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.vibe && (
              <span className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2.5 py-1 rounded-full">
                {vibeLabels[profile.vibe] ?? profile.vibe}
              </span>
            )}
            {profile.social_battery && (
              <span className={`bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${batteryLabels[profile.social_battery]?.color ?? 'text-gray-500 dark:text-gray-400'}`}>
                {batteryLabels[profile.social_battery]?.icon && (() => {
                  const BatteryIcon = batteryLabels[profile.social_battery].icon
                  return <BatteryIcon size={12} />
                })()}
                {profile.social_battery === 'full' ? 'Full battery' : profile.social_battery === 'medium' ? 'Medium battery' : 'Low battery'}
              </span>
            )}
            {profile.available_this_week && (
              <span className="bg-purple-500 border border-black text-white text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                <Check size={12} /> Open this week
              </span>
            )}
          </div>
        )}

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {profile.interests.map(i => (
              <span key={i} className="bg-white dark:bg-[#221c16] border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs px-3 py-1 rounded-full">
                {i}
              </span>
            ))}
          </div>
        )}

        {/* Social Media — gated */}
        {hasSocials && (
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Socials</h2>
            {sharedEvent ? (
              <div className="space-y-2">
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-[#15110d] dark:text-[#fdf6ec] hover:text-accent transition"
                  >
                    <Instagram size={18} />
                    <span>@{profile.instagram}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">Instagram →</span>
                  </a>
                )}
                {profile.tiktok && (
                  <a
                    href={`https://tiktok.com/@${profile.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-[#15110d] dark:text-[#fdf6ec] hover:text-accent transition"
                  >
                    <Music size={18} />
                    <span>@{profile.tiktok}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">TikTok →</span>
                  </a>
                )}
                {profile.snapchat && (
                  <a
                    href={`https://snapchat.com/add/${profile.snapchat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-[#15110d] dark:text-[#fdf6ec] hover:text-accent transition"
                  >
                    <Ghost size={18} />
                    <span>{profile.snapchat}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">Snapchat →</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-gray-500 dark:text-gray-400 text-sm inline-flex items-center gap-1">
                  <Lock size={14} /> Attend an event together to see their socials.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meetup request */}
        <Link
          href={`/meetups`}
          className="flex items-center justify-center gap-1.5 w-full text-center bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-lg transition"
        >
          <Handshake size={16} /> Request a Meetup
        </Link>
      </div>
    </div>
)
}
