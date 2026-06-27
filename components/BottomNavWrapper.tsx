'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

// Pages that should NOT show the bottom nav (exact match)
const NO_NAV_ROUTES = ['/', '/auth/login', '/auth/signup', '/onboarding', '/welcome', '/tos', '/privacy']

// Route prefixes that should NOT show the bottom nav (covers dynamic routes,
// e.g. /communities/[id], which render their own in-flow bottom tab bar that
// would otherwise be covered by this fixed-position global nav)
const NO_NAV_PREFIXES = ['/communities/']

export default function BottomNavWrapper() {
  const pathname = usePathname()
  if (NO_NAV_ROUTES.includes(pathname)) return null
  if (NO_NAV_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null
  return <BottomNav />
}
