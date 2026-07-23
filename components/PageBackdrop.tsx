'use client'

import MeshBackdrop from '@/components/MeshBackdrop'
import HexDotBackdrop from '@/components/HexDotBackdrop'
import type { BackgroundStyle } from '@/components/ThemeProvider'

/**
 * Single switchboard for "what renders behind this page" — reads the
 * Settings > Appearance > Background style choice and renders the matching
 * visual. Always fixed + pointer-events-none, always z-0, so any page can
 * drop this in without worrying about layout or click-through.
 */
export default function PageBackdrop({
  style,
  accent,
  customUrl,
}: {
  style: BackgroundStyle
  accent: string
  customUrl: string | null
}) {
  if (style === 'mesh') {
    return <MeshBackdrop accent={accent} />
  }

  if (style === 'dots') {
    return <HexDotBackdrop accent={accent} />
  }

  if (style === 'custom' && customUrl) {
    return (
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${customUrl})` }}
        />
        {/* Scrim so cards/text on top stay legible over an arbitrary photo. */}
        <div className="absolute inset-0 bg-[#fdf6ec]/70 dark:bg-[#15110d]/70" />
      </div>
    )
  }

  // 'flat' (or 'custom' with no image saved yet) — the original look: a
  // plain page fill with a few soft pastel bubbles, nothing more.
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute top-[22%] -left-16 w-40 h-40 rounded-full bg-[#f6d9bf] dark:bg-accent/10" />
      <div className="absolute top-[56%] -right-12 w-32 h-32 rounded-full bg-[#cfeede] dark:bg-teal-500/10" />
      <div className="absolute -bottom-12 left-[18%] w-44 h-44 rounded-full bg-[#dcd2ef] dark:bg-purple-500/10" />
    </div>
  )
}
