'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading...</div>
  )

  if (!profile) return null

  const vibeLabels: Record<string, string> = {
    chill: '😌 Chill & Low-Key',
    social: '🗣️ Social & Talkative',
    active: '⚡ High Energy',
    deep: '🧠 Deep Conversations',
  }

  const batteryLabels: Record<string, { icon: string; color: string }> = {
    full:   { icon: '🔋', color: 'text-green-400' },
    medium: { icon: '🪫', color: 'text-yellow-400' },
    low:    { icon: '🔴', color: 'text-red-400' },
  }

  const hasSocials = profile.instagram || profile.tiktok || profile.snapchat

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-400 text-sm mb-6 block"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-800 shrink-0 border border-gray-700">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-gray-800">
                {profile.full_name[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{profile.full_name}</h1>
              {profile.account_type === 'organizer' && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                  {profile.venue_name ? 'Venue' : 'Organizer'}
                </span>
              )}
            </div>
            {profile.username && <p className="text-gray-400 text-sm">@{profile.username}</p>}
            {profile.city && <p className="text-gray-500 text-xs mt-0.5">📍 {profile.city}</p>}
            {profile.venue_name && (
              <p className="text-orange-400 text-xs mt-0.5">🏟️ {profile.venue_name}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-300 text-sm mb-4">{profile.bio}</p>
        )}

        {/* Vibe + availability */}
        {(profile.vibe || profile.social_battery || profile.available_this_week) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.vibe && (
              <span className="bg-gray-900 border border-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                {vibeLabels[profile.vibe] ?? profile.vibe}
              </span>
            )}
            {profile.social_battery && (
              <span className={`bg-gray-900 border border-gray-800 text-xs px-2.5 py-1 rounded-full ${batteryLabels[profile.social_battery]?.color ?? 'text-gray-400'}`}>
                {batteryLabels[profile.social_battery]?.icon} {profile.social_battery === 'full' ? 'Full battery' : profile.social_battery === 'medium' ? 'Medium battery' : 'Low battery'}
              </span>
            )}
            {profile.available_this_week && (
              <span className="bg-green-950/50 border border-green-900/60 text-green-400 text-xs px-2.5 py-1 rounded-full">
                ✅ Open this week
              </span>
            )}
          </div>
        )}

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {profile.interests.map(i => (
              <span key={i} className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                {i}
              </span>
            ))}
          </div>
        )}

        {/* Social Media — gated */}
        {hasSocials && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Socials</h2>
            {sharedEvent ? (
              <div className="space-y-2">
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-white hover:text-orange-400 transition"
                  >
                    <span className="text-lg">📸</span>
                    <span>@{profile.instagram}</span>
                    <span className="text-gray-500 text-xs ml-auto">Instagram →</span>
                  </a>
                )}
                {profile.tiktok && (
                  <a
                    href={`https://tiktok.com/@${profile.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-white hover:text-orange-400 transition"
                  >
                    <span className="text-lg">🎵</span>
                    <span>@{profile.tiktok}</span>
                    <span className="text-gray-500 text-xs ml-auto">TikTok →</span>
                  </a>
                )}
                {profile.snapchat && (
                  <a
                    href={`https://snapchat.com/add/${profile.snapchat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-white hover:text-orange-400 transition"
                  >
                    <span className="text-lg">👻</span>
                    <span>{profile.snapchat}</span>
                    <span className="text-gray-500 text-xs ml-auto">Snapchat →</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-gray-500 text-sm">🔒 Attend an event together to see their socials.</p>
              </div>
            )}
          </div>
        )}

        {/* Meetup request */}
        <Link
          href={`/meetups`}
          className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition"
        >
          🤝 Request a Meetup
        </Link>
      </div>
    </div>
  )
}
