'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from './Logo'

interface TopBarProps {
  title: string
}

export default function TopBar({ title }: TopBarProps) {
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnread((count ?? 0) > 0)
    }
    check()
  }, [])

  return (
    <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-black border-b border-gray-900/60 sticky top-0 z-20">
      {/* Logo */}
      <Link href="/map" className="shrink-0">
        <Logo size={30} />
      </Link>

      {/* Page title */}
      <span className="text-sm font-medium text-gray-400">{title}</span>

      {/* Inbox bell */}
      <Link href="/inbox" className="relative p-1">
        <span className="text-xl">🔔</span>
        {unread && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-black" />
        )}
      </Link>
    </div>
  )
}
