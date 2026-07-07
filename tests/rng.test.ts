import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32, range } from '../src/core/rng'

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('stays in [0, 1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('range maps to [min, max)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = range(r, 5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThan(10)
    }
  })
  it('hashSeed is stable and index-sensitive', () => {
    expect(hashSeed(42, 1)).toBe(hashSeed(42, 1))
    expect(hashSeed(42, 1)).not.toBe(hashSeed(42, 2))
  })
  it('pins the exact first draw for seed 42 (golden value)', () => {
    const value = mulberry32(42)()
    expect(value).toBe(mulberry32(42)()) // determinism sanity
    expect(value).toMatchInlineSnapshot(`0.6011037519201636`)
  })
})
