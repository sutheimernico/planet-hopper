import { describe, expect, it } from 'vitest'
import {
  CORRIDOR_HALF_WIDTH, RAMP_DISTANCE, SPACING_MAX, SPACING_MIN,
} from '../src/core/constants'
import { createWorld } from '../src/world/generator'
import type { WorldSnapshot } from '../src/world/types'

// snapshot() returns live references to the generator's closure arrays and prune mutates
// them in place via splice — comparing two snapshots taken around a prune call compares
// an object to itself and always passes. Copy the ids out as primitives BEFORE pruning
// to pin real before/after behavior (review finding, Task 21).
const idsOf = (s: WorldSnapshot): { planets: number[]; crystals: number[]; suns: number[] } => ({
  planets: s.planets.map((p) => p.id),
  crystals: s.crystals.map((c) => c.id),
  suns: s.suns.map((sun) => sun.id),
})

describe('createWorld', () => {
  it('same seed → identical world', () => {
    const a = createWorld(42)
    const b = createWorld(42)
    a.ensureUntil(1000)
    b.ensureUntil(1000)
    expect(a.snapshot()).toEqual(b.snapshot())
  })
  it('incremental generation matches one-shot generation', () => {
    const a = createWorld(7)
    const b = createWorld(7)
    a.ensureUntil(300)
    a.ensureUntil(1000)
    b.ensureUntil(1000)
    expect(a.snapshot()).toEqual(b.snapshot())
  })
  it('starts with a planet at the origin', () => {
    const w = createWorld(1)
    w.ensureUntil(0)
    expect(w.snapshot().planets[0]?.pos).toEqual({ x: 0, y: 0 })
  })
  it('spacing stays within playable bounds, corridor respected', () => {
    const w = createWorld(3)
    w.ensureUntil(3000)
    const planets = w.snapshot().planets
    for (let i = 1; i < planets.length; i++) {
      const gap = planets[i]!.pos.x - planets[i - 1]!.pos.x
      expect(gap).toBeGreaterThanOrEqual(SPACING_MIN * 0.7 * 0.85 - 1e-9)
      expect(gap).toBeLessThanOrEqual(SPACING_MAX * 1.15 + 1e-9)
      expect(Math.abs(planets[i]!.pos.y)).toBeLessThanOrEqual(CORRIDOR_HALF_WIDTH)
    }
  })
  it('no suns among the first 8 planets (gentle start)', () => {
    const w = createWorld(5)
    w.ensureUntil(3000)
    const { planets, suns } = w.snapshot()
    const eighthX = planets[7]!.pos.x
    for (const s of suns) expect(s.pos.x).toBeGreaterThan(eighthX)
  })
  it('assigns globally unique ids across planets, crystals, and suns', () => {
    const w = createWorld(11)
    w.ensureUntil(2000)
    const { planets, crystals, suns } = w.snapshot()
    const ids = [...planets, ...crystals, ...suns].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('prune drops entities behind x, keeps the rest', () => {
    const w = createWorld(9)
    w.ensureUntil(2000)
    const before = w.snapshot().planets.length
    w.prune(500)
    const after = w.snapshot().planets
    expect(after.length).toBeLessThan(before)
    for (const p of after) expect(p.pos.x).toBeGreaterThanOrEqual(500)
  })
  it('prune is a no-op once nothing is behind the cutoff (allocation-free early exit)', () => {
    const w = createWorld(13)
    w.ensureUntil(2000)
    const before = idsOf(w.snapshot()) // value copy, taken before prune
    expect(before.planets.length).toBeGreaterThan(0) // guard: a wipe must not pass as "equal"
    w.prune(-1000) // first entity sits at x=0 → already clears the cutoff
    expect(idsOf(w.snapshot())).toEqual(before)
  })
  it('prune stays idempotent when called repeatedly with the same cutoff', () => {
    const w = createWorld(21)
    w.ensureUntil(2000)
    // expected survivors, computed as primitives before any prune — catches both
    // over-pruning on the first call and drift on the second
    const s = w.snapshot()
    const expected = {
      planets: s.planets.filter((p) => p.pos.x >= 500).map((p) => p.id),
      crystals: s.crystals.filter((c) => c.pos.x >= 500).map((c) => c.id),
      suns: s.suns.filter((sun) => sun.pos.x >= 500).map((sun) => sun.id),
    }
    expect(expected.planets.length).toBeGreaterThan(0)
    w.prune(500)
    expect(idsOf(w.snapshot())).toEqual(expected)
    w.prune(500) // second call hits the early-exit path — must change nothing
    expect(idsOf(w.snapshot())).toEqual(expected)
  })
  it('difficulty ramp (spacing, crystal density) is monotonic in x over a long horizon (spec §12)', () => {
    const w = createWorld(17)
    w.ensureUntil(RAMP_DISTANCE * 3) // run well past the ramp's saturation point (spec §5)
    // copy out primitives immediately — snapshot() returns the generator's live internal
    // arrays, and asserting against a held reference after further mutation would silently
    // compare an object to itself (same bug class as the Task 21 prune-test fix, 99916ce)
    const xs = w.snapshot().planets.map((p) => p.pos.x)
    const crystalXs = w.snapshot().crystals.map((c) => c.pos.x)
    expect(xs[xs.length - 1]!).toBeGreaterThan(RAMP_DISTANCE) // horizon crosses the ramp

    // Crystal density: count crystals actually generated per gap from the world's real
    // output (not a reimplemented formula) — the count is a deterministic function of
    // ramp alone (jitter only ever touches the y-offset, see generator.ts), so the
    // observed sequence must be exactly non-increasing.
    let prevCount = Infinity
    for (let i = 1; i < xs.length; i++) {
      const count = crystalXs.filter((x) => x > xs[i - 1]! && x < xs[i]!).length
      expect(count).toBeLessThanOrEqual(prevCount)
      prevCount = count
    }

    // Spacing: a single gap is jittered ±15% (SPACING_MIN/MAX * range(0.85, 1.15)), so it
    // isn't monotonic step-to-step by itself — bucket-average over the ramp-up phase only
    // (x below RAMP_DISTANCE, where the real upward trend dominates the jitter) rather than
    // the whole horizon, which is partly flat/saturated and would make bucket comparisons
    // noise-sensitive.
    const rampUpGaps: number[] = []
    for (let i = 1; i < xs.length; i++) {
      if (xs[i - 1]! < RAMP_DISTANCE) rampUpGaps.push(xs[i]! - xs[i - 1]!)
    }
    const BUCKETS = 4
    const bucketSize = Math.ceil(rampUpGaps.length / BUCKETS)
    const bucketAvgs: number[] = []
    for (let b = 0; b * bucketSize < rampUpGaps.length; b++) {
      const slice = rampUpGaps.slice(b * bucketSize, (b + 1) * bucketSize)
      bucketAvgs.push(slice.reduce((sum, g) => sum + g, 0) / slice.length)
    }
    expect(bucketAvgs.length).toBeGreaterThan(1) // need at least two buckets to compare
    for (let b = 1; b < bucketAvgs.length; b++) {
      expect(bucketAvgs[b]!).toBeGreaterThan(bucketAvgs[b - 1]!)
    }
  })
})
