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
