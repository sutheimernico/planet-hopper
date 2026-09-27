// src/core/replay.ts
// Ghost replay: a run is fully determined by its world seed plus the launches (tick, aim,
// power) — the sim is fixed-timestep and seeded — so a recording is tiny and playback is
// just a second RunDriver fed the same inputs at the same ticks.
import { createRunDriver, type RunDriver } from './run-driver'

export const RECORDING_VERSION = 1
// cap keeps the stored JSON small (~4 kB); longer runs keep their score but get no ghost
export const MAX_RECORDED_LAUNCHES = 50

export interface LaunchInput {
  t: number // driver tick count when the launch was applied (before that tick ran)
  x: number // aim direction
  y: number
  p: number // power01
}

export interface Recording {
  v: typeof RECORDING_VERSION
  seed: number // numeric world seed (createWorld input)
  points: number
  launches: LaunchInput[]
}

export function createRecording(
  seed: number, points: number, launches: readonly LaunchInput[],
): Recording | null {
  if (launches.length > MAX_RECORDED_LAUNCHES) return null
  return { v: RECORDING_VERSION, seed, points, launches: launches.map((l) => ({ ...l })) }
}

const isLaunch = (l: unknown, prevT: number): l is LaunchInput => {
  if (typeof l !== 'object' || l === null) return false
  const { t, x, y, p } = l as Record<string, unknown>
  return Number.isInteger(t) && (t as number) >= prevT &&
    Number.isFinite(x) && Number.isFinite(y) && ((x as number) !== 0 || (y as number) !== 0) &&
    typeof p === 'number' && p >= 0 && p <= 1
}

// Stored data is untrusted (old schema, hand-edited, truncated): anything that is not a
// valid current-version recording for the expected seed yields null → silently no ghost.
export function parseRecording(raw: unknown, expectedSeed: number): Recording | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r['v'] !== RECORDING_VERSION || r['seed'] !== expectedSeed) return null
  if (!Number.isFinite(r['points']) || !Array.isArray(r['launches'])) return null
  const launches: unknown[] = r['launches']
  if (launches.length > MAX_RECORDED_LAUNCHES) return null
  let prevT = 0
  for (const l of launches) {
    if (!isLaunch(l, prevT)) return null
    prevT = l.t + 1 // at most one launch per tick: the ship is flying right after one
  }
  return createRecording(expectedSeed, r['points'] as number, launches as LaunchInput[])
}

export interface Replay {
  driver(): RunDriver
  advance(ticks: number): void // step in lockstep with the live run
}

export function createReplay(rec: Recording): Replay {
  const driver = createRunDriver(rec.seed)
  let next = 0
  return {
    driver: () => driver,
    advance(ticks) {
      for (let i = 0; i < ticks; i++) {
        const l = rec.launches[next]
        if (l && l.t === driver.ticks()) {
          driver.launch({ x: l.x, y: l.y }, l.p)
          next++
        }
        driver.step()
      }
    },
  }
}
