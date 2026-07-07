import type { Vec } from '../core/vec'

export interface Kinematic {
  pos: Vec
  vel: Vec
}

// Semi-implicit (symplectic) Euler: stable for orbital mechanics at fixed dt,
// unlike explicit Euler which gains energy every step.
export function stepSemiImplicit(k: Kinematic, acc: Vec, dt: number): Kinematic {
  const vel = { x: k.vel.x + acc.x * dt, y: k.vel.y + acc.y * dt }
  const pos = { x: k.pos.x + vel.x * dt, y: k.pos.y + vel.y * dt }
  return { pos, vel }
}
