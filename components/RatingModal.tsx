'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PartyPopper, Star, Check, X } from 'lucide-react'
import { useEscapeToClose } from '@/lib/useEscapeToClose'

interface Props {
  eventId: string
  eventTitle: string
  onDone: () => void
}

// Compact 1-5 selector used for the venue/organization dimensions — same
// data shape as the main star row but smaller, so adding two more questions
// doesn't blow past the "60 seconds of honesty" budget the notification
// copy promises.
function MiniScale({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-full text-xs font-semibold border transition ${
              n <= value
                ? 'bg-accent border-accent text-white'
                : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function RatingModal({ eventId, eventTitle, onDone }: Props) {
  const [rating, setRating]   = useState(0)
  const [hovered, setHovered] = useState(0)
  const [venueScore, setVenueScore] = useState(0)
  const [organizationScore, setOrganizationScore] = useState(0)
  const [returnIntent, setReturnIntent] = useState<boolean | null>(null)
  const [note, setNote]       = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  useEscapeToClose(onDone)

  const handleSubmit = async () => {
    if (!rating) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    await supabase.from('event_ratings').upsert(
      {
        event_id: eventId,
        user_id: user.id,
        rating,
        venue_score: venueScore || null,
        organization_score: organizationScore || null,
        return_intent: returnIntent,
        note: note.trim() || null,
      },
      { onConflict: 'event_id,user_id' }
    )

    setDone(true)
    setLoading(false)
    setTimeout(onDone, 1400)
  }

  const stars = [1, 2, 3, 4, 5]
  const active = hovered || rating

  const label = ['', 'Not great', 'It was ok', 'Pretty good', 'Really good', 'Amazing!'][active] ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onDone} />
      <div
        className="relative bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-3xl w-full max-w-md p-6 z-10 max-h-[85vh] overflow-y-auto"
        style={{ animation: 'rpSheetUp 0.25s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        <div className="w-10 h-1 bg-gray-700 dark:bg-gray-600 rounded-full mx-auto mb-5" />

        {done ? (
          <div className="text-center py-4">
            <PartyPopper size={32} className="mx-auto mb-3 text-accent" />
            <p className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-lg">Thanks for rating!</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              This stays private — it helps the host improve, and they'll never see who said what.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-1">How was it?</p>
            <h3 id="rating-modal-title" className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-lg text-center mb-5 leading-snug">
              {eventTitle}
            </h3>

            {/* Overall — the main star row */}
            <div className="flex justify-center gap-3 mb-2">
              {stars.map(s => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform active:scale-90"
                >
                  <Star size={32} className={s <= active ? 'text-accent fill-accent' : 'text-gray-300 dark:text-gray-600'} />
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5 h-5">
              {label}
            </p>

            {rating > 0 && (
              <>
                <MiniScale value={venueScore} onChange={setVenueScore} label="Venue quality" />
                <MiniScale value={organizationScore} onChange={setOrganizationScore} label="Organization" />

                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Would you attend this host's next event?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnIntent(true)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${
                        returnIntent === true
                          ? 'bg-accent border-accent text-white'
                          : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <Check size={12} className="shrink-0" /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnIntent(false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${
                        returnIntent === false
                          ? 'bg-gray-600 border-gray-600 text-white'
                          : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <X size={12} className="shrink-0" /> No
                    </button>
                  </div>
                </div>

                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Leave a note for the host (optional, private)"
                  rows={2}
                  className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none mb-4 dark:placeholder-gray-500"
                />
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={onDone}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 py-3 rounded-2xl text-sm transition hover:border-gray-600"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!rating || loading}
                className="flex-1 bg-accent hover:brightness-90 text-white font-semibold py-3 rounded-2xl text-sm transition disabled:opacity-40"
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
