'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, Ticket, MapPin, Megaphone, type LucideIcon } from 'lucide-react'

const PERKS: { Icon: LucideIcon; title: string; desc: string }[] = [
  { Icon: Zap, title: 'Founding Member badge', desc: 'Permanent badge on your profile — visible to everyone you meet.' },
  { Icon: Ticket, title: 'First 50 spots', desc: 'Only the first 50 signups get founding status. After that it\'s gone.' },
  { Icon: MapPin, title: 'Breda launch priority', desc: 'First access when we go live in Breda. Be there from day one.' },
  { Icon: Megaphone, title: 'Shape the app', desc: 'Direct line to the founder. Your feedback gets built in.' },
]

export default function EarlyAccessPage() {
  const [email, setEmail]     = useState('')
  const [city, setCity]       = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), city: city.trim() || null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error === 'already_registered'
        ? 'You\'re already on the list! We\'ll be in touch.'
        : 'Something went wrong. Try again.')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col">

      {/* Back link */}
      <div className="px-5 pt-6">
        <Link href="/" className="text-gray-600 dark:text-gray-400 text-sm hover:text-black dark:hover:text-white transition">← Back</Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 max-w-md mx-auto w-full">

        {done ? (
          /* Success state */
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-accent border border-black flex items-center justify-center mx-auto mb-6">
              <Zap size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">You're on the list</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
              We'll email you the moment RallyPoint goes live in your city. You're one of the first — that means something.
            </p>
            <div className="bg-accent border border-black rounded-2xl px-5 py-4 mb-8">
              <p className="text-accent text-sm font-semibold inline-flex items-center gap-1"><Zap size={14} className="shrink-0" /> Founding Member status reserved</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Your badge will be waiting when you sign up.</p>
            </div>
            <Link
              href="/"
              className="text-gray-500 dark:text-gray-400 text-sm hover:text-black dark:hover:text-white transition"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 bg-accent border border-black text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Zap size={13} className="shrink-0" /> Founding Member — First 50 only
              </div>
              <h1 className="text-3xl font-bold leading-tight mb-3">
                Get early access<br />to RallyPoint
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                RallyPoint is the app for meeting people through real experiences — not swiping, not scrolling. Launching in Breda first.
              </p>
            </div>

            {/* Perks */}
            <div className="w-full space-y-2.5 mb-8">
              {PERKS.map(p => (
                <div key={p.title} className="flex items-start gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5">
                  <p.Icon size={20} className="shrink-0 mt-0.5 text-accent" />
                  <div>
                    <p className="text-[#15110d] dark:text-[#fdf6ec] text-sm font-semibold">{p.title}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-accent transition"
              />
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Your city (optional)"
                className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-accent transition"
              />

              {error && <p className="text-accent text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-accent hover:brightness-90 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition disabled:opacity-50 text-sm"
              >
                {loading ? 'Reserving your spot…' : 'Reserve my founding spot →'}
              </button>
            </form>

            <p className="text-gray-700 dark:text-gray-300 dark:text-gray-400 text-xs text-center mt-4">
              No spam. No selling your data. Just a heads-up when we launch.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
