import { describe, expect, it } from 'vitest'
import { dragToAim } from '../src/input/aim'

describe('dragToAim', () => {
  it('slingshot style: aim direction is opposite the drag', () => {
    // drag right+down on screen → aim left+up in world (screen y is inverted vs world y)
    const a = dragToAim({ x: 0, y: 0 }, { x: 100, y: 50 }, 200)
    expect(a.dir.x).toBeLessThan(0)
    expect(a.dir.y).toBeGreaterThan(0)
  })
  it('power scales with drag length and clamps at 1', () => {
    expect(dragToAim({ x: 0, y: 0 }, { x: 100, y: 0 }, 200).power01).toBeCloseTo(0.5)
    expect(dragToAim({ x: 0, y: 0 }, { x: 999, y: 0 }, 200).power01).toBe(1)
  })
  it('zero drag gives zero power', () => {
    expect(dragToAim({ x: 5, y: 5 }, { x: 5, y: 5 }, 200).power01).toBe(0)
  })
})
