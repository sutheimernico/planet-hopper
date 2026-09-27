// src/core/run-driver.ts
import { DT, GENERATE_AHEAD, PRUNE_BEHIND } from './constants'
import type { LaunchInput } from './replay'
import { launch, newRun, tickRun, type RunState, type SimEvent } from './sim'
import type { Vec } from './vec'
import { createWorld, type World } from '../world/generator'

// One run's simulation: seeded world + RunState + tick counter. Owns nothing visual —
// the live game and the ghost replay drive identical instances of it.
export interface RunDriver {
  readonly seed: number
  state(): RunState
  world(): World
  prevShipPos(): Vec // ship position before the last tick — render interpolation anchor
  ticks(): number // fixed steps run so far
  // Applies a launch between ticks; returns its events ([] when rejected: wrong mode or
  // not enough fuel). launch() bypasses tickRun, so these events exist nowhere else —
  // the caller must forward them (historical "launch event dropped" bug, Task 20 review).
  launch(dir: Vec, power01: number): readonly SimEvent[]
  step(): readonly SimEvent[] // one fixed tick; returns this tick's events
  // every accepted launch with the tick it happened before — with the seed, this is the
  // complete input of the run (the ghost replay needs nothing else)
  launches(): readonly LaunchInput[]
}

export function createRunDriver(seed: number): RunDriver {
  const world = createWorld(seed)
  world.ensureUntil(GENERATE_AHEAD)
  let run = newRun(world.snapshot())
  let prev = run.ship.pos
  let ticks = 0
  const inputs: LaunchInput[] = []

  return {
    seed,
    state: () => run,
    world: () => world,
    prevShipPos: () => prev,
    ticks: () => ticks,
    launch(dir, power01) {
      const next = launch(run, world.snapshot(), dir, power01)
      if (next === run) return [] // launch() returns its input unchanged when rejected
      run = next
      inputs.push({ t: ticks, x: dir.x, y: dir.y, p: power01 })
      return run.events
    },
    step() {
      prev = run.ship.pos
      run = tickRun(run, world.snapshot(), DT)
      ticks++
      // Per tick, not per frame: generation and pruning then depend only on the tick
      // count, never on frame pacing — required for the ghost replay to reproduce a run
      // exactly. Both calls are O(1) when there is nothing to do (prune early-exits).
      world.ensureUntil(run.ship.pos.x + GENERATE_AHEAD)
      world.prune(run.ship.pos.x - PRUNE_BEHIND)
      return run.events
    },
    launches: () => inputs,
  }
}
