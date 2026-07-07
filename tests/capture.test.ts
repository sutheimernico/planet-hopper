import { describe, expect, it } from 'vitest'
import { CAPTURE_FACTOR } from '../src/core/constants'
import { vec } from '../src/core/vec'
import { captureRadius, findCapture } from '../src/physics/capture'
import type { Planet } from '../src/world/types'

const planet = (id: number, x: number, radius = 5): Planet => ({
  id, pos: vec(x, 0), radius, mass: radius * radius, paletteIndex: 0, hasRing: false,
})

describe('capture', () => {
  it('captureRadius scales with planet radius', () => {
    expect(captureRadius(planet(1, 0, 4))).toBeCloseTo(4 * CAPTURE_FACTOR)
  })
  it('finds the planet whose capture zone contains the point', () => {
    const p = findCapture(vec(8, 0), [planet(1, 0), planet(2, 100)], null)
    expect(p?.id).toBe(1)
  })
  it('ignores the launch planet', () => {
    expect(findCapture(vec(8, 0), [planet(1, 0)], 1)).toBeNull()
  })
  it('returns null in open space', () => {
    expect(findCapture(vec(50, 0), [planet(1, 0), planet(2, 100)], null)).toBeNull()
  })
})
