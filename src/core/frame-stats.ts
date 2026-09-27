// src/core/frame-stats.ts
// Frame statistics for the dev overlay. FPS must come from the interval between frame
// callbacks: the CPU time spent inside one callback says nothing about GPU-bound frame
// rate (it read "362 fps" under SwiftShader while frames really took ~70–100 ms).
export interface FrameSummary {
  fps: number
  frameMs: number // mean rAF-to-rAF interval
  cpuMs: number // mean time spent inside the frame callback
}

export interface FrameStats {
  // `now` = the rAF timestamp; returns a summary every `window` intervals, else null
  push(now: number, cpuMs: number): FrameSummary | null
}

export function createFrameStats(window = 30): FrameStats {
  let prev: number | null = null
  let n = 0
  let sumInterval = 0
  let sumCpu = 0
  return {
    push(now, cpuMs) {
      if (prev === null) {
        prev = now
        return null
      }
      sumInterval += now - prev
      sumCpu += cpuMs
      prev = now
      if (++n < window) return null
      const frameMs = sumInterval / n
      const summary = { fps: 1000 / frameMs, frameMs, cpuMs: sumCpu / n }
      n = 0
      sumInterval = 0
      sumCpu = 0
      return summary
    },
  }
}
