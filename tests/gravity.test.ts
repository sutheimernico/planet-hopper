import { describe, expect, it } from 'vitest'
import { DT, GRAVITY, K_NEAREST } from '../src/core/constants'
import { mulberry32 } from '../src/core/rng'
import { vec } from '../src/core/vec'
import { accelerationAt, type GravityBody } from '../src/physics/gravity'
import { stepSemiImplicit, type Kinematic } from '../src/physics/integrator'
import { createWorld } from '../src/world/generator'

const body = (x: number, y: number, mass = 100, radius = 5): GravityBody => ({
  pos: vec(x, y),
  mass,
  radius,
})

describe('accelerationAt', () => {
  it('pulls toward a single body', () => {
    const a = accelerationAt(vec(0, 0), [body(10, 0)], 100, 3)
    expect(a.x).toBeGreaterThan(0)
    expect(a.y).toBeCloseTo(0)
  })
  it('magnitude follows inverse-square', () => {
    const near = accelerationAt(vec(0, 0), [body(10, 0)], 100, 3)
    const far = accelerationAt(vec(0, 0), [body(20, 0)], 100, 3)
    expect(near.x / far.x).toBeCloseTo(4, 5)
  })
  it('clamps below body radius (no singularity)', () => {
    const inside = accelerationAt(vec(9, 0), [body(10, 0, 100, 5)], 100, 3)
    const atRadius = accelerationAt(vec(5, 0), [body(10, 0, 100, 5)], 100, 3)
    expect(Math.abs(inside.x)).toBeLessThanOrEqual(Math.abs(atRadius.x) + 1e-9)
  })
  it('uses only the k nearest bodies', () => {
    const bodies = [body(10, 0), body(-10, 0), body(0, 10), body(0, -1000, 1e9)]
    const a = accelerationAt(vec(0, 0), bodies, 100, 3)
    // the huge far body is excluded by k=3, so pull is NOT dominated by -y
    expect(a.y).toBeGreaterThan(-1)
  })
  it('returns zero acceleration exactly at a body position (no NaN)', () => {
    expect(accelerationAt(vec(10, 0), [body(10, 0)], 100, 3)).toEqual({ x: 0, y: 0 })
  })
  it('returns zero acceleration with no bodies', () => {
    expect(accelerationAt(vec(0, 0), [], 100, 3)).toEqual({ x: 0, y: 0 })
  })
})

// Reference: the original copy+sort implementation, kept verbatim so the allocation-free
// top-k selection can be pinned bit-for-bit against it (ghost-and-shine Task 1).
function referenceAccelerationAt(
  p: { x: number; y: number }, bodies: readonly GravityBody[], g: number, kNearest: number,
): { x: number; y: number } {
  const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x - b.x, y: a.y - b.y })
  const lenSq = (a: { x: number; y: number }) => a.x * a.x + a.y * a.y
  const nearest = [...bodies]
    .sort((a, b) => lenSq(sub(a.pos, p)) - lenSq(sub(b.pos, p)))
    .slice(0, kNearest)
  let ax = 0
  let ay = 0
  for (const b of nearest) {
    const d = sub(b.pos, p)
    const dSq = lenSq(d)
    if (dSq === 0) continue
    const clampedSq = Math.max(dSq, b.radius * b.radius)
    const mag = (g * b.mass) / clampedSq
    const invLen = 1 / Math.sqrt(dSq)
    ax += d.x * invLen * mag
    ay += d.y * invLen * mag
  }
  return { x: ax, y: ay }
}

describe('accelerationAt top-k selection (golden vs. copy+sort reference)', () => {
  it('is bit-identical on randomized body sets, including distance ties', () => {
    const rng = mulberry32(1234)
    for (let trial = 0; trial < 2000; trial++) {
      const n = Math.floor(rng() * 14)
      const bodies: GravityBody[] = []
      for (let i = 0; i < n; i++) {
        // every 4th body duplicates an earlier position → exercises the tie-break order
        const src = i > 0 && i % 4 === 0 ? bodies[Math.floor(rng() * i)]!.pos : null
        bodies.push(body(src?.x ?? (rng() - 0.5) * 400, src?.y ?? (rng() - 0.5) * 120,
          1 + rng() * 80, 1 + rng() * 7))
      }
      const p = vec((rng() - 0.5) * 400, (rng() - 0.5) * 120)
      const k = 1 + Math.floor(rng() * 5)
      const got = accelerationAt(p, bodies, 280, k)
      const want = referenceAccelerationAt(p, bodies, 280, k)
      expect(Object.is(got.x, want.x) && Object.is(got.y, want.y)).toBe(true)
    }
  })
  it('keeps a full generated-world flight bit-identical over 3000 steps', () => {
    const world = createWorld(99)
    world.ensureUntil(1500)
    const bodies = [...world.snapshot().planets, ...world.snapshot().suns]
    let a: Kinematic = { pos: vec(0, 9), vel: vec(40, 6) }
    let b: Kinematic = a
    for (let i = 0; i < 3000; i++) {
      a = stepSemiImplicit(a, accelerationAt(a.pos, bodies, GRAVITY, K_NEAREST), DT)
      b = stepSemiImplicit(b, referenceAccelerationAt(b.pos, bodies, GRAVITY, K_NEAREST), DT)
      expect(a).toEqual(b)
    }
  })
  it('supports k larger than the internal scratch capacity', () => {
    const bodies = Array.from({ length: 12 }, (_, i) => body(10 + i * 3, i % 3))
    const got = accelerationAt(vec(0, 0), bodies, 100, 10)
    expect(got).toEqual(referenceAccelerationAt(vec(0, 0), bodies, 100, 10))
  })
})
