import { describe, it, expect } from 'vitest'
import { isRateLimited, getRemainingRequests } from './rateLimit'

describe('isRateLimited', () => {
  it('allows requests up to the limit, then blocks', () => {
    const key = `test:${Math.random()}`
    const opts = { limit: 3, windowMs: 60_000 }
    expect(isRateLimited(key, opts)).toBe(false) // 1st
    expect(isRateLimited(key, opts)).toBe(false) // 2nd
    expect(isRateLimited(key, opts)).toBe(false) // 3rd
    expect(isRateLimited(key, opts)).toBe(true)  // 4th — over limit
  })

  it('tracks separate keys independently', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const keyA = `test:a:${Math.random()}`
    const keyB = `test:b:${Math.random()}`
    expect(isRateLimited(keyA, opts)).toBe(false)
    expect(isRateLimited(keyB, opts)).toBe(false)
    expect(isRateLimited(keyA, opts)).toBe(true)
  })
})

describe('getRemainingRequests', () => {
  it('counts down from the limit', () => {
    const key = `test:remaining:${Math.random()}`
    const opts = { limit: 5, windowMs: 60_000 }
    expect(getRemainingRequests(key, opts.limit)).toBe(5)
    isRateLimited(key, opts)
    expect(getRemainingRequests(key, opts.limit)).toBe(4)
  })
})
