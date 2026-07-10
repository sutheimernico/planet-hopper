import { describe, expect, it } from 'vitest'
import { createStorage } from '../src/core/storage'

describe('createStorage', () => {
  it('reads back what it wrote', () => {
    const mem = new Map<string, string>()
    const backend = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    }
    const s = createStorage(backend)
    s.setHighscore(1234)
    expect(s.getHighscore()).toBe(1234)
    s.setMuted(true)
    expect(s.getMuted()).toBe(true)
  })
  it('survives a throwing backend (private mode)', () => {
    const backend = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    const s = createStorage(backend)
    expect(() => s.setHighscore(1)).not.toThrow()
    expect(s.getHighscore()).toBe(0)
    expect(s.getMuted()).toBe(false)
  })
})
