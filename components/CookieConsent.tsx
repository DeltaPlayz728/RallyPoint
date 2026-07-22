'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// No analytics/tracking scripts currently ship in this app, so there's
// nothing non-essential to actually gate behind consent yet — but the
// Privacy Policy already describes RallyPoint as GDPR-compliant, and a
// GDPR-compliant site is supposed to ask before anything non-essential
// runs, full stop. This banner is the mechanism; window.rallypointConsent
// is the flag any future analytics/tracking script should check before
// loading, so consent is real infrastructure from day one instead of a
// banner that doesn't actually gate anything.
const CONSENT_KEY = 'rallypoint-cookie-consent'

declare global {
  interface Window {
    rallypointConsent?: 'accepted' | 'declined'
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'accepted' || stored === 'declined') {
      window.rallypointConsent = stored
      return
    }
    setVisible(true)
  }, [])

  const choose = (value: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, value)
    window.rallypointConsent = value
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-[#221c16] border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
      <div className="max-w-lg mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">
          We use only the cookies needed to keep you signed in and remember your preferences.{' '}
          <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('declined')}
            className="text-xs font-medium px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
          >
            Decline non-essential
          </button>
          <button
            onClick={() => choose('accepted')}
            className="text-xs font-semibold px-3 py-2 rounded-full bg-accent text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
