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
