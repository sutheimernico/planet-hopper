# planet-hopper — Project (Source of Truth)

A 3D browser arcade game and portfolio showpiece: slingshot a small ship from planet
to planet through an endless, procedurally generated star field using real gravity
simulation. Built to demonstrate 3D graphics, custom physics, and polish in a single,
dependency-light TypeScript codebase. Everything on screen is rendered live (Three.js);
there are no prerendered assets and no backend.

# Part I — Specification

Full design: `docs/superpowers/specs/2026-07-06-planet-hopper-design.md` (binding).

## 1 · Vision & non-negotiables
- A recruiter clicking the link must think "wow" within the first 10 seconds.
- 60 fps on an integrated GPU (office laptop). Performance is a feature, not a footnote.
- Runs in any modern browser, no install, no backend, fully static.
- Desktop-first (mouse), touch works properly as a fallback.
- Honest framing: performance claims are measured, never asserted; captures are real.

## 2 · Architecture
- Pure logic (physics, world generation, scoring) strictly separated from rendering —
  unit-testable without a GPU or DOM.
- Fixed-timestep simulation (120 Hz) with render interpolation; trajectory preview runs
  the same integrator as the game (no fake preview).
- Three.js scene + post-processing; UI as DOM overlay; audio synthesized via WebAudio.
- Seeded, deterministic world generation.

## 3 · Scope
v1: endless run, drag-aim slingshot with live trajectory preview, auto-capture into
orbit, fuel economy + crystals, flyby bonus, hazards (suns, void drift), score + local
highscore, low-poly toon look with bloom/trails/juice, synth SFX, mouse + touch,
start/pause/game-over screens.
Out (v2 candidates): online leaderboard, levels/upgrades, mid-flight thrust, gamepad.

## 4 · Data model
No persistence beyond `localStorage` (highscore, mute flag). World is derived from a
seed at runtime; nothing is stored or fetched.

## 5 · Tech stack
Three.js + TypeScript + Vite. Vitest for unit tests, ESLint (typescript-eslint) for lint.
No UI framework — DOM overlay only. No runtime network access.

## 6 · Acceptance criteria
- `npm run gate` (typecheck + tests + lint) green.
- Measured 60 fps on integrated GPU in a normal run (dev FPS overlay).
- A full run works end to end: aim → launch → capture/crash → score → restart.
- Trajectory preview matches the actual flight path.
- Playable with mouse and with touch; WebGL-less browsers get a clean fallback message.

# Part II — Plan & working method

## Status
<!-- keep current — the sweep and every fresh agent reads this first -->
- 2026-09-27: v1.1 "Ghost & Shine" on `autopilot/work`: ghost replay, daily challenge +
  `?seed=` share links, milestone toasts, deeper synth audio, vendor chunk split, boot()
  decomposed into a tested session/run-driver/reset-registry. 144 tests green, gate +
  build clean (149.87 kB gzip JS in 3 chunks). First real render: headless Chromium +
  SwiftShader with real mouse input — 0 console errors, 4 runtime bugs found and fixed
  (stale preview, free flyby per launch, mid-round sim freeze, dev fps overlay measuring
  CPU instead of frame time). Needs Nico: theme A–D, live GPU/feel/fps/mobile session,
  audio mix, name, remote + deploy (PLAN.md "Needs Nico").
- 2026-07-11: v1 code-complete on `autopilot/work` (Tasks 1–23 done): full arcade
  loop wired end to end (aim → launch → capture/crash → score → restart), 79 tests
  green, gate clean (typecheck + tests + lint), production build clean (145 kB
  gzip). Verified so far via automated gate/build/headless smoke only — no real
  browser/GPU session yet. Needs Nico: live game-feel/fps verify on a real
  integrated-GPU display, git remote + public-visibility decision, name
  confirmation ("Planet Hopper" is the working title).

## Roadmap
Indicative (the implementation plan refines this): Phase 0 scaffold ✓ → Phase 1 physics
core → Phase 2 world generation → Phase 3 rendering/visuals → Phase 4 input + HUD →
Phase 5 audio + game-feel juice → Phase 6 performance pass + deployment.

## Working method
Superpowers flow (brainstorming ✓ → writing-plans → executing-plans /
subagent-driven-development → verification-before-completion). Autonomous loop per
`~/private/AUTOPILOT.md` + `LOOP.md` once the plan is approved. Interactive sessions
document to `docs/sessions/`.

## §Decisions (register — closed, dated)
- 2026-07-06 — Concept: "Planet Hopper" (slingshot gravity arcade) chosen over neon
  endless racer and underwater glider, after visual side-by-side comparison.
- 2026-07-06 — Stack: vanilla Three.js + TS + Vite over React Three Fiber / Babylon.js
  (game-loop control, performance, portfolio effect of framework-free 3D).
- 2026-07-06 — HUD: variant A "free corners" (fuel top-left, score/combo top-right,
  contextual hint bottom); bottom stays free for the drag gesture.
- 2026-07-06 — Planets always capture (no crash on planets) — frustration avoidance;
  hazards are suns and void drift.
- 2026-07-06 — No mid-flight thrust in v1: pure slingshot, fuel spent only on launch.
- 2026-07-06 — Audio synthesized at runtime (WebAudio), no audio assets, no licensing.
- 2026-07-06 — UI texts German (house default); code/comments/docs English.

## §Open inputs (living — external facts Nico owns → "Needs Nico")
- Git remote + public-visibility decision before any first push (publish checklist applies).
- Name confirmation ("Planet Hopper" is the working title).
- Game-feel and visual sign-off on a real GPU/display; performance verification on a
  real integrated-GPU laptop.
- Portfolio entry once presentable.
