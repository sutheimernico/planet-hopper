# planet-hopper — Plan (AUTOPILOT-driven build backlog)

**Source of truth for design:** `docs/superpowers/specs/2026-07-06-planet-hopper-design.md`
Personal rules (`~/.claude/CLAUDE.md`) + global loop rules (`~/private/AUTOPILOT.md`) apply.

This file is the binding backlog for the autonomous loop. Each iteration picks the SINGLE
highest-value open `- [ ]` task, does it on `autopilot/work`, runs the gate, commits only if
green, checks the box, and appends one line to `AUTOPILOT_LOG.md`.

## Iron principles (never overridden)
- **Local & free only.** Fully static game, no external services, no assets to license —
  everything procedural. A task needing a Nico-only input goes to "Needs Nico", never faked.
- **Gate is objective:** `npm run gate` (typecheck + vitest + eslint) green. Never commit red.
- **One change per iteration.** No bundling. No speculative abstractions (YAGNI).
- **New logic ships with a test.** Pure logic (physics/world/scoring) never lives in render code.
- **Honesty:** performance numbers only from measured runs; no fabricated fps claims; captures
  used in README/portfolio must be real.
- **60 fps on integrated GPU is a requirement**, not a stretch goal — perf-regressing tasks fix
  the regression before the commit.

## Status
- [x] **Phase 0 — Scaffold** (bootstrap, gate green on skeleton, docs, spec — 2026-07-06)

## Backlog
Task details (full code, tests, commands) live in
`docs/superpowers/plans/2026-07-06-planet-hopper-v1.md` — that text is binding.
The loop MUST NOT invent tasks beyond the plan.

### Phase 1 — Pure core (TDD)
- [x] Task 1: 2D vector math
- [x] Task 2: Seeded PRNG
- [x] Task 3: Gameplay constants
- [x] Task 4: Gravity (k-nearest, inverse-square)
- [x] Task 5: Semi-implicit Euler integrator
- [x] Task 6: World types
- [x] Task 7: Orbit mechanics + capture
- [x] Task 8: Trajectory preview (same integrator as flight)
- [x] Task 9: Seeded endless world generator
- [x] Task 10: Scoring (distance, crystals, flyby multiplier)
- [x] Task 11: Game phase machine
- [x] Task 12: Sim tick (orbit, flight, capture, hazards, fuel)
- [x] Task 13: Fixed-timestep accumulator
- [x] Task 14: Guarded storage + pure aim mapping

### Phase 2 — Rendering, input, UI, audio
- [x] Task 15: Scene rig (renderer, camera, starfield, bloom)
- [x] Task 16: Entity mesh pools
- [x] Task 17: Trajectory preview line + pointer controls
- [x] Task 18: HUD, screens, styling (German UI)
- [x] Task 19: Game bootstrap (main.ts wiring)
- [x] Task 20: Audio synth + trail + bursts
- [x] Task 21: Dev FPS overlay + performance pass
- [x] Task 22: GitHub Pages deploy workflow
- [x] Task 23: Documentation sync + final verification

### Final-review follow-ups (Task 24, spec-gap closure — 2026-07-11)
Full task text (exact code, byte-consistent) lives in
`docs/superpowers/plans/2026-07-06-planet-hopper-v1.md` under "Task 24" — that text is
binding. Each item is its own commit (iron principle: one change per iteration).
- [x] Capture-radius ring on pooled planet meshes (spec §3)
- [x] Touch pause button in HUD (spec §6)
- [x] `effects.reset()` clears trail/burst on restart (documented gap, Task 20 review)
- [x] Ramp monotonicity test (spec §12)
- [x] Bookkeeping: deferred-polish/needs-nico/needs-nico-live-verify entries below

