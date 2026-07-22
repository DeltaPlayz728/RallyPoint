import { describe, it, expect } from 'vitest'
import { moderateContent, moderateEvent } from './contentModeration'

describe('moderateContent', () => {
  it('allows ordinary text', () => {
    expect(moderateContent('Anyone up for bowling Friday night?')).toEqual({ allowed: true })
  })

  it('blocks outright terms tied to minors', () => {
    const result = moderateContent('looking for a 14 year old to hang out')
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.action).toBe('block')
  })

  it('holds flagged terms for review rather than blocking outright', () => {
    const result = moderateContent('dm me on telegram me for details')
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.action).toBe('hold')
  })

  it('is case-insensitive', () => {
    const result = moderateContent('WEED for sale')
    expect(result.allowed).toBe(false)
  })
})

describe('moderateEvent', () => {
  it('checks title and description together', () => {
    const result = moderateEvent('Chill hangout', 'bring your own weed')
    expect(result.allowed).toBe(false)
  })

  it('allows a clean event', () => {
    expect(moderateEvent('Board game night', 'BYO snacks, all welcome')).toEqual({ allowed: true })
  })
})
