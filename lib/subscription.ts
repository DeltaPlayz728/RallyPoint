// Subscription tier helpers — supporter model (decided 2026-06-25).
//
// Free covers ~90% of the app. Paid tiers are mostly about supporting
// RallyPoint; Planner is the one tier with real new capability (communities:
// standing group chats, banners, pinned announcements, paid-event hosting).
// See PHASE_6_7_DRAFT.md / idea board for the full reasoning.

export type SubscriptionTier = 'free' | 'go_getter' | 'extrovert' | 'planner'

export const TIER_ORDER: SubscriptionTier[] = ['free', 'go_getter', 'extrovert', 'planner']

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  go_getter: 'Go Getter',
  extrovert: 'Extrovert',
  planner: 'Planner',
}

// Monthly price in EUR — display only. Real billing amounts live in Stripe
// Price objects (env vars below); these are just for rendering the pricing
// page before Stripe IDs exist.
export const TIER_PRICE_EUR: Record<SubscriptionTier, number> = {
  free: 0,
  go_getter: 2.99,
  extrovert: 5.99,
  planner: 11.99,
}

// Maps each tier to the Stripe Price ID env var that should back its
// subscription checkout. Set these once John creates the products via the
// Stripe plugin — until then the upgrade page shows "coming soon" for any
// tier whose price ID isn't configured.
export const TIER_PRICE_ENV: Record<Exclude<SubscriptionTier, 'free'>, string | undefined> = {
  go_getter: process.env.NEXT_PUBLIC_STRIPE_PRICE_GO_GETTER,
  extrovert: process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTROVERT,
  planner: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLANNER,
}

// Playtest gate — real money should not change hands until full publish.
// Defaults to true (safe) so nobody has to remember to set it for the
// playtest; flip NEXT_PUBLIC_PLAYTEST_MODE=false in Vercel at launch once
// real Stripe prices are live to re-enable purchasing.
export const IS_PLAYTEST = process.env.NEXT_PUBLIC_PLAYTEST_MODE !== 'false'

export type Feature =
  | 'supporter_badge'
  | 'profile_banner_color'
  | 'profile_view_count'
  | 'priority_placement'
  | 'event_boost'
  | 'vibe_match_filters'
  | 'read_receipts'
  | 'create_community'
  | 'host_paid_events'
  | 'event_analytics'

// Minimum tier required for each feature. Anything not listed here is part
// of the free 90% — available to everyone.
const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  supporter_badge: 'go_getter',
  profile_banner_color: 'go_getter',
  profile_view_count: 'go_getter',
  priority_placement: 'extrovert',
  event_boost: 'extrovert',
  vibe_match_filters: 'extrovert',
  read_receipts: 'extrovert',
  create_community: 'planner',
  host_paid_events: 'planner',
  event_analytics: 'planner',
}

export function tierMeetsMinimum(tier: SubscriptionTier, minimum: SubscriptionTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum)
}

export function hasFeature(tier: SubscriptionTier | null | undefined, feature: Feature): boolean {
  const effective = tier ?? 'free'
  return tierMeetsMinimum(effective, FEATURE_MIN_TIER[feature])
}

// A subscription is only "live" if Stripe says it's active — a canceled or
// past_due paid tier should not keep gating open. Free tier has no Stripe
// status at all, so it's always considered fine.
export function effectiveTier(profile: {
  subscription_tier?: string | null
  subscription_status?: string | null
} | null | undefined): SubscriptionTier {
  if (!profile) return 'free'
  const tier = (profile.subscription_tier ?? 'free') as SubscriptionTier
  if (tier === 'free') return 'free'
  if (profile.subscription_status === 'active') return tier
  return 'free'
}

export function nextTier(tier: SubscriptionTier): SubscriptionTier | null {
  const idx = TIER_ORDER.indexOf(tier)
  return idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null
}
