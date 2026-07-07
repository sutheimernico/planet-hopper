import { describe, expect, it } from 'vitest'
import { vec } from '../src/core/vec'
import { stepSemiImplicit, type Kinematic } from '../src/physics/integrator'

describe('stepSemiImplicit', () => {
  it('moves in a straight line without acceleration', () => {
    let k: Kinematic = { pos: vec(0, 0), vel: vec(10, 0) }
    for (let i = 0; i < 120; i++) k = stepSemiImplicit(k, vec(0, 0), 1 / 120)
    expect(k.pos.x).toBeCloseTo(10, 5)
    expect(k.pos.y).toBeCloseTo(0, 5)
  })
  it('updates velocity before position (semi-implicit)', () => {
    const k = stepSemiImplicit({ pos: vec(0, 0), vel: vec(0, 0) }, vec(1, 0), 1)
    // explicit Euler would give pos.x = 0; semi-implicit gives dt * (v + a*dt) = 1
    expect(k.pos.x).toBe(1)
    expect(k.vel.x).toBe(1)
  })
  it('does not mutate its input', () => {
    const input: Kinematic = { pos: vec(1, 2), vel: vec(3, 4) }
    stepSemiImplicit(input, vec(5, 5), 1 / 120)
    expect(input).toEqual({ pos: vec(1, 2), vel: vec(3, 4) })
  })
  it('keeps a circular orbit bounded over many steps (symplectic stability)', () => {
    // central body at origin; circular orbit at r=20 requires v = sqrt(mu / r)
    const mu = 280 * 25 // GRAVITY * mass, matching game scale
    const r0 = 20
    const v0 = Math.sqrt(mu / r0)
    let k: Kinematic = { pos: vec(r0, 0), vel: vec(0, v0) }
    for (let i = 0; i < 3600; i++) {
      const d = Math.hypot(k.pos.x, k.pos.y)
      const a = { x: (-k.pos.x / d) * (mu / (d * d)), y: (-k.pos.y / d) * (mu / (d * d)) }
      k = stepSemiImplicit(k, a, 1 / 120)
    }
    const r = Math.hypot(k.pos.x, k.pos.y)
    expect(r).toBeGreaterThan(r0 * 0.95)
    expect(r).toBeLessThan(r0 * 1.05)
  })
})
