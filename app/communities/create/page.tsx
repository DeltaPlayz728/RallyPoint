'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { effectiveTier, hasFeature, SubscriptionTier } from '@/lib/subscription'

const BANNER_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#eab308']

export default function CreateCommunityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bannerColor, setBannerColor] = useState(BANNER_COLORS[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', user.id)
        .maybeSingle()
      setTier(effectiveTier(profile))
      setLoading(false)
    }
    load()
  }, [router])

  const canCreate = hasFeature(tier, 'create_community')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !name.trim()) return
    setSubmitting(true)
    setError(null)

    // RLS also enforces the Planner-tier check server-side — this is just
    // the friendly client-side guard so non-Planner users see a clear error
    // instead of a raw 403.
    const { data, error: insertError } = await supabase
      .from('communities')
      .insert({
        owner_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        banner_color: bannerColor,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      setError(
        insertError?.message.includes('row-level security')
          ? 'Creating communities requires the Planner plan.'
          : 'Something went wrong — try again.',
      )
      setSubmitting(false)
      return
    }

    // Owner joins their own community automatically.
    await supabase.from('community_members').insert({ community_id: data.id, user_id: userId })

    router.push(`/communities/${data.id}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-gray-500">
      <TopBar title="New Community" />
      <div className="flex items-center justify-center pt-20">Loading...</div>
    </div>
  )

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
        <TopBar title="New Community" />
        <div className="max-w-lg mx-auto px-4 pt-10 text-center">
          <p className="font-medium mb-2">Communities are a Planner perk</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Upgrade to Planner to create standing group chats, banners, and pinned announcements.
          </p>
          <button
            onClick={() => router.push('/upgrade')}
            className="bg-accent text-white rounded-lg py-2.5 px-6 text-sm font-medium"
          >
            See plans
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-28">
      <TopBar title="New Community" />

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold mb-1">Start a community</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          A standing group chat with banners and pinned announcements.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="e.g. Breda Weekend Crew"
          className="w-full bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-accent"
        />

        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="What's this community about?"
          className="w-full bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-accent resize-none"
        />

        <label className="block text-sm font-medium mb-1.5">Banner color</label>
        <div className="flex gap-2 mb-6">
          {BANNER_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setBannerColor(c)}
              className={`w-9 h-9 rounded-full shrink-0 ${bannerColor === c ? 'ring-2 ring-offset-2 ring-accent ring-offset-[#fdf6ec] dark:ring-offset-[#15110d]' : ''}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full bg-accent text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create community'}
        </button>
      </form>
    </div>
  )
}
