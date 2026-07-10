'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Star, MapPin, ClipboardList, ThumbsUp, MessageSquare } from 'lucide-react'

type FeedbackData = {
  ready: boolean
  responseCount: number
  threshold?: number
  avgOverall?: number | null
  avgVenue?: number | null
  avgOrganization?: number | null
  returnIntentRate?: number | null
  notes?: string[]
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-bold text-[#15110d] dark:text-[#fdf6ec]">{value}</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">{label}</p>
      </div>
    </div>
  )
}

export default function EventFeedbackPage() {
  const { id } = useParams()
  const router = useRouter()
  const [eventTitle, setEventTitle] = useState('')
  const [data, setData] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: event } = await supabase.from('events').select('title, created_by').eq('id', id).maybeSingle()
      if (!event || event.created_by !== user.id) { router.push(`/events/${id}`); return }
      setEventTitle(event.title)

      const res = await fetch(`/api/events/${id}/feedback`)
      if (!res.ok) {
        setError('Could not load feedback.')
        setLoading(false)
        return
      }
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [id, router])

  return (
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] pb-16">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <Link href={`/events/${id}`} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="font-semibold text-sm">{eventTitle || 'Event'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Feedback (private)</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center pt-10">Loading…</p>
        ) : error ? (
          <p className="text-red-500 text-sm text-center pt-10">{error}</p>
        ) : !data?.ready ? (
          <div className="text-center pt-10">
            <ClipboardList size={28} className="mx-auto mb-3 text-gray-400 dark:text-gray-500" />
            <p className="font-medium mb-1">Not enough responses yet</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {data?.responseCount ?? 0} of {data?.threshold ?? 5} needed — feedback only unlocks once enough people
              have responded, so no one can guess who said what.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {data.responseCount} responses · nobody's individual answer is identifiable, even to you.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatRow icon={Star} label="Overall" value={data.avgOverall != null ? `${data.avgOverall}★` : '—'} />
              <StatRow icon={MapPin} label="Venue" value={data.avgVenue != null ? `${data.avgVenue}★` : '—'} />
              <StatRow icon={ClipboardList} label="Organization" value={data.avgOrganization != null ? `${data.avgOrganization}★` : '—'} />
              <StatRow icon={ThumbsUp} label="Would return" value={data.returnIntentRate != null ? `${data.returnIntentRate}%` : '—'} />
            </div>

            <div className="mt-6">
              <h2 className="font-semibold mb-3 inline-flex items-center gap-1.5">
                <MessageSquare size={16} className="shrink-0" /> Notes
              </h2>
              {(!data.notes || data.notes.length === 0) ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No written notes this time.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.notes.map((note, i) => (
                    <div key={i} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 text-sm">
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
