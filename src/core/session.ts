// src/core/session.ts
import { createAccumulator } from './loop'
import { createRunDriver, type RunDriver } from './run-driver'
import type { SimEvent } from './sim'
import { transition, type GameEvent, type GamePhase } from './state'
import type { Aim } from '../input/aim'

// Input → simulation wiring without DOM or Three.js: game phase, the held aim gesture,
// the fixed-timestep accumulator and one queue that collects every sim event — tick events
// and the launch events that bypass tickRun — until main.ts drains it once per frame.
export interface Session {
  phase(): GamePhase
  driver(): RunDriver
  heldAim(): Aim | null // non-null only while a drag is in progress during 'playing'
  alpha(): number // render interpolation factor
  send(event: GameEvent): void
  resetRun(seed: number): void // fresh run on a new world; the 'session' lifecycle entry
  canAim(): boolean
  aim(a: Aim): void
  release(a: Aim): void
  cancel(): void
  advance(elapsedSeconds: number): number // fixed ticks run this frame (0 unless playing)
  drain(handle: (e: SimEvent) => void): void // every event since the last drain, exactly once
}

export function createSession(seed: number, onPhase: (phase: GamePhase) => void): Session {
  let phase: GamePhase = 'menu'
  let driver = createRunDriver(seed)
  let acc = createAccumulator()
  let held: Aim | null = null
  const queue: SimEvent[] = []

  const enqueue = (events: readonly SimEvent[]): void => {
    for (const e of events) queue.push(e)
  }
  // the one place the aim gesture ends — release, cancel, leaving 'playing' and run reset
  // all route here (previously three hand-copied reset sequences in main.ts)
  const clearGesture = (): void => {
    held = null
  }

  const send = (event: GameEvent): void => {
    const next = transition(phase, event)
    if (next === phase) return
    phase = next
    // leaving 'playing' (pause, tab-hide, death) must freeze the aim gesture — with
    // pointer capture a mid-drag release could otherwise launch while paused (Task 19 review)
    if (phase !== 'playing') clearGesture()
    onPhase(phase)
  }

  return {
    phase: () => phase,
    driver: () => driver,
    heldAim: () => held,
    alpha: () => acc.alpha(),
    send,
    resetRun(nextSeed) {
      driver = createRunDriver(nextSeed)
      // a leftover step residual must not leak into the new run (Task 19 review)
      acc = createAccumulator()
      clearGesture()
      queue.length = 0
    },
    canAim: () => phase === 'playing' && driver.state().mode === 'orbiting',
    aim(a) {
      if (phase === 'playing') held = a // a captured pointer keeps dragging across a pause
    },
    release(a) {
      if (phase !== 'playing') return // no launch from a drag that outlived 'playing'
      clearGesture()
      // the launch event exists only in this return value — queue it or it is lost
      enqueue(driver.launch(a.dir, a.power01))
    },
    cancel: clearGesture,
    advance(elapsedSeconds) {
      if (phase !== 'playing') return 0
      const steps = acc.advance(elapsedSeconds)
      for (let i = 0; i < steps; i++) enqueue(driver.step())
      if (driver.state().mode === 'dead') send('die')
      return steps
    },
    drain(handle) {
      for (let i = 0; i < queue.length; i++) handle(queue[i]!)
      queue.length = 0
    },
  }
}
