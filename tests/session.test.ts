import { describe, expect, it } from 'vitest'
import { DT } from '../src/core/constants'
import { createSession } from '../src/core/session'
import type { GamePhase } from '../src/core/state'
import { vec } from '../src/core/vec'

const aim = { dir: vec(1, 0), power01: 0.5 }

const setup = () => {
  const phases: GamePhase[] = []
  const s = createSession(42, (p) => phases.push(p))
  return { s, phases }
}

describe('session gesture + phase wiring', () => {
  it('reports only real phase changes', () => {
    const { s, phases } = setup()
    s.send('pause') // invalid from menu → no-op
    s.send('start')
    s.send('pause')
    s.send('resume')
    expect(phases).toEqual(['playing', 'paused', 'playing'])
  })
  it('ignores aim input outside playing', () => {
    const { s } = setup()
    s.aim(aim)
    expect(s.heldAim()).toBeNull()
    expect(s.canAim()).toBe(false)
  })
  it('holds the aim while dragging and ends the gesture on release, cancel and pause', () => {
    const { s } = setup()
    s.send('start')
    expect(s.canAim()).toBe(true)
    s.aim(aim)
    expect(s.heldAim()).toEqual(aim)
    s.cancel()
    expect(s.heldAim()).toBeNull()
    s.aim(aim)
    s.send('pause')
    expect(s.heldAim()).toBeNull()
    s.aim(aim) // captured pointer keeps dragging across the pause — ignored
    s.release(aim) // no launch while paused
    expect(s.driver().state().mode).toBe('orbiting')
    s.send('resume')
    s.aim(aim)
    s.release(aim)
    expect(s.heldAim()).toBeNull()
    expect(s.driver().state().mode).toBe('flying')
  })
  it('runs no ticks unless playing', () => {
    const { s } = setup()
    expect(s.advance(0.1)).toBe(0)
    s.send('start')
    expect(s.advance(DT * 3 + 1e-9)).toBe(3)
    s.send('pause')
    expect(s.advance(0.1)).toBe(0)
  })
  it('resetRun starts a fresh run on the given seed and drops queued events', () => {
    const { s } = setup()
    s.send('start')
    s.aim(aim)
    s.release(aim)
    s.resetRun(7)
    const drained: string[] = []
    s.drain((e) => drained.push(e.type))
    expect(drained).toEqual([])
    expect(s.driver().seed).toBe(7)
    expect(s.driver().state().mode).toBe('orbiting')
    expect(s.heldAim()).toBeNull()
  })
})
