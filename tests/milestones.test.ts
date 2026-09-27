import { describe, expect, it } from 'vitest'
import { createMilestones, MILESTONES } from '../src/core/milestones'
import { initialScore, type ScoreState } from '../src/core/score'

const score = (patch: Partial<ScoreState>): ScoreState => ({ ...initialScore(), ...patch })

describe('milestones', () => {
  it('covers exactly the fixed set from the plan', () => {
    expect(MILESTONES.map((m) => m.id)).toEqual([
      'first-flyby', 'mult-3', 'points-1000', 'points-5000', 'points-10000', 'crystals-5',
    ])
  })
  it('fires nothing on a fresh run', () => {
    expect(createMilestones().check(initialScore())).toBeNull()
  })
  it('fires each milestone once per run', () => {
    const t = createMilestones()
    expect(t.check(score({ points: 1200 }))?.id).toBe('points-1000')
    expect(t.check(score({ points: 1300 }))).toBeNull()
    expect(t.check(score({ crystals: 5 }))?.id).toBe('crystals-5')
    expect(t.check(score({ crystals: 6 }))).toBeNull()
  })
  it('emits at most one per check, the rest on following checks', () => {
    const t = createMilestones()
    const s = score({ points: 12000, mult: 3.5, crystals: 7 }) // everything at once
    const got: string[] = []
    for (let i = 0; i < 10; i++) {
      const m = t.check(s)
      if (m) got.push(m.id)
    }
    expect(got).toEqual(MILESTONES.map((m) => m.id))
  })
  it('first flyby and ×3 read the multiplier', () => {
    const t = createMilestones()
    expect(t.check(score({ mult: 1.5 }))?.id).toBe('first-flyby')
    expect(t.check(score({ mult: 2.5 }))).toBeNull()
    expect(t.check(score({ mult: 3 }))?.id).toBe('mult-3')
  })
  it('re-arms on reset (restart via the run lifecycle registry)', () => {
    const t = createMilestones()
    t.check(score({ points: 1000 }))
    t.reset()
    expect(t.check(score({ points: 1000 }))?.id).toBe('points-1000')
  })
})
