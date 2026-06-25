'use client'

import { usePathname } from 'next/navigation'
import SubscriptionCelebration from './SubscriptionCelebration'

// Same exclusion list as BottomNavWrapper — no point checking entitlements
// on pages the user hits before they're logged in.
const NO_CELEBRATION_ROUTES = ['/', '/auth/login', '/auth/signup', '/onboarding', '/welcome', '/tos', '/privacy']

export default function SubscriptionCelebrationWrapper() {
  const pathname = usePathname()
  if (NO_CELEBRATION_ROUTES.includes(pathname)) return null
  return <SubscriptionCelebration />
}
