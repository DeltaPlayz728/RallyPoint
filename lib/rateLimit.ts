/**
 * Rate limiter — durable when Upstash is configured, in-memory otherwise.
 *
 * The original in-memory-only version reset on every server restart/cold
 * start and, worse, kept a *separate* counter per serverless instance, so
 * under real traffic (multiple Vercel instances) the effective limit was
 * never actually enforced — a live brutal-QA pass on 2026-07-22 confirmed
 * the 429 fires correctly on one instance, but a redeploy or a request
 * routed to a different instance resets that instance's count to zero.
 *
 * Fix: when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, use
 * Upstash's plain HTTP REST API directly (INCR + EXPIRE NX in one pipeline
 * call) so the counter is shared and durable across every instance and
 * across restarts. No SDK dependency — just fetch, so it works in any
 * runtime (Node or Edge) without adding packages.
 *
 * Falls back to the original in-memory Map when Upstash isn't configured
 * (local dev) or if a call to Upstash fails (fail open on that one check
 * rather than 500ing every request — an outage in the rate limiter should
 * not take down the whole app).
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

function isUpstashConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN)
}

/** INCR the key and set its expiry (only if it doesn't already have one) in a single round-trip. */
async function upstashIncr(key: string, windowMs: number): Promise<number> {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, ttlSeconds, 'NX'],
    ]),
  })
  if (!res.ok) throw new Error(`Upstash request failed: ${res.status}`)
  const data = (await res.json()) as Array<{ result: number }>
  return data[0].result
}

async function upstashGet(key: string): Promise<number> {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Upstash request failed: ${res.status}`)
  const data = (await res.json()) as { result: string | null }
  return data.result ? parseInt(data.result, 10) : 0
}

function isRateLimitedInMemory(key: string, options: RateLimitOptions): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return false
  }

  entry.count++
  return entry.count > options.limit
}

function getRemainingInMemory(key: string, limit: number): number {
  const entry = store.get(key)
  if (!entry) return limit
  return Math.max(0, limit - entry.count)
}

/**
 * Returns true if the request should be blocked (limit exceeded).
 * key should be something like `ip:route` or `userId:route`.
 */
export async function isRateLimited(key: string, options: RateLimitOptions): Promise<boolean> {
  if (isUpstashConfigured()) {
    try {
      const count = await upstashIncr(key, options.windowMs)
      return count > options.limit
    } catch (e) {
      console.error('rateLimit: Upstash request failed, falling back to in-memory for this check:', e)
    }
  }
  return isRateLimitedInMemory(key, options)
}

/** Returns remaining requests in the current window (for headers) */
export async function getRemainingRequests(key: string, limit: number): Promise<number> {
  if (isUpstashConfigured()) {
    try {
      const count = await upstashGet(key)
      return Math.max(0, limit - count)
    } catch (e) {
      console.error('rateLimit: Upstash request failed, falling back to in-memory for this check:', e)
    }
  }
  return getRemainingInMemory(key, limit)
}
