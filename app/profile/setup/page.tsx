'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { moderateContent, flagForReview } from '@/lib/contentModeration'
import {
  Camera, Lock, BatteryFull, BatteryMedium, BatteryLow,
  type LucideIcon,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
//
// NOTE: INTERESTS strings are persisted verbatim into profiles.interests (see
// handleSubmit below), so stripping the emoji prefix here also changes the
// stored data values for any new saves going forward. Flagged for review —
// vibe/social_battery/preferred_time are saved by `id`, not by label, so those
// are unaffected.

const INTERESTS = [
  'Coffee', 'Hiking', 'Gaming', 'Music', 'Fitness', 'Art',
  'Food & Drinks', 'Movies', 'Sports', 'Travel', 'Reading',
  'Bowling', 'Karaoke', 'Dancing', 'Cycling', 'Photography',
  'Cooking', 'Yoga', 'Climbing', 'Board Games',
]

const VIBES = [
  { id: 'chill',  label: 'Chill & Low-Key',      desc: 'Small groups, easy going, no pressure' },
  { id: 'social', label: 'Social & Talkative',    desc: 'Love meeting lots of new people' },
  { id: 'active', label: 'High Energy',            desc: 'Active, adventurous, up for anything' },
  { id: 'deep',   label: 'Deep Conversations',    desc: 'Thoughtful, meaningful connections' },
]

const BATTERIES = [
  { id: 'full',   icon: BatteryFull,   label: 'Full',   desc: 'Ready for anything' },
  { id: 'medium', icon: BatteryMedium, label: 'Medium', desc: 'Selective but open' },
  { id: 'low',    icon: BatteryLow,    label: 'Low',    desc: 'Need easy low-key plans' },
] as { id: string; icon: LucideIcon; label: string; desc: string }[]

const TIMES = [
  { id: 'morning',   label: 'Mornings'  },
  { id: 'afternoon', label: 'Afternoons' },
  { id: 'evening',   label: 'Evenings'  },
  { id: 'any',       label: 'Any time'  },
]

// ─── Component ────────────────────────────────────────────────────────────────

function ProfileSetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEditing = searchParams.get('edit') === 'true'

  // Avatar
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile]     = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Layer 1 — Basics
  const [username, setUsername]   = useState('')
  const [city, setCity]           = useState('')
  const [bio, setBio]             = useState('')

  // Layer 2 — Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])

  // Layer 3 — Social Vibe
  const [selectedVibe, setSelectedVibe] = useState('')

  // Layer 4 — Availability
  const [battery, setBattery]           = useState('full')
  const [availableThisWeek, setAvailableThisWeek] = useState(true)
  const [preferredTime, setPreferredTime] = useState('any')

  // Social
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok]       = useState('')
  const [snapchat, setSnapchat]   = useState('')

  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(true)

  // Pre-load existing data when editing
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('username, city, bio, interests, vibe, social_battery, available_this_week, preferred_time, instagram, tiktok, snapchat, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setAvatarUrl(data.avatar_url ?? null)
        setUsername(data.username ?? '')
        setCity(data.city ?? '')
        setBio(data.bio ?? '')
        setSelectedInterests(data.interests ?? [])
        setSelectedVibe(data.vibe ?? '')
        setBattery(data.social_battery ?? 'full')
        setAvailableThisWeek(data.available_this_week ?? true)
        setPreferredTime(data.preferred_time ?? 'any')
        setInstagram(data.instagram ?? '')
        setTiktok(data.tiktok ?? '')
        setSnapchat(data.snapchat ?? '')
      }

      setHydrating(false)
    }
    load()
  }, [])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5 MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const modResult = moderateContent(bio)
    if (!modResult.allowed && modResult.action === 'block') {
      setError('Your bio can\'t be saved as written — please rephrase it.')
      setLoading(false)
      return
    }

    // Upload avatar if a new file was selected
    let finalAvatarUrl = avatarUrl
    if (avatarFile) {
      setUploadingAvatar(true)
      const ext = avatarFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      setUploadingAvatar(false)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path)
      finalAvatarUrl = urlData.publicUrl
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: finalAvatarUrl,
        username,
        city,
        bio,
        interests: selectedInterests,
        vibe: selectedVibe,
        social_battery: battery,
        available_this_week: availableThisWeek,
        preferred_time: preferredTime,
        instagram: instagram.replace('@', '').trim() || null,
        tiktok: tiktok.replace('@', '').trim() || null,
        snapchat: snapchat.replace('@', '').trim() || null,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    if (!modResult.allowed) {
      flagForReview(user.id, 'profile', user.id, modResult.reason)
    }

    // After initial setup → onboarding; after edit → profile
    router.push(isEditing ? '/profile' : '/onboarding')
  }

  if (hydrating) {
    return (
      <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-4 py-8 pb-28">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {isEditing ? (
              <button onClick={() => router.push('/profile')} className="text-gray-500 dark:text-gray-400 text-sm hover:text-black dark:hover:text-white transition">
                ← Back
              </button>
            ) : <span />}
            <Logo size={24} />
          </div>
          <h1 className="text-2xl font-bold mb-1">
            {isEditing ? 'Edit your profile' : 'Set up your profile'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isEditing
              ? 'Update your info, vibe, and availability.'
              : 'Help people know who you are before showing up.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Avatar picker ── */}
          <div className="flex flex-col items-center">
            <label className="cursor-pointer group relative" htmlFor="avatar-input">
              {/* Circle */}
              <div className="w-24 h-24 rounded-full overflow-hidden bg-white dark:bg-[#221c16] border-2 border-gray-300 dark:border-gray-700 group-hover:border-accent transition relative">
                {(avatarPreview ?? avatarUrl) ? (
                  <img
                    src={avatarPreview ?? avatarUrl!}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-black dark:text-[#fdf6ec] bg-accent">
                    {(username || '?')[0].toUpperCase()}
                  </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full">
                  <span className="text-[#15110d] dark:text-[#fdf6ec] text-xs font-semibold">Change</span>
                </div>
              </div>
              {/* Camera badge */}
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-accent rounded-full flex items-center justify-center border-2 border-black text-sm">
                <Camera size={14} className="text-white" />
              </div>
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">Tap to {avatarUrl || avatarPreview ? 'change' : 'add'} photo</p>
          </div>

          {/* ── Layer 1: Basics ── */}
          <section>
            <h2 className="text-xs text-accent font-semibold uppercase tracking-wider mb-4">01 · Basics</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))}
                  required
                  placeholder="@yourname"
                  className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Your City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  required
                  placeholder="e.g. Breda"
                  className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Bio <span className="text-gray-600 dark:text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={160}
                  rows={2}
                  placeholder="A line about yourself..."
                  className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none"
                />
                <p className="text-gray-700 dark:text-gray-300 text-xs mt-1 text-right">{bio.length}/160</p>
              </div>
            </div>
          </section>

          {/* ── Layer 2: Interests ── */}
          <section>
            <h2 className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">02 · Interests</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">Pick up to 8 — shown on your profile and used to match you with events.</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selectedInterests.includes(interest)
                      ? 'bg-accent border-accent text-white'
                      : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">{selectedInterests.length}/8 selected</p>
          </section>

          {/* ── Layer 3: Social Vibe ── */}
          <section>
            <h2 className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">03 · Social Vibe</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">How would you describe your social style?</p>
            <div className="space-y-2">
              {VIBES.map(vibe => (
                <button
                  key={vibe.id}
                  type="button"
                  onClick={() => setSelectedVibe(vibe.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    selectedVibe === vibe.id
                      ? 'bg-accent/15 border-accent text-white'
                      : 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm">{vibe.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{vibe.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Layer 4: Availability ── */}
          <section>
            <h2 className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">04 · Availability</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">Lets people know your social energy right now.</p>

            {/* Social battery */}
            <div className="mb-4">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Social battery</label>
              <div className="flex gap-2">
                {BATTERIES.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBattery(b.id)}
                    className={`flex-1 py-3 rounded-xl border text-center transition ${
                      battery === b.id
                        ? 'bg-accent/15 border-accent text-white'
                        : 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <b.icon size={18} className="mx-auto mb-0.5" />
                    <div className="text-xs">{b.label}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Open to meetups */}
            <div className="flex items-center justify-between bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-4">
              <div>
                <p className="text-sm text-[#15110d] dark:text-[#fdf6ec] font-medium">Open to meetups this week</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Others can see you're available</p>
              </div>
              <button
                type="button"
                onClick={() => setAvailableThisWeek(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  availableThisWeek ? 'bg-accent' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#221c16] shadow transition-transform ${
                  availableThisWeek ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Preferred time */}
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Preferred time</label>
              <div className="grid grid-cols-2 gap-2">
                {TIMES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreferredTime(t.id)}
                    className={`py-2.5 rounded-xl border text-sm transition ${
                      preferredTime === t.id
                        ? 'bg-accent/15 border-accent text-white font-medium'
                        : 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Social Media ── */}
          <section>
            <h2 className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">Social Media</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 inline-flex items-center gap-1">
              <Lock size={12} /> Only visible to people who've attended an event with you.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Instagram', value: instagram, set: setInstagram, placeholder: '@username' },
                { label: 'TikTok',    value: tiktok,    set: setTiktok,    placeholder: '@username' },
                { label: 'Snapchat',  value: snapchat,  set: setSnapchat,  placeholder: 'username' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="flex items-center bg-white dark:bg-[#221c16] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 gap-3 focus-within:border-accent transition">
                  <span className="text-gray-500 dark:text-gray-400 text-sm w-20 shrink-0">{label}</span>
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-[#15110d] dark:text-[#fdf6ec] text-sm focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !city}
            className="w-full bg-accent hover:brightness-90 text-white font-semibold py-4 rounded-xl transition disabled:opacity-40 text-sm"
          >
            {uploadingAvatar ? 'Uploading photo…' : loading ? 'Saving…' : isEditing ? 'Save changes' : "Let's go →"}
          </button>

        </form>
      </div>
    </div>
  )
}

export default function ProfileSetupPage() {
  return (
    <Suspense>
      <ProfileSetupForm />
    </Suspense>
  )
}
