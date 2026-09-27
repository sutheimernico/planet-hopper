// src/core/storage.ts
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface GameStorage {
  getHighscore(): number
  setHighscore(v: number): void
  getMuted(): boolean
  setMuted(v: boolean): void
  // best score per fixed seed (daily challenge date or ?seed= link) — kept apart from the
  // endless highscore; only the SEED_SLOTS most recently improved seeds are remembered
  getSeedBest(seed: string): number
  setSeedBest(seed: string, points: number): void
}

interface SeedEntry {
  seed: string
  best: number
}

const KEY_HIGHSCORE = 'planet-hopper.highscore'
const KEY_MUTED = 'planet-hopper.muted'
const KEY_SEEDS = 'planet-hopper.seeds'
export const SEED_SLOTS = 4 // bounded: today's daily + a few shared links

const isSeedEntry = (e: unknown): e is SeedEntry =>
  typeof e === 'object' && e !== null &&
  typeof (e as SeedEntry).seed === 'string' && Number.isFinite((e as SeedEntry).best)

// Wraps localStorage so private-mode/denied storage degrades to in-run defaults.
export function createStorage(backend: StorageBackend): GameStorage {
  const read = (key: string): string | null => {
    try {
      return backend.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key: string, value: string): void => {
    try {
      backend.setItem(key, value)
    } catch {
      /* private mode — non-fatal */
    }
  }
  // corrupt or foreign JSON degrades to "no records", never to a crash
  const readSeeds = (): SeedEntry[] => {
    try {
      const parsed: unknown = JSON.parse(read(KEY_SEEDS) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter(isSeedEntry) : []
    } catch {
      return []
    }
  }
  return {
    getHighscore: () => Number(read(KEY_HIGHSCORE) ?? 0) || 0,
    setHighscore: (v) => write(KEY_HIGHSCORE, String(v)),
    getMuted: () => read(KEY_MUTED) === '1',
    setMuted: (v) => write(KEY_MUTED, v ? '1' : '0'),
    getSeedBest: (seed) => readSeeds().find((e) => e.seed === seed)?.best ?? 0,
    setSeedBest(seed, points) {
      // most recent last; the oldest record falls off beyond SEED_SLOTS
      const entries = [...readSeeds().filter((e) => e.seed !== seed), { seed, best: points }]
      write(KEY_SEEDS, JSON.stringify(entries.slice(-SEED_SLOTS)))
    },
  }
}
