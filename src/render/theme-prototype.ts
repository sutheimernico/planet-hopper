// src/render/theme-prototype.ts
// PROTOTYPE — THROWAWAY. Four visual themes for the game, switchable via ?variant=A|B|C|D
// on the running game route (dev-only, tree-shaken from prod like devhud). Question being
// answered: "Which look should planet-hopper's planets/scene get?" Delete this file and the
// two PROTOTYPE HOOK sites (meshes.ts, scene.ts) once a winner is picked; fold the winner in
// properly (plan amendment) — do not promote this code as-is.
import * as THREE from 'three'
import type { Planet } from '../world/types'

type ThemeKey = 'A' | 'B' | 'C' | 'D'
const THEME_NAMES: Record<ThemeKey, string> = {
  A: 'Aktuell (Baseline)',
  B: 'Toon / Cel',
  C: 'Atmosphäre',
  D: 'Neon',
}
const ORDER: ThemeKey[] = ['A', 'B', 'C', 'D']

function activeVariant(): ThemeKey {
  const v = new URLSearchParams(location.search).get('variant')?.toUpperCase()
  return (ORDER as string[]).includes(v ?? '') ? (v as ThemeKey) : 'A'
}

// ——— curated palettes per theme (body, accent) ———
const TOON_PALETTES: Array<[number, number]> = [
  [0x4ade80, 0x166534], [0xfacc15, 0x92400e], [0x93c5fd, 0x1e3a8a],
  [0xf9a8d4, 0x9d174d], [0x5eead4, 0x115e59], [0xd9f99d, 0x3f6212],
]
const ATMO_PALETTES: Array<[number, number, number]> = [
  // body, polar/band accent, atmosphere glow
  [0x2f9e6e, 0xbfe8d2, 0x7dffc4], [0xc98a2b, 0xf3d9a4, 0xffd98a], [0x5666c9, 0xc3c9f2, 0x93a5ff],
  [0xb14a7e, 0xf0c3d8, 0xff9ecf], [0x2596a8, 0xbde9f0, 0x7ee5ff], [0x7ea832, 0xe2f0be, 0xcdff7e],
]
const NEON_COLORS = [0x22d3ee, 0xf0abfc, 0xa3e635, 0xfb923c, 0x818cf8, 0xf472b6]

// 3-step gradient map for MeshToonMaterial — tiny one-time DataTexture, no asset.
let toonGradient: THREE.DataTexture | null = null
function getToonGradient(): THREE.DataTexture {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat)
    toonGradient.minFilter = THREE.NearestFilter
    toonGradient.magFilter = THREE.NearestFilter
    toonGradient.needsUpdate = true
  }
  return toonGradient
}

