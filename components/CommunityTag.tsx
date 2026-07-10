import type { CommunityTag as CommunityTagData } from '@/lib/communityTags'

/**
 * The small Discord-style tag shown beside a user's name to represent the
 * one community they've chosen to "wear" (profiles.primary_community_id).
 * Renders nothing if the user has no tag set — callers can render this
 * unconditionally.
 */
export default function CommunityTag({ tag }: { tag: CommunityTagData | null | undefined }) {
  if (!tag) return null

  return (
    <span
      title={tag.name}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: tag.banner_color }}
    >
      {tag.icon_url ? (
        <img src={tag.icon_url} alt="" className="w-3 h-3 rounded-full object-cover" />
      ) : (
        <span className="w-3 h-3 rounded-full bg-white/30 flex items-center justify-center text-[8px]">
          {tag.name.charAt(0).toUpperCase()}
        </span>
      )}
      {tag.name}
    </span>
  )
}
