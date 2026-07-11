# Planet Hopper v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete v1 of Planet Hopper per `docs/superpowers/specs/2026-07-06-planet-hopper-design.md`: an endless 3D browser arcade game where the player slingshots a ship planet-to-planet using real gravity simulation.

**Architecture:** Simulation is strictly 2D (XY plane) and pure TypeScript — slingshot gameplay is planar, and 2D keeps physics unit-testable without GPU/DOM. Rendering is 3D (Three.js) and consumes simulation state read-only; world coords `(x, y)` map to scene `(x, y, 0)`. Fixed 120 Hz timestep with render interpolation; the trajectory preview runs the exact same integrator as the flight.

**Tech Stack:** Three.js, TypeScript (strict), Vite, Vitest, ESLint. No UI framework (DOM overlay), no runtime network, WebAudio synth for SFX.

**Gate:** `npm run gate` (typecheck + vitest + eslint) must be green before every commit. Work on branch `autopilot/work`.

---

## File structure (locked by this plan)

```
src/
  core/
    vec.ts          2D vector math (pure)
    rng.ts          seeded PRNG mulberry32 (pure)
    constants.ts    every gameplay tunable in one place
    state.ts        phase machine: menu → playing → paused → gameover (pure)
    score.ts        points, crystals, flyby multiplier (pure)
    sim.ts          the world tick: orbit/flight/capture/pickup/hazards/fuel (pure)
    loop.ts         fixed-timestep accumulator (pure) + rAF driver
    storage.ts      guarded localStorage (highscore, mute)
  physics/
    gravity.ts      k-nearest gravity acceleration (pure)
    integrator.ts   semi-implicit Euler step (pure)
    orbit.ts        orbit state, launch velocity/cost, orbit insertion (pure)
    capture.ts      capture radius checks (pure)
    trajectory.ts   preview simulation — same integrator (pure)
  world/
    types.ts        Planet/Crystal/Sun/World interfaces
    generator.ts    seeded endless corridor stream + pruning (pure)
  render/
    scene.ts        renderer, camera rig, lights, starfield, bloom composer
    meshes.ts       planet/crystal/sun/ship mesh pools synced from world state
    preview.ts      dashed trajectory line
    effects.ts      particle trail, capture burst, screen shake, FOV kick
  input/
    aim.ts          pure drag→aim mapping
    controls.ts     Pointer Events wiring
  ui/
    hud.ts          HUD variant A (fuel TL, score/combo TR, hint bottom)
    screens.ts      start/pause/gameover overlays (German texts)
    style.css       all overlay styling
  audio/
    sfx.ts          WebAudio synth: launch/capture/pickup/flyby + mute
  main.ts           bootstrap: WebGL check, wiring, rAF loop
tests/              one *.test.ts per pure module
.github/workflows/deploy.yml   GitHub Pages build (activates once remote exists)
```

Naming rule used throughout: world units = "wu". Interfaces defined in an early task are
reused verbatim in later tasks — do not rename.

---

## Phase 1 — Pure core: math, physics, world, sim

### Task 1: 2D vector math

**Files:**
- Create: `src/core/vec.ts`
- Test: `tests/vec.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/vec.test.ts
import { describe, expect, it } from 'vitest'
import { add, cross, dist, len, norm, scale, sub, vec } from '../src/core/vec'

describe('vec', () => {
  it('adds, subtracts, scales', () => {
    expect(add(vec(1, 2), vec(3, -1))).toEqual({ x: 4, y: 1 })
    expect(sub(vec(1, 2), vec(3, -1))).toEqual({ x: -2, y: 3 })
    expect(scale(vec(2, -3), 2)).toEqual({ x: 4, y: -6 })
  })
  it('length and distance', () => {
    expect(len(vec(3, 4))).toBe(5)
    expect(dist(vec(1, 1), vec(4, 5))).toBe(5)
  })
  it('normalizes, zero-safe', () => {
    expect(norm(vec(10, 0))).toEqual({ x: 1, y: 0 })
    expect(norm(vec(0, 0))).toEqual({ x: 0, y: 0 })
  })
  it('cross product sign gives orientation', () => {
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1)
    expect(cross(vec(0, 1), vec(1, 0))).toBe(-1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vec.test.ts`
Expected: FAIL — cannot resolve `../src/core/vec`

- [ ] **Step 3: Implement**

```ts
// src/core/vec.ts
export interface Vec {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec => ({ x, y })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
export const lenSq = (a: Vec): number => a.x * a.x + a.y * a.y
export const len = (a: Vec): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec, b: Vec): number => len(sub(a, b))
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x

export const norm = (a: Vec): Vec => {
  const l = len(a)
  return l === 0 ? { x: 0, y: 0 } : scale(a, 1 / l)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/vec.test.ts` — Expected: PASS (4 tests)

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/vec.ts tests/vec.test.ts
git commit -m "feat: add 2d vector math core"
```

### Task 2: Seeded PRNG

**Files:**
- Create: `src/core/rng.ts`
- Test: `tests/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/rng.test.ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rng.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/core/rng.ts
export type Rng = () => number

// Mulberry32: tiny, fast, good-enough distribution for gameplay procedural generation.
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const range = (rng: Rng, min: number, max: number): number => min + rng() * (max - min)

