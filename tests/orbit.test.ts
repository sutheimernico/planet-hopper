import { describe, expect, it } from 'vitest'
import { ORBIT_FACTOR, ORBIT_SPEED, POWER_MAX, POWER_MIN } from '../src/core/constants'
import { dist, len, vec } from '../src/core/vec'
import {
  advanceOrbit,
  enterOrbit,
  launchCost,
  launchVelocity,
  orbitPosition,
  type OrbitState,
} from '../src/physics/orbit'
import type { Planet } from '../src/world/types'

const planet: Planet = {
  id: 1, pos: vec(100, 50), radius: 5, mass: 25, paletteIndex: 0, hasRing: false,
}

describe('orbit', () => {
  it('orbitPosition sits at orbit radius', () => {
    const o: OrbitState = { planetId: 1, angle: 0, dir: 1 }
    expect(dist(orbitPosition(planet, o), planet.pos)).toBeCloseTo(planet.radius * ORBIT_FACTOR)
  })
  it('advanceOrbit rotates by ORBIT_SPEED * dt in dir', () => {
    const o = advanceOrbit({ planetId: 1, angle: 0, dir: -1 }, 0.5)
    expect(o.angle).toBeCloseTo(-ORBIT_SPEED * 0.5)
  })
  it('launchVelocity maps power01 into [POWER_MIN, POWER_MAX]', () => {
    expect(len(launchVelocity(vec(1, 0), 0))).toBeCloseTo(POWER_MIN)
    expect(len(launchVelocity(vec(0, 2), 1))).toBeCloseTo(POWER_MAX)
  })
  it('launchCost grows with power', () => {
    expect(launchCost(1)).toBeGreaterThan(launchCost(0))
  })
  it('enterOrbit picks angle toward the ship and dir from velocity orientation', () => {
    const o = enterOrbit(planet, vec(120, 50), vec(0, 10)) // ship right of planet, moving up
    expect(o.angle).toBeCloseTo(0) // atan2(0, 20)
    expect(o.dir).toBe(1) // counter-clockwise
    expect(o.planetId).toBe(1)
  })
  it('enterOrbit picks clockwise dir for opposite tangential motion', () => {
    const o = enterOrbit(planet, vec(120, 50), vec(0, -10)) // ship right of planet, moving down
    expect(o.dir).toBe(-1)
  })
  it('launchVelocity returns zero velocity for a zero aim direction', () => {
    expect(launchVelocity(vec(0, 0), 1)).toEqual({ x: 0, y: 0 })
  })
})
