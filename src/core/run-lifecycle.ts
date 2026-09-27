// src/core/run-lifecycle.ts
// Registry of every subsystem that holds per-run state, in reset order. Three separate
// "forgot to reset X on restart" bugs came from resets scattered across main.ts; now a new
// stateful subsystem must be named here, the Record type forces a reset handler for it,
// and createRunLifecycle refuses handlers for names that are not listed.
export const RUN_RESETTABLES = [
  'session', // sim run, world, gesture, accumulator, event queue
  'ghost', // replay of the seed's best run (reads the new run's seed)
  'milestones', // fired-once set + queued toasts
  'pools', // pooled meshes keyed by entity id — a new world reuses ids
  'effects', // trail + burst particle buffers
] as const

export type RunResettable = (typeof RUN_RESETTABLES)[number]

export interface RunLifecycle {
  resetRun(): void
}

export function createRunLifecycle(handlers: Record<RunResettable, () => void>): RunLifecycle {
  const known: readonly string[] = RUN_RESETTABLES
  for (const name of RUN_RESETTABLES) {
    if (typeof handlers[name] !== 'function') throw new Error(`run lifecycle: no reset for '${name}'`)
  }
  for (const name of Object.keys(handlers)) {
    if (!known.includes(name)) throw new Error(`run lifecycle: '${name}' is not in RUN_RESETTABLES`)
  }
  return {
    resetRun() {
      for (const name of RUN_RESETTABLES) handlers[name]()
    },
  }
}
