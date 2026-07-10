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
