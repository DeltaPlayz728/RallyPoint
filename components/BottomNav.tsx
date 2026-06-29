'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, Calendar, Users, User, type LucideIcon } from 'lucide-react'
import Logo from './Logo'

type NavItem =
  | { href: string; label: string; Icon: LucideIcon; special?: undefined }
  | { href: string; label: string; special: true; Icon?: undefined }

const navItems: NavItem[] = [
  { href: '/map',           label: 'Map',     Icon: Map },
  { href: '/events',        label: 'Events',  Icon: Calendar },
  { href: '/events/create', label: 'Rally',   special: true },
  { href: '/friends',       label: 'Friends', Icon: Users },
  { href: '/profile',       label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#fdf6ec] dark:bg-[#15110d] border-t border-gray-300 dark:border-gray-700 z-50 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {/* grid-cols-5 (not justify-around) guarantees the middle item sits at the
          true horizontal center of the bar, regardless of label/icon width */}
      <div className="max-w-lg mx-auto grid grid-cols-5 items-center py-2 px-2">
        {navItems.map(item => {
          const isActive = pathname === item.href || (
            item.href !== '/events/create' &&
            pathname.startsWith(item.href) &&
            !pathname.startsWith('/events/create')
          )
          if (item.special) {
            const isCreateActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-self-center">
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition border-2"
                  style={{ borderColor: isCreateActive ? 'var(--accent, #f97316)' : 'transparent' }}
                >
                  <Logo size={26} />
                </span>
                <span
                  className="text-xs transition text-gray-500"
                  style={isCreateActive ? { color: 'var(--accent, #f97316)' } : undefined}
                >
                  {item.label}
                </span>
              </Link>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-self-center text-xs transition ${
                isActive ? '' : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
              style={isActive ? { color: 'var(--accent, #f97316)' } : undefined}
            >
              <item.Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="mb-0.5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
