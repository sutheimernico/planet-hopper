import { CAPTURE_FACTOR } from '../core/constants'
import { dist, type Vec } from '../core/vec'
import type { Planet } from '../world/types'

export const captureRadius = (planet: Planet): number => planet.radius * CAPTURE_FACTOR

// ignorePlanetId: the planet we just launched from — ignored until the ship has
// left its capture zone once (the sim clears the flag), preventing instant recapture.
export function findCapture(
  pos: Vec,
  planets: readonly Planet[],
  ignorePlanetId: number | null,
): Planet | null {
  for (const p of planets) {
    if (p.id === ignorePlanetId) continue
    if (dist(pos, p.pos) <= captureRadius(p)) return p
  }
  return null
}
