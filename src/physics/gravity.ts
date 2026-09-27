import type { Vec } from '../core/vec'

export interface GravityBody {
  pos: Vec
  mass: number
  radius: number
}

// Scratch buffers for the top-k selection, reused across calls: this runs up to 8×/frame
// in flight and 360×/frame while aiming, so it must not allocate. Grown on demand if a
// caller ever asks for more than the initial capacity.
let topIdx = new Int32Array(8)
let topDSq = new Float64Array(8)

// Sum of inverse-square pulls from the k nearest bodies. Distance is clamped to the
// body radius so acceleration stays finite inside a body (capture handles that case).
export function accelerationAt(
  p: Vec,
  bodies: readonly GravityBody[],
  g: number,
  kNearest: number,
): Vec {
  if (kNearest > topIdx.length) {
    topIdx = new Int32Array(kNearest)
    topDSq = new Float64Array(kNearest)
  }
  // Single-pass insertion into a sorted top-k list. Strict `<` keeps the earlier body on
  // distance ties — the same order the previous stable copy+sort produced, so the
  // summation order (and therefore every trajectory) stays bit-identical.
  let count = 0
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    const dx = b.pos.x - p.x
    const dy = b.pos.y - p.y
    const dSq = dx * dx + dy * dy
    if (count === kNearest && !(dSq < topDSq[count - 1]!)) continue
    let j = count < kNearest ? count++ : count - 1
    while (j > 0 && dSq < topDSq[j - 1]!) {
      topDSq[j] = topDSq[j - 1]!
      topIdx[j] = topIdx[j - 1]!
      j--
    }
    topDSq[j] = dSq
    topIdx[j] = i
  }

  let ax = 0
  let ay = 0
  for (let n = 0; n < count; n++) {
    const b = bodies[topIdx[n]!]!
    const dx = b.pos.x - p.x
    const dy = b.pos.y - p.y
    const dSq = topDSq[n]!
    if (dSq === 0) continue
    const clampedSq = Math.max(dSq, b.radius * b.radius)
    const mag = (g * b.mass) / clampedSq
    const invLen = 1 / Math.sqrt(dSq)
    ax += dx * invLen * mag
    ay += dy * invLen * mag
  }
  return { x: ax, y: ay }
}
