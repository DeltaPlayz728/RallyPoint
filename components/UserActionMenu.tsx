'use client'

/**
 * Three-dot menu that appears on any user profile or attendee row.
 * Provides: Block user, Report user.
 * Usage: <UserActionMenu targetUserId={...} targetName={...} />
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import ReportModal from './ReportModal'
import { Ban, Flag } from 'lucide-react'

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
    return <span className="text-xs text-gray-600 dark:text-gray-400">Blocked</span>
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
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white rounded-full hover:bg-gray-200 transition text-lg"
      >
        ···
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-9 z-50 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl w-44">
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="w-full text-left px-4 py-3 text-sm text-accent hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b border-gray-200 dark:border-gray-700 inline-flex items-center gap-1.5"
            >
              <Ban size={14} /> {blocking ? 'Blocking…' : 'Block user'}
            </button>
            <button
              onClick={() => { setOpen(false); setShowReport(true) }}
              className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition inline-flex items-center gap-1.5"
            >
              <Flag size={14} /> Report user
            </button>
          </div>
        </>
      )}
    </div>
  )
}
