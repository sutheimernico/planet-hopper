// src/input/aim.ts
import { norm, type Vec } from '../core/vec'

export interface Aim {
  dir: Vec // world-space launch direction (unit vector)
  power01: number
}

// Slingshot mapping: drag back to shoot forward. Screen y grows downward while
// world y grows upward, so screen delta (dx, dy) becomes world aim (-dx, +dy).
export function dragToAim(startPx: Vec, currentPx: Vec, maxDragPx: number): Aim {
  const dx = currentPx.x - startPx.x
  const dy = currentPx.y - startPx.y
  const lenPx = Math.hypot(dx, dy)
  if (lenPx === 0) return { dir: { x: 0, y: 0 }, power01: 0 }
  return {
    dir: norm({ x: -dx, y: dy }),
    power01: Math.min(1, lenPx / maxDragPx),
  }
}
