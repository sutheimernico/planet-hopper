import { describe, expect, it } from 'vitest'
import {
  createRecording, createReplay, MAX_RECORDED_LAUNCHES, parseRecording, RECORDING_VERSION,
  type Recording,
} from '../src/core/replay'
import { createRunDriver, type RunDriver } from '../src/core/run-driver'
import { findLaunchFrom } from './helpers/reach'

const SEED = 20260721

// FNV-1a over the raw float64 bytes of the ship position — any bit difference shows up
const f64 = new Float64Array(2)
const bytes = new Uint8Array(f64.buffer)
const hashPos = (d: RunDriver): number => {
  const { x, y } = d.state().ship.pos
  f64[0] = x
  f64[1] = y
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193)
  return h >>> 0
}

// A real run: idles in orbit for a varying time, hops three planets via searched launches,
// then launches into the void and dies. Returns the recording + per-tick position hashes.
function playRun(): { rec: Recording; hashes: number[] } {
  const d = createRunDriver(SEED)
  const hashes: number[] = []
  const step = (): void => {
    d.step()
    hashes.push(hashPos(d))
  }
  for (let hop = 0; hop < 3; hop++) {
    for (let i = 0; i < 17 + hop * 23; i++) step()
    const run = d.state()
    const world = d.world().snapshot()
    const from = world.planets.find((p) => p.id === run.orbit!.planetId)!
    const target = world.planets[world.planets.indexOf(from) + 1]!
    const aim = findLaunchFrom(run.ship.pos, world, from, target)!
    expect(d.launch(aim.dir, aim.power01)).toHaveLength(1)
    for (let i = 0; i < 5000 && d.state().mode === 'flying'; i++) step()
    expect(d.state().orbit?.planetId).toBe(target.id)
  }
  expect(d.launch({ x: 0, y: 1 }, 1)).toHaveLength(1) // straight out of the corridor
  for (let i = 0; i < 5000 && d.state().mode !== 'dead'; i++) step()
  expect(d.state().mode).toBe('dead')
  for (let i = 0; i < 10; i++) step() // dead ticks are part of the sequence too
  const rec = createRecording(SEED, d.state().score.points, d.launches())!
  return { rec, hashes }
}

const replayHashes = (rec: Recording, ticks: number): number[] => {
  const r = createReplay(rec)
  const out: number[] = []
  for (let i = 0; i < ticks; i++) {
    r.advance(1)
    out.push(hashPos(r.driver()))
  }
  return out
}

describe('ghost replay determinism', () => {
  const { rec, hashes } = playRun()

  it('records the seed and every accepted launch', () => {
    expect(rec.v).toBe(RECORDING_VERSION)
    expect(rec.seed).toBe(SEED)
    expect(rec.launches).toHaveLength(4)
  })
  it('same seed + same inputs ⇒ identical per-tick state sequence', () => {
    expect(replayHashes(rec, hashes.length)).toEqual(hashes)
  })
  it('survives the localStorage JSON round-trip bit-for-bit', () => {
    const restored = parseRecording(JSON.parse(JSON.stringify(rec)), SEED)
    expect(restored).not.toBeNull()
    expect(replayHashes(restored!, hashes.length)).toEqual(hashes)
  })
  it('batched advance(n) equals n single steps (frame pacing is irrelevant)', () => {
    const r = createReplay(rec)
    r.advance(hashes.length)
    expect(hashPos(r.driver())).toBe(hashes.at(-1))
  })
  it('is sensitive: a 1e-12 change in one launch power diverges the ghost', () => {
    const nudged: Recording = {
      ...rec, launches: rec.launches.map((l, i) => (i === 1 ? { ...l, p: l.p + 1e-12 } : l)),
    }
    expect(replayHashes(nudged, hashes.length)).not.toEqual(hashes)
  })
})

describe('recording schema', () => {
  const valid = { v: RECORDING_VERSION, seed: 7, points: 100, launches: [{ t: 3, x: 1, y: 0, p: 0.5 }] }
  it('accepts a valid current-version recording', () => {
    expect(parseRecording(valid, 7)).toEqual(valid)
  })
  it('silently rejects old, foreign or corrupt data (→ no ghost)', () => {
    const bad: unknown[] = [
      null, 'x', 42, [],
      { ...valid, v: 0 }, { ...valid, v: undefined }, // older schema
      { ...valid, seed: 8 }, // recorded on another world
      { ...valid, points: 'many' },
      { ...valid, launches: 'none' },
      { ...valid, launches: [{ t: -1, x: 1, y: 0, p: 0.5 }] },
      { ...valid, launches: [{ t: 1.5, x: 1, y: 0, p: 0.5 }] },
      { ...valid, launches: [{ t: 3, x: NaN, y: 0, p: 0.5 }] },
      { ...valid, launches: [{ t: 3, x: 0, y: 0, p: 0.5 }] }, // zero aim would soft-lock
      { ...valid, launches: [{ t: 3, x: 1, y: 0, p: 1.5 }] },
      { ...valid, launches: [{ t: 9, x: 1, y: 0, p: 0.5 }, { t: 9, x: 1, y: 0, p: 0.5 }] },
      { ...valid, launches: [{ t: 9, x: 1, y: 0, p: 0.5 }, { t: 4, x: 1, y: 0, p: 0.5 }] },
      { ...valid, launches: Array.from({ length: MAX_RECORDED_LAUNCHES + 1 }, (_, i) => ({ t: i * 10, x: 1, y: 0, p: 0.5 })) },
    ]
    for (const raw of bad) expect(parseRecording(raw, 7)).toBeNull()
  })
  it(`stores no ghost for runs with more than ${MAX_RECORDED_LAUNCHES} launches`, () => {
    const many = Array.from({ length: MAX_RECORDED_LAUNCHES + 1 }, (_, i) => ({ t: i * 10, x: 1, y: 0, p: 0.5 }))
    expect(createRecording(7, 1, many)).toBeNull()
    expect(createRecording(7, 1, many.slice(1))).not.toBeNull()
  })
})
