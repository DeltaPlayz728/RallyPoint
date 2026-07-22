'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { Handshake, CheckCircle2, XCircle, PartyPopper, Clock, MessageCircle, Bell, type LucideIcon } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

const typeIcon: Record<string, LucideIcon> = {
  meetup_request: Handshake,
  meetup_accepted: CheckCircle2,
  meetup_declined: XCircle,
  event_join: PartyPopper,
  event_reminder: Clock,
  group_chat: MessageCircle,
  default: Bell,
}

export default function InboxPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data ?? [])
      setLoading(false)

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    }
    load()
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
  )

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Inbox</h1>
            {unreadCount > 0 && (
              <p className="text-accent text-sm">{unreadCount} new</p>
            )}
          </div>
          <Logo size={28} />
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            illustration="caughtup"
            title="All caught up"
            description="Notifications will appear here — RSVPs, messages, and community activity."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = typeIcon[n.type] ?? typeIcon.default
              const content = (
                <div className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                  n.read
                    ? 'bg-white dark:bg-[#221c16] border-gray-200 dark:border-gray-700'
                    : 'bg-white dark:bg-[#221c16] border-accent/40'
                }`}>
                  <Icon size={20} className="shrink-0 mt-0.5 text-[#15110d] dark:text-[#fdf6ec]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-snug ${n.read ? 'text-gray-600 dark:text-gray-400' : 'text-[#15110d] dark:text-[#fdf6ec]'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">{formatTime(n.created_at)}</span>
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>
                    )}
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                  )}
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link}>{content}</Link>
              ) : (
                <div key={n.id}>{content}</div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
