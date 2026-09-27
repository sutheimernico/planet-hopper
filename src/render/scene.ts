// src/render/scene.ts
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { decorateSceneForTheme } from './theme-prototype' // THEME PROTOTYPE — see fence below
import type { Vec } from '../core/vec'

const BASE_FOV = 55
const CAM_DISTANCE = 95
const CAM_TILT_Y = -32 // camera sits below the plane → slight 3D perspective

export interface SceneRig {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  render(): void
  resize(): void
  // smooth follow + speed zoom + decaying shake/fov-kick, called once per frame
  updateCamera(target: Vec, speed: number, dt: number): void
  addShake(intensity: number): void
  fovKick(): void
}

export function createSceneRig(canvas: HTMLCanvasElement): SceneRig {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060f)
  scene.fog = new THREE.Fog(0x05060f, 220, 480)

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 1200)
  camera.position.set(0, CAM_TILT_Y, CAM_DISTANCE)

  scene.add(new THREE.AmbientLight(0x8899bb, 0.8))
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(60, 80, 120)
  scene.add(key)

  const stars = createStarfield()
  scene.add(stars)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.8)
  composer.addPass(bloom)
  // r152+ color management: without a final OutputPass the composer blits a linear-space
  // buffer to the canvas — no sRGB encode, colors render too dark (SOTA check, Phase 2 boundary)
  composer.addPass(new OutputPass())

  // ─── BEGIN THEME PROTOTYPE HOOK (dev-only, tree-shaken from prod — verified 2026-09-27) ───
  // Open decision: Nico picks A–D via `npm run dev` + `?variant=`. Removal: fold the winner's
  // backdrop/bloom into this file, delete these lines + the import above, the hook in
  // meshes.ts and src/render/theme-prototype.ts (plan 2026-07-21, Task 10 branch 1).
  if (import.meta.env.DEV) decorateSceneForTheme(scene, bloom)
  // ─── END THEME PROTOTYPE HOOK ───

  let shake = 0
  let fov = BASE_FOV

  const resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    scene,
    camera,
    render: () => composer.render(),
    resize,
    updateCamera(target, speed, dt) {
      const k = 1 - Math.exp(-4 * dt) // frame-rate independent lerp
      const zoom = CAM_DISTANCE + Math.min(45, speed * 0.5)
      camera.position.x += (target.x - camera.position.x) * k
      camera.position.y += (target.y + CAM_TILT_Y - camera.position.y) * k
      camera.position.z += (zoom - camera.position.z) * k
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake
        camera.position.y += (Math.random() - 0.5) * shake
        shake *= Math.exp(-6 * dt)
      }
      fov += (BASE_FOV - fov) * (1 - Math.exp(-3 * dt))
      camera.fov = fov
      camera.updateProjectionMatrix()
      camera.lookAt(target.x, target.y, 0)
      stars.position.x = camera.position.x * 0.85 // 15% parallax
      stars.position.y = camera.position.y * 0.85
    },
    addShake: (intensity) => { shake = Math.min(3, shake + intensity) },
    fovKick: () => { fov = BASE_FOV + 9 },
  }
}

function createStarfield(): THREE.Points {
  const COUNT = 1500
  const positions = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1600
    positions[i * 3 + 1] = (Math.random() - 0.5) * 900
    positions[i * 3 + 2] = -80 - Math.random() * 300
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xbfd4ff, size: 1.4, sizeAttenuation: true,
    transparent: true, opacity: 0.9, depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}
