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

### v1.1 "Ghost & Shine" (2026-09-27, plan `docs/superpowers/plans/2026-07-21-ghost-and-shine.md`)
Outcome + deviations are in the plan doc's Outcome section.
- [x] Task 1: top-K gravity without sort (bit-identical golden test)
- [x] Task 2: boot() decomposition — session, run driver, RUN_RESETTABLES registry
- [x] Task 3: event-drain smoke test (pure session instead of jsdom + three mock)
- [x] Task 4: reachability test (2000/2000 gaps, guard = void gap)
- [x] Task 5: vendor chunk split (three-core + three, no size warning)
- [x] Task 6: ghost replay (seeded runs only)
- [x] Task 7: daily seed, `?seed=` links, share button (done before Task 6)
- [x] Task 8: milestone toasts
- [x] Task 9: audio deepening (pad, Doppler flyby, layered death) — mix = Nico's ear
- [x] Task 10: theme prototype — branch 2 (no decision yet; hooks fenced)
- [x] Task 11: README + verification table
- [x] Headless render + play (SwiftShader, Playwright): 4 runtime bugs fixed, screenshots
      in `docs/screenshots/`

### Deferred polish (v1.1 candidates)
Consciously deferred out of v1 so it converges (spec nice-to-haves, from
`docs/superpowers/plans/2026-07-06-planet-hopper-v1.md` "Deferred polish"); each
is a small standalone iteration.
- [ ] Nebula gradient backdrop layers (spec §6) — starfield + fog ship first.
- [ ] Slight time-dilation on flyby bonus (spec §6 juice).
- [x] Ambient synth pad (spec §7) — shipped in v1.1 Task 9; volume balancing on real
      speakers is in Needs Nico (audio mix veto).
- [ ] Adaptive DPR feedback loop (spec §10) — the current DPR cap (≤2) is static; a real
      feedback loop needs measured fps on real hardware to tune against (Nico territory).

### Needs Nico live verify (accumulates during Phase 2)
(visual/game-feel checks that need a real display + GPU — appended as tasks complete)
> 2026-09-27 headless pass (Playwright + SwiftShader, prod build): the mechanical parts of
> the items below are now verified — 0 console errors, non-blank canvas, start → orbit →
> drag preview → launch → capture chain (10 hops) → game over → Nochmal, HUD counts, Esc
> pause, mute button present, AudioContext only after a gesture. What remains for each item
> is the human part: looks, feel, audibility, real fps. The Task 21 overlay was fixed to
> read frame intervals (it used to report 1000 / CPU-ms, e.g. "362 fps" at a real ~10 fps).
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
Matches the "pending" column of the README verification table.
- **Theme decision A–D** (`npm run dev` → `http://localhost:5173/?variant=A|B|C|D`, ~5 min
  with real eyes; orientation grid `docs/screenshots/theme-variants.jpg` is
  SwiftShader-rendered). The winner then gets folded in per plan 2026-07-21 Task 10
  branch 1.
- **Live GPU session** (`npm run dev`): game feel of the full loop; real fps from the
  bottom-left dev overlay (now frame-interval based — trustworthy); looks of bloom/trail/
  rings; readability of the ghost (opacity 0.35) and the milestone toasts; mobile/touch
  viewport check (pause button, drag gesture); WebGL-less fallback message.
- **Audio mix veto** by ear: `SFX_GAIN`, `PAD_GAIN`, `DEATH_NOISE_GAIN` in
  `src/audio/mix.ts`.
- **Balance feel after the flyby fix:** a launch no longer pays a free flyby, so scores
  are lower than in v1 and the ×-multiplier needs real flybys. Reachability headroom
  measured: gaps stay 100 % reachable even at 2× spacing — difficulty can go up if runs
  feel too easy.
- Trailer GIF/clip for the README (5 s flyby + capture, real screen recording).
- Name confirmation ("Planet Hopper" is the working title).
- Git remote / public-visibility decision before any first push (publish checklist), then
  merge `autopilot/work` → `main` (the push to `main` triggers the Pages deploy).
- `.github/workflows/deploy.yml` action pins bumped 2026-09-27 to the then-latest majors
  (checkout v7, setup-node v7 with Node 24, upload-pages-artifact v5, deploy-pages v5 —
  the v3/v4 pair was the Node20 generation); release notes show no breaking change for
  this workflow, but it has never run — the first push to `main` on a remote is its test.
- WebGL-fallback message (`src/main.ts`) should link to the repo (spec §11) once a public
  remote exists — inert until then, same dependency as the git-remote decision above.
- Portfolio entry once presentable.
