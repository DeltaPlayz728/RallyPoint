'use client'

/**
 * Three-dot menu that appears on any user profile or attendee row.
 * Provides: Block user, Report user.
 * Usage: <UserActionMenu targetUserId={...} targetName={...} />
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import ReportModal from './ReportModal'

interface Props {
  targetUserId: string
  targetName?: string
}

export default function UserActionMenu({ targetUserId, targetName }: Props) {
  const [open, setOpen]             = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [blocked, setBlocked]       = useState(false)
  const [blocking, setBlocking]     = useState(false)

  const handleBlock = async () => {
    setBlocking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBlocking(false); return }

    await supabase.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    })

    setBlocked(true)
    setBlocking(false)
    setOpen(false)
  }

  if (blocked) {
    return <span className="text-xs text-gray-600">Blocked</span>
  }

  return (
    <div className="relative">
      {showReport && (
        <ReportModal
          targetType="user"
          targetId={targetUserId}
          targetName={targetName}
          onClose={() => setShowReport(false)}
        />
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-400 rounded-full hover:bg-gray-900 transition text-lg"
      >
        ···
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 bg-[#1a1a1a] border border-gray-800 rounded-2xl overflow-hidden shadow-xl w-44">
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="w-full text-left px-4 py-3 text-sm text-orange-400 hover:bg-gray-900 transition border-b border-gray-800"
            >
              🚫 {blocking ? 'Blocking…' : 'Block user'}
            </button>
            <button
              onClick={() => { setOpen(false); setShowReport(true) }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-900 transition"
            >
              🚩 Report user
            </button>
          </div>
        </>
      )}
    </div>
  )
}
