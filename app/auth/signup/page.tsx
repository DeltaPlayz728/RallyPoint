'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signupError) {
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

      window.location.href = '/profile/setup'
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-[#15110d] mb-2">Join RallyPoint</h1>
        <p className="text-gray-500 mb-8">Find your people. Do things together.</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-white text-[#15110d] border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white text-[#15110d] border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white text-[#15110d] border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="Min 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
              className="w-full bg-white text-[#15110d] border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-orange-500 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
