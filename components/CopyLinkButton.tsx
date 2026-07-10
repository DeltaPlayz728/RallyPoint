'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { mintReferralLink } from '@/lib/referral'

export default function CopyLinkButton({ eventId, className }: { eventId: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Mint a fresh attributed invite link so this share counts toward the
    // sender's referral count (V2 share engine). Falls back to a plain,
    // unattributed link if minting fails for any reason (e.g. offline) so
    // sharing never just breaks.
    const url = (await mintReferralLink({ eventId })) ?? `${window.location.origin}/e/${eventId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable — fall back to a prompt so the link is still gettable
      window.prompt('Copy this link:', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy invite link"
      className={className ?? 'px-4 border border-gray-300 dark:border-gray-700 hover:border-accent text-gray-500 dark:text-gray-400 hover:text-accent rounded-2xl transition text-lg'}
    >
      {copied ? <Check size={18} /> : <Link2 size={18} />}
    </button>
  )
}
