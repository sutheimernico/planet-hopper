// src/main.ts
import { createSfx } from './audio/sfx'
import { createAccumulator } from './core/loop'
import * as C from './core/constants'
import { launch, newRun, tickRun, type SimEvent } from './core/sim'
import { transition, type GamePhase } from './core/state'
import { createStorage } from './core/storage'
import { len, type Vec } from './core/vec'
import { attachControls } from './input/controls'
import { launchVelocity } from './physics/orbit'
import { simulateTrajectory } from './physics/trajectory'
import { createEffects } from './render/effects'
import { createEntityPools } from './render/meshes'
import { createPreviewLine } from './render/preview'
import { createSceneRig } from './render/scene'
import { createHud } from './ui/hud'
import { createScreens } from './ui/screens'
import { createWorld } from './world/generator'
import './ui/style.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

// --- WebGL check -------------------------------------------------------------
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return c.getContext('webgl2') !== null || c.getContext('webgl') !== null
  } catch {
    return false
  }
}
if (!webglAvailable()) {
  app.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;
    color:#e2e8f0;font-family:system-ui;text-align:center;padding:24px">
    <p>Planet Hopper braucht WebGL.<br>Bitte einen aktuellen Browser mit aktivierter
    Hardware-Beschleunigung verwenden.</p></div>`
} else {
  boot(app)
}

function boot(root: HTMLDivElement): void {
  const canvas = document.createElement('canvas')
  root.appendChild(canvas)

  const rig = createSceneRig(canvas)
  const pools = createEntityPools(rig.scene)
  const preview = createPreviewLine(rig.scene)
  const effects = createEffects(rig.scene)
  const storage = createStorage(window.localStorage)
  const sfx = createSfx(storage.getMuted())
  const hud = createHud(root, {
    onToggleMute: () => {
      const m = !sfx.isMuted()
      sfx.setMuted(m)
      storage.setMuted(m)
      return m
    },
  })

  let phase: GamePhase = 'menu'
  let world = createWorld(Date.now() % 2 ** 31)
  world.ensureUntil(C.GENERATE_AHEAD)
  let run = newRun(world.snapshot())
  let prevShipPos: Vec = run.ship.pos
  let aiming = false

  const screens = createScreens(root, {
    onStart: () => setPhase('start'),
    onResume: () => setPhase('resume'),
    onRestart: () => {
      world = createWorld(Date.now() % 2 ** 31)
      world.ensureUntil(C.GENERATE_AHEAD)
      pools.reset() // new world reuses ids — drop stale meshes (review finding, Task 9)
      run = newRun(world.snapshot())
      prevShipPos = run.ship.pos
      // gesture + accumulator are per-run state: a stale preview line from the old
      // world and a leftover step residual must not leak into the new run
      // (review finding, Task 19)
      aiming = false
      preview.hide()
      acc = createAccumulator()
      setPhase('restart')
    },
  })

  function setPhase(event: Parameters<typeof transition>[1]): void {
    phase = transition(phase, event)
    // leaving 'playing' (pause, tab-hide, death) must freeze the aim gesture — with
    // pointer capture a mid-drag release could otherwise launch() while paused
    // (review finding, Task 19)
    if (phase !== 'playing') {
      aiming = false
      preview.hide()
    }
    if (phase === 'menu') screens.showStart(storage.getHighscore())
    else if (phase === 'paused') screens.showPause()
    else if (phase === 'gameover') {
      const points = Math.floor(run.score.points)
      const high = storage.getHighscore()
      const isNew = points > high
      if (isNew) storage.setHighscore(points)
      screens.showGameOver({
        points, crystals: run.score.crystals,
        highscore: Math.max(points, high), isNewHighscore: isNew,
        cause: run.deathCause ?? 'void',
      })
    } else screens.hide()
  }
  screens.showStart(storage.getHighscore())

  attachControls(canvas, {
    canAim: () => phase === 'playing' && run.mode === 'orbiting',
    onAim: (a) => {
      if (phase !== 'playing') return // captured pointer keeps dragging across a pause
      aiming = true
      const planet = world.snapshot().planets.find((p) => p.id === run.orbit?.planetId)
      if (!planet || !run.orbit) return
      // preview uses launchVelocity + simulateTrajectory — the live physics, no duplicate
      const t = simulateTrajectory(
        { pos: run.ship.pos, vel: launchVelocity(a.dir, a.power01) },
        world.snapshot(), planet.id,
        Math.round(C.PREVIEW_SECONDS / C.DT), C.PREVIEW_SAMPLE_EVERY,
      )
      preview.show(t.points)
    },
    onRelease: (a) => {
      if (phase !== 'playing') return // no launch from a drag that outlived 'playing'
      aiming = false
      preview.hide()
      run = launch(run, world.snapshot(), a.dir, a.power01)
    },
    onCancel: () => {
      aiming = false
      preview.hide()
    },
  })

  // pause when the tab goes to background; Esc toggles pause on desktop
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') setPhase('pause')
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (phase === 'playing') setPhase('pause')
      else if (phase === 'paused') setPhase('resume')
    }
  })
  window.addEventListener('resize', rig.resize)

  let acc = createAccumulator()
  let last = performance.now()

  const frame = (now: number): void => {
    const elapsed = Math.min(0.25, (now - last) / 1000)
    last = now

    if (phase === 'playing') {
      const steps = acc.advance(elapsed)
      for (let i = 0; i < steps; i++) {
        prevShipPos = run.ship.pos
        world.ensureUntil(run.ship.pos.x + C.GENERATE_AHEAD)
        world.prune(run.ship.pos.x - C.PRUNE_BEHIND)
        run = tickRun(run, world.snapshot(), C.DT)
        for (const e of run.events) handleEvent(e)
      }
      if (run.mode === 'dead') setPhase('die')
    }

    const alpha = acc.alpha()
    const shipPos = {
      x: prevShipPos.x + (run.ship.pos.x - prevShipPos.x) * alpha,
      y: prevShipPos.y + (run.ship.pos.y - prevShipPos.y) * alpha,
    }
    const speed = len(run.ship.vel)
    const velAngle = speed > 0.1 ? Math.atan2(run.ship.vel.y, run.ship.vel.x)
      : (run.orbit ? run.orbit.angle + (run.orbit.dir * Math.PI) / 2 : 0)

    pools.sync(world.snapshot())
    pools.updateShip(shipPos, velAngle)
    effects.pushTrail(shipPos, run.mode === 'flying')
    effects.update(elapsed)
    rig.updateCamera(shipPos, speed, elapsed)
    hud.update({
      fuel01: run.fuel / C.FUEL_MAX,
      points: run.score.points,
      mult: run.score.mult,
      hint: phase === 'playing' && run.mode === 'orbiting' && !aiming
        ? 'Ziehen zum Zielen · loslassen zum Starten' : null,
      warning: run.voidTimer > 0
        ? `Zurück zum Korridor! ${(C.VOID_GRACE - run.voidTimer).toFixed(1)} s` : null,
      dimmed: run.mode === 'flying',
    })
    rig.render()
    requestAnimationFrame(frame)
  }

  // takes the full SimEvent, not just the type — Task 20's audio hooks need the
  // payload (death cause, captured planetId) (review finding, Task 19)
  function handleEvent(e: SimEvent): void {
    switch (e.type) {
      case 'launch': rig.fovKick(); sfx.launch(); break
      case 'capture': rig.addShake(1.6); effects.burst(run.ship.pos, 0x67e8f9); sfx.capture(); break
      case 'crystal': effects.burst(run.ship.pos, 0x22d3ee); sfx.crystal(); break
      case 'flyby': sfx.flyby(); break
      case 'death': rig.addShake(2.5); effects.burst(run.ship.pos, 0xf87171); sfx.death(); break
    }
  }

  requestAnimationFrame(frame)
}
