// src/render/preview.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'

export interface PreviewLine {
  show(points: readonly Vec[]): void
  hide(): void
}

export function createPreviewLine(scene: THREE.Scene): PreviewLine {
  const material = new THREE.LineDashedMaterial({
    color: 0x00e5ff, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.9,
  })
  const geometry = new THREE.BufferGeometry()
  const line = new THREE.Line(geometry, material)
  line.visible = false
  scene.add(line)
  return {
    show(points) {
      geometry.setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, 0)))
      line.computeLineDistances()
      line.visible = true
    },
    hide() {
      line.visible = false
    },
  }
}
