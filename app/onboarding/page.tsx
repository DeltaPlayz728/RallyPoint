'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { consumePendingRedirect } from '@/lib/postAuthRedirect'
import {
  Home, Calendar, Map as MapIcon, MessageCircle, Handshake, Camera,
  type LucideIcon,
} from 'lucide-react'

// ─── Constants (mirrors profile/setup) ───────────────────────────────────────
//
// NOTE: these INTERESTS strings are persisted verbatim into profiles.interests
// (see finish() below), so stripping the emoji prefix here also changes the
// stored data values for any new signups going forward. Flagged for review —
// existing rows with emoji-prefixed interests are unaffected by this change.

const INTERESTS = [
  'Coffee', 'Hiking', 'Gaming', 'Music', 'Fitness', 'Art',
  'Food & Drinks', 'Movies', 'Sports', 'Travel', 'Reading',
  'Bowling', 'Karaoke', 'Dancing', 'Cycling', 'Photography',
  'Cooking', 'Yoga', 'Climbing', 'Board Games',
]

const VIBES = [
  { id: 'chill',  label: 'Chill & Low-Key',   desc: 'Small groups, easy going' },
  { id: 'social', label: 'Social & Talkative', desc: 'Love meeting new people' },
  { id: 'active', label: 'High Energy',         desc: 'Active and adventurous' },
  { id: 'deep',   label: 'Deep Conversations', desc: 'Thoughtful connections' },
]

// ─── Slides ───────────────────────────────────────────────────────────────────

function WelcomeSlide() {
  return (
    <div className="flex flex-col items-center text-center px-6">
      <h1 className="text-3xl font-bold mb-3">
        Welcome to Rally<span className="text-accent">Point</span>
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed max-w-xs">
        The app built for people who'd rather be out doing things than scrolling through them.
      </p>
    </div>
  )
}

function FeaturesSlide() {
  return (
    <div className="px-6 w-full">
      <h2 className="text-2xl font-bold text-center mb-2">Everything in one place</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">Here's what you can do on RallyPoint.</p>
      <div className="grid grid-cols-2 gap-3">
        {([
          { icon: Home,          label: 'Live Feed',     desc: 'Casual meetups happening now near you' },
          { icon: Calendar,      label: 'Events Tab',    desc: 'Venue nights & big scheduled events' },
          { icon: MapIcon,       label: 'Pulse Map',     desc: 'See every event around you visually' },
          { icon: MessageCircle, label: 'Group Chat',    desc: 'Talk with attendees before you show up' },
          { icon: Handshake,     label: '1:1 Meetups',  desc: 'Request private hangouts after events' },
          { icon: Camera,        label: 'Social Links',  desc: 'Share your socials after meeting IRL' },
        ] as { icon: LucideIcon; label: string; desc: string }[]).map(f => (
          <div key={f.label} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <f.icon size={22} className="mb-1 text-[#15110d] dark:text-[#fdf6ec]" />
            <div className="font-semibold text-sm text-[#15110d] dark:text-[#fdf6ec]">{f.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PersonalizeSlideProps {
  selectedInterests: string[]
  onToggleInterest: (i: string) => void
  selectedVibe: string
  onSelectVibe: (v: string) => void
}

function PersonalizeSlide({ selectedInterests, onToggleInterest, selectedVibe, onSelectVibe }: PersonalizeSlideProps) {
  return (
    <div className="px-6 w-full">
      <h2 className="text-2xl font-bold text-center mb-1">Personalize your feed</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">Pick what you're into — we'll match you better.</p>

      {/* Interests */}
      <div className="mb-6">
        <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-2">
          Your interests <span className="text-gray-500 dark:text-gray-400 normal-case font-normal">({selectedInterests.length}/8)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(interest => (
            <button
              key={interest}
              type="button"
              onClick={() => onToggleInterest(interest)}
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
      </div>

      {/* Vibe */}
      <div>
        <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-2">Your social vibe</p>
        <div className="grid grid-cols-2 gap-2">
          {VIBES.map(vibe => (
            <button
              key={vibe.id}
              type="button"
              onClick={() => onSelectVibe(vibe.id)}
              className={`text-left px-3 py-3 rounded-xl border transition ${
                selectedVibe === vibe.id
                  ? 'bg-accent/15 border-accent text-white'
                  : 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="font-semibold text-sm">{vibe.label}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{vibe.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [current, setCurrent]   = useState(0)
  const [finishing, setFinishing] = useState(false)

  // Personalize slide state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedVibe, setSelectedVibe]           = useState('')

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    )
  }

  const slides = [
    { id: 'welcome',     content: <WelcomeSlide /> },
    { id: 'features',   content: <FeaturesSlide /> },
    {
      id: 'personalize',
      content: (
        <PersonalizeSlide
          selectedInterests={selectedInterests}
          onToggleInterest={toggleInterest}
          selectedVibe={selectedVibe}
          onSelectVibe={setSelectedVibe}
        />
      ),
    },
  ]

  const isLast = current === slides.length - 1
  const isPersonalize = slides[current].id === 'personalize'

  const finish = async () => {
    setFinishing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const update: Record<string, any> = { onboarded: true }
      if (selectedInterests.length > 0) update.interests = selectedInterests
      if (selectedVibe) update.vibe = selectedVibe
      await supabase.from('profiles').update(update).eq('id', user.id)
    }
    window.location.href = consumePendingRedirect()
  }

  const handleNext = async () => {
    if (!isLast) { setCurrent(prev => prev + 1); return }
    await finish()
  }

  const handleSkip = async () => { await finish() }

  // On the personalize slide, "Next" becomes "Continue" and is always enabled
  // (interests/vibe are optional — user can set them from profile later)
  const buttonLabel = finishing
    ? 'Getting ready…'
    : isLast
    ? "Let's go →"
    : 'Next'

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col">

      {/* Skip */}
      <div className="flex justify-end px-6 pt-6">
        <button onClick={handleSkip} className="text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition">
          Skip
        </button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex items-center justify-center w-full py-4 overflow-y-auto">
        {slides[current].content}
      </div>

      {/* Progress + button */}
      <div className="px-6 pb-12 flex flex-col items-center gap-6 shrink-0">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-accent' : 'w-1.5 bg-gray-700'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={finishing}
          className="w-full max-w-sm bg-accent hover:brightness-90 text-white font-bold py-4 rounded-xl text-lg transition disabled:opacity-50"
        >
          {buttonLabel}
        </button>

        {isPersonalize && (selectedInterests.length > 0 || selectedVibe) && (
          <p className="text-xs text-gray-600 dark:text-gray-400 -mt-4">
            You can always update these from your profile
          </p>
        )}
      </div>
    </div>
  )
}
