// Tiny helper so a logged-out visitor who lands on a shared event link
// (/e/[id]) and then logs in or signs up gets sent back to that event
// instead of the default /feed. sessionStorage (not query params) so we
// don't have to thread a `redirect` param through the whole signup →
// onboarding chain (profile setup, interests, vibe, welcome) — we only
// need to check it once, at the very end of each auth flow.

const KEY = 'rp_post_auth_redirect'

export function setPendingRedirect(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // sessionStorage unavailable (e.g. private mode edge cases) — fine, just skip
  }
}

export function consumePendingRedirect(fallback = '/feed'): string {
  try {
    const value = sessionStorage.getItem(KEY)
    if (value) {
      sessionStorage.removeItem(KEY)
      return value
    }
  } catch {
    // ignore
  }
  return fallback
}
