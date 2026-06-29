'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Floating feedback entry point — intentionally positioned at bottom-right,
// raised well clear of the global fixed BottomNav (which sits at z-50 and is
// known to swallow clicks from anything placed in its footprint — see the
// /communities/[id] nav-overlap bug). bottom-24 keeps this above the nav bar
// on every screen size; z-40 keeps it below modals (z-[60]) and the nav
// itself, so the nav still wins any literal overlap if one ever occurs.
export default function FeedbackButton() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Only logged-in users can leave feedback, and only on real in-app screens
  // (not auth/onboarding/legal pages).
  const HIDDEN_ROUTES = ['/', '/auth/login', '/auth/signup', '/onboarding', '/welcome', '/tos', '/privacy']
  if (!userId || HIDDEN_ROUTES.includes(pathname)) return null

  const submit = async () => {
    if (!message.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: message.trim(), pageUrl: pathname }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Something went wrong')
      }
      setDone(true)
      setMessage('')
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => {
    setOpen(false)
    setDone(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-24 right-4 z-40 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg border border-black/10 transition hover:brightness-90"
        style={{ backgroundColor: 'var(--accent, #f97316)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center px-4">
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-3xl w-full max-w-md p-5">
            {done ? (
              <>
                <h3 className="font-bold text-lg mb-1">Thanks!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Your feedback was sent — we'll take a look.</p>
                <button onClick={close} className="w-full bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-2xl text-sm transition">
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg mb-1">Got feedback?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Found a bug, or something feel off? Tell us — we're watching this live.</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, and where?"
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-accent resize-none"
                />
                {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={close} className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 py-3 rounded-2xl text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting || !message.trim()}
                    className="flex-1 bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-2xl text-sm transition disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
