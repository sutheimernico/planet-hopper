// src/core/daily.ts
// Seeds as strings: shareable in a URL, typeable, and the same string always yields the
// same world — the daily challenge is just the seed "YYYY-MM-DD" (UTC).
const SEED_PATTERN = /^[A-Za-z0-9_-]{1,32}$/ // URL-safe as-is, bounded length
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// `?seed=` value → seed, or null (missing/invalid → the caller falls back to random)
export const parseSeed = (raw: string | null): string | null =>
  raw !== null && SEED_PATTERN.test(raw) ? raw : null

// FNV-1a 32-bit: tiny and platform-stable, so a shared link builds the same world anywhere.
export function seedToNumber(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const dailySeed = (now: Date): string => now.toISOString().slice(0, 10)
export const isDailySeed = (seed: string): boolean => DATE_PATTERN.test(seed)

// German label for a seeded run ("Tages-Challenge 2026-07-21" / "Seed „abc“")
export const seedLabel = (seed: string): string =>
  isDailySeed(seed) ? `Tages-Challenge ${seed}` : `Seed „${seed}“`

// pageUrl: origin + path of the running game, without query/hash
export const shareUrl = (pageUrl: string, seed: string): string =>
  `${pageUrl}?seed=${encodeURIComponent(seed)}`

const numberFmt = new Intl.NumberFormat('de-DE')

export const shareText = (seed: string, points: number, pageUrl: string): string =>
  `Planet Hopper ${seedLabel(seed)}: ${numberFmt.format(Math.floor(points))} Punkte — ` +
  `schaffst du mehr? ${shareUrl(pageUrl, seed)}`
