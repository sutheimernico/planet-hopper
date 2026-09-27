// Test-only launch search: sweeps a coarse grid of aim angle × power through the real
// simulateTrajectory (same integrator as the flight) and returns the first launch whose
// path is captured by the target planet without burning up or dying in the void.
import { DT, GENERATE_AHEAD, PRUNE_BEHIND, VOID_DISTANCE, VOID_GRACE } from '../../src/core/constants'
import { dist, type Vec } from '../../src/core/vec'
import { launchVelocity, orbitPosition } from '../../src/physics/orbit'
import { simulateTrajectory } from '../../src/physics/trajectory'
import type { Planet, WorldSnapshot } from '../../src/world/types'

export interface FoundLaunch {
  dir: Vec
  power01: number
}

const DIRECTIONS = 32
const POWERS = [0.5, 0.25, 0.75, 1, 0]
const MAX_STEPS = Math.round(8 / DT)

// true when the sampled path (every step) stays out of the void long enough
function survivesVoid(points: readonly Vec[], planets: readonly Planet[]): boolean {
  let voidTime = 0
  for (const p of points) {
    let nearest = Infinity
    for (const pl of planets) nearest = Math.min(nearest, dist(p, pl.pos))
    voidTime = nearest > VOID_DISTANCE ? voidTime + DT : 0
    if (voidTime >= VOID_GRACE) return false
  }
  return true
}

// Launch from `pos` (the ship's current orbit position around `from`) that ends in
// `target`'s capture zone. Directions are tried nearest-bearing-first for an early exit.
export function findLaunchFrom(
  pos: Vec, world: WorldSnapshot, from: Planet, target: Planet,
): FoundLaunch | null {
  const bearing = Math.atan2(target.pos.y - pos.y, target.pos.x - pos.x)
  for (let i = 0; i < DIRECTIONS; i++) {
    // 0, +1, -1, +2, -2 … steps away from the direct bearing
    const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * ((2 * Math.PI) / DIRECTIONS)
    const dir = { x: Math.cos(bearing + offset), y: Math.sin(bearing + offset) }
    for (const power01 of POWERS) {
      const t = simulateTrajectory(
        { pos, vel: launchVelocity(dir, power01) }, world, from.id, MAX_STEPS, 1,
      )
      if (t.capturedBy === target.id && survivesVoid(t.points, world.planets)) {
        return { dir, power01 }
      }
    }
  }
  return null
}

const ORBIT_ANGLES = 12

// The slice of an endless world the live game holds while the ship is at `from` →
// `target`: pruned PRUNE_BEHIND behind, generated GENERATE_AHEAD ahead (run-driver.ts).
export function liveWindow(world: WorldSnapshot, from: Planet, target: Planet): WorldSnapshot {
  const inside = (e: { pos: Vec }): boolean =>
    e.pos.x >= from.pos.x - PRUNE_BEHIND && e.pos.x <= target.pos.x + GENERATE_AHEAD
  return {
    planets: world.planets.filter(inside),
    crystals: [],
    suns: world.suns.filter(inside),
  }
}

// Reachable if SOME orbit position (the player can wait) admits a capturing launch.
// Orbit positions are tried facing-the-target first, then alternating outward.
export function isReachable(fullWorld: WorldSnapshot, from: Planet, target: Planet): boolean {
  const world = liveWindow(fullWorld, from, target)
  const facing = Math.atan2(target.pos.y - from.pos.y, target.pos.x - from.pos.x)
  for (let i = 0; i < ORBIT_ANGLES; i++) {
    const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * ((2 * Math.PI) / ORBIT_ANGLES)
    const pos = orbitPosition(from, { planetId: from.id, angle: facing + offset, dir: 1 })
    if (findLaunchFrom(pos, world, from, target)) return true
  }
  return false
}
