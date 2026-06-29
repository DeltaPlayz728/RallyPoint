'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import {
  Map as MapIcon, Calendar, Handshake, Rocket, Glasses, Search, Target, Check,
  type LucideIcon,
} from 'lucide-react'

// NOTE: these INTERESTS strings are persisted to sessionStorage (rp_interests)
// and read again at signup, so stripping the emoji prefix here also changes
// the stored values for any new signups going forward. Flagged for review.
const INTERESTS = [
  'Bowling', 'Music', 'Food', 'Art',
  'Sports', 'Comedy', 'Gaming', 'Hiking',
  'Film', 'Books', 'Nightlife', 'Coffee',
]

const VIBES = [
  { id: 'outgoing',  label: 'Outgoing',  icon: Rocket,  desc: 'First to arrive, last to leave' },
  { id: 'chill',     label: 'Chill',     icon: Glasses, desc: 'Good vibes, no pressure' },
  { id: 'curious',   label: 'Curious',   icon: Search,  desc: 'Here to explore and try things' },
  { id: 'selective', label: 'Selective', icon: Target,  desc: 'Small groups, real connections' },
] as { id: string; label: string; icon: LucideIcon; desc: string }[]

type Step = 0 | 1 | 2

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)

  const toggleInterest = (i: string) =>
    setSelectedInterests(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )

  const finish = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rp_interests', JSON.stringify(selectedInterests))
      sessionStorage.setItem('rp_vibe', selectedVibe ?? '')
    }
    router.push('/auth/signup')
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col">

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-14 pb-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-accent' : i < step ? 'w-4 bg-orange-800' : 'w-4 bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 flex flex-col max-w-md mx-auto w-full">

        {step === 0 && (
          <div className="flex flex-col flex-1">
            <div className="mb-8">
              <div className="mb-6"><Logo size={44} /></div>
              <h1 className="text-3xl font-bold leading-tight mb-3">
                Stop scrolling.<br />
                <span className="text-accent">Start showing up.</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
                RallyPoint connects people 18–30 through real events — casual meetups, bowling nights, and everything in between.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {([
                { icon: MapIcon,  text: 'See what\'s happening around you' },
                { icon: Calendar, text: 'Join events or create your own' },
                { icon: Handshake, text: 'Meet people worth knowing' },
              ] as { icon: LucideIcon; text: string }[]).map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <item.icon size={24} className="text-[#15110d] dark:text-[#fdf6ec]" />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-accent hover:brightness-90 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                Get started →
              </button>
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full text-gray-500 dark:text-gray-400 text-sm py-2 hover:text-black dark:hover:text-white transition"
              >
                Already have an account? Log in
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col flex-1">
            <h2 className="text-2xl font-bold mb-1">What's your scene?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Pick what excites you — we'll show the right events first.</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {INTERESTS.map(i => (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    selectedInterests.includes(i)
                      ? 'bg-orange-100 border-accent text-accent'
                      : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => setStep(2)}
                className="w-full bg-accent hover:brightness-90 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                {selectedInterests.length > 0 ? `Nice! Next →` : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col flex-1">
            <h2 className="text-2xl font-bold mb-1">What's your vibe?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">How do you usually show up?</p>

            <div className="space-y-3 mb-6">
              {VIBES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVibe(v.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition ${
                    selectedVibe === v.id
                      ? 'bg-orange-100 border-accent'
                      : 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <v.icon size={24} className={selectedVibe === v.id ? 'text-accent' : 'text-[#15110d] dark:text-[#fdf6ec]'} />
                  <div>
                    <p className={`font-semibold text-sm ${selectedVibe === v.id ? 'text-accent' : 'text-[#15110d] dark:text-[#fdf6ec]'}`}>
                      {v.label}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">{v.desc}</p>
                  </div>
                  {selectedVibe === v.id && (
                    <Check size={16} className="ml-auto text-accent" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={finish}
                className="w-full bg-accent hover:brightness-90 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                Create my account →
              </button>
              <button
                onClick={finish}
                className="w-full text-gray-600 dark:text-gray-400 text-sm py-2 hover:text-black dark:hover:text-white transition"
              >
                Skip
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
