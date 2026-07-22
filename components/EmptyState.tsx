'use client'

import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import EmptyIllustration from './EmptyIllustration'

// Shared warm empty-state. Prefer the `illustration` prop (hand-felt SVG
// badge matching the Logo.tsx brand mark) over the older `icon` prop — the
// generic Lucide-icon-in-a-tinted-circle pattern was the single most
// obvious "built by an AI scaffold" tell in the app, since it's the default
// first result for "nice empty state" from every AI page-builder. `icon`
// is kept only for any caller not yet migrated to an illustration variant.
export default function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: {
  icon?: LucideIcon
  illustration?: 'friends' | 'community' | 'caughtup' | 'events' | 'search'
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
  onCtaClick?: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      {illustration ? (
        <div className="mb-4"><EmptyIllustration variant={illustration} /></div>
      ) : Icon ? (
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Icon size={28} className="text-accent" />
        </div>
      ) : null}
      <p className="font-semibold text-[#15110d] dark:text-[#fdf6ec] text-sm mb-1">{title}</p>
      <p className="text-gray-500 dark:text-gray-400 text-xs max-w-xs mb-4">{description}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="bg-accent hover:brightness-90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition">
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaHref && (
        <button onClick={onCtaClick} className="bg-accent hover:brightness-90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition">
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
