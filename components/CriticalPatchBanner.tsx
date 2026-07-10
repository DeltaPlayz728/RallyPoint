'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, X } from 'lucide-react'

type CriticalPatch = { id: string; title: string; body_markdown: string }

// Critical patch notes get a banner that can't be turned off in settings
// (unlike the email digest opt-out) — but it CAN be acknowledged once read,
// which just marks it read and lets it go away; "can't be disabled" means
// no preference hides it before that, not that it nags forever.
export default function CriticalPatchBanner() {
  const [patch, setPatch] = useState<CriticalPatch | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [acking, setAcking] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: reads } = await supabase.from('user_patch_reads').select('patch_id').eq('user_id', user.id)
      const readIds = (reads ?? []).map(r => r.patch_id)

      let query = supabase
        .from('patch_notes')
        .select('id, title, body_markdown')
        .eq('severity', 'critical')
        .order('published_at', { ascending: false })
        .limit(1)

      if (readIds.length > 0) query = query.not('id', 'in', `(${readIds.join(',')})`)

      const { data } = await query.maybeSingle()
      setPatch(data ?? null)
    }
    load()
  }, [])

  const acknowledge = async () => {
    if (!patch || !userId) return
    setAcking(true)
    await supabase.from('user_patch_reads').insert({ user_id: userId, patch_id: patch.id })
    setPatch(null)
    setAcking(false)
  }

  if (!patch) return null

  return (
    <div className="sticky top-0 z-[70] bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm">
      <AlertTriangle size={16} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{patch.title}</span>
        <span className="opacity-90"> — </span>
        <Link href="/patch-notes" className="underline underline-offset-2">Read more</Link>
      </div>
      <button onClick={acknowledge} disabled={acking} title="Got it" className="shrink-0 hover:opacity-75">
        <X size={16} />
      </button>
    </div>
  )
}