export const hashSeed = (seed: number, index: number): number =>
  (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0
```

- [ ] **Step 4: Run test** — `npx vitest run tests/rng.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/rng.ts tests/rng.test.ts
git commit -m "feat: add seeded prng (mulberry32)"
```

### Task 3: Gameplay constants (single tuning surface)

**Files:**
- Create: `src/core/constants.ts`

No test — pure data. Every later module imports from here; hand-tuning happens ONLY here.

- [ ] **Step 1: Implement**

```ts
// src/core/constants.ts
// Every gameplay tunable lives here. Units: world units (wu), seconds, wu/s.

// Simulation
export const DT = 1 / 120 // fixed timestep (s)
export const MAX_STEPS_PER_FRAME = 8 // spiral-of-death guard

// Gravity
export const GRAVITY = 280
export const K_NEAREST = 3

// Planets / orbit
export const ORBIT_FACTOR = 1.8 // orbit radius = planet.radius * this
export const ORBIT_SPEED = 1.2 // rad/s
export const CAPTURE_FACTOR = 2.2 // capture radius = planet.radius * this
export const FLYBY_FACTOR = 4.5 // flyby band outer = planet.radius * this

// Launch / fuel
export const POWER_MIN = 18 // wu/s at power01 = 0
export const POWER_MAX = 55 // wu/s at power01 = 1
export const FUEL_MAX = 100
export const LAUNCH_COST_BASE = 8
export const LAUNCH_COST_SCALE = 22 // cost = BASE + power01 * SCALE
export const CRYSTAL_REFILL = 18

// Pickup / hazards
export const CRYSTAL_PICKUP_RADIUS = 3.5
export const VOID_DISTANCE = 130 // distance to nearest planet that starts the void countdown
export const VOID_GRACE = 2.5 // s of countdown before the run ends
export const STRANDED_GRACE = 1.5 // s after orbiting without launch fuel

// Trajectory preview
export const PREVIEW_SECONDS = 3
export const PREVIEW_SAMPLE_EVERY = 4 // keep every 4th point for rendering

// World generation
export const SPACING_MIN = 55
export const SPACING_MAX = 110
export const RAMP_DISTANCE = 2000 // x-distance over which difficulty reaches max
export const CORRIDOR_HALF_WIDTH = 40
export const PLANET_RADIUS_MIN = 3
export const PLANET_RADIUS_MAX = 7
export const PLANET_MASS_FACTOR = 1 // mass = radius^2 * this
export const SUN_RADIUS = 6
export const SUN_MASS = 80
export const SUN_PROBABILITY_MAX = 0.35
export const GENTLE_PLANETS = 10 // hand-tuned easy start
export const GENTLE_SPACING_SCALE = 0.7
export const CRYSTALS_PER_GAP_START = 3
export const CRYSTALS_PER_GAP_END = 1
export const GENERATE_AHEAD = 400 // wu generated ahead of the ship
export const PRUNE_BEHIND = 200 // wu kept behind the ship

// Scoring
export const DIST_POINTS_PER_WU = 1
export const CRYSTAL_POINTS = 250
export const FLYBY_POINTS = 400
export const MULT_STEP = 0.5
export const MULT_MAX = 5
export const MULT_DECAY_SECONDS = 8
```

- [ ] **Step 2: Gate + commit**

```bash
npm run gate
git add src/core/constants.ts
git commit -m "feat: add gameplay constants as single tuning surface"
```

### Task 4: Gravity (k-nearest acceleration)

**Files:**
- Create: `src/physics/gravity.ts`
- Test: `tests/gravity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/gravity.test.ts
import { describe, expect, it } from 'vitest'
import { vec } from '../src/core/vec'
import { accelerationAt, type GravityBody } from '../src/physics/gravity'

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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gravity.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/physics/gravity.ts
import { lenSq, sub, type Vec } from '../core/vec'

export interface GravityBody {
  pos: Vec
  mass: number
  radius: number
}

// Sum of inverse-square pulls from the k nearest bodies. Distance is clamped to the
// body radius so acceleration stays finite inside a body (capture handles that case).
export function accelerationAt(
  p: Vec,
  bodies: readonly GravityBody[],
  g: number,
  kNearest: number,
): Vec {
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
```

- [ ] **Step 4: Run test** — `npx vitest run tests/gravity.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/physics/gravity.ts tests/gravity.test.ts
git commit -m "feat: add k-nearest inverse-square gravity"
```

### Task 5: Semi-implicit Euler integrator

**Files:**
- Create: `src/physics/integrator.ts`
- Test: `tests/integrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integrator.test.ts
import { describe, expect, it } from 'vitest'
import { vec } from '../src/core/vec'
import { stepSemiImplicit, type Kinematic } from '../src/physics/integrator'

describe('stepSemiImplicit', () => {
  it('moves in a straight line without acceleration', () => {
    let k: Kinematic = { pos: vec(0, 0), vel: vec(10, 0) }
    for (let i = 0; i < 120; i++) k = stepSemiImplicit(k, vec(0, 0), 1 / 120)
    expect(k.pos.x).toBeCloseTo(10, 5)
    expect(k.pos.y).toBeCloseTo(0, 5)
  })
  it('updates velocity before position (semi-implicit)', () => {
    const k = stepSemiImplicit({ pos: vec(0, 0), vel: vec(0, 0) }, vec(1, 0), 1)
    // explicit Euler would give pos.x = 0; semi-implicit gives dt * (v + a*dt) = 1
    expect(k.pos.x).toBe(1)
    expect(k.vel.x).toBe(1)
  })
  it('does not mutate its input', () => {
    const input: Kinematic = { pos: vec(1, 2), vel: vec(3, 4) }
    stepSemiImplicit(input, vec(5, 5), 1 / 120)
    expect(input).toEqual({ pos: vec(1, 2), vel: vec(3, 4) })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integrator.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/physics/integrator.ts
import type { Vec } from '../core/vec'

export interface Kinematic {
  pos: Vec
  vel: Vec
}

// Semi-implicit (symplectic) Euler: stable for orbital mechanics at fixed dt,
// unlike explicit Euler which gains energy every step.
export function stepSemiImplicit(k: Kinematic, acc: Vec, dt: number): Kinematic {
  const vel = { x: k.vel.x + acc.x * dt, y: k.vel.y + acc.y * dt }
  const pos = { x: k.pos.x + vel.x * dt, y: k.pos.y + vel.y * dt }
  return { pos, vel }
}
```

- [ ] **Step 4: Run test** — `npx vitest run tests/integrator.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/physics/integrator.ts tests/integrator.test.ts
git commit -m "feat: add semi-implicit euler integrator"
```

### Task 6: World types

**Files:**
- Create: `src/world/types.ts`

- [ ] **Step 1: Implement (types only, no test)**

```ts
// src/world/types.ts
import type { Vec } from '../core/vec'

export interface Planet {
  id: number
  pos: Vec
  radius: number
  mass: number
  paletteIndex: number // which biome color set the renderer uses
  hasRing: boolean
}

export interface Crystal {
  id: number
  pos: Vec
  collected: boolean
}

export interface Sun {
  id: number
  pos: Vec
  radius: number
  mass: number
}

export interface WorldSnapshot {
  planets: readonly Planet[]
  crystals: readonly Crystal[]
  suns: readonly Sun[]
}
```

- [ ] **Step 2: Gate + commit**

```bash
npm run gate
git add src/world/types.ts
git commit -m "feat: add world entity types"
```

### Task 7: Orbit mechanics + capture

**Files:**
- Create: `src/physics/orbit.ts`, `src/physics/capture.ts`
- Test: `tests/orbit.test.ts`, `tests/capture.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/orbit.test.ts
import { describe, expect, it } from 'vitest'
import { ORBIT_FACTOR, ORBIT_SPEED, POWER_MAX, POWER_MIN } from '../src/core/constants'
import { dist, len, vec } from '../src/core/vec'
import {
  advanceOrbit,
  enterOrbit,
  launchCost,
  launchVelocity,
  orbitPosition,
  type OrbitState,
} from '../src/physics/orbit'
import type { Planet } from '../src/world/types'

const planet: Planet = {
  id: 1, pos: vec(100, 50), radius: 5, mass: 25, paletteIndex: 0, hasRing: false,
}

describe('orbit', () => {
  it('orbitPosition sits at orbit radius', () => {
    const o: OrbitState = { planetId: 1, angle: 0, dir: 1 }
    expect(dist(orbitPosition(planet, o), planet.pos)).toBeCloseTo(planet.radius * ORBIT_FACTOR)
  })
  it('advanceOrbit rotates by ORBIT_SPEED * dt in dir', () => {
    const o = advanceOrbit({ planetId: 1, angle: 0, dir: -1 }, 0.5)
    expect(o.angle).toBeCloseTo(-ORBIT_SPEED * 0.5)
  })
  it('launchVelocity maps power01 into [POWER_MIN, POWER_MAX]', () => {
    expect(len(launchVelocity(vec(1, 0), 0))).toBeCloseTo(POWER_MIN)
    expect(len(launchVelocity(vec(0, 2), 1))).toBeCloseTo(POWER_MAX)
  })
  it('launchCost grows with power', () => {
    expect(launchCost(1)).toBeGreaterThan(launchCost(0))
  })
  it('enterOrbit picks angle toward the ship and dir from velocity orientation', () => {
    const o = enterOrbit(planet, vec(120, 50), vec(0, 10)) // ship right of planet, moving up
    expect(o.angle).toBeCloseTo(0) // atan2(0, 20)
    expect(o.dir).toBe(1) // counter-clockwise
    expect(o.planetId).toBe(1)
  })
})
```

```ts
// tests/capture.test.ts
import { describe, expect, it } from 'vitest'
import { CAPTURE_FACTOR } from '../src/core/constants'
import { vec } from '../src/core/vec'
import { captureRadius, findCapture } from '../src/physics/capture'
import type { Planet } from '../src/world/types'

const planet = (id: number, x: number, radius = 5): Planet => ({
  id, pos: vec(x, 0), radius, mass: radius * radius, paletteIndex: 0, hasRing: false,
})

describe('capture', () => {
  it('captureRadius scales with planet radius', () => {
    expect(captureRadius(planet(1, 0, 4))).toBeCloseTo(4 * CAPTURE_FACTOR)
  })
  it('finds the planet whose capture zone contains the point', () => {
    const p = findCapture(vec(8, 0), [planet(1, 0), planet(2, 100)], null)
    expect(p?.id).toBe(1)
  })
  it('ignores the launch planet', () => {
    expect(findCapture(vec(8, 0), [planet(1, 0)], 1)).toBeNull()
  })
  it('returns null in open space', () => {
    expect(findCapture(vec(50, 0), [planet(1, 0), planet(2, 100)], null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/orbit.test.ts tests/capture.test.ts` — Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

```ts
// src/physics/orbit.ts
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
export const launchVelocity = (aimDir: Vec, power01: number): Vec =>
  scale(norm(aimDir), POWER_MIN + power01 * (POWER_MAX - POWER_MIN))

export const launchCost = (power01: number): number =>
  LAUNCH_COST_BASE + power01 * LAUNCH_COST_SCALE

export function enterOrbit(planet: Planet, shipPos: Vec, shipVel: Vec): OrbitState {
  const radial = sub(shipPos, planet.pos)
  const angle = Math.atan2(radial.y, radial.x)
  const dir: 1 | -1 = cross(radial, shipVel) >= 0 ? 1 : -1
  return { planetId: planet.id, angle, dir }
}
```

```ts
// src/physics/capture.ts
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
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/orbit.test.ts tests/capture.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/physics/orbit.ts src/physics/capture.ts tests/orbit.test.ts tests/capture.test.ts
git commit -m "feat: add orbit mechanics and capture logic"
```

### Task 8: Trajectory preview (same integrator as flight)

**Files:**
- Create: `src/physics/trajectory.ts`
- Test: `tests/trajectory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/trajectory.test.ts
import { describe, expect, it } from 'vitest'
import { DT, GRAVITY, K_NEAREST } from '../src/core/constants'
import { vec } from '../src/core/vec'
import { accelerationAt } from '../src/physics/gravity'
import { stepSemiImplicit, type Kinematic } from '../src/physics/integrator'
import { simulateTrajectory } from '../src/physics/trajectory'
import type { WorldSnapshot } from '../src/world/types'

const world: WorldSnapshot = {
  planets: [
    { id: 1, pos: vec(0, 0), radius: 5, mass: 25, paletteIndex: 0, hasRing: false },
    { id: 2, pos: vec(80, 10), radius: 5, mass: 25, paletteIndex: 1, hasRing: false },
  ],
  crystals: [],
  suns: [],
}

describe('simulateTrajectory', () => {
  it('is deterministic', () => {
    const start: Kinematic = { pos: vec(0, 12), vel: vec(30, 5) }
    const a = simulateTrajectory(start, world, 1, 360, 1)
    const b = simulateTrajectory(start, world, 1, 360, 1)
    expect(a).toEqual(b)
  })
  it('matches a manual step-by-step flight exactly (preview = flight)', () => {
    let k: Kinematic = { pos: vec(0, 12), vel: vec(30, 5) }
    const manual = []
    for (let i = 0; i < 50; i++) {
      const bodies = [...world.planets, ...world.suns]
      k = stepSemiImplicit(k, accelerationAt(k.pos, bodies, GRAVITY, K_NEAREST), DT)
      manual.push(k.pos)
    }
    const t = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 50, 1)
    expect(t.points).toEqual(manual)
  })
  it('reports capture and stops there', () => {
    // aimed straight at planet 2 with enough speed
    const t = simulateTrajectory({ pos: vec(20, 10), vel: vec(50, 0) }, world, 1, 2000, 1)
    expect(t.outcome).toBe('captured')
    expect(t.capturedBy).toBe(2)
  })
  it('samples every nth point', () => {
    const full = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 40, 1)
    const sampled = simulateTrajectory({ pos: vec(0, 12), vel: vec(30, 5) }, world, 1, 40, 4)
    expect(sampled.points.length).toBeLessThan(full.points.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trajectory.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/physics/trajectory.ts
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
```

- [ ] **Step 4: Run test** — `npx vitest run tests/trajectory.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/physics/trajectory.ts tests/trajectory.test.ts
git commit -m "feat: add trajectory preview using the live integrator"
```

### Task 9: Seeded endless world generator

**Files:**
- Create: `src/world/generator.ts`
- Test: `tests/generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/generator.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/world/generator.ts
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
      const keep = <T extends { pos: { x: number } }>(arr: T[]): T[] =>
        arr.filter((e) => e.pos.x >= behindX)
      planets.splice(0, planets.length, ...keep(planets))
      crystals.splice(0, crystals.length, ...keep(crystals))
      suns.splice(0, suns.length, ...keep(suns))
    },
    snapshot: (): WorldSnapshot => ({ planets, crystals, suns }),
  }
}
```

NOTE: the sun-probability roll consumes rng unconditionally — that keeps `sunRoll` before
the `planetCount` check so early planets consume the same rng sequence as late ones.

- [ ] **Step 4: Run test** — `npx vitest run tests/generator.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/world/generator.ts tests/generator.test.ts
git commit -m "feat: add seeded endless world generator with difficulty ramp"
```

### Task 10: Scoring (distance, crystals, flyby multiplier)

**Files:**
- Create: `src/core/score.ts`
- Test: `tests/score.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/score.test.ts
import { describe, expect, it } from 'vitest'
import {
  CRYSTAL_POINTS, FLYBY_POINTS, MULT_DECAY_SECONDS, MULT_MAX, MULT_STEP,
} from '../src/core/constants'
import { initialScore, onCrystal, onFlyby, tickScore } from '../src/core/score'

describe('score', () => {
  it('accrues distance points only for new max x', () => {
    let s = initialScore()
    s = tickScore(s, 100, 1 / 120)
    const after = s.points
    s = tickScore(s, 50, 1 / 120) // flying backwards adds nothing
    expect(s.points).toBe(after)
    expect(s.maxX).toBe(100)
  })
  it('crystal adds points times multiplier', () => {
    let s = { ...initialScore(), mult: 2 }
    s = onCrystal(s)
    expect(s.points).toBe(CRYSTAL_POINTS * 2)
    expect(s.crystals).toBe(1)
  })
  it('flyby raises multiplier, caps at MULT_MAX, awards points', () => {
    let s = initialScore()
    s = onFlyby(s)
    expect(s.mult).toBe(1 + MULT_STEP)
    expect(s.points).toBe(FLYBY_POINTS * (1 + MULT_STEP))
    for (let i = 0; i < 20; i++) s = onFlyby(s)
    expect(s.mult).toBe(MULT_MAX)
  })
  it('multiplier decays back to 1 after MULT_DECAY_SECONDS', () => {
    let s = onFlyby(initialScore())
    s = tickScore(s, 0, MULT_DECAY_SECONDS + 0.01)
    expect(s.mult).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/score.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/core/score.ts
import {
  CRYSTAL_POINTS, DIST_POINTS_PER_WU, FLYBY_POINTS, MULT_DECAY_SECONDS, MULT_MAX, MULT_STEP,
} from './constants'

export interface ScoreState {
  points: number // float internally; UI floors it
  crystals: number
  mult: number
  multTimer: number // seconds until mult resets to 1
  maxX: number
}

export const initialScore = (): ScoreState => ({
  points: 0, crystals: 0, mult: 1, multTimer: 0, maxX: 0,
})

export function tickScore(s: ScoreState, shipX: number, dt: number): ScoreState {
  const maxX = Math.max(s.maxX, shipX)
  const points = s.points + (maxX - s.maxX) * DIST_POINTS_PER_WU * s.mult
  const multTimer = Math.max(0, s.multTimer - dt)
  return { ...s, maxX, points, multTimer, mult: multTimer > 0 ? s.mult : 1 }
}

export function onCrystal(s: ScoreState): ScoreState {
  return { ...s, crystals: s.crystals + 1, points: s.points + CRYSTAL_POINTS * s.mult }
}

export function onFlyby(s: ScoreState): ScoreState {
  const mult = Math.min(MULT_MAX, s.mult + MULT_STEP)
  return { ...s, mult, multTimer: MULT_DECAY_SECONDS, points: s.points + FLYBY_POINTS * mult }
}
```

- [ ] **Step 4: Run test** — `npx vitest run tests/score.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/score.ts tests/score.test.ts
git commit -m "feat: add scoring with flyby multiplier"
```

### Task 11: Game phase machine

**Files:**
- Create: `src/core/state.ts`
- Test: `tests/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/state.test.ts
import { describe, expect, it } from 'vitest'
import { transition, type GameEvent, type GamePhase } from '../src/core/state'

describe('transition', () => {
  const cases: Array<[GamePhase, GameEvent, GamePhase]> = [
    ['menu', 'start', 'playing'],
    ['playing', 'pause', 'paused'],
    ['paused', 'resume', 'playing'],
    ['playing', 'die', 'gameover'],
    ['gameover', 'restart', 'playing'],
    // invalid events leave the phase unchanged
    ['menu', 'pause', 'menu'],
    ['paused', 'die', 'paused'],
    ['gameover', 'pause', 'gameover'],
  ]
  it.each(cases)('%s + %s → %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/core/state.ts
export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover'
export type GameEvent = 'start' | 'pause' | 'resume' | 'die' | 'restart'

const TABLE: Record<GamePhase, Partial<Record<GameEvent, GamePhase>>> = {
  menu: { start: 'playing' },
  playing: { pause: 'paused', die: 'gameover' },
  paused: { resume: 'playing' },
  gameover: { restart: 'playing' },
}

export const transition = (phase: GamePhase, event: GameEvent): GamePhase =>
  TABLE[phase][event] ?? phase
```

- [ ] **Step 4: Run test** — `npx vitest run tests/state.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/state.ts tests/state.test.ts
git commit -m "feat: add game phase state machine"
```

### Task 12: The sim tick (orbit, flight, capture, pickups, hazards, fuel)

**Files:**
- Create: `src/core/sim.ts`
- Test: `tests/sim.test.ts`

This is the heart of the game. `RunState` is immutable per tick (new object returned);
the ONE sanctioned mutation is `Crystal.collected` inside the world (pooled entities).
`events` is drained by render/audio each frame and replaced every tick.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim.test.ts
import { describe, expect, it } from 'vitest'
import {
  DT, FUEL_MAX, STRANDED_GRACE, VOID_GRACE,
} from '../src/core/constants'
import { launch, newRun, tickRun, type RunState } from '../src/core/sim'
import { launchCost } from '../src/physics/orbit'
import { vec } from '../src/core/vec'
import type { WorldSnapshot } from '../src/world/types'

const twoPlanets = (): WorldSnapshot => ({
  planets: [
    { id: 1, pos: vec(0, 0), radius: 5, mass: 25, paletteIndex: 0, hasRing: false },
    { id: 2, pos: vec(70, 0), radius: 5, mass: 25, paletteIndex: 1, hasRing: false },
  ],
  crystals: [],
  suns: [],
})

const run = (state: RunState, world: WorldSnapshot, seconds: number): RunState => {
  let s = state
  for (let i = 0; i < Math.round(seconds / DT); i++) s = tickRun(s, world, DT)
  return s
}

describe('sim', () => {
  it('newRun starts orbiting planet 1 with full fuel', () => {
    const s = newRun(twoPlanets())
    expect(s.mode).toBe('orbiting')
    expect(s.orbit?.planetId).toBe(1)
    expect(s.fuel).toBe(FUEL_MAX)
  })
  it('launch spends fuel and switches to flying', () => {
    const world = twoPlanets()
    const s = launch(newRun(world), world, vec(1, 0), 0.5)
    expect(s.mode).toBe('flying')
    expect(s.fuel).toBeCloseTo(FUEL_MAX - launchCost(0.5))
    expect(s.events.some((e) => e.type === 'launch')).toBe(true)
  })
  it('launch is rejected without enough fuel', () => {
    const world = twoPlanets()
    const s: RunState = { ...newRun(world), fuel: 1 }
    expect(launch(s, world, vec(1, 0), 1).mode).toBe('orbiting')
  })
  it('a straight shot at planet 2 gets captured there', () => {
    const world = twoPlanets()
    let s = newRun(world)
    // place ship on the right side of planet 1's orbit, aim at planet 2
    s = { ...s, orbit: { planetId: 1, angle: 0, dir: 1 } }
    s = launch(s, world, vec(1, 0), 0.8)
    s = run(s, world, 5)
    expect(s.mode).toBe('orbiting')
    expect(s.orbit?.planetId).toBe(2)
  })
  it('crystal pickup refuels, scores, and marks collected', () => {
    const world = twoPlanets()
    const crystal = { id: 99, pos: vec(25, 0), collected: false }
    const w: WorldSnapshot = { ...world, crystals: [crystal] }
    let s = { ...newRun(w), fuel: 40 }
    s = { ...s, orbit: { planetId: 1, angle: 0, dir: 1 } }
    s = launch(s, w, vec(1, 0), 0.8)
    s = run(s, w, 2)
    expect(crystal.collected).toBe(true)
    expect(s.score.crystals).toBe(1)
    expect(s.fuel).toBeGreaterThan(40 - launchCost(0.8))
  })
  it('burning in a sun ends the run', () => {
    const w: WorldSnapshot = { ...twoPlanets(), suns: [{ id: 50, pos: vec(35, 0), radius: 6, mass: 80 }] }
    let s = newRun(w)
    s = { ...s, orbit: { planetId: 1, angle: 0, dir: 1 } }
    s = launch(s, w, vec(1, 0), 0.5)
    s = run(s, w, 4)
    expect(s.mode).toBe('dead')
    expect(s.deathCause).toBe('sun')
  })
  it('drifting into the void ends the run after the grace period', () => {
    const w = twoPlanets()
    let s = newRun(w)
    s = { ...s, orbit: { planetId: 1, angle: Math.PI / 2, dir: 1 } }
    s = launch(s, w, vec(0, 1), 1) // straight up, away from everything
    s = run(s, w, VOID_GRACE + 6)
    expect(s.mode).toBe('dead')
    expect(s.deathCause).toBe('void')
  })
  it('stranded in orbit without launch fuel ends the run', () => {
    const w = twoPlanets()
    let s: RunState = { ...newRun(w), fuel: 0 }
    s = run(s, w, STRANDED_GRACE + 0.5)
    expect(s.mode).toBe('dead')
    expect(s.deathCause).toBe('stranded')
  })
  it('a fast tangential pass through the flyby band raises the multiplier', () => {
    const w: WorldSnapshot = {
      planets: [
        { id: 1, pos: vec(-100, 200), radius: 5, mass: 25, paletteIndex: 0, hasRing: false },
        { id: 2, pos: vec(0, 0), radius: 5, mass: 25, paletteIndex: 1, hasRing: false },
      ],
      crystals: [],
      suns: [],
    }
    let s = newRun(w)
    // hand-placed flying state: passes planet 2 at min distance ~15 (band is [11, 22.5]) at high speed
    s = {
      ...s,
      mode: 'flying',
      orbit: null,
      ignorePlanetId: null,
      ship: { pos: vec(-60, 15), vel: vec(120, 0) },
    }
    s = run(s, w, 1.2)
    expect(s.score.mult).toBeGreaterThan(1)
    expect(s.events.length >= 0).toBe(true) // events drained per tick; flyby already consumed
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/core/sim.ts
import {
  CRYSTAL_PICKUP_RADIUS, CRYSTAL_REFILL, DT, FLYBY_FACTOR, FUEL_MAX, GRAVITY, K_NEAREST,
  STRANDED_GRACE, VOID_DISTANCE, VOID_GRACE,
} from './constants'
import { initialScore, onCrystal, onFlyby, tickScore, type ScoreState } from './score'
import { dist, type Vec } from './vec'
import { captureRadius, findCapture } from '../physics/capture'
import { accelerationAt, type GravityBody } from '../physics/gravity'
import { stepSemiImplicit, type Kinematic } from '../physics/integrator'
import {
  advanceOrbit, enterOrbit, launchCost, launchVelocity, orbitPosition, type OrbitState,
} from '../physics/orbit'
import type { WorldSnapshot } from '../world/types'

export type RunMode = 'orbiting' | 'flying' | 'dead'
export type DeathCause = 'sun' | 'void' | 'stranded'

export type SimEvent =
  | { type: 'launch' }
  | { type: 'capture'; planetId: number }
  | { type: 'crystal' }
  | { type: 'flyby' }
  | { type: 'death'; cause: DeathCause }

export interface RunState {
  mode: RunMode
  ship: Kinematic
  orbit: OrbitState | null
  ignorePlanetId: number | null
  fuel: number
  score: ScoreState
  voidTimer: number
  strandedTimer: number
  flybyTracking: readonly number[] // planet ids the ship is currently inside the flyby band of
  deathCause: DeathCause | null
  events: readonly SimEvent[] // this tick's discrete happenings; replaced every tick
}

export function newRun(world: WorldSnapshot): RunState {
  const home = world.planets[0]
  if (!home) throw new Error('world has no planets')
  const orbit: OrbitState = { planetId: home.id, angle: Math.PI / 2, dir: 1 }
  return {
    mode: 'orbiting',
    ship: { pos: orbitPosition(home, orbit), vel: { x: 0, y: 0 } },
    orbit,
    ignorePlanetId: null,
    fuel: FUEL_MAX,
    score: initialScore(),
    voidTimer: 0,
    strandedTimer: 0,
    flybyTracking: [],
    deathCause: null,
    events: [],
  }
}

export function launch(s: RunState, world: WorldSnapshot, aimDir: Vec, power01: number): RunState {
  if (s.mode !== 'orbiting' || !s.orbit) return s
  const cost = launchCost(power01)
  if (s.fuel < cost) return s
  const planet = world.planets.find((p) => p.id === s.orbit!.planetId)
  if (!planet) return s
  return {
    ...s,
    mode: 'flying',
    ship: { pos: orbitPosition(planet, s.orbit), vel: launchVelocity(aimDir, power01) },
    orbit: null,
    ignorePlanetId: planet.id,
    fuel: s.fuel - cost,
    events: [{ type: 'launch' }],
  }
}

const die = (s: RunState, cause: DeathCause, events: SimEvent[]): RunState => ({
  ...s, mode: 'dead', deathCause: cause, events: [...events, { type: 'death', cause }],
})

export function tickRun(s: RunState, world: WorldSnapshot, dt: number = DT): RunState {
  if (s.mode === 'dead') return { ...s, events: [] }
  const events: SimEvent[] = []

  if (s.mode === 'orbiting' && s.orbit) {
    const planet = world.planets.find((p) => p.id === s.orbit!.planetId)
    if (!planet) return die(s, 'void', events) // pruned under us — should not happen
    const orbit = advanceOrbit(s.orbit, dt)
    const next: RunState = {
      ...s,
      orbit,
      ship: { pos: orbitPosition(planet, orbit), vel: { x: 0, y: 0 } },
      score: tickScore(s.score, s.ship.pos.x, dt),
      strandedTimer: s.fuel < launchCost(0) ? s.strandedTimer + dt : 0,
      events,
    }
    if (next.strandedTimer >= STRANDED_GRACE) return die(next, 'stranded', events)
    return next
  }

  // flying
  const bodies: GravityBody[] = [...world.planets, ...world.suns]
  const ship = stepSemiImplicit(s.ship, accelerationAt(s.ship.pos, bodies, GRAVITY, K_NEAREST), dt)

  // launch planet becomes capturable again once we leave its capture zone
  let ignore = s.ignorePlanetId
  if (ignore !== null) {
    const lp = world.planets.find((p) => p.id === ignore)
    if (!lp || dist(ship.pos, lp.pos) > captureRadius(lp)) ignore = null
  }

  for (const sun of world.suns) {
    if (dist(ship.pos, sun.pos) <= sun.radius) return die({ ...s, ship }, 'sun', events)
  }

  let score = tickScore(s.score, ship.pos.x, dt)
  let fuel = s.fuel
  for (const c of world.crystals) {
    if (!c.collected && dist(ship.pos, c.pos) <= CRYSTAL_PICKUP_RADIUS) {
      c.collected = true // sanctioned mutation: crystals are pooled world entities
      score = onCrystal(score)
      fuel = Math.min(FUEL_MAX, fuel + CRYSTAL_REFILL)
      events.push({ type: 'crystal' })
    }
  }

  // flyby band tracking: entered band → tracked; exited outward without capture → flyby
  const tracking = new Set(s.flybyTracking)
  for (const p of world.planets) {
    if (p.id === ignore) continue
    const d = dist(ship.pos, p.pos)
    const inBand = d > captureRadius(p) && d <= p.radius * FLYBY_FACTOR
    if (inBand) {
      tracking.add(p.id)
    } else if (tracking.has(p.id) && d > p.radius * FLYBY_FACTOR) {
      tracking.delete(p.id)
      score = onFlyby(score)
      events.push({ type: 'flyby' })
    }
  }

  const captured = findCapture(ship.pos, world.planets, ignore)
  if (captured) {
    tracking.delete(captured.id)
    events.push({ type: 'capture', planetId: captured.id })
    return {
      ...s,
      mode: 'orbiting',
      orbit: enterOrbit(captured, ship.pos, ship.vel),
      ship: { pos: ship.pos, vel: { x: 0, y: 0 } },
      ignorePlanetId: null,
      fuel,
      score,
      voidTimer: 0,
      flybyTracking: [...tracking],
      events,
    }
  }

  let nearestPlanet = Infinity
  for (const p of world.planets) nearestPlanet = Math.min(nearestPlanet, dist(ship.pos, p.pos))
  const voidTimer = nearestPlanet > VOID_DISTANCE ? s.voidTimer + dt : 0
  const next: RunState = {
    ...s, ship, ignorePlanetId: ignore, fuel, score, voidTimer,
    flybyTracking: [...tracking], events,
  }
  if (voidTimer >= VOID_GRACE) return die(next, 'void', events)
  return next
}
```

- [ ] **Step 4: Run test** — `npx vitest run tests/sim.test.ts` — Expected: PASS.
If the flyby test's min distance drifts into the capture zone due to gravity bend, raise the
start `y` from 15 toward 18 (stay < 22.5) — do NOT touch sim code for a test-geometry issue.

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/sim.ts tests/sim.test.ts
git commit -m "feat: add run simulation tick (orbit, flight, capture, hazards, fuel)"
```

### Task 13: Fixed-timestep accumulator

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/loop.test.ts
import { describe, expect, it } from 'vitest'
import { DT, MAX_STEPS_PER_FRAME } from '../src/core/constants'
import { createAccumulator } from '../src/core/loop'

describe('createAccumulator', () => {
  it('emits one step per DT of elapsed time', () => {
    const acc = createAccumulator()
    expect(acc.advance(DT * 3)).toBe(3)
  })
  it('accumulates fractional frames', () => {
    const acc = createAccumulator()
    expect(acc.advance(DT * 0.6)).toBe(0)
    expect(acc.advance(DT * 0.6)).toBe(1)
  })
  it('clamps huge frames (tab was in background)', () => {
    const acc = createAccumulator()
    expect(acc.advance(10)).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME)
  })
  it('alpha stays in [0, 1)', () => {
    const acc = createAccumulator()
    acc.advance(DT * 1.5)
    expect(acc.alpha()).toBeGreaterThanOrEqual(0)
    expect(acc.alpha()).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loop.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/core/loop.ts
import { DT, MAX_STEPS_PER_FRAME } from './constants'

export interface Accumulator {
  advance(elapsedSeconds: number): number // how many fixed steps to run this frame
  alpha(): number // interpolation factor for rendering between the last two sim states
}

export function createAccumulator(dt: number = DT, maxSteps: number = MAX_STEPS_PER_FRAME): Accumulator {
  let acc = 0
  return {
    advance(elapsedSeconds: number): number {
      acc = Math.min(acc + elapsedSeconds, dt * maxSteps)
      let steps = 0
      while (acc >= dt) {
        acc -= dt
        steps++
      }
      return steps
    },
    alpha: () => acc / dt,
  }
}
```

- [ ] **Step 4: Run test** — `npx vitest run tests/loop.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/core/loop.ts tests/loop.test.ts
git commit -m "feat: add fixed-timestep accumulator"
```

### Task 14: Guarded storage + pure aim mapping

**Files:**
- Create: `src/core/storage.ts`, `src/input/aim.ts`
- Test: `tests/storage.test.ts`, `tests/aim.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/aim.test.ts
import { describe, expect, it } from 'vitest'
import { dragToAim } from '../src/input/aim'

describe('dragToAim', () => {
  it('slingshot style: aim direction is opposite the drag', () => {
    // drag right+down on screen → aim left+up in world (screen y is inverted vs world y)
    const a = dragToAim({ x: 0, y: 0 }, { x: 100, y: 50 }, 200)
    expect(a.dir.x).toBeLessThan(0)
    expect(a.dir.y).toBeGreaterThan(0)
  })
  it('power scales with drag length and clamps at 1', () => {
    expect(dragToAim({ x: 0, y: 0 }, { x: 100, y: 0 }, 200).power01).toBeCloseTo(0.5)
    expect(dragToAim({ x: 0, y: 0 }, { x: 999, y: 0 }, 200).power01).toBe(1)
  })
  it('zero drag gives zero power', () => {
    expect(dragToAim({ x: 5, y: 5 }, { x: 5, y: 5 }, 200).power01).toBe(0)
  })
})
```

```ts
// tests/storage.test.ts
import { describe, expect, it } from 'vitest'
import { createStorage } from '../src/core/storage'

describe('createStorage', () => {
  it('reads back what it wrote', () => {
    const mem = new Map<string, string>()
    const backend = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    }
    const s = createStorage(backend)
    s.setHighscore(1234)
    expect(s.getHighscore()).toBe(1234)
    s.setMuted(true)
    expect(s.getMuted()).toBe(true)
  })
  it('survives a throwing backend (private mode)', () => {
    const backend = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    const s = createStorage(backend)
    expect(() => s.setHighscore(1)).not.toThrow()
    expect(s.getHighscore()).toBe(0)
    expect(s.getMuted()).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/aim.test.ts tests/storage.test.ts` — Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// src/input/aim.ts
import { norm, type Vec } from '../core/vec'

export interface Aim {
  dir: Vec // world-space launch direction (unit vector)
  power01: number
}

// Slingshot mapping: drag back to shoot forward. Screen y grows downward while
// world y grows upward, so screen delta (dx, dy) becomes world aim (-dx, +dy).
export function dragToAim(startPx: Vec, currentPx: Vec, maxDragPx: number): Aim {
  const dx = currentPx.x - startPx.x
  const dy = currentPx.y - startPx.y
  const lenPx = Math.hypot(dx, dy)
  if (lenPx === 0) return { dir: { x: 0, y: 0 }, power01: 0 }
  return {
    dir: norm({ x: -dx, y: dy }),
    power01: Math.min(1, lenPx / maxDragPx),
  }
}
```

```ts
// src/core/storage.ts
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface GameStorage {
  getHighscore(): number
  setHighscore(v: number): void
  getMuted(): boolean
  setMuted(v: boolean): void
}

const KEY_HIGHSCORE = 'planet-hopper.highscore'
const KEY_MUTED = 'planet-hopper.muted'

// Wraps localStorage so private-mode/denied storage degrades to in-run defaults.
export function createStorage(backend: StorageBackend): GameStorage {
  const read = (key: string): string | null => {
    try {
      return backend.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key: string, value: string): void => {
    try {
      backend.setItem(key, value)
    } catch {
      /* private mode — non-fatal */
    }
  }
  return {
    getHighscore: () => Number(read(KEY_HIGHSCORE) ?? 0) || 0,
    setHighscore: (v) => write(KEY_HIGHSCORE, String(v)),
    getMuted: () => read(KEY_MUTED) === '1',
    setMuted: (v) => write(KEY_MUTED, v ? '1' : '0'),
  }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/aim.test.ts tests/storage.test.ts` — Expected: PASS

- [ ] **Step 5: Gate + commit**

```bash
npm run gate
git add src/input/aim.ts src/core/storage.ts tests/aim.test.ts tests/storage.test.ts
git commit -m "feat: add drag-to-aim mapping and guarded storage"
```

---

## Phase 2 — Rendering, input, UI, audio (integration)

Render-side tasks cannot be unit-tested. Their "Step: Manual verify" describes the expected
observation in `npm run dev`. In a headless environment, run the gate, confirm zero TypeScript/
ESLint errors and a clean `npm run build`, and record the visual check under "Needs Nico live
verify" in `PLAN.md` — never claim a visual result you did not see.

### Task 15: Scene rig (renderer, camera, lights, starfield, bloom)

**Files:**
- Create: `src/render/scene.ts`
- Modify: `src/main.ts` (temporary wiring to view the scene)

- [ ] **Step 1: Implement the scene rig**

```ts
// src/render/scene.ts
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { Vec } from '../core/vec'

const BASE_FOV = 55
const CAM_DISTANCE = 95
const CAM_TILT_Y = -32 // camera sits below the plane → slight 3D perspective

export interface SceneRig {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  render(): void
  resize(): void
  // smooth follow + speed zoom + decaying shake/fov-kick, called once per frame
  updateCamera(target: Vec, speed: number, dt: number): void
  addShake(intensity: number): void
  fovKick(): void
}

export function createSceneRig(canvas: HTMLCanvasElement): SceneRig {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060f)
  scene.fog = new THREE.Fog(0x05060f, 220, 480)

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 1200)
  camera.position.set(0, CAM_TILT_Y, CAM_DISTANCE)

  scene.add(new THREE.AmbientLight(0x8899bb, 0.8))
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(60, 80, 120)
  scene.add(key)

  const stars = createStarfield()
  scene.add(stars)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.8))
  // r152+ color management: without a final OutputPass the composer blits a linear-space
  // buffer to the canvas — no sRGB encode, colors render too dark (SOTA check, Phase 2 boundary)
  composer.addPass(new OutputPass())

  let shake = 0
  let fov = BASE_FOV

  const resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    scene,
    camera,
    render: () => composer.render(),
    resize,
    updateCamera(target, speed, dt) {
      const k = 1 - Math.exp(-4 * dt) // frame-rate independent lerp
      const zoom = CAM_DISTANCE + Math.min(45, speed * 0.5)
      camera.position.x += (target.x - camera.position.x) * k
      camera.position.y += (target.y + CAM_TILT_Y - camera.position.y) * k
      camera.position.z += (zoom - camera.position.z) * k
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake
        camera.position.y += (Math.random() - 0.5) * shake
        shake *= Math.exp(-6 * dt)
      }
      fov += (BASE_FOV - fov) * (1 - Math.exp(-3 * dt))
      camera.fov = fov
      camera.updateProjectionMatrix()
      camera.lookAt(target.x, target.y, 0)
      stars.position.x = camera.position.x * 0.85 // 15% parallax
      stars.position.y = camera.position.y * 0.85
    },
    addShake: (intensity) => { shake = Math.min(3, shake + intensity) },
    fovKick: () => { fov = BASE_FOV + 9 },
  }
}

function createStarfield(): THREE.Points {
  const COUNT = 1500
  const positions = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1600
    positions[i * 3 + 1] = (Math.random() - 0.5) * 900
    positions[i * 3 + 2] = -80 - Math.random() * 300
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xbfd4ff, size: 1.4, sizeAttenuation: true,
    transparent: true, opacity: 0.9, depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}
```

Rendering randomness (`Math.random` for stars/shake) is fine — it never touches the
simulation, which stays seeded and deterministic.

- [ ] **Step 2: Temporary wiring in `src/main.ts`** (replaced in Task 19)

```ts
// src/main.ts
import { createSceneRig } from './render/scene'

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  const canvas = document.createElement('canvas')
  app.appendChild(canvas)
  const rig = createSceneRig(canvas)
  window.addEventListener('resize', rig.resize)
  const frame = (): void => {
    rig.updateCamera({ x: 0, y: 0 }, 0, 1 / 60)
    rig.render()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
```

- [ ] **Step 3: Manual verify** — `npm run dev` → dark space, starfield with subtle bloom,
no console errors.

- [ ] **Step 4: Gate + commit**

```bash
npm run gate && npm run build
git add src/render/scene.ts src/main.ts
git commit -m "feat: add scene rig with camera follow, starfield, bloom"
```

### Task 16: Entity mesh pools

**Files:**
- Create: `src/render/meshes.ts`

- [ ] **Step 1: Implement**

```ts
// src/render/meshes.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'
import type { WorldSnapshot } from '../world/types'

// Low-poly toon biome palettes (body / accent), indexed by Planet.paletteIndex.
const PALETTES: Array<[number, number]> = [
  [0x34d399, 0x059669], [0xfbbf24, 0xd97706], [0x818cf8, 0x4f46e5],
  [0xf472b6, 0xbe185d], [0x22d3ee, 0x0e7490], [0xa3e635, 0x4d7c0f],
]

export interface EntityPools {
  sync(world: WorldSnapshot): void
  updateShip(pos: Vec, velAngle: number): void
  shipPosition(): Vec
  // restart creates a fresh world whose ids restart at 1 — stale pooled meshes
  // would silently be reused at old positions without this (review finding, Task 9)
  reset(): void
}

export function createEntityPools(scene: THREE.Scene): EntityPools {
  const planetObjs = new Map<number, THREE.Group>()
  const crystalObjs = new Map<number, THREE.Mesh>()
  const sunObjs = new Map<number, THREE.Mesh>()

  const crystalGeo = new THREE.OctahedronGeometry(1.4)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.6, flatShading: true,
  })
  const sunGeo = new THREE.IcosahedronGeometry(1, 1)
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffd166, emissive: 0xff8c42, emissiveIntensity: 2.4, flatShading: true,
  })

  const ship = buildShip()
  scene.add(ship)

  const buildPlanet = (radius: number, paletteIndex: number, hasRing: boolean): THREE.Group => {
    const g = new THREE.Group()
    const [body, accent] = PALETTES[paletteIndex % PALETTES.length]!
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshStandardMaterial({ color: body, flatShading: true, roughness: 0.9 }),
    )
    g.add(mesh)
    if (hasRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.7, radius * 0.12, 6, 40),
        new THREE.MeshStandardMaterial({ color: accent, flatShading: true }),
      )
      ring.rotation.x = Math.PI / 2.6
      g.add(ring)
    }
    return g
  }

  return {
    sync(world) {
      const seen = new Set<number>()
      for (const p of world.planets) {
        seen.add(p.id)
        let obj = planetObjs.get(p.id)
        if (!obj) {
          obj = buildPlanet(p.radius, p.paletteIndex, p.hasRing)
          obj.position.set(p.pos.x, p.pos.y, 0)
          planetObjs.set(p.id, obj)
          scene.add(obj)
        }
        obj.rotation.y += 0.0008 // slow idle spin
      }
      for (const c of world.crystals) {
        seen.add(c.id)
        let obj = crystalObjs.get(c.id)
        if (!obj) {
          obj = new THREE.Mesh(crystalGeo, crystalMat)
          obj.position.set(c.pos.x, c.pos.y, 0)
          crystalObjs.set(c.id, obj)
          scene.add(obj)
        }
        obj.visible = !c.collected
        obj.rotation.z += 0.02
      }
      for (const s of world.suns) {
        seen.add(s.id)
        if (!sunObjs.has(s.id)) {
          const obj = new THREE.Mesh(sunGeo, sunMat)
          obj.scale.setScalar(s.radius)
          obj.position.set(s.pos.x, s.pos.y, 0)
          sunObjs.set(s.id, obj)
          scene.add(obj)
        }
      }
      // drop pruned entities
      for (const [id, obj] of [...planetObjs, ...crystalObjs, ...sunObjs]) {
        if (!seen.has(id)) {
          scene.remove(obj)
          planetObjs.delete(id)
          crystalObjs.delete(id)
          sunObjs.delete(id)
        }
      }
    },
    updateShip(pos, velAngle) {
      ship.position.set(pos.x, pos.y, 0)
      ship.rotation.z = velAngle - Math.PI / 2 // cone points +y by default
    },
    shipPosition: () => ({ x: ship.position.x, y: ship.position.y }),
    reset() {
      for (const [, obj] of [...planetObjs, ...crystalObjs, ...sunObjs]) scene.remove(obj)
      planetObjs.clear()
      crystalObjs.clear()
      sunObjs.clear()
    },
  }
}

function buildShip(): THREE.Group {
  const g = new THREE.Group()
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, flatShading: true }),
  )
  const engine = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 3 }),
  )
  engine.position.y = -1.6
  g.add(hull, engine)
  return g
}
```

- [ ] **Step 2: Gate + commit**

```bash
npm run gate
git add src/render/meshes.ts
git commit -m "feat: add pooled entity meshes (planets, crystals, suns, ship)"
```

### Task 17: Trajectory preview line + pointer controls

**Files:**
- Create: `src/render/preview.ts`, `src/input/controls.ts`

- [ ] **Step 1: Implement preview line**

```ts
// src/render/preview.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'

export interface PreviewLine {
  show(points: readonly Vec[]): void
  hide(): void
}

export function createPreviewLine(scene: THREE.Scene): PreviewLine {
  const material = new THREE.LineDashedMaterial({
    color: 0x00e5ff, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.9,
  })
  const geometry = new THREE.BufferGeometry()
  const line = new THREE.Line(geometry, material)
  line.visible = false
  scene.add(line)
  return {
    show(points) {
      geometry.setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, 0)))
      line.computeLineDistances()
      line.visible = true
    },
    hide() {
      line.visible = false
    },
  }
}
```

- [ ] **Step 2: Implement pointer controls**

```ts
// src/input/controls.ts
import { dragToAim, type Aim } from './aim'

