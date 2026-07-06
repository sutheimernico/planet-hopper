export interface Vec {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec => ({ x, y })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
export const lenSq = (a: Vec): number => a.x * a.x + a.y * a.y
export const len = (a: Vec): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec, b: Vec): number => len(sub(a, b))
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x

export const norm = (a: Vec): Vec => {
  const l = len(a)
  return l === 0 ? { x: 0, y: 0 } : scale(a, 1 / l)
}
