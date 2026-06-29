'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { entitlementLabel, TIER_LABELS } from '@/lib/subscription'
import { Zap, Heart, Sparkles, Building2, type LucideIcon } from 'lucide-react'

const CONFETTI_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#eab308']
const CONFETTI_COUNT = 36

const COPY: Record<string, { icon: LucideIcon; title: string; body: string }> = {
  founding: {
    icon: Zap,
    title: "You're a Founding Member!",
    body: "You've been granted the Planner tier for free, forever — communities, paid-event hosting, and everything else, on us.",
  },
  go_getter: {
    icon: Heart,
    title: 'Welcome to Go Getter!',
    body: 'Your supporter badge and custom banner color are live on your profile.',
  },
  extrovert: {
    icon: Sparkles,
    title: "You're an Extrovert now!",
    body: 'Priority placement, event boosts, vibe filters, and read receipts are unlocked.',
  },
  planner: {
    icon: Building2,
    title: 'Welcome to Planner!',
    body: 'You can now create communities, host paid events, and see event analytics.',
  },
}

export default function SubscriptionCelebration() {
  const [visible, setVisible] = useState(false)
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, is_founding_member, last_celebrated_tier')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) return

      const current = entitlementLabel(profile)
      if (current === 'free') return
      if (profile.last_celebrated_tier === current) return

      setLabel(current)
      setVisible(true)

      // Record immediately so a refresh mid-animation doesn't re-trigger it.
      await supabase.from('profiles').update({ last_celebrated_tier: current }).eq('id', user.id)
    }
    check()
  }, [])

  if (!visible || !label) return null

  const copy = COPY[label] ?? COPY.planner
  const tierLabel = label === 'founding' ? 'Founding Member' : TIER_LABELS[label as keyof typeof TIER_LABELS]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes confetti-fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
          }
          @keyframes celebration-pop {
            0% { transform: scale(0.85); opacity: 0; }
            60% { transform: scale(1.03); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `,
      }} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
          const left = Math.random() * 100
          const delay = Math.random() * 0.6
          const duration = 2.2 + Math.random() * 1.6
          const size = 6 + Math.random() * 6
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: 0,
                width: size,
                height: size * 0.4,
                background: color,
                animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>

      <div
        className="relative bg-white dark:bg-[#221c16] rounded-2xl p-6 max-w-sm w-full text-center shadow-xl"
        style={{ animation: 'celebration-pop 0.4s ease-out' }}
      >
        <copy.icon size={40} className="mx-auto mb-3 text-accent" />
        <h2 className="text-xl font-bold text-[#15110d] dark:text-[#fdf6ec] mb-1">
          {copy.title}
        </h2>
        <span className="inline-block text-[10px] uppercase tracking-wide bg-accent text-white px-2 py-0.5 rounded-full mb-3">
          {tierLabel}
        </span>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
          {copy.body}
        </p>
        <button
          onClick={() => setVisible(false)}
          className="w-full bg-accent text-white rounded-lg py-2.5 text-sm font-medium"
        >
          Let's go
        </button>
      </div>
    </div>
  )
}
