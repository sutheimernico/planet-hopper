// src/core/score.ts
import {
  CRYSTAL_POINTS, DIST_POINTS_PER_WU, FLYBY_POINTS, MULT_DECAY_SECONDS, MULT_MAX, MULT_STEP,
} from './constants'

export interface ScoreState {
  points: number // float internally; UI floors it
  crystals: number
  mult: number
  multTimer: number // seconds until mult resets to 1
  maxX: number
}

export const initialScore = (): ScoreState => ({
  points: 0, crystals: 0, mult: 1, multTimer: 0, maxX: 0,
})

export function tickScore(s: ScoreState, shipX: number, dt: number): ScoreState {
  const maxX = Math.max(s.maxX, shipX)
  const points = s.points + (maxX - s.maxX) * DIST_POINTS_PER_WU * s.mult
  const multTimer = Math.max(0, s.multTimer - dt)
  return { ...s, maxX, points, multTimer, mult: multTimer > 0 ? s.mult : 1 }
}

export function onCrystal(s: ScoreState): ScoreState {
  return { ...s, crystals: s.crystals + 1, points: s.points + CRYSTAL_POINTS * s.mult }
}

export function onFlyby(s: ScoreState): ScoreState {
  const mult = Math.min(MULT_MAX, s.mult + MULT_STEP)
  return { ...s, mult, multTimer: MULT_DECAY_SECONDS, points: s.points + FLYBY_POINTS * mult }
}
