import * as C from '../core/constants'
import { mulberry32, range } from '../core/rng'
import type { Crystal, Planet, Sun, WorldSnapshot } from './types'

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export interface World {
  ensureUntil(x: number): void
  prune(behindX: number): void
  snapshot(): WorldSnapshot
}

// Sequential append-only stream: the rng is consumed in a fixed order, so any
// ensureUntil call pattern yields the identical world for a given seed.
export function createWorld(seed: number): World {
  const rng = mulberry32(seed)
  const planets: Planet[] = []
  const crystals: Crystal[] = []
  const suns: Sun[] = []
  let nextId = 1
  let planetCount = 0

  const addPlanet = (): void => {
    const prev = planets.length > 0 ? planets[planets.length - 1]! : null
    const ramp = clamp01((prev?.pos.x ?? 0) / C.RAMP_DISTANCE)
    const gentle = planetCount < C.GENTLE_PLANETS ? C.GENTLE_SPACING_SCALE : 1
    const spacing = lerp(C.SPACING_MIN, C.SPACING_MAX, ramp) * gentle * range(rng, 0.85, 1.15)
    const x = prev ? prev.pos.x + spacing : 0
    const y = prev
      ? Math.max(
          -C.CORRIDOR_HALF_WIDTH,
          Math.min(C.CORRIDOR_HALF_WIDTH, prev.pos.y + range(rng, -0.6, 0.6) * C.CORRIDOR_HALF_WIDTH),
        )
      : 0
    const radius = range(rng, C.PLANET_RADIUS_MIN, C.PLANET_RADIUS_MAX)
    planets.push({
      id: nextId++,
      pos: { x, y },
      radius,
      mass: radius * radius * C.PLANET_MASS_FACTOR,
      paletteIndex: Math.floor(rng() * 6),
      hasRing: rng() < 0.25,
    })
    planetCount++
    if (!prev) return

    const crystalCount = Math.round(lerp(C.CRYSTALS_PER_GAP_START, C.CRYSTALS_PER_GAP_END, ramp))
    for (let i = 0; i < crystalCount; i++) {
      const t = (i + 1) / (crystalCount + 1)
      crystals.push({
        id: nextId++,
        pos: { x: lerp(prev.pos.x, x, t), y: lerp(prev.pos.y, y, t) + range(rng, -12, 12) },
        collected: false,
      })
    }
    // Suns only after the gentle start; probability ramps with distance.
    const sunRoll = rng() // always consumed → call-pattern-independent determinism
    if (planetCount > 8 && sunRoll < C.SUN_PROBABILITY_MAX * ramp) {
      const side = rng() < 0.5 ? -1 : 1
      suns.push({
        id: nextId++,
        pos: {
          x: (prev.pos.x + x) / 2,
          y: (prev.pos.y + y) / 2 + side * range(rng, 22, 34),
        },
        radius: C.SUN_RADIUS,
        mass: C.SUN_MASS,
      })
    }
  }

  return {
    ensureUntil(x: number): void {
      while ((planets.length > 0 ? planets[planets.length - 1]!.pos.x : -Infinity) < x) addPlanet()
    },
    prune(behindX: number): void {
      // entities are appended in ascending x (see addPlanet), so once the front element
      // clears the cutoff, nothing in the array is behind it — skip the allocating
      // filter/splice entirely (review finding, Task 19 review #6)
      const dropBehind = <T extends { pos: { x: number } }>(arr: T[]): void => {
        if (arr.length === 0 || arr[0]!.pos.x >= behindX) return
        const kept = arr.filter((e) => e.pos.x >= behindX)
        arr.splice(0, arr.length, ...kept)
      }
      dropBehind(planets)
      dropBehind(crystals)
      dropBehind(suns)
    },
    snapshot: (): WorldSnapshot => ({ planets, crystals, suns }),
  }
}