export interface ControlsCallbacks {
  canAim(): boolean // phase === 'playing' && run.mode === 'orbiting'
  onAim(aim: Aim): void
  onRelease(aim: Aim): void
  onCancel(): void
}

const MAX_DRAG_PX = 220

// Pointer Events cover mouse + touch + pen with one code path.
export function attachControls(el: HTMLElement, cb: ControlsCallbacks): void {
  let start: { x: number; y: number } | null = null
  el.style.touchAction = 'none' // stop scroll/zoom stealing the gesture

  el.addEventListener('pointerdown', (e) => {
    if (!cb.canAim()) return
    start = { x: e.clientX, y: e.clientY }
    el.setPointerCapture(e.pointerId)
  })
  el.addEventListener('pointermove', (e) => {
    if (!start) return
    cb.onAim(dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX))
  })
  el.addEventListener('pointerup', (e) => {
    if (!start) return
    const aim = dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX)
    start = null
    if (aim.power01 > 0.05) cb.onRelease(aim)
    else cb.onCancel() // a tap, not a drag
  })
  el.addEventListener('pointercancel', () => {
    start = null
    cb.onCancel()
  })
}
```

- [ ] **Step 3: Gate + commit**

```bash
npm run gate
git add src/render/preview.ts src/input/controls.ts
git commit -m "feat: add trajectory preview line and pointer controls"
```

### Task 18: HUD, screens, styling (German UI)

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/screens.ts`, `src/ui/style.css`

