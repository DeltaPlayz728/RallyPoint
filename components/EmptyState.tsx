'use client'

import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'

// Shared warm empty-state: illustration (icon-in-a-soft-accent-circle rather than
// a plain gray placeholder) + one-line explanation + a single primary CTA.
// Pattern lifted straight from the UI/UX panel's Monzo/Headspace/Shopify-Polaris
// findings — every real empty state in the app should route through this instead
// of a bare "Nothing here yet" line with no visual warmth or next step.
export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
  onCtaClick?: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <Icon size={28} className="text-accent" />
      </div>
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
