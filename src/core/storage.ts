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
}

const KEY_HIGHSCORE = 'planet-hopper.highscore'
const KEY_MUTED = 'planet-hopper.muted'

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
  return {
    getHighscore: () => Number(read(KEY_HIGHSCORE) ?? 0) || 0,
    setHighscore: (v) => write(KEY_HIGHSCORE, String(v)),
    getMuted: () => read(KEY_MUTED) === '1',
    setMuted: (v) => write(KEY_MUTED, v ? '1' : '0'),
  }
}
