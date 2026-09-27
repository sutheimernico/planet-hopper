// Event-drain smoke test (ghost-and-shine Task 3): drives the real session — the same
// object main.ts wires to pointer events and the frame loop — through a whole hop.
import { describe, expect, it } from 'vitest'
import { DT, PREVIEW_SAMPLE_EVERY } from '../src/core/constants'
import { createSession, type Session } from '../src/core/session'
import type { SimEvent } from '../src/core/sim'
import { vec } from '../src/core/vec'
import { findLaunchFrom } from './helpers/reach'

const SEED = 42

const drainTypes = (s: Session): SimEvent['type'][] => {
  const out: SimEvent['type'][] = []
  s.drain((e) => out.push(e.type))
  return out
}

// one rendered frame worth exactly one fixed tick
const frame = (s: Session): SimEvent['type'][] => {
  s.advance(DT)
  return drainTypes(s)
}

const aimAtNextPlanet = (s: Session) => {
  const run = s.driver().state()
  const world = s.driver().world().snapshot()
  const from = world.planets.find((p) => p.id === run.orbit!.planetId)!
  const target = world.planets[world.planets.indexOf(from) + 1]!
  const found = findLaunchFrom(run.ship.pos, world, from, target)
  expect(found).not.toBeNull()
  return { aim: found!, target }
}

describe('session integration: aim → launch → drain → pause → resume → capture', () => {
  it('delivers the launch event exactly once, survives a mid-flight pause, then captures', () => {
    const phases: string[] = []
    const s = createSession(SEED, (p) => phases.push(p))
    s.send('start')
    frame(s)
    const { aim, target } = aimAtNextPlanet(s)

    s.aim(aim)
    s.release(aim)
    // historical bug: launch() bypasses tickRun, whose next tick replaces `events` — the
    // launch event must survive into the drain even though a tick runs before it
    expect(frame(s)).toEqual(['launch'])
    expect(drainTypes(s)).toEqual([]) // drained exactly once

    for (let i = 0; i < 30; i++) frame(s)
    s.send('pause')
    const frozen = s.driver().state()
    expect(s.advance(1)).toBe(0)
    expect(s.driver().state()).toBe(frozen)
    s.send('resume')

    const seen: SimEvent['type'][] = []
    for (let i = 0; i < 1200 && !seen.includes('capture'); i++) seen.push(...frame(s))
    expect(seen).toContain('capture')
    expect(seen).not.toContain('launch')
    expect(s.driver().state().mode).toBe('orbiting')
    expect(s.driver().state().orbit?.planetId).toBe(target.id)
    expect(phases).toEqual(['playing', 'paused', 'playing'])
  })

  it('keeps the held-aim preview anchored to the orbiting ship (stale-preview regression)', () => {
    const s = createSession(SEED, () => {})
    s.send('start')
    const aim = { dir: vec(1, 0.2), power01: 0.6 }
    s.aim(aim)
    const first = s.previewPath()!
    for (let i = 0; i < 120; i++) frame(s) // pointer rests for one second
    const later = s.previewPath()!
    expect(later[0]).not.toEqual(first[0])
    // the first sample is one integrator step from the ship's current position
    const ship = s.driver().state().ship.pos
    expect(Math.hypot(later[0]!.x - ship.x, later[0]!.y - ship.y)).toBeLessThan(1)
  })

  it('flies exactly the previewed path after release (no fake preview)', () => {
    const s = createSession(SEED, () => {})
    s.send('start')
    frame(s)
    const { aim } = aimAtNextPlanet(s)
    s.aim(aim)
    const path = s.previewPath()!
    s.release(aim)
    let compared = 0
    flight: for (let i = 0; i < path.length; i++) {
      for (let k = 0; k < PREVIEW_SAMPLE_EVERY; k++) {
        if (s.driver().state().mode !== 'flying') break flight // captured — compared up to here
        s.advance(DT)
        // preview keeps samples 0, 4, 8, … → the ship after tick 1, 5, 9, …
        if (k === 0 && s.driver().state().mode === 'flying') {
          expect(s.driver().state().ship.pos).toEqual(path[i])
          compared++
        }
      }
    }
    expect(compared).toBeGreaterThan(5)
  })

  it('ends the run on death: phase → gameover, death event drained once', () => {
    const phases: string[] = []
    const s = createSession(SEED, (p) => phases.push(p))
    s.send('start')
    frame(s)
    const back = { dir: vec(-1, 0), power01: 1 } // straight out of the corridor, into the void
    s.release(back)
    const seen: SimEvent['type'][] = []
    for (let i = 0; i < 2000 && s.phase() === 'playing'; i++) seen.push(...frame(s))
    expect(s.phase()).toBe('gameover')
    expect(seen.filter((t) => t === 'death')).toHaveLength(1)
    expect(frame(s)).toEqual([]) // no ticks after gameover
    expect(phases.at(-1)).toBe('gameover')
  })
})
