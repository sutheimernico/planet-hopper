// src/main.ts
import { createSfx } from './audio/sfx'
import * as C from './core/constants'
import { createRunLifecycle } from './core/run-lifecycle'
import { createSession } from './core/session'
import type { SimEvent } from './core/sim'
import type { GamePhase } from './core/state'
import { createStorage } from './core/storage'
import { len } from './core/vec'
import { attachControls } from './input/controls'
import { attachDevHud } from './render/devhud'
import { createEffects } from './render/effects'
import { createEntityPools } from './render/meshes'
import { createPreviewLine } from './render/preview'
import { createSceneRig } from './render/scene'
import { createHud } from './ui/hud'
import { createScreens } from './ui/screens'
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
    // touch-friendly equivalent of Esc — same 'pause' transition (spec §6, final review)
    onPause: () => session.send('pause'),
  })
  const devHud = import.meta.env.DEV ? attachDevHud(root) : null

  const randomSeed = (): number => Date.now() % 2 ** 31
  let nextSeed = randomSeed()
  const session = createSession(nextSeed, showPhase)
  const lifecycle = createRunLifecycle({
    session: () => session.resetRun(nextSeed),
    pools: () => pools.reset(),
    effects: () => effects.reset(),
  })

  const screens = createScreens(root, {
    onStart: () => session.send('start'),
    onResume: () => session.send('resume'),
    onRestart: () => {
      nextSeed = randomSeed()
      lifecycle.resetRun()
      session.send('restart')
    },
  })

  function showPhase(phase: GamePhase): void {
    if (phase === 'menu') screens.showStart(storage.getHighscore())
    else if (phase === 'paused') screens.showPause()
    else if (phase === 'gameover') {
      const run = session.driver().state()
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
    canAim: () => session.canAim(),
    onAim: (a) => session.aim(a),
    onRelease: (a) => session.release(a),
    onCancel: () => session.cancel(),
  })

  // pause when the tab goes to background; Esc toggles pause on desktop
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) session.send('pause')
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') session.send(session.phase() === 'paused' ? 'resume' : 'pause')
  })
  window.addEventListener('resize', rig.resize)

  let last = performance.now()

  const frame = (now: number): void => {
    const elapsed = Math.min(0.25, (now - last) / 1000)
    last = now

    session.advance(elapsed)
    session.drain(handleEvent)

    const driver = session.driver()
    const run = driver.state()
    const world = driver.world().snapshot()

    const path = session.previewPath()
    if (path) preview.show(path)
    else preview.hide()

    const alpha = session.alpha()
    const prevShipPos = driver.prevShipPos()
    const shipPos = {
      x: prevShipPos.x + (run.ship.pos.x - prevShipPos.x) * alpha,
      y: prevShipPos.y + (run.ship.pos.y - prevShipPos.y) * alpha,
    }
    const speed = len(run.ship.vel)
    const velAngle = speed > 0.1 ? Math.atan2(run.ship.vel.y, run.ship.vel.x)
      : (run.orbit ? run.orbit.angle + (run.orbit.dir * Math.PI) / 2 : 0)

    const phase = session.phase()
    pools.sync(world)
    pools.updateShip(shipPos, velAngle)
    effects.pushTrail(shipPos, run.mode === 'flying')
    effects.update(elapsed)
    rig.updateCamera(shipPos, speed, elapsed)
    hud.update({
      fuel01: run.fuel / C.FUEL_MAX,
      points: run.score.points,
      mult: run.score.mult,
      hint: phase === 'playing' && run.mode === 'orbiting' && !session.heldAim()
        ? 'Ziehen zum Zielen · loslassen zum Starten' : null,
      warning: run.voidTimer > 0
        ? `Zurück zum Korridor! ${(C.VOID_GRACE - run.voidTimer).toFixed(1)} s` : null,
      dimmed: run.mode === 'flying',
      showPause: phase === 'playing',
    })
    rig.render()
    devHud?.(performance.now() - now)
    requestAnimationFrame(frame)
  }

  // takes the full SimEvent, not just the type — Task 20's audio hooks need the
  // payload (death cause, captured planetId) (review finding, Task 19)
  function handleEvent(e: SimEvent): void {
    const pos = session.driver().state().ship.pos
    switch (e.type) {
      case 'launch': rig.fovKick(); sfx.launch(); break
      case 'capture': rig.addShake(1.6); effects.burst(pos, 0x67e8f9); sfx.capture(); break
      case 'crystal': effects.burst(pos, 0x22d3ee); sfx.crystal(); break
      case 'flyby': sfx.flyby(); break
      case 'death': rig.addShake(2.5); effects.burst(pos, 0xf87171); sfx.death(); break
    }
  }

  requestAnimationFrame(frame)
}
