import { describe, it, expect } from 'vitest'
import { canSeeAgeRestricted, AGE_GATING_ENABLED } from './ageGating'

describe('ageGating', () => {
  it('is enabled — this app enforces 18+ gating server-side too (see the RLS', () => {
    expect(AGE_GATING_ENABLED).toBe(true)
  })

  it('blocks minors from age-restricted content', () => {
    expect(canSeeAgeRestricted({ is_minor: true })).toBe(false)
  })

  it('allows non-minors regardless of age_verified (verification not built yet)', () => {
    expect(canSeeAgeRestricted({ is_minor: false })).toBe(true)
    expect(canSeeAgeRestricted({ is_minor: false, age_verified: false })).toBe(true)
  })

  it('blocks when there is no profile at all', () => {
    expect(canSeeAgeRestricted(null)).toBe(false)
  })
})
