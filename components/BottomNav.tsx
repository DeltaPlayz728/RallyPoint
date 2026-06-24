'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

const navItems = [
  { href: '/map',           label: 'Map',     icon: '🗺️' },
  { href: '/events',        label: 'Events',  icon: '🎳' },
  { href: '/events/create', label: 'Rally',   special: true },
  { href: '/friends',       label: 'Friends', icon: '🤝' },
  { href: '/profile',       label: 'Profile', icon: '👤' },
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
                <span className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition border-2 ${
                  isCreateActive ? 'border-orange-500' : 'border-transparent'
                }`}>
                  <Logo size={26} />
                </span>
                <span className={`text-xs transition ${isCreateActive ? 'text-orange-500' : 'text-gray-500'}`}>
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
                isActive ? 'text-orange-500' : 'text-gray-500 hover:text-black dark:hover:text-white'
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
