'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { consumePendingRedirect } from '@/lib/postAuthRedirect'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
    }
  }
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Supabase's captcha protection (Attack Protection) applies to every auth
  // endpoint, not just sign-up — without this widget, signInWithPassword
  // fails server-side with captcha_failed ("no captcha_token found") and
  // real users can't log in at all.
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!turnstileToken) {
      setError('Please complete the verification check.')
      setLoading(false)
      return
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstileToken },
    })

    if (loginError) {
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current)
      }
      setTurnstileToken('')
      setError(loginError.message)
      setLoading(false)
      return
    }

    router.push(consumePendingRedirect(searchParams.get('redirect') || '/feed'))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-[#15110d] dark:text-[#fdf6ec] mb-2">Welcome back</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Log in to see what's happening near you.</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-accent placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Your password"
            />
          </div>

          <div ref={turnstileRef} />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />

        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d]" />}>
      <LoginForm />
    </Suspense>
  )
}
