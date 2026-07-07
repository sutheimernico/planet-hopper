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
})