- [ ] **Step 1: Implement HUD (variant A — free corners)**

```ts
// src/ui/hud.ts
export interface HudView {
  fuel01: number
  points: number
  mult: number
  hint: string | null // bottom-center contextual hint
  warning: string | null // void countdown etc.
  dimmed: boolean // in flight the HUD drops to 40% opacity
}

export interface Hud {
  update(view: HudView): void
}

export function createHud(root: HTMLElement): Hud {
  root.insertAdjacentHTML(
    'beforeend',
    `<div id="hud">
      <div class="hud-corner hud-tl">
        <span class="hud-label">Treibstoff</span>
        <div class="hud-fuelbar"><div id="hud-fuel" class="hud-fuelfill"></div></div>
      </div>
      <div class="hud-corner hud-tr">
        <span class="hud-label">Punkte</span>
        <div id="hud-points" class="hud-num">0</div>
        <div id="hud-mult" class="hud-num hud-combo"></div>
      </div>
      <div id="hud-warning" class="hud-warning"></div>
      <div id="hud-hint" class="hud-hint"></div>
    </div>`,
  )
  const el = (id: string): HTMLElement => root.querySelector(`#${id}`)!
  const hud = el('hud')
  const fuel = el('hud-fuel')
  const points = el('hud-points')
  const mult = el('hud-mult')
  const hint = el('hud-hint')
  const warning = el('hud-warning')
  return {
    update(v) {
      fuel.style.width = `${Math.round(v.fuel01 * 100)}%`
      fuel.classList.toggle('hud-fuel-low', v.fuel01 < 0.25)
      points.textContent = new Intl.NumberFormat('de-DE').format(Math.floor(v.points))
      mult.textContent = v.mult > 1 ? `×${v.mult.toFixed(1).replace('.', ',')} Flyby` : ''
      hint.textContent = v.hint ?? ''
      hint.style.opacity = v.hint ? '1' : '0'
      warning.textContent = v.warning ?? ''
      warning.style.opacity = v.warning ? '1' : '0'
      hud.classList.toggle('hud-dimmed', v.dimmed)
    },
  }
}
```

- [ ] **Step 2: Implement screens**

```ts
// src/ui/screens.ts
export interface RunStats {
  points: number
  crystals: number
  highscore: number
  isNewHighscore: boolean
  cause: 'sun' | 'void' | 'stranded'
}

