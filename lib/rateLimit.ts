/**
 * In-memory rate limiter (no Redis needed for MVP)
 * Resets on server restart — good enough for early launch.
 * Swap for Upstash Redis rate limiter before scaling.
 */

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * Returns true if the request should be blocked (limit exceeded).
 * key should be something like `ip:route` or `userId:route`.
 */
export function isRateLimited(key: string, options: RateLimitOptions): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return false
  }

  entry.count++
  if (entry.count > options.limit) return true

  return false
}

/** Returns remaining requests in the current window (for headers) */
export function getRemainingRequests(key: string, limit: number): number {
  const entry = store.get(key)
  if (!entry) return limit
  return Math.max(0, limit - entry.count)
}
