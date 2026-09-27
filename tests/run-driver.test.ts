import { describe, expect, it } from 'vitest'
import { FUEL_MAX, GENERATE_AHEAD } from '../src/core/constants'
import { createRunDriver } from '../src/core/run-driver'
import { vec } from '../src/core/vec'

describe('run driver', () => {
  it('starts orbiting the home planet of its seeded world', () => {
    const d = createRunDriver(42)
    expect(d.state().mode).toBe('orbiting')
    expect(d.state().fuel).toBe(FUEL_MAX)
    expect(d.ticks()).toBe(0)
    expect(d.world().snapshot().planets.at(-1)!.pos.x).toBeGreaterThanOrEqual(GENERATE_AHEAD)
  })
  it('returns the launch event from launch() — it exists nowhere else', () => {
    const d = createRunDriver(42)
    expect(d.launch(vec(1, 0), 0.5)).toEqual([{ type: 'launch' }])
    expect(d.state().mode).toBe('flying')
    // the next tick replaces events — the launch event is gone from the state
    expect(d.step().some((e) => e.type === 'launch')).toBe(false)
  })
  it('returns no events and keeps state when a launch is rejected', () => {
    const d = createRunDriver(42)
    d.launch(vec(1, 0), 0.5)
    const before = d.state()
    expect(d.launch(vec(1, 0), 0.5)).toEqual([]) // already flying
    expect(d.state()).toBe(before)
  })
  it('counts ticks and tracks the pre-tick position for interpolation', () => {
    const d = createRunDriver(42)
    const p0 = d.state().ship.pos
    d.step()
    expect(d.ticks()).toBe(1)
    expect(d.prevShipPos()).toEqual(p0)
    expect(d.state().ship.pos).not.toEqual(p0)
  })
})
