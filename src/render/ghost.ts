// src/render/ghost.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'

export interface GhostShip {
  // null hides the ghost (no recording for this seed, toggle off, or the ghost run ended)
  update(pos: Vec | null, velAngle: number): void
}

// Translucent silhouette of the player ship — visual only, the replayed run has its own
// world and never touches the live score or collisions. Additive + no depth write so it
// reads as a hologram and never occludes the real ship.
export function createGhostShip(scene: THREE.Scene): GhostShip {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3, 6),
    new THREE.MeshBasicMaterial({
      color: 0xa5f3fc, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  )
  mesh.visible = false
  scene.add(mesh)
  return {
    update(pos, velAngle) {
      mesh.visible = pos !== null
      if (!pos) return
      mesh.position.set(pos.x, pos.y, 0)
      mesh.rotation.z = velAngle - Math.PI / 2 // cone points +y by default (as meshes.ts)
    },
  }
}
