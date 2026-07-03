// 18+ age siloing.
//
// SCAFFOLD ONLY right now — nothing is verified and nothing is hidden. The data
// model, the "role", the badge, and the gating logic are all in place so this can
// be switched on the moment a real verification system exists.
//
// TO ACTIVATE (the "flip of a switch"):
//   1. Build/connect the verification flow that sets profiles.age_verified = true.
//   2. Set AGE_GATING_ENABLED = true below.
//   3. (For a hard guardrail) add an RLS policy so age_restricted events are only
//      selectable by verified adults — client filtering alone is not security.
// Once on: users without profiles.age_verified (and all minors) stop seeing and
// joining events flagged events.age_restricted.
export const AGE_GATING_ENABLED = false

// The "role" that grants access to 18+ events. Set true by the future
// verification system; defaults to false for everyone until then.
export function canSeeAgeRestricted(
  profile: { age_verified?: boolean | null; is_minor?: boolean | null } | null
): boolean {
  if (!AGE_GATING_ENABLED) return true // scaffold: everyone can see 18+ events for now
  if (!profile) return false
  if (profile.is_minor) return false
  return !!profile.age_verified
}
