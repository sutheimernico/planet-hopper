import { describe, expect, it } from 'vitest'
import {
  dailySeed, isDailySeed, parseSeed, seedLabel, seedToNumber, shareText, shareUrl,
} from '../src/core/daily'
import { createWorld } from '../src/world/generator'

describe('seed param', () => {
  it('round-trips through a share link', () => {
    for (const seed of ['2026-07-21', 'abc', 'Nico_42-x']) {
      const url = new URL(shareUrl('https://example.org/planet-hopper/', seed))
      expect(parseSeed(url.searchParams.get('seed'))).toBe(seed)
    }
  })
  it('rejects missing and invalid values (→ random fallback)', () => {
    for (const raw of [null, '', 'a b', '<script>', 'ä', 'x'.repeat(33)]) {
      expect(parseSeed(raw)).toBeNull()
    }
    expect(parseSeed('x'.repeat(32))).toBe('x'.repeat(32))
  })
})

describe('daily seed', () => {
  it('is the UTC date, stable across the whole UTC day', () => {
    expect(dailySeed(new Date('2026-07-21T00:00:00Z'))).toBe('2026-07-21')
    expect(dailySeed(new Date('2026-07-21T23:59:59Z'))).toBe('2026-07-21')
    expect(dailySeed(new Date('2026-07-22T00:00:00Z'))).toBe('2026-07-22')
    expect(isDailySeed('2026-07-21')).toBe(true)
    expect(isDailySeed('abc')).toBe(false)
  })
  it('builds the identical world for everyone on the same day, a different one tomorrow', () => {
    const a = createWorld(seedToNumber(dailySeed(new Date('2026-07-21T08:00:00Z'))))
    const b = createWorld(seedToNumber(dailySeed(new Date('2026-07-21T20:00:00Z'))))
    const c = createWorld(seedToNumber('2026-07-22'))
    for (const w of [a, b, c]) w.ensureUntil(1500)
    expect(a.snapshot()).toEqual(b.snapshot())
    expect(c.snapshot()).not.toEqual(a.snapshot())
  })
  it('hashes to a stable unsigned 32-bit number (FNV-1a)', () => {
    expect(seedToNumber('')).toBe(0x811c9dc5)
    expect(seedToNumber('a')).toBe(0xe40c292c) // FNV-1a reference value
    expect(seedToNumber('2026-07-21')).toBe(seedToNumber('2026-07-21'))
  })
})

describe('share text', () => {
  it('formats the daily challenge in German with a replay link', () => {
    expect(shareText('2026-07-21', 4320.7, 'https://example.org/')).toBe(
      'Planet Hopper Tages-Challenge 2026-07-21: 4.320 Punkte — schaffst du mehr? ' +
        'https://example.org/?seed=2026-07-21',
    )
  })
  it('labels custom seeds', () => {
    expect(seedLabel('abc')).toBe('Seed „abc“')
    expect(shareText('abc', 12, 'https://x.y/')).toContain('Seed „abc“: 12 Punkte')
  })
})

describe('no network access anywhere in src (fully static — PROJECT.md §1)', () => {
  // Vite's glob import reads every source file as text — no @types/node needed
  const sources = import.meta.glob<string>('../src/**/*.{ts,css,html}', {
    query: '?raw', import: 'default', eager: true,
  })
  it('uses no fetch/XHR/WebSocket/beacon/EventSource', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    const offenders = Object.entries(sources)
      .filter(([, text]) => /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
