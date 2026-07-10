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
- [ ] Task 12: Sim tick (orbit, flight, capture, hazards, fuel)
- [ ] Task 13: Fixed-timestep accumulator
- [ ] Task 14: Guarded storage + pure aim mapping

### Phase 2 — Rendering, input, UI, audio
- [ ] Task 15: Scene rig (renderer, camera, starfield, bloom)
- [ ] Task 16: Entity mesh pools
- [ ] Task 17: Trajectory preview line + pointer controls
- [ ] Task 18: HUD, screens, styling (German UI)
- [ ] Task 19: Game bootstrap (main.ts wiring)
- [ ] Task 20: Audio synth + trail + bursts
- [ ] Task 21: Dev FPS overlay + performance pass
- [ ] Task 22: GitHub Pages deploy workflow
- [ ] Task 23: Documentation sync + final verification

### Needs Nico live verify (accumulates during Phase 2)
(visual/game-feel checks that need a real display + GPU — appended as tasks complete)

## Standing mandate (per AUTOPILOT, once per phase — not per iteration)
- [ ] Phase boundaries: run the self-challenge/SOTA step; write an ADR under `docs/adr/` if it
      changes the plan.

## Needs Nico (loop cannot do these itself)
- Git remote / public-visibility decision before any first push.
- Game-feel + visual sign-off on a real GPU/display; fps verification on a real laptop.
- Name confirmation ("Planet Hopper" is the working title).