export interface Screens {
  showStart(highscore: number): void
  showPause(): void
  showGameOver(stats: RunStats): void
  hide(): void
}

const CAUSE_TEXT: Record<RunStats['cause'], string> = {
  sun: 'In der Sonne verglüht',
  void: 'In der Leere verloren',
  stranded: 'Ohne Treibstoff gestrandet',
}

const fmt = (n: number): string => new Intl.NumberFormat('de-DE').format(Math.floor(n))

export function createScreens(
  root: HTMLElement,
  actions: { onStart(): void; onResume(): void; onRestart(): void },
): Screens {
  root.insertAdjacentHTML('beforeend', `<div id="screen" class="screen"></div>`)
  const el = root.querySelector<HTMLDivElement>('#screen')!

  const render = (html: string): void => {
    el.innerHTML = html
    el.classList.add('screen-visible')
  }
  el.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).dataset['action']
    if (action === 'start') actions.onStart()
    if (action === 'resume') actions.onResume()
    if (action === 'restart') actions.onRestart()
  })

  return {
    showStart(highscore) {
      render(`
        <h1>Planet Hopper</h1>
        <p class="screen-sub">Ziehen zum Zielen · loslassen zum Starten.<br>
        Schwing dich per Gravitation von Planet zu Planet — knappe Vorbeiflüge geben Bonus.</p>
        ${highscore > 0 ? `<p class="screen-high">Rekord: ${fmt(highscore)}</p>` : ''}
        <button class="screen-btn" data-action="start">Start</button>`)
    },
    showPause() {
      render(`
        <h1>Pause</h1>
        <button class="screen-btn" data-action="resume">Weiter</button>`)
    },
    showGameOver(s) {
      render(`
        <h1>${CAUSE_TEXT[s.cause]}</h1>
        <p class="screen-score">${fmt(s.points)} Punkte · ${s.crystals} Kristalle</p>
        <p class="screen-high">${s.isNewHighscore ? 'Neuer Rekord!' : `Rekord: ${fmt(s.highscore)}`}</p>
        <button class="screen-btn" data-action="restart">Nochmal</button>`)
    },
    hide() {
      el.classList.remove('screen-visible')
      el.innerHTML = ''
    },
  }
}
```

- [ ] **Step 3: Styling**

```css
/* src/ui/style.css */
:root {
  color-scheme: dark;
  font-family: system-ui, sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; background: #05060f; }
#app, canvas { width: 100%; height: 100%; display: block; }

#hud { position: fixed; inset: 0; pointer-events: none; color: #e2e8f0; transition: opacity .3s; }
.hud-dimmed { opacity: .4; }
.hud-corner { position: absolute; top: 16px; }
.hud-tl { left: 16px; }
.hud-tr { right: 16px; text-align: right; }
.hud-label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; }
.hud-num { font-family: ui-monospace, monospace; font-weight: 700; font-size: 24px; }
.hud-combo { color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, .8); font-size: 14px; }
.hud-fuelbar { width: 130px; height: 10px; margin-top: 5px; border-radius: 99px;
  background: rgba(148, 163, 184, .25); overflow: hidden; }
