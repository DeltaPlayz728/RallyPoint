'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, Award } from 'lucide-react'

type AccommodationType = { id: string; name: string }

export default function EndorseModal({
  target,
  currentUserId,
  onClose,
}: {
  target: { userId: string; name: string }
  currentUserId: string
  onClose: () => void
}) {
  const [types, setTypes] = useState<AccommodationType[]>([])
  const [loading, setLoading] = useState(true)
  const [givenId, setGivenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('accommodation_types').select('id, name').order('name').then(({ data }) => {
      setTypes(data ?? [])
      setLoading(false)
    })
  }, [])

  const give = async (typeId: string) => {
    setError('')
    const { error: insertError } = await supabase.from('endorsements').insert({
      endorser_id: currentUserId,
      recipient_id: target.userId,
      accommodation_type_id: typeId,
    })
    if (insertError) {
      // Unique-constraint violation = already given this one to this person
      if (insertError.code === '23505') setError(`You've already given ${target.name} this one.`)
      else setError('Could not send that endorsement. Try again.')
      return
    }
    setGivenId(typeId)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-3xl w-full max-w-md p-5 z-10 max-h-[80vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-1 text-[#15110d] dark:text-[#fdf6ec] inline-flex items-center gap-1.5">
          <Award size={18} className="shrink-0 text-accent" /> Give {target.name} an accommodation
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          A fun, earned trait — not a rating. One per person, and only because you've actually shared an event.
        </p>

        {givenId ? (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-xl mb-4 inline-flex items-center gap-2">
            <Check size={16} className="shrink-0" /> Sent!
          </div>
        ) : loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-6 text-center">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3 max-h-64 overflow-y-auto">
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => give(t.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-700 hover:border-accent hover:text-accent transition text-gray-600 dark:text-gray-400"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <button
          onClick={onClose}
          className="w-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium py-2.5 rounded-xl transition hover:border-gray-500"
        >
          {givenId ? 'Done' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
