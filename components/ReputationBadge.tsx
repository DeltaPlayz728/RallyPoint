import { Sparkles } from 'lucide-react'

// Warm-toned tiers by design (Master Plan §4): a low tier must never read as
// "this person might scam you." Every tier uses the same warm amber/orange
// family — lighter for new users, richer for veterans — never red or
// warning-yellow, and the raw numeric score is never shown, only the tier.
const TIER_STYLE: Record<string, { bg: string; text: string }> = {
  'New Explorer':        { bg: '#fef3e2', text: '#b45309' },
  'Active Participant':  { bg: '#fde8cc', text: '#9a3412' },
  'Trusted Member':      { bg: '#fbd9a5', text: '#7c2d12' },
  'Community Anchor':    { bg: '#f97316', text: '#ffffff' },
  'Platform Veteran':    { bg: '#c2410c', text: '#ffffff' },
}

export default function ReputationBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null
  const style = TIER_STYLE[tier] ?? TIER_STYLE['New Explorer']
  const isVeteran = tier === 'Platform Veteran'

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {isVeteran && <Sparkles size={11} className="shrink-0" />}
      {tier}
    </span>
  )
}
