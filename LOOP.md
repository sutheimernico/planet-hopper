# planet-hopper — LOOP (per-iteration prompt for the autonomous build agent)

You are a fresh headless agent. You do ONE high-value thing, verify it, commit it, and exit.
Progress lives on disk (this file, `PROJECT.md`/`PLAN.md`, git history, `AUTOPILOT_LOG.md`) —
never in context.

## Per-iteration protocol
1. Read `~/private/AUTOPILOT.md` (global rules), then this `LOOP.md`, then `PLAN.md` + `PROJECT.md`.
2. Confirm you are on branch `autopilot/work` (the runner guarantees this; if not, stop).
3. Pick the SINGLE highest-value open `- [ ]` task (top-to-bottom, earlier phases first). If a
   phase boundary is reached, run the once-per-phase self-challenge/SOTA step first (write an ADR
   if it changes the plan).
4. Do that one task. Small, reviewable diff. Read existing code before writing; match conventions.
   New logic ships with a test.
5. Run the gate: `npm run gate` (typecheck + vitest + eslint). If red, fix or revert.
6. On green: commit (Conventional Commits, English, imperative), check off the task in `PLAN.md`,
   append a one-line note to `AUTOPILOT_LOG.md`. Then exit.
7. If a task needs a Nico-only input: move it to "Needs Nico", pick another, or exit.
   Never fake data, metrics, or fps numbers.

## Project-specific hard constraints (never override)
- **Fully static & free.** No backend, no external APIs, no CDN assets — everything procedural
  and bundled. No new runtime dependencies without a one-line justification.
- **Pure logic stays pure.** `src/physics/`, `src/world/`, scoring in `src/core/` must not import
  Three.js or touch the DOM — that is what makes them testable. Rendering lives in `src/render/`.
- **Determinism.** World generation is seeded; the trajectory preview uses the same integrator as
  the flight. Tests are deterministic, no timing-dependent assertions.
- **Performance is a gate-level concern.** Target 60 fps on integrated GPU: instancing, object
  pooling, capped pixel ratio. A task that tanks fps is not done.
- **Honesty.** Measured numbers only; no fabricated benchmarks or fake screenshots. UI texts
  German; code/comments/docs English.

## Gate (objective done-check)
`npm run gate` — typecheck + vitest + eslint, all green. Commit only a green gate.

## Where things are
- Spec: `docs/superpowers/specs/2026-07-06-planet-hopper-design.md`
- Code: `src/{core,physics,world,render,input,ui,audio}/` (one responsibility per file)
- Tests: `tests/` · Entry: `src/main.ts` · Static shell: `index.html`
- Run locally: `npm run dev` (Vite, default port 5173)
