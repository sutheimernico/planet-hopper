import { describe, expect, it } from 'vitest'
import { createRunLifecycle, RUN_RESETTABLES, type RunResettable } from '../src/core/run-lifecycle'

const recordingHandlers = (calls: string[]): Record<RunResettable, () => void> =>
  Object.fromEntries(RUN_RESETTABLES.map((n) => [n, () => void calls.push(n)])) as Record<RunResettable, () => void>

describe('run lifecycle registry', () => {
  it('enumerates every per-run stateful subsystem (update this list with a reset handler)', () => {
    expect(RUN_RESETTABLES).toEqual(['session', 'ghost', 'pools', 'effects'])
  })
  it('resets every registered subsystem exactly once, in registry order', () => {
    const calls: string[] = []
    const life = createRunLifecycle(recordingHandlers(calls))
    life.resetRun()
    expect(calls).toEqual([...RUN_RESETTABLES])
    life.resetRun()
    expect(calls).toHaveLength(RUN_RESETTABLES.length * 2)
  })
  it('refuses to build when a listed subsystem has no reset handler', () => {
    const handlers = recordingHandlers([]) as Partial<Record<RunResettable, () => void>>
    delete handlers.pools
    expect(() => createRunLifecycle(handlers as Record<RunResettable, () => void>)).toThrow(/pools/)
  })
  it('refuses a stateful subsystem that is wired in but not registered in RUN_RESETTABLES', () => {
    const handlers = { ...recordingHandlers([]), trail2: () => {} }
    expect(() => createRunLifecycle(handlers as Record<RunResettable, () => void>)).toThrow(/trail2/)
  })
})
