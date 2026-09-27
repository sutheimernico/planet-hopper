import { describe, expect, it } from 'vitest'
import { createStorage, SEED_SLOTS } from '../src/core/storage'

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

describe('seed records', () => {
  const memBackend = () => {
    const mem = new Map<string, string>()
    return {
      mem,
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    }
  }
  it('stores a best per seed, separate from the endless highscore', () => {
    const s = createStorage(memBackend())
    s.setHighscore(900)
    s.setSeedBest('2026-07-21', 4320)
    s.setSeedBest('abc', 77)
    expect(s.getSeedBest('2026-07-21')).toBe(4320)
    expect(s.getSeedBest('abc')).toBe(77)
    expect(s.getSeedBest('2026-07-22')).toBe(0)
    expect(s.getHighscore()).toBe(900)
  })
  it(`keeps only the ${SEED_SLOTS} most recently improved seeds`, () => {
    const s = createStorage(memBackend())
    for (let i = 0; i <= SEED_SLOTS; i++) s.setSeedBest(`s${i}`, i + 1)
    expect(s.getSeedBest('s0')).toBe(0) // evicted
    expect(s.getSeedBest(`s${SEED_SLOTS}`)).toBe(SEED_SLOTS + 1)
  })
  it('keeps the best run\'s ghost with its seed and drops it on a ghost-less new best', () => {
    const s = createStorage(memBackend())
    expect(s.getSeedGhost('abc')).toBeNull()
    s.setSeedBest('abc', 100, { v: 1, launches: [] })
    expect(s.getSeedGhost('abc')).toEqual({ v: 1, launches: [] })
    s.setSeedBest('abc', 200) // e.g. > MAX_RECORDED_LAUNCHES
    expect(s.getSeedGhost('abc')).toBeNull()
  })
  it('persists the ghost toggle, default on', () => {
    const s = createStorage(memBackend())
    expect(s.getGhostEnabled()).toBe(true)
    s.setGhostEnabled(false)
    expect(s.getGhostEnabled()).toBe(false)
  })
  it('treats corrupt seed JSON as no records', () => {
    const b = memBackend()
    b.mem.set('planet-hopper.seeds', '{not json')
    expect(createStorage(b).getSeedBest('x')).toBe(0)
    b.mem.set('planet-hopper.seeds', JSON.stringify([{ seed: 'x', best: 'lots' }, { seed: 'y', best: 5 }]))
    expect(createStorage(b).getSeedBest('x')).toBe(0)
    expect(createStorage(b).getSeedBest('y')).toBe(5)
  })
})
