# AGENTS.md — planet-hopper codebase operations

Read before changing code. Working method and locked decisions: `CLAUDE.md`.
Source of truth for spec/decisions: `PROJECT.md`.

## Agent stance
- **Pure logic does not live in render/input/ui code.** Physics, world generation, and
  scoring live in `src/physics/`, `src/world/`, `src/core/` — no Three.js imports, no DOM,
  unit-tested with Vitest.
- `src/render/` consumes simulation state read-only; it never contains game rules.
- The simulation is deterministic per seed and fixed-timestep (120 Hz). Never introduce
  frame-rate-dependent behavior into game logic.
- Performance target (60 fps, integrated GPU) is part of "done" for every render-side task.

## Architecture
- `src/core/` — game loop (fixed timestep + interpolation), state machine, scoring
- `src/physics/` — gravity integrator, capture logic, trajectory preview
- `src/world/` — seeded procedural generation (planets, crystals, hazards)
- `src/render/` — Three.js scene, materials, post-processing, particles, camera
- `src/input/` — Pointer Events (mouse + touch unified), drag-aim state
- `src/ui/` — DOM overlay: HUD, menus, game-over (German texts)
- `src/audio/` — WebAudio synth SFX
- `tests/` — Vitest unit tests for everything pure

## Run / build / test
- `npm install` · `npm run dev` (Vite, port 5173) · `npm run build`
- Gate: `npm run gate` = `typecheck` + `test:run` + `lint` — must be green before commit.

## Best first edits
- **New mechanic/rule** → implement in `src/physics/` or `src/core/` with a test first,
  then wire visuals in `src/render/` separately.
- **Visual polish** → `src/render/` only; verify fps stays at target before committing.
