'use client'

import { useRef, useState } from 'react'

interface Props {
  eventTitle: string
  eventLocation: string
  eventDate: string   // ISO string
  onClose: () => void
}

function formatShareDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric',
  })
}

export default function ShareCard({ eventTitle, eventLocation, eventDate, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [shared, setShared] = useState(false)

  const handleShare = async () => {
    // Try Web Share API first (works on iOS Safari, Android Chrome)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'I showed up. 🙌',
          text: `Just attended "${eventTitle}" on RallyPoint. rally-point.app`,
        })
        setShared(true)
        return
      } catch {
        // User cancelled or share failed — fall through to screenshot hint
      }
    }
    // Fallback: just show the screenshot hint
    setShared(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm px-4">

      {/* Instructions */}
      <p className="text-gray-400 text-xs mb-4 text-center">
        {shared
          ? '✅ Nice! Screenshot the card below to post your story'
          : 'Share your experience with your friends'}
      </p>

      {/* ── The Card ─────────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative w-full max-w-xs rounded-3xl overflow-hidden select-none"
        style={{
          background: 'linear-gradient(145deg, #0d0d0d 0%, #1a0a00 50%, #0d0d0d 100%)',
          border: '1px solid rgba(249,115,22,0.25)',
          boxShadow: '0 0 60px rgba(249,115,22,0.12), 0 24px 48px rgba(0,0,0,0.6)',
          aspectRatio: '9/14',
        }}
      >
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

        {/* Top brand bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-6 pt-6">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-black dark:text-[#fdf6ec] font-black text-xs">RP</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">
            Rally<span className="text-orange-500">Point</span>
          </span>
        </div>

        {/* Main content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">

          {/* Headline */}
          <div className="mb-6">
            <p className="text-5xl mb-3">🙌</p>
            <h1 className="text-3xl font-black text-white leading-tight">
              I showed<br />up.
            </h1>
          </div>

          {/* Event card */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 mb-6 backdrop-blur-sm">
            <p className="text-white font-bold text-base leading-snug mb-2">{eventTitle}</p>
            <div className="flex flex-col gap-1">
              <p className="text-gray-400 text-xs flex items-center gap-1.5">
                <span>📍</span>{eventLocation}
              </p>
              <p className="text-gray-400 text-xs flex items-center gap-1.5">
                <span>📅</span>{formatShareDate(eventDate)}
              </p>
            </div>
          </div>

          {/* Vibe line */}
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-[200px]">
            Real places. Real people.<br />No swiping required.
          </p>
        </div>

        {/* Bottom URL */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-6 pb-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-gray-500 dark:text-gray-400 text-[10px] tracking-widest uppercase">rally-point.app</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-xs mt-5 space-y-2">
        {!shared ? (
          <button
            onClick={handleShare}
            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-4 rounded-2xl text-sm transition"
          >
            Share to story →
          </button>
        ) : (
          <div className="w-full bg-gray-900 border border-gray-700 text-gray-300 font-medium py-4 rounded-2xl text-sm text-center">
            📸 Hold the card above to save it
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-400 py-2 text-sm transition"
        >
          {shared ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
