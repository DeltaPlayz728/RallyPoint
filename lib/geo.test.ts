import { describe, it, expect } from 'vitest'
import { haversineKm, boundingBox } from './geo'

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(52.37, 4.89, 52.37, 4.89)).toBeCloseTo(0, 5)
  })

  it('matches the known Amsterdam-Haarlem distance (~18km)', () => {
    const dist = haversineKm(52.3676, 4.9041, 52.3874, 4.6462)
    expect(dist).toBeGreaterThan(15)
    expect(dist).toBeLessThan(22)
  })
})

describe('boundingBox', () => {
  it('produces a box that contains the center point with sane ordering', () => {
    const box = boundingBox(52.37, 4.89, 50)
    expect(box.minLat).toBeLessThan(box.maxLat)
    expect(box.minLng).toBeLessThan(box.maxLng)
    expect(box.minLat).toBeLessThan(52.37)
    expect(box.maxLat).toBeGreaterThan(52.37)
  })

  it('grows with a larger radius', () => {
    const small = boundingBox(52.37, 4.89, 50)
    const large = boundingBox(52.37, 4.89, 200)
    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat)
  })
})
