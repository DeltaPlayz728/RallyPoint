'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import {
  SubscriptionTier,
  TIER_ORDER,
  TIER_LABELS,
  TIER_PRICE_EUR,
  effectiveTier,
  IS_PLAYTEST,
} from '@/lib/subscription'

const TIER_BLURB: Record<SubscriptionTier, string> = {
  free: 'Everything you need to find people and events near you. This is the real app — no paywalls on the core experience.',
  go_getter: 'Show some love and stand out a little. A supporter badge, a custom profile banner color, and you can see who\'s been checking out your profile.',
  extrovert: 'For the social butterflies. Everything in Go Getter, plus priority placement in the feed/map, a weekly event boost, vibe-match filters, and read receipts.',
  planner: 'For people who bring people together. Create standing communities — group chats, banners, pinned announcements — plus host paid events and see analytics.',
}

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ['Feed, map & event discovery', '1:1 meetups & group chat', 'RSVP to events', 'Full profile customization'],
  go_getter: ['Supporter badge on your profile', 'Custom profile banner color', 'See who viewed your profile'],
  extrovert: ['Everything in Go Getter', 'Priority feed & map placement', 'One event boost per week', 'Vibe-match filters', 'Read receipts in chat'],
  planner: ['Everything in Extrovert', 'Create communities (group chats)', 'Custom community banners', 'Pinned announcements', 'Host paid events', 'Event analytics'],
}

export default function UpgradePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free')
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', user.id)
        .maybeSingle()

      setCurrentTier(effectiveTier(profile))
      setLoading(false)
    }
    load()
  }, [router])

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!userId || tier === 'free') return
    if (IS_PLAYTEST) {
      setError("This is the playtest build — paid plans aren't active yet. No money will be charged. Check back at full launch!")
      return
    }
    setError(null)
    setPendingTier(tier)
    try {
      const res = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setPendingTier(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong — try again in a moment.')
      setPendingTier(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500">
      <TopBar title="Upgrade" />
      <div className="flex items-center justify-center pt-20">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="Upgrade" />

      <div className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold mb-1">Support RallyPoint</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          The free plan already gives you ~90% of the app — paid tiers are mostly
          about supporting what we're building. Planner also unlocks community
          tools for people organizing groups.
        </p>

        {IS_PLAYTEST && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm rounded-xl p-3 mb-4">
            ⚠️ <strong>Playtest build.</strong> Pricing below is a preview — nothing
            is purchasable yet and no real money will be charged. Subscriptions
            turn on at full launch.
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {TIER_ORDER.map((tier) => {
            const isCurrent = tier === currentTier
            const isPlanner = tier === 'planner'
            return (
              <div
                key={tier}
                className={`bg-white dark:bg-[#221c16] rounded-xl p-4 ${
                  isPlanner
                    ? 'border-2 border-accent'
                    : 'border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg text-[#15110d] dark:text-[#fdf6ec]">
                      {TIER_LABELS[tier]}
                    </h2>
                    {isPlanner && (
                      <span className="text-[10px] uppercase tracking-wide bg-accent text-white px-2 py-0.5 rounded-full">
                        Community tier
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        Current plan
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {tier === 'free' ? 'Free' : `€${TIER_PRICE_EUR[tier].toFixed(2)}/mo`}
                  </span>
                </div>

                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                  {TIER_BLURB[tier]}
                </p>

                <ul className="text-sm text-[#15110d] dark:text-[#fdf6ec] space-y-1 mb-3">
                  {TIER_FEATURES[tier].map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {tier !== 'free' && !isCurrent && (
                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={pendingTier === tier}
                    className={`w-full rounded-lg py-2 text-sm font-medium disabled:opacity-60 ${
                      IS_PLAYTEST
                        ? 'bg-gray-100 dark:bg-[#2b241c] text-gray-500 dark:text-gray-400'
                        : 'bg-accent text-white'
                    }`}
                  >
                    {IS_PLAYTEST
                      ? 'Coming at full launch'
                      : pendingTier === tier ? 'Redirecting…' : `Upgrade to ${TIER_LABELS[tier]}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
