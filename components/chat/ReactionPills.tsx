'use client'

export type Reaction = { emoji: string; user_id: string }

// Grouped reaction pills under a message bubble — tap a pill to toggle your
// own reaction. Highlighted (accent border/bg) when you're one of the reactors,
// same visual language as Discord/Slack reaction chips.
export default function ReactionPills({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: Reaction[]
  currentUserId: string | null
  onToggle: (emoji: string) => void
}) {
  if (reactions.length === 0) return null

  const grouped = reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.user_id)
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, userIds]) => {
        const mine = currentUserId ? userIds.includes(currentUserId) : false
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`text-xs rounded-full px-2 py-0.5 border transition-colors ${
              mine
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {emoji} {userIds.length}
          </button>
        )
      })}
    </div>
  )
}
