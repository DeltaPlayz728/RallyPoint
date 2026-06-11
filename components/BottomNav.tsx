'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/feed',          label: 'Feed',    icon: '🏠' },
  { href: '/map',           label: 'Map',     icon: '🗺️' },
  { href: '/events',        label: 'Events',  icon: '🎳' },
  { href: '/events/create', label: 'Create',  icon: '➕' },
  { href: '/friends',       label: 'Friends', icon: '🤝' },
  { href: '/inbox',         label: 'Inbox',   icon: '🔔' },
  { href: '/profile',       label: 'Profile', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center px-2 py-1 text-xs transition ${
                isActive ? 'text-orange-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
