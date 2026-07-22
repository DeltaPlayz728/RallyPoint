'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { effectiveTier, hasFeature, SubscriptionTier } from '@/lib/subscription'
import { Users2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

type CommunityRow = {
  id: string
  name: string
  description: string | null
  banner_color: string
  icon_url: string | null
  member_count: number
  isMember: boolean
}

export default function CommunitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [communities, setCommunities] = useState<CommunityRow[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', user.id)
        .maybeSingle()
      setTier(effectiveTier(profile))

      const { data: rows } = await supabase
        .from('communities')
        .select('id, name, description, banner_color, icon_url, community_members(user_id)')
        .order('created_at', { ascending: false })

      const mapped: CommunityRow[] = (rows ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        banner_color: c.banner_color,
        icon_url: c.icon_url ?? null,
        member_count: c.community_members?.length ?? 0,
        isMember: !!c.community_members?.some((m: any) => m.user_id === user.id),
      }))

      setCommunities(mapped)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500">
      <TopBar title="Communities" />
      <div className="flex items-center justify-center pt-20">Loading...</div>
    </div>
  )

  const canCreate = hasFeature(tier, 'create_community')

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="Communities" />

      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold">Communities</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Standing group chats for people building something together.
            </p>
          </div>
        </div>

        {canCreate ? (
          <Link
            href="/communities/create"
            className="block w-full text-center bg-accent text-white rounded-lg py-2.5 text-sm font-medium mt-4 mb-6"
          >
            + Create a community
          </Link>
        ) : (
          <Link
            href="/upgrade"
            className="block w-full text-center bg-gray-100 dark:bg-[#2b241c] text-[#15110d] dark:text-[#fdf6ec] rounded-lg py-2.5 text-sm font-medium mt-4 mb-6"
          >
            Planner tier creates communities — upgrade to start one
          </Link>
        )}

        {communities.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No communities yet"
            description="Communities are where people with shared interests hang out, chat, and plan events together. Be the first to start one."
            ctaLabel="Explore events instead"
            ctaHref="/feed"
          />
        ) : (
          <div className="space-y-3">
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/communities/${c.id}`}
                className="block bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <div className="h-12 relative" style={{ background: c.banner_color }}>
                  <div
                    className="absolute left-3 -bottom-4 w-9 h-9 rounded-full border-2 border-white dark:border-[#221c16] overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: c.banner_color }}
                  >
                    {c.icon_url ? (
                      <img src={c.icon_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      c.name.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <div className="p-4 pl-14">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-semibold text-[#15110d] dark:text-[#fdf6ec]">{c.name}</h2>
                    {c.isMember && (
                      <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        Joined
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-1 line-clamp-2">{c.description}</p>
                  )}
                  <p className="text-gray-400 dark:text-gray-500 text-xs">
                    {c.member_count} member{c.member_count === 1 ? '' : 's'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
