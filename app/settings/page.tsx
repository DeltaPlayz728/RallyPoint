'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { useTheme } from '@/components/ThemeProvider'

export default function SettingsPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setLoading(false)
    }
    check()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500">
      <TopBar title="Settings" />
      <div className="flex items-center justify-center pt-20">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="Settings" />

      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Manage how RallyPoint looks and works for you.
        </p>

        {/* Appearance */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Appearance
          </h2>
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#15110d] dark:text-[#fdf6ec]">Dark mode</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                Switch RallyPoint to a darker color scheme.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={toggleTheme}
              className={`relative w-12 h-7 rounded-full transition shrink-0 ${
                theme === 'dark' ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Account
          </h2>
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
            <Link
              href="/profile/setup?edit=true"
              className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#2b241c] transition"
            >
              <span className="text-[#15110d] dark:text-[#fdf6ec]">Edit profile</span>
              <span className="text-gray-400">›</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#2b241c] transition"
            >
              <span className="text-red-500">Sign out</span>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </section>

        {/* Subscription */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Subscription
          </h2>
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-[#15110d] dark:text-[#fdf6ec] font-medium">Free plan</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              Paid tiers (Go Getter, Extrovert, Planner) are coming soon.
            </p>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            About
          </h2>
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
            <Link
              href="/tos"
              className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#2b241c] transition"
            >
              <span className="text-[#15110d] dark:text-[#fdf6ec]">Terms of Service</span>
              <span className="text-gray-400">›</span>
            </Link>
            <Link
              href="/privacy"
              className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#2b241c] transition"
            >
              <span className="text-[#15110d] dark:text-[#fdf6ec]">Privacy Policy</span>
              <span className="text-gray-400">›</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
