// src/render/preview.ts
import * as THREE from 'three'
import { DT, PREVIEW_SAMPLE_EVERY, PREVIEW_SECONDS } from '../core/constants'
import type { Vec } from '../core/vec'

export interface PreviewLine {
  show(points: readonly Vec[]): void
  hide(): void
}

// Provable sample-count bound: the game loop runs simulateTrajectory for
// round(PREVIEW_SECONDS / DT) steps and keeps every PREVIEW_SAMPLE_EVERY-th point.
const MAX_POINTS = Math.ceil(Math.round(PREVIEW_SECONDS / DT) / PREVIEW_SAMPLE_EVERY)

export function createPreviewLine(scene: THREE.Scene): PreviewLine {
  const material = new THREE.LineDashedMaterial({
    color: 0x00e5ff, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.9,
  })
  // Buffers preallocated once at MAX_POINTS: setFromPoints on a reused geometry
  // truncates counts above the first allocation and leaves stale ghost-tail points
  // below it (review finding, 2026-07-11).
  const positions = new Float32Array(MAX_POINTS * 3)
  const lineDistances = new Float32Array(MAX_POINTS)
  const posAttr = new THREE.BufferAttribute(positions, 3)
  const distAttr = new THREE.BufferAttribute(lineDistances, 1)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('lineDistance', distAttr)
  const line = new THREE.Line(geometry, material)
  line.visible = false
  // the lazily computed bounding sphere would go stale as the buffer mutates — skip culling
  line.frustumCulled = false
  scene.add(line)
  return {
    show(points) {
      const n = Math.min(points.length, MAX_POINTS)
      let d = 0
      let prev: Vec | null = null
      for (let i = 0; i < n; i++) {
        const p = points[i]!
        positions[i * 3] = p.x
        positions[i * 3 + 1] = p.y
        positions[i * 3 + 2] = 0
        // cumulative dash distances written inline — no computeLineDistances() garbage
        if (prev) d += Math.hypot(p.x - prev.x, p.y - prev.y)
        lineDistances[i] = d
        prev = p
      }
      posAttr.needsUpdate = true
      distAttr.needsUpdate = true
      geometry.setDrawRange(0, n)
      line.visible = true
    },
    hide() {
      line.visible = false
    },
  }
}
