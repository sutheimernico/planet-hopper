import { describe, expect, it } from 'vitest'
import { vec } from '../src/core/vec'
import { accelerationAt, type GravityBody } from '../src/physics/gravity'

const body = (x: number, y: number, mass = 100, radius = 5): GravityBody => ({
  pos: vec(x, y),
  mass,
  radius,
})

describe('accelerationAt', () => {
  it('pulls toward a single body', () => {
    const a = accelerationAt(vec(0, 0), [body(10, 0)], 100, 3)
    expect(a.x).toBeGreaterThan(0)
    expect(a.y).toBeCloseTo(0)
  })
  it('magnitude follows inverse-square', () => {
    const near = accelerationAt(vec(0, 0), [body(10, 0)], 100, 3)
    const far = accelerationAt(vec(0, 0), [body(20, 0)], 100, 3)
    expect(near.x / far.x).toBeCloseTo(4, 5)
  })
  it('clamps below body radius (no singularity)', () => {
    const inside = accelerationAt(vec(9, 0), [body(10, 0, 100, 5)], 100, 3)
    const atRadius = accelerationAt(vec(5, 0), [body(10, 0, 100, 5)], 100, 3)
    expect(Math.abs(inside.x)).toBeLessThanOrEqual(Math.abs(atRadius.x) + 1e-9)
  })
  it('uses only the k nearest bodies', () => {
    const bodies = [body(10, 0), body(-10, 0), body(0, 10), body(0, -1000, 1e9)]
    const a = accelerationAt(vec(0, 0), bodies, 100, 3)
    // the huge far body is excluded by k=3, so pull is NOT dominated by -y
    expect(a.y).toBeGreaterThan(-1)
  })
})
