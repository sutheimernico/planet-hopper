// src/core/milestones.ts
// Fixed per-run milestones (no meta-progression — out of scope by spec): each fires at
// most once per run, and at most one per check so toasts never stack up in one frame.
import type { ScoreState } from './score'

export interface Milestone {
  id: string
  text: string // German UI text
  reached(score: ScoreState): boolean
}

export const MILESTONES: readonly Milestone[] = [
  // mult > 1 exists only after a real flyby (launch-planet exits don't count, sim.ts)
  { id: 'first-flyby', text: 'Erster Vorbeiflug!', reached: (s) => s.mult > 1 },
  { id: 'mult-3', text: '×3 Multiplikator!', reached: (s) => s.mult >= 3 },
  { id: 'points-1000', text: '1.000 Punkte!', reached: (s) => s.points >= 1000 },
  { id: 'points-5000', text: '5.000 Punkte!', reached: (s) => s.points >= 5000 },
  { id: 'points-10000', text: '10.000 Punkte!', reached: (s) => s.points >= 10000 },
  { id: 'crystals-5', text: '5 Kristalle in einem Lauf!', reached: (s) => s.crystals >= 5 },
]

export interface MilestoneTracker {
  check(score: ScoreState): Milestone | null // first newly reached milestone, or null
  reset(): void // new run: every milestone can fire again
}

export function createMilestones(list: readonly Milestone[] = MILESTONES): MilestoneTracker {
  const fired = new Set<string>()
  return {
    check(score) {
      for (const m of list) {
        if (!fired.has(m.id) && m.reached(score)) {
          fired.add(m.id)
          return m
        }
      }
      return null
    },
    reset: () => fired.clear(),
  }
}
