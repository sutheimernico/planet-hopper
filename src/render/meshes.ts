// src/render/meshes.ts
import * as THREE from 'three'
import type { Vec } from '../core/vec'
import { captureRadius } from '../physics/capture'
import { themePlanetBody } from './theme-prototype'
import type { Planet, WorldSnapshot } from '../world/types'

// Low-poly toon biome palettes (body / accent), indexed by Planet.paletteIndex.
const PALETTES: Array<[number, number]> = [
  [0x34d399, 0x059669], [0xfbbf24, 0xd97706], [0x818cf8, 0x4f46e5],
  [0xf472b6, 0xbe185d], [0x22d3ee, 0x0e7490], [0xa3e635, 0x4d7c0f],
]

export interface EntityPools {
  sync(world: WorldSnapshot): void
  updateShip(pos: Vec, velAngle: number): void
  shipPosition(): Vec
  // restart creates a fresh world whose ids restart at 1 — stale pooled meshes
  // would silently be reused at old positions without this (review finding, Task 9)
  reset(): void
}

export function createEntityPools(scene: THREE.Scene): EntityPools {
  const planetObjs = new Map<number, THREE.Group>()
  const crystalObjs = new Map<number, THREE.Mesh>()
  const sunObjs = new Map<number, THREE.Mesh>()
  // scratch set reused across sync calls — avoids per-frame Set + spread-array garbage
  // (review finding, 2026-07-11)
  const seen = new Set<number>()

  const crystalGeo = new THREE.OctahedronGeometry(1.4)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.6, flatShading: true,
  })
  const sunGeo = new THREE.IcosahedronGeometry(1, 1)
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffd166, emissive: 0xff8c42, emissiveIntensity: 2.4, flatShading: true,
  })

  const ship = buildShip()
  scene.add(ship)

  const buildPlanet = (p: Planet): THREE.Group => {
    // PROTOTYPE HOOK (dev-only, tree-shaken in prod) — remove with theme-prototype.ts
    if (import.meta.env.DEV) {
      const themed = themePlanetBody(p)
      if (themed) {
        themed.add(buildCaptureRing(captureRadius(p)))
        return themed
      }
    }
    const g = new THREE.Group()
    const [body, accent] = PALETTES[p.paletteIndex % PALETTES.length]!
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(p.radius, 1),
      new THREE.MeshStandardMaterial({ color: body, flatShading: true, roughness: 0.9 }),
    )
    g.add(mesh)
    if (p.hasRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * 1.7, p.radius * 0.12, 6, 40),
        new THREE.MeshStandardMaterial({ color: accent, flatShading: true }),
      )
      ring.rotation.x = Math.PI / 2.6
      g.add(ring)
    }
    // subtle dashed capture-radius indicator (spec §3, final review) — same XY plane as
    // the simulation, pooled with the rest of the group so prune/reset dispose it too
    g.add(buildCaptureRing(captureRadius(p)))
    return g
  }

  // planets own per-instance geometries/materials (radius/palette-specific) — dispose on
  // removal or endless pruning + restarts leak GPU buffers; crystals/suns reuse the shared
  // singletons above, which must stay alive (review finding, 2026-07-11)
  // capture-ring child is a THREE.Line, not a THREE.Mesh — both expose the same disposable
  // geometry/material shape (final review, capture-ring gap closure)
  const disposePlanet = (obj: THREE.Group): void => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        const mat = child.material as THREE.Material
        child.geometry.dispose()
        mat.dispose()
      }
    })
  }

  return {
    sync(world) {
      seen.clear()
      for (const p of world.planets) {
        seen.add(p.id)
        let obj = planetObjs.get(p.id)
        if (!obj) {
          obj = buildPlanet(p)
          obj.position.set(p.pos.x, p.pos.y, 0)
          planetObjs.set(p.id, obj)
          scene.add(obj)
        }
        obj.rotation.y += 0.0008 // slow idle spin
      }
      for (const c of world.crystals) {
        seen.add(c.id)
        let obj = crystalObjs.get(c.id)
        if (!obj) {
          obj = new THREE.Mesh(crystalGeo, crystalMat)
          obj.position.set(c.pos.x, c.pos.y, 0)
          crystalObjs.set(c.id, obj)
          scene.add(obj)
        }
        obj.visible = !c.collected
        obj.rotation.z += 0.02
      }
      for (const s of world.suns) {
        seen.add(s.id)
        if (!sunObjs.has(s.id)) {
          const obj = new THREE.Mesh(sunGeo, sunMat)
          obj.scale.setScalar(s.radius)
          obj.position.set(s.pos.x, s.pos.y, 0)
          sunObjs.set(s.id, obj)
          scene.add(obj)
        }
      }
      // drop pruned entities — one shared `seen` works because ids are globally unique
      // across planets/crystals/suns (generator.ts invariant, pinned by test)
      for (const [id, obj] of planetObjs) {
        if (!seen.has(id)) {
          scene.remove(obj)
          disposePlanet(obj)
          planetObjs.delete(id)
        }
      }
      for (const [id, obj] of crystalObjs) {
        if (!seen.has(id)) {
          scene.remove(obj)
          crystalObjs.delete(id)
        }
      }
      for (const [id, obj] of sunObjs) {
        if (!seen.has(id)) {
          scene.remove(obj)
          sunObjs.delete(id)
        }
      }
    },
    updateShip(pos, velAngle) {
      ship.position.set(pos.x, pos.y, 0)
      ship.rotation.z = velAngle - Math.PI / 2 // cone points +y by default
    },
    shipPosition: () => ({ x: ship.position.x, y: ship.position.y }),
    reset() {
      for (const obj of planetObjs.values()) {
        scene.remove(obj)
        disposePlanet(obj)
      }
      for (const obj of crystalObjs.values()) scene.remove(obj)
      for (const obj of sunObjs.values()) scene.remove(obj)
      planetObjs.clear()
      crystalObjs.clear()
      sunObjs.clear()
    },
  }
}

// Faint dashed circle at the planet's capture radius — kept subtle (low opacity, thin
// dashes) since it's a gameplay hint, not a focal element (spec §3, final review).
function buildCaptureRing(radius: number): THREE.Line {
  const SEGMENTS = 48
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= SEGMENTS; i++) { // +1 closes the loop so the dash pattern wraps cleanly
    const a = (i / SEGMENTS) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({
    color: 0x67e8f9, dashSize: 1.4, gapSize: 1.2, transparent: true, opacity: 0.22,
  })
  const ring = new THREE.Line(geo, mat)
  ring.computeLineDistances()
  return ring
}

function buildShip(): THREE.Group {
  const g = new THREE.Group()
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, flatShading: true }),
  )
  const engine = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 3 }),
  )
  engine.position.y = -1.6
  g.add(hull, engine)
  return g
}
