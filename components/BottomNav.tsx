'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/map',           label: 'Map',     icon: '🗺️' },
  { href: '/events',        label: 'Events',  icon: '🎳' },
  { href: '/events/create', label: 'Create',  icon: '➕', special: true },
  { href: '/friends',       label: 'Friends', icon: '🤝' },
  { href: '/profile',       label: 'Profile', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-900 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/events/create' && pathname.startsWith(item.href))
          if (item.special) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center px-3 py-1">
                <span className="bg-orange-500 w-10 h-10 rounded-2xl flex items-center justify-center text-xl mb-0.5">➕</span>
                <span className="text-xs text-gray-500">Create</span>
              </Link>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center px-3 py-1 text-xs transition ${
                isActive ? 'text-orange-500' : 'text-gray-500 hover:text-white'
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
