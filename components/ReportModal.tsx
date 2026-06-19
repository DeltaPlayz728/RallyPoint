'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const REASONS = [
  'Fake or spam account',
  'Harassment or bullying',
  'Inappropriate content',
  'Suspicious / unsafe event',
  'Underage user',
  'Other',
]

interface ReportModalProps {
  targetType: 'user' | 'event' | 'message'
  targetId: string
  targetName?: string
  onClose: () => void
}

export default function ReportModal({ targetType, targetId, targetName, onClose }: ReportModalProps) {
  const [reason, setReason]   = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  const handleSubmit = async () => {
    if (!reason) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: user.id,
        targetType,
        targetId,
        reason,
        details: details.trim() || null,
      }),
    })

    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-[#111] border border-gray-800 rounded-3xl w-full max-w-md p-5 z-10"
        style={{ animation: 'rpSheetUp 0.25s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        {done ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-white font-semibold">Report submitted</p>
            <p className="text-gray-500 text-sm mt-1">We'll review this shortly.</p>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-lg text-white mb-1">
              Report {targetType === 'user' ? 'user' : targetType === 'event' ? 'event' : 'message'}
            </h3>
            {targetName && (
              <p className="text-gray-500 text-sm mb-4">{targetName}</p>
            )}

            <p className="text-gray-400 text-sm mb-3">Why are you reporting this?</p>

            <div className="space-y-2 mb-4">
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition ${
                    reason === r
                      ? 'bg-red-950/50 border-red-700 text-red-400'
                      : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {reason && (
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Additional details (optional)"
                rows={2}
                className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 resize-none mb-4"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-700 text-gray-400 py-3 rounded-xl text-sm font-medium hover:border-gray-500 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
