'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INTERESTS = [
  '🎳 Bowling', '🎵 Music', '🍕 Food', '🎨 Art',
  '⚽ Sports', '🎭 Comedy', '🎮 Gaming', '🥾 Hiking',
  '🎬 Film', '📚 Books', '🌃 Nightlife', '☕ Coffee',
]

const VIBES = [
  { id: 'outgoing',  label: 'Outgoing',  emoji: '🚀', desc: 'First to arrive, last to leave' },
  { id: 'chill',     label: 'Chill',     emoji: '😎', desc: 'Good vibes, no pressure' },
  { id: 'curious',   label: 'Curious',   emoji: '🔍', desc: 'Here to explore and try things' },
  { id: 'selective', label: 'Selective', emoji: '🎯', desc: 'Small groups, real connections' },
]

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
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-14 pb-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-orange-500' : i < step ? 'w-4 bg-orange-800' : 'w-4 bg-gray-800'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 flex flex-col max-w-md mx-auto w-full">

        {step === 0 && (
          <div className="flex flex-col flex-1">
            <div className="mb-8">
              <div className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full inline-block mb-6">RP</div>
              <h1 className="text-3xl font-bold leading-tight mb-3">
                Stop scrolling.<br />
                <span className="text-orange-500">Start showing up.</span>
              </h1>
              <p className="text-gray-400 text-base leading-relaxed">
                RallyPoint connects people 18–30 through real events — casual meetups, bowling nights, and everything in between.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { icon: '🗺️', text: 'See what\'s happening around you' },
                { icon: '🎳', text: 'Join events or create your own' },
                { icon: '🤝', text: 'Meet people worth knowing' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-gray-300 text-sm">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                Get started →
              </button>
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full text-gray-500 text-sm py-2 hover:text-gray-300 transition"
              >
                Already have an account? Log in
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col flex-1">
            <h2 className="text-2xl font-bold mb-1">What's your scene?</h2>
            <p className="text-gray-500 text-sm mb-6">Pick what excites you — we'll show the right events first.</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {INTERESTS.map(i => (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    selectedInterests.includes(i)
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => setStep(2)}
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                {selectedInterests.length > 0 ? `Nice! Next →` : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col flex-1">
            <h2 className="text-2xl font-bold mb-1">What's your vibe?</h2>
            <p className="text-gray-500 text-sm mb-6">How do you usually show up?</p>

            <div className="space-y-3 mb-6">
              {VIBES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVibe(v.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition ${
                    selectedVibe === v.id
                      ? 'bg-orange-500/10 border-orange-500'
                      : 'bg-[#111] border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{v.emoji}</span>
                  <div>
                    <p className={`font-semibold text-sm ${selectedVibe === v.id ? 'text-orange-400' : 'text-white'}`}>
                      {v.label}
                    </p>
                    <p className="text-gray-500 text-xs">{v.desc}</p>
                  </div>
                  {selectedVibe === v.id && (
                    <span className="ml-auto text-orange-500 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={finish}
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition text-base"
              >
                Create my account →
              </button>
              <button
                onClick={finish}
                className="w-full text-gray-600 text-sm py-2 hover:text-gray-400 transition"
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