// Cheap fresnel atmosphere: additive BackSide shell, one draw call per planet.
function atmosphereShell(radius: number, color: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying float vRim;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vRim = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vRim;
      void main() { gl_FragColor = vec4(uColor, vRim * 0.55); }`,
  })
  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.28, 2), mat)
}

// Two-tone flat-shaded body: polar caps get the accent color via per-vertex colors.
function twoToneBody(radius: number, body: number, accent: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 2).toNonIndexed()
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const cBody = new THREE.Color(body)
  const cAccent = new THREE.Color(accent)
  for (let f = 0; f < pos.count; f += 3) {
    // face centroid |y| decides polar cap vs body — stable, no randomness needed
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3
    const c = Math.abs(cy) > radius * 0.62 ? cAccent : cBody
    for (let v = 0; v < 3; v++) colors.set([c.r, c.g, c.b], (f + v) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }),
  )
}

// ——— per-theme planet body builders (capture ring is appended by the caller) ———
// Returns null for theme A so meshes.ts falls through to the production path.
export function themePlanetBody(p: Planet): THREE.Group | null {
  const variant = activeVariant()
  if (variant === 'A') return null
  const g = new THREE.Group()

  if (variant === 'B') {
    const [body, accent] = TOON_PALETTES[p.paletteIndex % TOON_PALETTES.length]!
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(p.radius, 3), // smooth silhouette, hard toon steps
      new THREE.MeshToonMaterial({ color: body, gradientMap: getToonGradient() }),
    )
    g.add(mesh)
    if (p.hasRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * 1.7, p.radius * 0.14, 8, 48),
        new THREE.MeshToonMaterial({ color: accent, gradientMap: getToonGradient() }),
      )
      ring.rotation.x = Math.PI / 2.6
      g.add(ring)
    }
  }

  if (variant === 'C') {
    const [body, accent, glow] = ATMO_PALETTES[p.paletteIndex % ATMO_PALETTES.length]!
    g.add(twoToneBody(p.radius, body, accent))
    g.add(atmosphereShell(p.radius, glow))
    if (p.hasRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * 1.7, p.radius * 0.1, 6, 48),
        new THREE.MeshStandardMaterial({
          color: accent, flatShading: true, transparent: true, opacity: 0.85,
        }),
      )
      ring.rotation.x = Math.PI / 2.6
      g.add(ring)
    }
  }

  if (variant === 'D') {
    const neon = NEON_COLORS[p.paletteIndex % NEON_COLORS.length]!
    const geo = new THREE.IcosahedronGeometry(p.radius, 1)
    const dark = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x0b0d18, flatShading: true, roughness: 0.6 }),
    )
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(p.radius * 1.002, 1),
      new THREE.MeshBasicMaterial({
        color: neon, wireframe: true, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    )
    g.add(dark, wire)
    if (p.hasRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * 1.7, p.radius * 0.06, 4, 56),
        new THREE.MeshBasicMaterial({
          color: neon, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      ring.rotation.x = Math.PI / 2.6
      g.add(ring)
    }
  }

  return g
}

// ——— scene-level decoration (background/fog/lights/bloom/backdrop) + switcher bar ———
export function decorateSceneForTheme(scene: THREE.Scene, bloom: { strength: number }): void {
  const variant = activeVariant()

  if (variant === 'B') {
    scene.background = new THREE.Color(0x0a0c1c)
    scene.fog = new THREE.Fog(0x0a0c1c, 240, 500)
    // harder key light, dimmer ambient → crisp toon steps
    scene.children.forEach((c) => {
      if (c instanceof THREE.AmbientLight) c.intensity = 0.55
      if (c instanceof THREE.DirectionalLight) c.intensity = 2.2
    })
    bloom.strength = 0.55
  }

  if (variant === 'C') {
    scene.background = new THREE.Color(0x070818)
    scene.fog = new THREE.Fog(0x070818, 260, 520)
    bloom.strength = 0.75
    // static nebula backdrop: one big gradient plane far behind the play plane —
    // built once from a small canvas, zero per-frame cost
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const paint = (x: number, y: number, r: number, color: string): void => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, color)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 256, 256)
    }
    ctx.fillStyle = '#070818'
    ctx.fillRect(0, 0, 256, 256)
    paint(70, 90, 120, 'rgba(76, 29, 149, 0.45)')
    paint(190, 150, 130, 'rgba(8, 90, 120, 0.4)')
    paint(140, 60, 90, 'rgba(157, 23, 77, 0.28)')
    const tex = new THREE.CanvasTexture(canvas)
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 1600),
      new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, transparent: true, opacity: 0.85 }),
    )
    backdrop.position.z = -420
    backdrop.renderOrder = -1
    scene.add(backdrop)
  }

  if (variant === 'D') {
    scene.background = new THREE.Color(0x020208)
    scene.fog = new THREE.Fog(0x020208, 200, 460)
    scene.children.forEach((c) => {
      if (c instanceof THREE.AmbientLight) c.intensity = 0.35
    })
    bloom.strength = 1.25
  }

  mountSwitcherBar(variant)
}

// Floating bottom-center pill: ← [key — name] →, arrow keys cycle, URL param + reload
// keeps the choice shareable/reload-stable. Deliberately styled unlike the game UI.
function mountSwitcherBar(current: ThemeKey): void {
  const bar = document.createElement('div')
  bar.style.cssText =
    'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'display:flex;gap:10px;align-items:center;padding:8px 14px;border-radius:999px;' +
    'background:#fff;color:#111;font:600 13px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.5);' +
    'user-select:none'
  const go = (dir: 1 | -1): void => {
    const next = ORDER[(ORDER.indexOf(current) + dir + ORDER.length) % ORDER.length]!
    const url = new URL(location.href)
    url.searchParams.set('variant', next)
    location.href = url.toString() // full reload — rebuilds all pooled meshes cleanly
  }
  const mkBtn = (label: string, dir: 1 | -1): HTMLButtonElement => {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = 'border:0;background:#111;color:#fff;border-radius:999px;' +
      'width:26px;height:26px;cursor:pointer;font-size:13px'
    b.addEventListener('click', () => go(dir))
    return b
  }
  const label = document.createElement('span')
  label.textContent = `${current} — ${THEME_NAMES[current]}`
  bar.append(mkBtn('←', -1), label, mkBtn('→', 1))
  document.body.appendChild(bar)
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  })
}
