'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { useTheme, ACCENT_PRESETS } from '@/components/ThemeProvider'
import { effectiveTier, TIER_LABELS, nextTier, SubscriptionTier, IS_PLAYTEST } from '@/lib/subscription'
import { Check, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { theme, toggleTheme, accent, setAccent } = useTheme()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [portalLoading, setPortalLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rallypoint-my-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    }
    setExporting(false)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your account and all your data? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) throw new Error()
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      alert('Account deletion failed. Please try again.')
      setDeleting(false)
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
                theme === 'dark' ? 'bg-accent' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-3">
            <p className="font-medium text-[#15110d] dark:text-[#fdf6ec] mb-0.5">Accent color</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">
              Pick the color that highlights buttons, the nav bar, and other accents across the app.
            </p>
            <div className="flex gap-3">
              {ACCENT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setAccent(preset.id)}
                  aria-label={preset.label}
                  title={preset.label}
                  className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition"
                  style={{
                    backgroundColor: preset.hex,
                    boxShadow: accent === preset.id ? `0 0 0 2px white, 0 0 0 4px ${preset.hex}` : 'none',
                  }}
                >
                  {accent === preset.id && (
                    <Check size={14} className="text-white" />
                  )}
                </button>
              ))}
            </div>
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

        {/* Data & privacy */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Data &amp; privacy</h2>
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
            <button onClick={handleExport} disabled={exporting} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#2b241c] transition disabled:opacity-60">
              <span className="text-[#15110d] dark:text-[#fdf6ec]">{exporting ? 'Preparing…' : 'Export my data'}</span>
              <span className="text-gray-400">›</span>
            </button>
            <button onClick={handleDeleteAccount} disabled={deleting} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#2b241c] transition disabled:opacity-60">
              <span className="text-red-500">{deleting ? 'Deleting…' : 'Delete my account'}</span>
              <span className="text-gray-400">›</span>
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">Export downloads everything we hold on you as a file. Deleting removes your account and all your data permanently.</p>
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
              <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs rounded-lg p-2.5 mb-3 inline-flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" /> Playtest build — subscriptions aren't active yet, no real money is charged.
              </p>
            )}
            <div className="flex gap-2">
              {nextTier(tier) && (
                <Link
                  href="/upgrade"
                  className="flex-1 text-center bg-accent text-white rounded-lg py-2 text-sm font-medium"
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
