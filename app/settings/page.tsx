'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { useTheme } from '@/components/ThemeProvider'
import { effectiveTier, TIER_LABELS, nextTier, SubscriptionTier, IS_PLAYTEST } from '@/lib/subscription'

export default function SettingsPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', user.id)
        .maybeSingle()

      setTier(effectiveTier(profile))
      setLoading(false)
    }
    check()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleManageBilling = async () => {
    if (!userId) return
    if (IS_PLAYTEST) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/create-billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.ok) {
        window.location.href = data.url
      } else {
        setPortalLoading(false)
      }
    } catch {
      setPortalLoading(false)
    }
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
            <p className="text-[#15110d] dark:text-[#fdf6ec] font-medium">
              {TIER_LABELS[tier]} plan
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 mb-3">
              {tier === 'free'
                ? 'You have access to the full core app. Upgrade to support RallyPoint and unlock a few extra perks.'
                : 'Thanks for supporting RallyPoint!'}
            </p>
            {IS_PLAYTEST && (
              <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs rounded-lg p-2.5 mb-3">
                ⚠️ Playtest build — subscriptions aren't active yet, no real money is charged.
              </p>
            )}
            <div className="flex gap-2">
              {nextTier(tier) && (
                <Link
                  href="/upgrade"
                  className="flex-1 text-center bg-orange-500 text-white rounded-lg py-2 text-sm font-medium"
                >
                  {tier === 'free' ? 'Upgrade' : 'Change plan'}
                </Link>
              )}
              {tier !== 'free' && !IS_PLAYTEST && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="flex-1 text-center bg-gray-100 dark:bg-[#2b241c] text-[#15110d] dark:text-[#fdf6ec] rounded-lg py-2 text-sm font-medium disabled:opacity-60"
                >
                  {portalLoading ? 'Loading…' : 'Manage billing'}
                </button>
              )}
            </div>
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
