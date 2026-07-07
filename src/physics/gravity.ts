import { lenSq, sub, type Vec } from '../core/vec'

export interface GravityBody {
  pos: Vec
  mass: number
  radius: number
}

// Sum of inverse-square pulls from the k nearest bodies. Distance is clamped to the
// body radius so acceleration stays finite inside a body (capture handles that case).
export function accelerationAt(
  p: Vec,
  bodies: readonly GravityBody[],
  g: number,
  kNearest: number,
): Vec {
  const nearest = [...bodies]
    .sort((a, b) => lenSq(sub(a.pos, p)) - lenSq(sub(b.pos, p)))
    .slice(0, kNearest)

  let ax = 0
  let ay = 0
  for (const b of nearest) {
    const d = sub(b.pos, p)
    const dSq = lenSq(d)
    if (dSq === 0) continue
    const clampedSq = Math.max(dSq, b.radius * b.radius)
    const mag = (g * b.mass) / clampedSq
    const invLen = 1 / Math.sqrt(dSq)
    ax += d.x * invLen * mag
    ay += d.y * invLen * mag
  }
  return { x: ax, y: ay }
}
