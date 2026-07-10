import { supabase } from '@/lib/supabase'

export type CommunityTag = { name: string; banner_color: string; icon_url: string | null }

/**
 * Batch-fetches the "community tag" (Discord-style banner-next-to-your-name)
 * for a set of user ids, keyed by user id. Users with no primary_community_id
 * set are simply absent from the returned map. Kept as a standalone lookup
 * rather than threading a nested embed into every existing attendee/message
 * query, so this feature can't accidentally break those queries.
 */
export async function getCommunityTags(userIds: string[]): Promise<Record<string, CommunityTag>> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean)
  if (uniqueIds.length === 0) return {}

  const { data } = await supabase
    .from('profiles')
    .select('id, communities!primary_community_id(name, banner_color, icon_url)')
    .in('id', uniqueIds)
    .not('primary_community_id', 'is', null)

  const map: Record<string, CommunityTag> = {}
  for (const row of data ?? []) {
    const community = (row as any).communities
    if (community) map[(row as any).id] = community
  }
  return map
}
