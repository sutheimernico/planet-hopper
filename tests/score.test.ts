import { describe, expect, it } from 'vitest'
import {
  CRYSTAL_POINTS, DIST_POINTS_PER_WU, FLYBY_POINTS, MULT_DECAY_SECONDS, MULT_MAX, MULT_STEP,
} from '../src/core/constants'
import { initialScore, onCrystal, onFlyby, tickScore } from '../src/core/score'

describe('score', () => {
  it('accrues distance points only for new max x', () => {
    let s = initialScore()
    s = tickScore(s, 100, 1 / 120)
    const after = s.points
    s = tickScore(s, 50, 1 / 120) // flying backwards adds nothing
    expect(s.points).toBe(after)
    expect(s.maxX).toBe(100)
  })
  it('distance points scale with the active multiplier', () => {
    let s = onFlyby(initialScore()) // mult = 1 + MULT_STEP, decay timer running
    const before = s.points
    s = tickScore(s, 100, 1 / 120)
    expect(s.points).toBe(before + 100 * DIST_POINTS_PER_WU * (1 + MULT_STEP))
  })
  it('crystal adds points times multiplier', () => {
    let s = { ...initialScore(), mult: 2 }
    s = onCrystal(s)
    expect(s.points).toBe(CRYSTAL_POINTS * 2)
    expect(s.crystals).toBe(1)
  })
  it('flyby raises multiplier, caps at MULT_MAX, awards points', () => {
    let s = initialScore()
    s = onFlyby(s)
    expect(s.mult).toBe(1 + MULT_STEP)
    expect(s.points).toBe(FLYBY_POINTS * (1 + MULT_STEP))
    for (let i = 0; i < 20; i++) s = onFlyby(s)
    expect(s.mult).toBe(MULT_MAX)
  })
  it('multiplier decays back to 1 after MULT_DECAY_SECONDS', () => {
    let s = onFlyby(initialScore())
    s = tickScore(s, 0, MULT_DECAY_SECONDS + 0.01)
    expect(s.mult).toBe(1)
  })
})
