import { describe, expect, it } from 'vitest'
import { DT, GRAVITY, K_NEAREST } from '../src/core/constants'
import { vec } from '../src/core/vec'
import { accelerationAt } from '../src/physics/gravity'
import { stepSemiImplicit, type Kinematic } from '../src/physics/integrator'
import { simulateTrajectory } from '../src/physics/trajectory'
import type { WorldSnapshot } from '../src/world/types'

const world: WorldSnapshot = {
  planets: [
    { id: 1, pos: vec(0, 0), radius: 5, mass: 25, paletteIndex: 0, hasRing: false },
    { id: 2, pos: vec(80, 10), radius: 5, mass: 25, paletteIndex: 1, hasRing: false },
  ],
  crystals: [],
  suns: [],
}

describe('simulateTrajectory', () => {
  it('is deterministic', () => {
    const start: Kinematic = { pos: vec(0, 12), vel: vec(30, 5) }
    const a = simulateTrajectory(start, world, 1, 360, 1)
    const b = simulateTrajectory(start, world, 1, 360, 1)
    expect(a).toEqual(b)
  })
  it('matches a manual step-by-step flight exactly (preview = flight)', () => {
    let k: Kinematic = { pos: vec(0, 12), vel: vec(30, 5) }
    const manual = []
    for (let i = 0; i < 50; i++) {
      const bodies = [...world.planets, ...world.suns]
      k = stepSemiImplicit(k, accelerationAt(k.pos, bodies, GRAVITY, K_NEAREST), DT)
      manual.push(k.pos)
    }
    const t = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 50, 1)
    expect(t.points).toEqual(manual)
  })
  it('reports capture and stops there', () => {
    // aimed straight at planet 2 with enough speed
    const t = simulateTrajectory({ pos: vec(20, 10), vel: vec(50, 0) }, world, 1, 2000, 1)
    expect(t.outcome).toBe('captured')
    expect(t.capturedBy).toBe(2)
  })
  it('reports sun burn-up and stops there', () => {
    const w: WorldSnapshot = { ...world, suns: [{ id: 9, pos: vec(40, 11), radius: 6, mass: 80 }] }
    const t = simulateTrajectory({ pos: vec(20, 10), vel: vec(50, 0) }, w, 1, 2000, 1)
    expect(t.outcome).toBe('sun')
    expect(t.capturedBy).toBeNull()
  })
  it('samples every nth point', () => {
    const full = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 40, 1)
    const sampled = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 40, 4)
    expect(sampled.points.length).toBeLessThan(full.points.length)
  })
})
