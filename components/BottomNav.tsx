'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Map, Calendar, Users, User, type LucideIcon } from 'lucide-react'
import Logo from './Logo'

type NavItem =
  | { href: string; label: string; Icon: LucideIcon; special?: undefined }
  | { href: string; label: string; special: true; Icon?: undefined }

const navItems: NavItem[] = [
  { href: '/map',           label: 'Map',     Icon: Map },
  { href: '/feed',          label: 'Events',  Icon: Calendar },
  { href: '/events/create', label: 'Rally',   special: true },
  { href: '/friends',       label: 'Friends', Icon: Users },
  { href: '/profile',       label: 'Profile', Icon: User },
]

// Instagram's current mobile app bar (per its 2026 "Liquid Glass" nav test —
// verified via web search, not guessed): icon-only, no text labels, and a
// narrower floating pill rather than a flush edge-to-edge strip — it sits
// inset from the screen edges with a gap of backdrop visible all around it,
// semi-transparent and blurred so content ("more of the post remains
// visible") scrolls/renders through it instead of hiding behind a solid bar.
// Every tap plays a quick overshoot bounce on the icon just activated.
export default function BottomNav() {
  const pathname = usePathname()
  const [poppedHref, setPoppedHref] = useState<string | null>(null)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setPoppedHref(pathname)
      prevPathname.current = pathname
      const t = setTimeout(() => setPoppedHref(null), 320)
      return () => clearTimeout(t)
    }
  }, [pathname])

  return (
    <nav
      className="fixed left-3 right-3 bg-[#fdf6ec]/70 dark:bg-[#15110d]/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-3xl shadow-lg shadow-black/10 z-50"
      style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
    >
      {/* grid-cols-5 (not justify-around) guarantees the middle item sits at the
          true horizontal center of the bar, regardless of icon width */}
      <div className="max-w-lg mx-auto grid grid-cols-5 items-center py-2.5 px-2">
        {navItems.map(item => {
          const isActive = pathname === item.href || (
            item.href !== '/events/create' &&
            pathname.startsWith(item.href) &&
            !pathname.startsWith('/events/create')
          )
          const justPopped = poppedHref === item.href
          if (item.special) {
            const isCreateActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setPoppedHref(item.href)}
                className="flex flex-col items-center justify-self-center"
              >
                <span
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition border-2 ${justPopped ? 'animate-nav-pop' : ''}`}
                  style={{ borderColor: isCreateActive ? 'var(--accent, #f97316)' : 'transparent' }}
                >
                  <Logo size={26} />
                </span>
              </Link>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setPoppedHref(item.href)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-self-center transition ${
                isActive ? '' : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
              style={isActive ? { color: 'var(--accent, #f97316)' } : undefined}
            >
              <item.Icon
                size={26}
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? 'currentColor' : 'none'}
                fillOpacity={isActive ? 0.15 : 0}
                className={justPopped ? 'animate-nav-pop' : ''}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
