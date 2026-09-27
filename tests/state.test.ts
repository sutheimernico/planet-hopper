import { describe, expect, it } from 'vitest'
import { transition, type GameEvent, type GamePhase } from '../src/core/state'

describe('transition', () => {
  const cases: Array<[GamePhase, GameEvent, GamePhase]> = [
    ['menu', 'start', 'playing'],
    ['playing', 'pause', 'paused'],
    ['paused', 'resume', 'playing'],
    ['playing', 'die', 'gameover'],
    ['gameover', 'restart', 'playing'],
    ['gameover', 'menu', 'menu'],
    // invalid events leave the phase unchanged
    ['menu', 'pause', 'menu'],
    ['paused', 'die', 'paused'],
    ['gameover', 'pause', 'gameover'],
    ['playing', 'menu', 'playing'],
  ]
  it.each(cases)('%s + %s → %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to)
  })
})
