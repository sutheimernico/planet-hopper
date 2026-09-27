import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/world/generator'
import type { Planet, WorldSnapshot } from '../src/world/types'
import { isReachable } from './helpers/reach'

const SEEDS = 50
const PLANETS = 40

const planet = (id: number, x: number, y: number): Planet => ({
  id, pos: { x, y }, radius: 5, mass: 25, paletteIndex: 0, hasRing: false,
})

describe('generator reachability (solvability guarantee)', () => {
  it(`every gap between the first ${PLANETS + 1} planets is reachable, over ${SEEDS} seeds`, () => {
    const unreachable: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const w = createWorld(seed)
      w.ensureUntil(6000) // ≥ 41 planets at SPACING_MAX, plus the live generate-ahead window
      const s = w.snapshot()
      expect(s.planets.length).toBeGreaterThan(PLANETS)
      for (let i = 0; i < PLANETS; i++) {
        if (!isReachable(s, s.planets[i]!, s.planets[i + 1]!)) unreachable.push(`seed ${seed} gap ${i}`)
      }
    }
    expect(unreachable).toEqual([])
  }, 30_000)

  // Guard: the check must be able to fail. Doubling the spacing is NOT enough — measured
  // 2026-09-27: 0/200 gaps unreachable at 2× spacing, 20/200 at 3× (max-power shots carry
  // far) — so the guard uses a gap whose midpoint sits deep in the void: 450 wu apart,
  // ≥ 3.4 s beyond VOID_DISTANCE even at POWER_MAX, i.e. past VOID_GRACE.
  it('guard: flags a gap beyond ballistic + void reach, accepts a normal one', () => {
    const world = (gap: number): WorldSnapshot => ({
      planets: [planet(1, 0, 0), planet(2, gap, 0)], crystals: [], suns: [],
    })
    const far = world(450)
    const near = world(100)
    expect(isReachable(far, far.planets[0]!, far.planets[1]!)).toBe(false)
    expect(isReachable(near, near.planets[0]!, near.planets[1]!)).toBe(true)
  }, 30_000)
})
