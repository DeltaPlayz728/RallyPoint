'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { reportConversionIfPending } from '@/lib/referral'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
    }
  }
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Cloudflare Turnstile — the CAPTCHA blocking automated signups. Supabase
  // Auth itself verifies the token server-side (Authentication > Attack
  // Protection, configured 2026-07-23), so this widget is the frontend half
  // of a real server-enforced gate, not just a client-side speed bump.
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReady, setTurnstileReady] = useState(false)

  useEffect(() => {
    if (!turnstileReady || !turnstileRef.current || !window.turnstile || turnstileWidgetId.current) return
    turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    })
  }, [turnstileReady])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Age validation
    const birthDate = new Date(dob)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
      - (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)

    if (age < 13) {
      setError('You must be at least 13 years old to join RallyPoint.')
      setLoading(false)
      return
    }

    const isMinor = age < 18

    if (!turnstileToken) {
      setError('Please complete the verification check.')
      setLoading(false)
      return
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { captchaToken: turnstileToken },
    })

    if (signupError) {
      // A rejected/expired Turnstile token surfaces here as a Supabase auth
      // error — reset the widget so the user can retry instead of getting
      // stuck on a dead token.
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current)
      }
      setTurnstileToken('')
      setError(signupError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Pick up interests + vibe from pre-signup onboarding
      const savedInterests = JSON.parse(sessionStorage.getItem('rp_interests') ?? '[]')
      const savedVibe = sessionStorage.getItem('rp_vibe') || null
      sessionStorage.removeItem('rp_interests')
      sessionStorage.removeItem('rp_vibe')

      const profilePayload: Record<string, any> = {
        id: data.user.id,
        full_name: fullName,
        date_of_birth: dob,
        is_minor: isMinor,
      }
      if (savedInterests.length > 0) profilePayload.interests = savedInterests
      if (savedVibe) profilePayload.vibe = savedVibe

      const { error: profileError } = await supabase.from('profiles').insert(profilePayload)

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      // Fire-and-forget: report a pending referral conversion (V2 share
      // engine), if this signup arrived via a shared invite link. Never
      // blocks navigation — see reportConversionIfPending's error handling.
      reportConversionIfPending('signup')

      window.location.href = '/profile/setup'
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-[#15110d] dark:text-[#fdf6ec] mb-2">Join RallyPoint</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Find your people. Do things together.</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-accent placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-accent placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-accent placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Min 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-accent"
            />
          </div>

          <div ref={turnstileRef} />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />

        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
