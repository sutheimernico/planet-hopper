// src/core/state.ts
export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover'
export type GameEvent = 'start' | 'pause' | 'resume' | 'die' | 'restart'

const TABLE: Record<GamePhase, Partial<Record<GameEvent, GamePhase>>> = {
  menu: { start: 'playing' },
  playing: { pause: 'paused', die: 'gameover' },
  paused: { resume: 'playing' },
  gameover: { restart: 'playing' },
}

export const transition = (phase: GamePhase, event: GameEvent): GamePhase =>
  TABLE[phase][event] ?? phase