### Deferred polish (v1.1 candidates)
Consciously deferred out of v1 so it converges (spec nice-to-haves, from
`docs/superpowers/plans/2026-07-06-planet-hopper-v1.md` "Deferred polish"); each
is a small standalone iteration.
- [ ] Nebula gradient backdrop layers (spec §6) — starfield + fog ship first.
- [ ] Slight time-dilation on flyby bonus (spec §6 juice).
- [ ] Ambient synth pad (spec §7) — SFX ship first; pad needs volume balancing on
      real speakers.
- [ ] Adaptive DPR feedback loop (spec §10) — the current DPR cap (≤2) is static; a real
      feedback loop needs measured fps on real hardware to tune against (Nico territory).

### Needs Nico live verify (accumulates during Phase 2)
(visual/game-feel checks that need a real display + GPU — appended as tasks complete)
- [ ] Task 15: `npm run dev` → confirm dark space, starfield with subtle bloom, no console errors
      (agent smoke-checked only that the module graph serves/builds without error; cannot see a
      real WebGL canvas)
- [ ] Task 19: `npm run dev` → start screen; Start → orbit around the first planet; drag shows
      dashed preview; release launches; capture into next orbit works; HUD counts; Esc pauses;
      dying shows game over; Nochmal restarts. Zero console errors. (agent smoke-checked only that
      the module graph serves/builds without error; cannot drive pointer input or see the canvas)
- [ ] Task 20: `npm run dev` → launch/capture/crystal sounds audible, engine trail glows behind
      the ship in flight, capture/crystal/death bursts show at the ship's position, mute button
      (bottom-right) toggles sound and persists across reloads. (agent smoke-checked only that the
      module graph serves/builds without error and gate/build are green; cannot hear WebAudio
      output or see the canvas)
- [ ] Task 21: `npm run dev` (dev build) → bottom-left dev fps readout shows a plausible number
      and updates every ~30 frames; watch `renderer.info.render.calls` in devtools while flying
      for 2 minutes and confirm it stays roughly constant (pooling holds, no per-frame mesh
      allocation). Agent is headless and cannot observe real fps or render-call counts — only
      confirmed the overlay is tree-shaken out of the prod build (absent from `dist/`) and that
      `npm run build` gzip size is 145 kB, well under the 500 kB budget.
- [ ] Task 24: `npm run dev` → each planet shows a subtle dashed ring at its capture radius
      (should read as a faint gameplay hint, not a distracting halo — opacity/dash sizing is
      a judgment call); on a touch device, the bottom-left "⏸" pause button is reachable
      without interfering with the drag-to-aim gesture and disappears outside `phase ===
      'playing'`. Agent is headless and cannot judge subtlety, touch-target feel, or whether
      the ring reads correctly at actual planet sizes/zoom levels on real hardware.

## Standing mandate (per AUTOPILOT, once per phase — not per iteration)
- [ ] Phase boundaries: run the self-challenge/SOTA step; write an ADR under `docs/adr/` if it
      changes the plan.

## Needs Nico (loop cannot do these itself)
- **Theme decision A–D** (`npm run dev` → `?variant=A|B|C|D`, ~5 min with real eyes;
  orientation grid `docs/screenshots/theme-variants.jpg` is SwiftShader-rendered). The
  winner then gets folded in per plan 2026-07-21 Task 10 branch 1.
- Git remote / public-visibility decision before any first push.
- Game-feel + visual sign-off on a real GPU/display; fps verification on a real laptop.
- Name confirmation ("Planet Hopper" is the working title).
- `.github/workflows/deploy.yml` action pins bumped 2026-09-27 to the then-latest majors
  (checkout v7, setup-node v7 with Node 24, upload-pages-artifact v5, deploy-pages v5 —
  the v3/v4 pair was the Node20 generation); release notes show no breaking change for
  this workflow, but it has never run — the first push to `main` on a remote is its test.
- WebGL-fallback message (`src/main.ts`) should link to the repo (spec §11) once a public
  remote exists — inert until then, same dependency as the git-remote decision above.
