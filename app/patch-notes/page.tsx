'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'

type PatchNote = {
  id: string
  version: string
  title: string
  body_markdown: string
  severity: 'minor' | 'standard' | 'critical'
  published_at: string
}

const SEVERITY_STYLE: Record<string, string> = {
  minor: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  standard: 'bg-accent/10 text-accent border border-accent/30',
  critical: 'bg-red-100 text-red-600 border border-red-300',
}

export default function PatchNotesPage() {
  const router = useRouter()
  const [notes, setNotes] = useState<PatchNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase.from('patch_notes').select('*').order('published_at', { ascending: false }).limit(30)
      setNotes(data ?? [])
      setLoading(false)

      // Mark everything currently visible as read — closes the loop for
      // both the critical banner (see CriticalPatchBanner) and the regular
      // in-app notification link.
      if (data && data.length > 0) {
        await supabase.from('user_patch_reads').upsert(
          data.map(p => ({ user_id: user.id, patch_id: p.id })),
          { onConflict: 'user_id,patch_id', ignoreDuplicates: true }
        )
      }
    }
    load()
  }, [router])

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-24">
      <TopBar title="What's new" />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center pt-8">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center pt-8">Nothing published yet.</p>
        ) : (
          notes.map(n => (
            <div key={n.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${SEVERITY_STYLE[n.severity]}`}>
                  {n.severity}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {n.version} · {new Date(n.published_at).toLocaleDateString()}
                </span>
              </div>
              <p className="font-semibold text-sm mb-1">{n.title}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">{n.body_markdown}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