.hud-fuelfill { height: 100%; border-radius: 99px; width: 100%;
  background: linear-gradient(90deg, #06b6d4, #67e8f9);
  box-shadow: 0 0 8px rgba(103, 232, 249, .8); transition: width .15s; }
.hud-fuel-low { background: linear-gradient(90deg, #dc2626, #f87171);
  box-shadow: 0 0 8px rgba(248, 113, 113, .8); }
.hud-hint { position: absolute; bottom: 6%; left: 50%; transform: translateX(-50%);
  font-size: 13px; color: rgba(226, 232, 240, .7); background: rgba(5, 6, 15, .5);
  padding: 5px 14px; border-radius: 99px; transition: opacity .3s; white-space: nowrap; }
.hud-warning { position: absolute; top: 18%; left: 50%; transform: translateX(-50%);
  font-size: 16px; font-weight: 700; color: #f87171;
  text-shadow: 0 0 12px rgba(248, 113, 113, .8); transition: opacity .2s; }

.screen { position: fixed; inset: 0; display: none; flex-direction: column; gap: 18px;
  align-items: center; justify-content: center; text-align: center; color: #e2e8f0;
  background: rgba(5, 6, 15, .72); backdrop-filter: blur(6px); }
.screen-visible { display: flex; }
.screen h1 { font-size: clamp(28px, 6vw, 52px); letter-spacing: .02em;
  text-shadow: 0 0 24px rgba(103, 232, 249, .5); }
.screen-sub { color: #94a3b8; line-height: 1.6; max-width: 34em; }
.screen-score { font-family: ui-monospace, monospace; font-size: 22px; font-weight: 700; }
.screen-high { color: #fbbf24; }
.screen-btn { pointer-events: auto; cursor: pointer; font-size: 18px; font-weight: 700;
  color: #05060f; background: linear-gradient(90deg, #22d3ee, #67e8f9);
  border: none; border-radius: 99px; padding: 12px 44px;
  box-shadow: 0 0 24px rgba(34, 211, 238, .5); }
.screen-btn:hover { filter: brightness(1.1); }
```

- [ ] **Step 4: Gate + commit**

```bash
npm run gate
git add src/ui/hud.ts src/ui/screens.ts src/ui/style.css
git commit -m "feat: add hud (free-corners variant) and screens with german ui"
```

### Task 19: Game bootstrap — wire everything in main.ts

**Files:**
- Create: `src/vite-env.d.ts`
- Modify: `src/main.ts` (full replacement of the Task-15 temporary wiring)

- [ ] **Step 1: Add Vite client types** (CSS imports + `import.meta.env` need them under `tsc`)

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Implement**

```ts
// src/main.ts
import { createAccumulator } from './core/loop'
import * as C from './core/constants'
import { launch, newRun, tickRun } from './core/sim'
import { transition, type GamePhase } from './core/state'
import { createStorage } from './core/storage'
import { len, type Vec } from './core/vec'
import { attachControls } from './input/controls'
import { launchVelocity } from './physics/orbit'
import { simulateTrajectory } from './physics/trajectory'
import { createEntityPools } from './render/meshes'
import { createPreviewLine } from './render/preview'
import { createSceneRig } from './render/scene'
import { createHud } from './ui/hud'
import { createScreens } from './ui/screens'
import { createWorld } from './world/generator'
import './ui/style.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

// --- WebGL check -------------------------------------------------------------
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return c.getContext('webgl2') !== null || c.getContext('webgl') !== null
  } catch {
    return false
  }
}
if (!webglAvailable()) {
  app.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;
    color:#e2e8f0;font-family:system-ui;text-align:center;padding:24px">
    <p>Planet Hopper braucht WebGL.<br>Bitte einen aktuellen Browser mit aktivierter
    Hardware-Beschleunigung verwenden.</p></div>`
} else {
  boot(app)
}

function boot(root: HTMLDivElement): void {
  const canvas = document.createElement('canvas')
  root.appendChild(canvas)

  const rig = createSceneRig(canvas)
  const pools = createEntityPools(rig.scene)
  const preview = createPreviewLine(rig.scene)
  const hud = createHud(root)
  const storage = createStorage(window.localStorage)

  let phase: GamePhase = 'menu'
  let world = createWorld(Date.now() % 2 ** 31)
  world.ensureUntil(C.GENERATE_AHEAD)
  let run = newRun(world.snapshot())
  let prevShipPos: Vec = run.ship.pos
  let aiming = false

  const screens = createScreens(root, {
    onStart: () => setPhase('start'),
    onResume: () => setPhase('resume'),
    onRestart: () => {
      world = createWorld(Date.now() % 2 ** 31)
      world.ensureUntil(C.GENERATE_AHEAD)
      pools.reset() // new world reuses ids — drop stale meshes (review finding, Task 9)
      run = newRun(world.snapshot())
      prevShipPos = run.ship.pos
      setPhase('restart')
    },
  })

  function setPhase(event: Parameters<typeof transition>[1]): void {
    phase = transition(phase, event)
    if (phase === 'menu') screens.showStart(storage.getHighscore())
    else if (phase === 'paused') screens.showPause()
    else if (phase === 'gameover') {
      const points = Math.floor(run.score.points)
      const high = storage.getHighscore()
      const isNew = points > high
      if (isNew) storage.setHighscore(points)
      screens.showGameOver({
        points, crystals: run.score.crystals,
        highscore: Math.max(points, high), isNewHighscore: isNew,
        cause: run.deathCause ?? 'void',
      })
    } else screens.hide()
  }
  screens.showStart(storage.getHighscore())

  attachControls(canvas, {
    canAim: () => phase === 'playing' && run.mode === 'orbiting',
    onAim: (a) => {
      aiming = true
      const planet = world.snapshot().planets.find((p) => p.id === run.orbit?.planetId)
      if (!planet || !run.orbit) return
      // preview uses launchVelocity + simulateTrajectory — the live physics, no duplicate
      const t = simulateTrajectory(
        { pos: run.ship.pos, vel: launchVelocity(a.dir, a.power01) },
        world.snapshot(), planet.id,
        Math.round(C.PREVIEW_SECONDS / C.DT), C.PREVIEW_SAMPLE_EVERY,
      )
      preview.show(t.points)
    },
    onRelease: (a) => {
      aiming = false
      preview.hide()
      run = launch(run, world.snapshot(), a.dir, a.power01)
    },
    onCancel: () => {
      aiming = false
      preview.hide()
    },
  })

  // pause when the tab goes to background; Esc toggles pause on desktop
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') setPhase('pause')
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (phase === 'playing') setPhase('pause')
      else if (phase === 'paused') setPhase('resume')
    }
  })
  window.addEventListener('resize', rig.resize)

  const acc = createAccumulator()
  let last = performance.now()

  const frame = (now: number): void => {
    const elapsed = Math.min(0.25, (now - last) / 1000)
    last = now

    if (phase === 'playing') {
      const steps = acc.advance(elapsed)
      for (let i = 0; i < steps; i++) {
        prevShipPos = run.ship.pos
        world.ensureUntil(run.ship.pos.x + C.GENERATE_AHEAD)
        world.prune(run.ship.pos.x - C.PRUNE_BEHIND)
        run = tickRun(run, world.snapshot(), C.DT)
        for (const e of run.events) handleEvent(e.type)
      }
      if (run.mode === 'dead') setPhase('die')
    }

    const alpha = acc.alpha()
    const shipPos = {
      x: prevShipPos.x + (run.ship.pos.x - prevShipPos.x) * alpha,
      y: prevShipPos.y + (run.ship.pos.y - prevShipPos.y) * alpha,
    }
    const speed = len(run.ship.vel)
    const velAngle = speed > 0.1 ? Math.atan2(run.ship.vel.y, run.ship.vel.x)
      : (run.orbit ? run.orbit.angle + (run.orbit.dir * Math.PI) / 2 : 0)

    pools.sync(world.snapshot())
    pools.updateShip(shipPos, velAngle)
    rig.updateCamera(shipPos, speed, elapsed)
    hud.update({
      fuel01: run.fuel / C.FUEL_MAX,
      points: run.score.points,
      mult: run.score.mult,
      hint: phase === 'playing' && run.mode === 'orbiting' && !aiming
        ? 'Ziehen zum Zielen · loslassen zum Starten' : null,
      warning: run.voidTimer > 0
        ? `Zurück zum Korridor! ${(C.VOID_GRACE - run.voidTimer).toFixed(1)} s` : null,
      dimmed: run.mode === 'flying',
    })
    rig.render()
    requestAnimationFrame(frame)
  }

  function handleEvent(type: string): void {
    if (type === 'launch') rig.fovKick()
    if (type === 'capture') rig.addShake(1.6)
    if (type === 'death') rig.addShake(2.5)
    // audio hooks land in Task 20
  }

  requestAnimationFrame(frame)
}
```

NOTE on the seed: `Date.now()` gives run variety; determinism per seed is a sim property
(tested), not a UX requirement. Everything else is driven by the seeded world.

- [ ] **Step 3: Manual verify** — `npm run dev` → start screen; Start → orbit around the
first planet; drag shows dashed preview; release launches; capture into next orbit works;
HUD counts; Esc pauses; dying shows game over; Nochmal restarts. Zero console errors.

- [ ] **Step 4: Gate + commit**

```bash
npm run gate && npm run build
git add src/main.ts src/vite-env.d.ts
git commit -m "feat: wire full game loop, screens, and hud in bootstrap"
```

### Task 20: Audio (WebAudio synth) + engine trail + capture burst

**Files:**
- Create: `src/audio/sfx.ts`, `src/render/effects.ts`
- Modify: `src/main.ts` (handleEvent + mute button wiring, trail/burst update in frame)

- [ ] **Step 1: Implement synth SFX**

```ts
// src/audio/sfx.ts
export interface Sfx {
  launch(): void
  capture(): void
  crystal(): void
  flyby(): void
  death(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
}

// All sounds are synthesized — zero asset files, zero licensing.
// The AudioContext is created lazily on first call (browser autoplay policy).
export function createSfx(initialMuted: boolean): Sfx {
  let ctx: AudioContext | null = null
  let muted = initialMuted

  const play = (
    type: OscillatorType, from: number, to: number, duration: number, gainPeak: number,
  ): void => {
    if (muted) return
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = ctx.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  return {
    launch: () => play('sawtooth', 180, 40, 0.5, 0.18),
    capture: () => { play('sine', 520, 780, 0.18, 0.2); play('sine', 660, 990, 0.3, 0.12) },
    crystal: () => play('triangle', 880, 1320, 0.15, 0.16),
    flyby: () => play('sawtooth', 300, 900, 0.35, 0.1),
    death: () => play('square', 220, 30, 0.7, 0.2),
    setMuted: (m) => { muted = m },
    isMuted: () => muted,
  }
}
```

- [ ] **Step 2: Implement trail + burst**

```ts
// src/render/effects.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'

const TRAIL_N = 120
const BURST_N = 40

export interface Effects {
  pushTrail(pos: Vec, active: boolean): void
  burst(pos: Vec, color: number): void
  update(dt: number): void
}

export function createEffects(scene: THREE.Scene): Effects {
  // Trail: fixed ring buffer of points, brightness fades by age (color buffer rewrite).
  const trailPos = new Float32Array(TRAIL_N * 3)
  const trailCol = new Float32Array(TRAIL_N * 3)
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 1.1, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  scene.add(trail)
  let head = 0

  // Bursts: one pooled particle set reused per explosion.
  const burstPos = new Float32Array(BURST_N * 3)
  const burstVel: Vec[] = Array.from({ length: BURST_N }, () => ({ x: 0, y: 0 }))
  const burstGeo = new THREE.BufferGeometry()
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3))
  const burstMat = new THREE.PointsMaterial({
    size: 1.4, color: 0x67e8f9, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)
  scene.add(burstPoints)
  let burstLife = 0

  return {
    pushTrail(pos, active) {
      trailPos[head * 3] = pos.x
      trailPos[head * 3 + 1] = pos.y
      trailPos[head * 3 + 2] = 0
      trailCol[head * 3] = active ? 0.4 : 0
      trailCol[head * 3 + 1] = active ? 0.9 : 0
      trailCol[head * 3 + 2] = active ? 1.0 : 0
      head = (head + 1) % TRAIL_N
      trailGeo.attributes['position']!.needsUpdate = true
      trailGeo.attributes['color']!.needsUpdate = true
    },
    burst(pos, color) {
      burstMat.color.setHex(color)
      for (let i = 0; i < BURST_N; i++) {
        burstPos[i * 3] = pos.x
        burstPos[i * 3 + 1] = pos.y
        burstPos[i * 3 + 2] = 0
        const a = Math.random() * Math.PI * 2
        const s = 8 + Math.random() * 22
        burstVel[i] = { x: Math.cos(a) * s, y: Math.sin(a) * s }
      }
      burstLife = 0.6
      burstMat.opacity = 1
    },
    update(dt) {
      // fade the whole trail slightly every frame
      for (let i = 0; i < TRAIL_N * 3; i++) trailCol[i] = trailCol[i]! * (1 - 1.8 * dt)
      trailGeo.attributes['color']!.needsUpdate = true
      if (burstLife > 0) {
        burstLife -= dt
        for (let i = 0; i < BURST_N; i++) {
          burstPos[i * 3] = burstPos[i * 3]! + burstVel[i]!.x * dt
          burstPos[i * 3 + 1] = burstPos[i * 3 + 1]! + burstVel[i]!.y * dt
        }
        burstMat.opacity = Math.max(0, burstLife / 0.6)
        burstGeo.attributes['position']!.needsUpdate = true
      }
    },
  }
}
```

- [ ] **Step 3: Wire into `src/main.ts`**

In `boot()`: create `const effects = createEffects(rig.scene)` and
`const sfx = createSfx(storage.getMuted())`. Extend `handleEvent`:

```ts
function handleEvent(e: SimEvent): void {
  switch (e.type) {
    case 'launch': rig.fovKick(); sfx.launch(); break
    case 'capture': rig.addShake(1.6); effects.burst(run.ship.pos, 0x67e8f9); sfx.capture(); break
    case 'crystal': effects.burst(run.ship.pos, 0x22d3ee); sfx.crystal(); break
    case 'flyby': sfx.flyby(); break
    case 'death': rig.addShake(2.5); effects.burst(run.ship.pos, 0xf87171); sfx.death(); break
  }
}
```
(change the loop to `for (const e of run.events) handleEvent(e)` and import `SimEvent`
from `./core/sim`). In the frame function, after `pools.updateShip(...)`:

```ts
effects.pushTrail(shipPos, run.mode === 'flying')
effects.update(elapsed)
```

Add a mute button (bottom-right, pointer-events auto) to the HUD in `src/ui/hud.ts`:

```ts
// inside createHud, after insertAdjacentHTML — add to the template:
// <button id="hud-mute" class="hud-mute" aria-label="Ton an/aus">🔊</button>
// and expose a callback:
export interface HudOptions { onToggleMute(): boolean } // returns new muted state
```

```css
/* append to src/ui/style.css */
.hud-mute { position: absolute; right: 16px; bottom: 16px; pointer-events: auto;
  cursor: pointer; background: rgba(10, 14, 28, .6); color: #e2e8f0;
  border: 1px solid rgba(103, 232, 249, .25); border-radius: 99px;
  width: 42px; height: 42px; font-size: 18px; }
```

Wire: `createHud(root, { onToggleMute: () => { const m = !sfx.isMuted(); sfx.setMuted(m);
storage.setMuted(m); return m } })` — button text `🔇` when muted.

- [ ] **Step 4: Manual verify** — launch/capture/crystal sounds audible, trail glows behind
the ship, bursts on capture, mute toggle persists across reloads.

- [ ] **Step 5: Gate + commit**

```bash
npm run gate && npm run build
git add src/audio/sfx.ts src/render/effects.ts src/main.ts src/ui/hud.ts src/ui/style.css
git commit -m "feat: add synth sfx, engine trail, capture bursts, mute toggle"
```

### Task 21: Dev FPS overlay + performance pass

**Files:**
- Create: `src/render/devhud.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement (dev-only, tree-shaken out of prod builds)**

```ts
// src/render/devhud.ts
export function attachDevHud(root: HTMLElement): (frameMs: number) => void {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;color:#0f0;font:11px ui-monospace;z-index:9;opacity:.8'
  root.appendChild(el)
  const samples: number[] = []
  return (frameMs: number) => {
    samples.push(frameMs)
    if (samples.length >= 30) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length
      el.textContent = `${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms`
      samples.length = 0
    }
  }
}
```

In `src/main.ts` (inside `boot`):

```ts
const devHud = import.meta.env.DEV ? attachDevHud(root) : null
// at the end of frame(): devHud?.(performance.now() - now)
```

- [ ] **Step 2: Performance checklist (verify, don't assume)**

- `renderer.info.render.calls` stays roughly constant while flying (pooling works, no
  per-frame allocations of meshes) — log it once in dev and check after 2 minutes of play.
- No geometry/material created inside the frame loop (grep `new THREE.` — must only appear
  in create* functions).
- `npm run build` bundle < 500 kB gzip (three + game; no accidental dev imports).

- [ ] **Step 3: Gate + commit**

```bash
npm run gate && npm run build
git add src/render/devhud.ts src/main.ts
git commit -m "feat: add dev fps overlay and verify pooling budget"
```

### Task 22: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`, `vite.config.ts`

- [ ] **Step 1: Implement**

```ts
// vite.config.ts
import { defineConfig } from 'vite'

// Relative base → works on GitHub Pages project sites without knowing the repo name.
export default defineConfig({
  base: './',
})
```

```yaml
# .github/workflows/deploy.yml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run gate
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

The workflow only becomes active once Nico creates the remote and enables Pages
(Needs Nico) — committing it now costs nothing and completes the repo.

- [ ] **Step 2: Gate + commit**

```bash
npm run gate && npm run build
git add vite.config.ts .github/workflows/deploy.yml
git commit -m "chore: add github pages deploy workflow"
```

### Task 23: Documentation sync + final verification

**Files:**
- Modify: `PROJECT.md` (§Status), `README.md` (Status + Quickstart), `PLAN.md` (check off phases)

- [ ] **Step 1: Update statuses**

- `PROJECT.md` §Status → "v1 code-complete on `autopilot/work` (YYYY-MM-DD): full arcade
  loop playable, N tests green. Needs Nico: live game-feel/fps verify, remote, name."
- `README.md` Status → same one-liner; extend Quickstart with `npm run preview` after build.
- `PLAN.md` → check off completed phase boxes; keep "Needs Nico live verify" items open.

- [ ] **Step 2: Full verification (verification-before-completion gate)**

```bash
npm run gate          # all tests green, lint clean, typecheck clean
npm run build         # production build succeeds
npx vite preview      # smoke: game boots from the production bundle
```

- [ ] **Step 3: Commit**

```bash
git add PROJECT.md README.md PLAN.md
git commit -m "docs: mark v1 code-complete, record open needs-nico items"
```

---

## Execution notes

- Work happens on `autopilot/work`; Nico merges to `main` after review.
- Task order is dependency order — do not parallelize across tasks that touch `src/main.ts`.
- Any deviation from the spec (constants aside) needs an ADR under `docs/adr/`.
- Game-feel tuning (GRAVITY, POWER_*, spacing) is expected and happens ONLY in
  `src/core/constants.ts` — tests are written against the constants, not magic numbers.

## Deferred polish (spec nice-to-haves, add as open PLAN.md items after Task 23)

Consciously NOT in the tasks above, so v1 converges; each is a small standalone iteration:
- Nebula gradient backdrop layers (spec §6) — starfield + fog ship first.
- Slight time-dilation on flyby bonus (spec §6 juice).
- Ambient synth pad (spec §7) — SFX ship first; pad needs volume balancing on real speakers.


