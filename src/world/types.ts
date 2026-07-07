import type { Vec } from '../core/vec'

export interface Planet {
  id: number
  pos: Vec
  radius: number
  mass: number
  paletteIndex: number // which biome color set the renderer uses
  hasRing: boolean
}

export interface Crystal {
  id: number
  pos: Vec
  collected: boolean
}

export interface Sun {
  id: number
  pos: Vec
  radius: number
  mass: number
}

export interface WorldSnapshot {
  planets: readonly Planet[]
  crystals: readonly Crystal[]
  suns: readonly Sun[]
}
