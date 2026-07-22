'use client'

import { Reply, Copy, Check } from 'lucide-react'
import { useState } from 'react'

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉']

// Discord/Slack-style hover action toolbar — sits at the trailing edge of a
// message row and only appears on hover (parent must have `group` on it).
// Kept deliberately small: 4 quick-react emoji + reply + copy. No "more" menu
// yet — add one here later if edit/delete/pin get built.
export default function HoverActions({
  isMe,
  onReact,
  onReply,
  content,
}: {
  isMe: boolean
  onReact: (emoji: string) => void
  onReply: () => void
  content: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard permission denied — silently skip */ }
  }

  return (
    <div
      className={`absolute top-0 ${isMe ? 'left-0 -translate-x-[calc(100%+6px)]' : 'right-0 translate-x-[calc(100%+6px)]'}
        flex items-center gap-0.5 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-full
        px-1 py-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto`}
    >
      {QUICK_EMOJI.map((e) => (
        <button
          key={e}
          onClick={() => onReact(e)}
          className="w-6 h-6 flex items-center justify-center text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={`React ${e}`}
        >
          {e}
        </button>
      ))}
      <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
      <button
        onClick={onReply}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
        title="Reply"
      >
        <Reply size={13} />
      </button>
      <button
        onClick={copy}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
        title="Copy"
      >
        {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
      </button>
    </div>
  )
}
