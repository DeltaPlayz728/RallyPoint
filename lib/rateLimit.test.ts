import { describe, it, expect } from 'vitest'
import { isRateLimited, getRemainingRequests } from './rateLimit'

// No UPSTASH_REDIS_REST_URL/TOKEN set in the test environment, so these
// exercise the in-memory fallback path — same behavior the tests always
// verified, now through the async isRateLimited/getRemainingRequests API.

describe('isRateLimited', () => {
  it('allows requests up to the limit, then blocks', async () => {
    const key = `test:${Math.random()}`
    const opts = { limit: 3, windowMs: 60_000 }
    expect(await isRateLimited(key, opts)).toBe(false) // 1st
    expect(await isRateLimited(key, opts)).toBe(false) // 2nd
    expect(await isRateLimited(key, opts)).toBe(false) // 3rd
    expect(await isRateLimited(key, opts)).toBe(true)  // 4th — over limit
  })

  it('tracks separate keys independently', async () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const keyA = `test:a:${Math.random()}`
    const keyB = `test:b:${Math.random()}`
    expect(await isRateLimited(keyA, opts)).toBe(false)
    expect(await isRateLimited(keyB, opts)).toBe(false)
    expect(await isRateLimited(keyA, opts)).toBe(true)
  })
})

describe('getRemainingRequests', () => {
  it('counts down from the limit', async () => {
    const key = `test:remaining:${Math.random()}`
    const opts = { limit: 5, windowMs: 60_000 }
    expect(await getRemainingRequests(key, opts.limit)).toBe(5)
    await isRateLimited(key, opts)
    expect(await getRemainingRequests(key, opts.limit)).toBe(4)
  })
})
