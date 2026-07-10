'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { consumePendingRedirect } from '@/lib/postAuthRedirect'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
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

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

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
