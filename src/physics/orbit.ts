import {
  LAUNCH_COST_BASE,
  LAUNCH_COST_SCALE,
  ORBIT_FACTOR,
  ORBIT_SPEED,
  POWER_MAX,
  POWER_MIN,
} from '../core/constants'
import { cross, norm, scale, sub, type Vec } from '../core/vec'
import type { Planet } from '../world/types'

export interface OrbitState {
  planetId: number
  angle: number // rad, ship position on the orbit circle
  dir: 1 | -1 // 1 = counter-clockwise
}

export const orbitRadius = (planet: Planet): number => planet.radius * ORBIT_FACTOR

export const orbitPosition = (planet: Planet, o: OrbitState): Vec => ({
  x: planet.pos.x + Math.cos(o.angle) * orbitRadius(planet),
  y: planet.pos.y + Math.sin(o.angle) * orbitRadius(planet),
})

export const advanceOrbit = (o: OrbitState, dt: number): OrbitState => ({
  ...o,
  angle: o.angle + o.dir * ORBIT_SPEED * dt,
})

// Launch speed is absolute (not added to orbital velocity) — predictable aiming
// beats physical purity here; the preview shows the truth either way.
// Callers must pass a non-zero aimDir: a zero vector yields zero velocity (would soft-lock a launch).
export const launchVelocity = (aimDir: Vec, power01: number): Vec =>
  scale(norm(aimDir), POWER_MIN + power01 * (POWER_MAX - POWER_MIN))

export const launchCost = (power01: number): number =>
  LAUNCH_COST_BASE + power01 * LAUNCH_COST_SCALE

export function enterOrbit(planet: Planet, shipPos: Vec, shipVel: Vec): OrbitState {
  const radial = sub(shipPos, planet.pos)
  const angle = Math.atan2(radial.y, radial.x)
  // >= 0 tie-break: a purely radial entry has no direction to preserve — default to counter-clockwise.
  const dir: 1 | -1 = cross(radial, shipVel) >= 0 ? 1 : -1
  return { planetId: planet.id, angle, dir }
}
