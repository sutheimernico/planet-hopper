import { DT, GRAVITY, K_NEAREST } from '../core/constants'
import { dist, type Vec } from '../core/vec'
import type { WorldSnapshot } from '../world/types'
import { findCapture } from './capture'
import { accelerationAt, type GravityBody } from './gravity'
import { stepSemiImplicit, type Kinematic } from './integrator'

export interface TrajectoryResult {
  points: Vec[]
  outcome: 'flying' | 'captured' | 'sun'
  capturedBy: number | null
}

// Runs the EXACT same stepping as the live sim (accelerationAt + stepSemiImplicit at DT).
// This is the spec's "no fake preview" guarantee — any change here must mirror sim.ts.
export function simulateTrajectory(
  start: Kinematic,
  world: WorldSnapshot,
  ignorePlanetId: number | null,
  steps: number,
  sampleEvery: number,
): TrajectoryResult {
  const bodies: GravityBody[] = [...world.planets, ...world.suns]
  let k = start
  let ignore = ignorePlanetId
  const points: Vec[] = []

  for (let i = 0; i < steps; i++) {
    k = stepSemiImplicit(k, accelerationAt(k.pos, bodies, GRAVITY, K_NEAREST), DT)
    if (i % sampleEvery === 0) points.push(k.pos)

    // once clear of the launch planet's capture zone, it becomes capturable again
    if (ignore !== null) {
      const launchPlanet = world.planets.find((p) => p.id === ignore)
      if (!launchPlanet || findCapture(k.pos, [launchPlanet], null) === null) ignore = null
    }
    for (const s of world.suns) {
      if (dist(k.pos, s.pos) <= s.radius) return { points, outcome: 'sun', capturedBy: null }
    }
    const captured = findCapture(k.pos, world.planets, ignore)
    if (captured) return { points, outcome: 'captured', capturedBy: captured.id }
  }
  return { points, outcome: 'flying', capturedBy: null }
}
