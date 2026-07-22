// 18+ age siloing.
//
// LIVE as of the "no new user data yet" safety pass — gating now runs on
// profiles.is_minor alone, which is already collected (self-attested DOB) at
// signup. It does NOT require profiles.age_verified, because that field will
// never be true until a real ID-verification system is built (deliberately
// deferred — see PROGRESS.md). Once that system exists, age_verified can be
// layered in as a *stronger* requirement for a future higher tier (e.g. a
// 21+-only event category), without changing this baseline behavior.
//
// This is enforced in two places, not just here:
//   - Client-side: this function, used to filter what's shown in feed/events.
//   - Database-level (the actual security boundary): RLS policies on
//     event_attendees (join/RSVP) and dm_threads/dm_messages (minors can't
//     open or message into a DM thread with a non-minor), migration
//     "enforce_age_gating_server_side". Client filtering alone was
//     previously the only protection, which is not real security — someone
//     could join an 18+ event or DM an adult via a direct API call even
//     though the feed hid it from them.
export const AGE_GATING_ENABLED = true

export function canSeeAgeRestricted(
  profile: { age_verified?: boolean | null; is_minor?: boolean | null } | null
): boolean {
  if (!AGE_GATING_ENABLED) return true
  if (!profile) return false
  return !profile.is_minor
}
