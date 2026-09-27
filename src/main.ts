// src/main.ts
import { createSfx } from './audio/sfx'
import * as C from './core/constants'
import { dailySeed, isDailySeed, parseSeed, seedLabel, seedToNumber, shareText } from './core/daily'
import { createRecording, createReplay, parseRecording, type Replay } from './core/replay'
import type { RunDriver } from './core/run-driver'
import { createRunLifecycle } from './core/run-lifecycle'
import { createSession } from './core/session'
import type { SimEvent } from './core/sim'
import type { GamePhase } from './core/state'
import { createStorage } from './core/storage'
import { len, type Vec } from './core/vec'
import { attachControls } from './input/controls'
import { attachDevHud } from './render/devhud'
import { createEffects } from './render/effects'
import { createGhostShip } from './render/ghost'
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
  const ghostShip = createGhostShip(rig.scene)
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
  // a valid ?seed= link replaces the endless random world; the daily button uses today's date
  const urlSeed = parseSeed(new URLSearchParams(location.search).get('seed'))
  const pageUrl = location.origin + location.pathname
  let runSeed: string | null = urlSeed // null = endless run on a random world
  let nextSeed = urlSeed !== null ? seedToNumber(urlSeed) : randomSeed()
  const session = createSession(nextSeed, showPhase)
  // Ghost = best recorded run on this exact seed (daily / ?seed= only — a random endless
  // world is never replayed, so a ghost there would fly through planets that don't exist)
  let ghost: Replay | null = null
  let ghostEnabled = storage.getGhostEnabled()
  const loadGhost = (seed: string | null): Replay | null => {
    if (seed === null) return null
    const rec = parseRecording(storage.getSeedGhost(seed), seedToNumber(seed))
    return rec ? createReplay(rec) : null
  }
  const lifecycle = createRunLifecycle({
    session: () => session.resetRun(nextSeed),
    ghost: () => { ghost = loadGhost(runSeed) },
    pools: () => pools.reset(),
    effects: () => effects.reset(),
  })

  const startRun = (seed: string | null, event: 'start' | 'restart'): void => {
    runSeed = seed
    nextSeed = seed !== null ? seedToNumber(seed) : randomSeed()
    lifecycle.resetRun()
    session.send(event)
  }

  const screens = createScreens(root, {
    onStart: () => startRun(urlSeed, 'start'),
    onDaily: () => startRun(dailySeed(new Date()), 'start'),
    onResume: () => session.send('resume'),
    onToggleGhost: () => {
      ghostEnabled = !ghostEnabled
      storage.setGhostEnabled(ghostEnabled)
      return ghostEnabled
    },
    onRestart: () => startRun(runSeed, 'restart'), // same mode: same seed or a new random one
    onMenu: () => session.send('menu'),
  })

  const showStart = (): void => screens.showStart({
    highscore: storage.getHighscore(),
    seedLabel: urlSeed !== null ? seedLabel(urlSeed) : null,
    dailyBest: storage.getSeedBest(dailySeed(new Date())),
  })

  function showPhase(phase: GamePhase): void {
    if (phase === 'menu') showStart()
    else if (phase === 'paused') screens.showPause(ghost ? ghostEnabled : null)
    else if (phase === 'gameover') showGameOver()
    else screens.hide()
  }

  function showGameOver(): void {
    const run = session.driver().state()
    const points = Math.floor(run.score.points)
    const seed = runSeed
    const best = seed === null ? storage.getHighscore() : storage.getSeedBest(seed)
    const isNewBest = points > best
    if (isNewBest) {
      if (seed === null) storage.setHighscore(points)
      else {
        const d = session.driver()
        storage.setSeedBest(seed, points, createRecording(d.seed, points, d.launches()) ?? undefined)
      }
    }
    screens.showGameOver({
      points, crystals: run.score.crystals,
      best: Math.max(points, best), isNewBest,
      bestLabel: seed === null ? 'Rekord' : isDailySeed(seed) ? 'Tagesrekord' : 'Seed-Rekord',
      runLabel: seed !== null ? seedLabel(seed) : null,
      shareText: seed !== null ? shareText(seed, points, pageUrl) : null,
      cause: run.deathCause ?? 'void',
    })
  }
  showStart()

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

    // lockstep: the ghost runs exactly the live ticks. Not `ghost?.advance(session.advance(…))`
    // — optional chaining skips evaluating the arguments when there is no ghost, which froze
    // the sim (caught by the headless run, 2026-09-27)
    const ticks = session.advance(elapsed)
    ghost?.advance(ticks)
    session.drain(handleEvent)

    const driver = session.driver()
    const run = driver.state()
    const world = driver.world().snapshot()

    const path = session.previewPath()
    if (path) preview.show(path)
    else preview.hide()

    const alpha = session.alpha()
    const { pos: shipPos, angle: velAngle, speed } = pose(driver, alpha)
    const g = ghost?.driver()
    if (g && ghostEnabled && g.state().mode !== 'dead') {
      const gp = pose(g, alpha)
      ghostShip.update(gp.pos, gp.angle)
    } else ghostShip.update(null, 0)

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

  // interpolated render pose of a run (live ship or ghost) between its last two ticks
  function pose(d: RunDriver, alpha: number): { pos: Vec; angle: number; speed: number } {
    const run = d.state()
    const prev = d.prevShipPos()
    const pos = {
      x: prev.x + (run.ship.pos.x - prev.x) * alpha,
      y: prev.y + (run.ship.pos.y - prev.y) * alpha,
    }
    const speed = len(run.ship.vel)
    const angle = speed > 0.1 ? Math.atan2(run.ship.vel.y, run.ship.vel.x)
      : (run.orbit ? run.orbit.angle + (run.orbit.dir * Math.PI) / 2 : 0)
    return { pos, angle, speed }
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
