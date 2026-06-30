'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { CURRENT_VERSION, RELEASES, type ChangeTag } from '@/lib/changelog'

const STORAGE_KEY = 'rallypoint:whatsNewSeen'

// Tag pill colours — Bold & Expressive: solid fill + black border, white text.
const TAG_STYLES: Record<ChangeTag, string> = {
  New: 'bg-accent text-white',
  Update: 'bg-purple-500 text-white',
  News: 'bg-green-500 text-white',
}

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false)
  const release = RELEASES[0]

  useEffect(() => {
    if (!release) return
    let seen: string | null = null
    try {
      seen = localStorage.getItem(STORAGE_KEY)
    } catch {
      // localStorage can throw in private mode / blocked storage — fail open
      // by simply not showing the popup rather than crashing the feed.
      return
    }
    if (seen !== CURRENT_VERSION) setOpen(true)
  }, [release])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    } catch {
      // ignore — worst case the popup shows again next launch
    }
    setOpen(false)
  }

  // Close on Escape for keyboard users
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !release) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#221c16] border-2 border-black dark:border-gray-600 rounded-3xl overflow-hidden shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with decorative blobs */}
        <div className="relative overflow-hidden px-5 pt-6 pb-5 border-b-2 border-black dark:border-gray-600">
          <div className="absolute -top-12 -right-10 w-32 h-32 rounded-full bg-accent pointer-events-none" aria-hidden="true" />
          <div className="absolute top-4 -right-2 w-12 h-12 rounded-full bg-purple-500 pointer-events-none" aria-hidden="true" />

          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white dark:bg-[#221c16] border-2 border-black dark:border-gray-600 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} className="text-[#15110d] dark:text-[#fdf6ec]" />
          </button>

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide bg-black text-white px-2.5 py-1 rounded-full font-bold mb-3">
              <Sparkles size={11} className="shrink-0" /> {release.date}
            </span>
            <h2
              id="whatsnew-title"
              className="text-2xl font-black text-[#15110d] dark:text-[#fdf6ec] leading-tight"
            >
              <span className="inline-block -rotate-1">{release.headline}</span>{' '}
              <span className="inline-block bg-accent text-white px-2 py-0.5 rounded-lg rotate-2 border-2 border-black">
                update
              </span>
            </h2>
          </div>
        </div>

        {/* Change list */}
        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-3">
          {release.changes.map((c, i) => (
            <div
              key={i}
              className="bg-[#fdf6ec] dark:bg-[#15110d] border-2 border-black dark:border-gray-600 rounded-2xl p-3.5"
            >
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold border-2 border-black ${TAG_STYLES[c.tag]}`}
              >
                {c.tag}
              </span>
              <h3 className="text-[#15110d] dark:text-[#fdf6ec] font-bold text-[15px] mt-2 leading-snug">
                {c.title}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 leading-relaxed">
                {c.description}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={dismiss}
            className="w-full bg-accent hover:brightness-90 text-white font-bold py-3 rounded-xl border-2 border-black active:scale-[0.98] transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
