import { describe, expect, it } from 'vitest'
import {
  CORRIDOR_HALF_WIDTH, SPACING_MAX, SPACING_MIN,
} from '../src/core/constants'
import { createWorld } from '../src/world/generator'

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
})
