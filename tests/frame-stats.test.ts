import { describe, expect, it } from 'vitest'
import { createFrameStats } from '../src/core/frame-stats'

describe('frame stats (dev overlay)', () => {
  it('derives fps from the frame interval, not from CPU time', () => {
    const s = createFrameStats(4)
    let out = null
    // GPU-bound: 100 ms between frames, only 3 ms of CPU work each
    for (let i = 0; i <= 4; i++) out = s.push(i * 100, 3) ?? out
    expect(out).not.toBeNull()
    expect(out!.fps).toBeCloseTo(10)
    expect(out!.frameMs).toBeCloseTo(100)
    expect(out!.cpuMs).toBeCloseTo(3)
  })
  it('reports once per window and then starts a fresh window', () => {
    const s = createFrameStats(2)
    const got = [0, 16, 32, 48, 80].map((t) => s.push(t, 1))
    expect(got.map((g) => g !== null)).toEqual([false, false, true, false, true])
    expect(got[4]!.frameMs).toBeCloseTo(24) // (16 + 32) / 2 — only the second window
  })
})
