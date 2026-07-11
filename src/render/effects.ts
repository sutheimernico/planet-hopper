// src/render/effects.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'

const TRAIL_N = 120
const BURST_N = 40

export interface Effects {
  pushTrail(pos: Vec, active: boolean): void
  burst(pos: Vec, color: number): void
  update(dt: number): void
}

export function createEffects(scene: THREE.Scene): Effects {
  // Trail: fixed ring buffer of points, brightness fades by age (color buffer rewrite).
  const trailPos = new Float32Array(TRAIL_N * 3)
  const trailCol = new Float32Array(TRAIL_N * 3)
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 1.1, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  scene.add(trail)
  let head = 0

  // Bursts: one pooled particle set reused per explosion.
  const burstPos = new Float32Array(BURST_N * 3)
  const burstVel: Vec[] = Array.from({ length: BURST_N }, () => ({ x: 0, y: 0 }))
  const burstGeo = new THREE.BufferGeometry()
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3))
  const burstMat = new THREE.PointsMaterial({
    size: 1.4, color: 0x67e8f9, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)
  scene.add(burstPoints)
  let burstLife = 0

  return {
    pushTrail(pos, active) {
      trailPos[head * 3] = pos.x
      trailPos[head * 3 + 1] = pos.y
      trailPos[head * 3 + 2] = 0
      trailCol[head * 3] = active ? 0.4 : 0
      trailCol[head * 3 + 1] = active ? 0.9 : 0
      trailCol[head * 3 + 2] = active ? 1.0 : 0
      head = (head + 1) % TRAIL_N
      trailGeo.attributes['position']!.needsUpdate = true
      trailGeo.attributes['color']!.needsUpdate = true
    },
    burst(pos, color) {
      burstMat.color.setHex(color)
      for (let i = 0; i < BURST_N; i++) {
        burstPos[i * 3] = pos.x
        burstPos[i * 3 + 1] = pos.y
        burstPos[i * 3 + 2] = 0
        const a = Math.random() * Math.PI * 2
        const s = 8 + Math.random() * 22
        burstVel[i] = { x: Math.cos(a) * s, y: Math.sin(a) * s }
      }
      burstLife = 0.6
      burstMat.opacity = 1
    },
    update(dt) {
      // fade the whole trail slightly every frame
      for (let i = 0; i < TRAIL_N * 3; i++) trailCol[i] = trailCol[i]! * (1 - 1.8 * dt)
      trailGeo.attributes['color']!.needsUpdate = true
      if (burstLife > 0) {
        burstLife -= dt
        for (let i = 0; i < BURST_N; i++) {
          burstPos[i * 3] = burstPos[i * 3]! + burstVel[i]!.x * dt
          burstPos[i * 3 + 1] = burstPos[i * 3 + 1]! + burstVel[i]!.y * dt
        }
        burstMat.opacity = Math.max(0, burstLife / 0.6)
        burstGeo.attributes['position']!.needsUpdate = true
      }
    },
  }
}
