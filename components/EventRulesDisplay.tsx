import { Cake, Wine, Shirt, Camera, RefreshCcw, HeartHandshake, ShieldCheck } from 'lucide-react'

const CATEGORY_ICON: Record<string, typeof Cake> = {
  age: Cake,
  byob: Wine,
  dress_code: Shirt,
  photography: Camera,
  refund: RefreshCcw,
  behavior: HeartHandshake,
}

export type DisplayRule = {
  id: string
  text: string
  category?: string | null
}

// Read-only rule chips — replaces the "paragraph nobody reads" with the
// icon-row pattern from the event detail redesign (Master Plan §10). Shared
// between the full /events/[id] page and the public /e/[id] teaser, since
// rules carry no sensitive info (unlike the exact address).
export default function EventRulesDisplay({ rules }: { rules: DisplayRule[] }) {
  if (rules.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {rules.map(rule => {
        const Icon = (rule.category && CATEGORY_ICON[rule.category]) || ShieldCheck
        return (
          <span
            key={rule.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#221c16] text-gray-600 dark:text-gray-400"
          >
            <Icon size={12} className="shrink-0" /> {rule.text}
          </span>
        )
      })}
    </div>
  )
}
