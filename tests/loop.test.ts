import { describe, expect, it } from 'vitest'
import { DT, MAX_STEPS_PER_FRAME } from '../src/core/constants'
import { createAccumulator } from '../src/core/loop'

describe('createAccumulator', () => {
  it('emits one step per DT of elapsed time', () => {
    const acc = createAccumulator()
    expect(acc.advance(DT * 3)).toBe(3)
  })
  it('accumulates fractional frames', () => {
    const acc = createAccumulator()
    expect(acc.advance(DT * 0.6)).toBe(0)
    expect(acc.advance(DT * 0.6)).toBe(1)
  })
  it('clamps huge frames (tab was in background)', () => {
    const acc = createAccumulator()
    expect(acc.advance(10)).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME)
  })
  it('alpha stays in [0, 1)', () => {
    const acc = createAccumulator()
    acc.advance(DT * 1.5)
    expect(acc.alpha()).toBeGreaterThanOrEqual(0)
    expect(acc.alpha()).toBeLessThan(1)
  })
})
