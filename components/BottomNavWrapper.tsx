'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

// Pages that should NOT show the bottom nav
const NO_NAV_ROUTES = ['/', '/auth/login', '/auth/signup', '/onboarding', '/tos', '/privacy']

export default function BottomNavWrapper() {
  const pathname = usePathname()
  if (NO_NAV_ROUTES.includes(pathname)) return null
  return <BottomNav />
}
