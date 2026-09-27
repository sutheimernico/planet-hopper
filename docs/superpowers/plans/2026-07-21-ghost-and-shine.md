# Plan: Ghost & Shine — planet-hopper v1.1

**Date:** 2026-07-21 · **Status:** done 2026-09-27 (go given; see Outcome) · **Executor:** any capable agent (self-contained — no session context required)
**Branch state:** v1 code-complete on `autopilot/work` (24 tasks, 80 tests green, typecheck+lint clean, 145 kB gzip). Theme prototype is **committed** (`src/render/theme-prototype.ts`, dev-only, tree-shaken from prod — verified) with two "PROTOTYPE HOOK" touch points in `meshes.ts`/`scene.ts`.

## Context (verified 2026-07-21 by code review)

planet-hopper is a 3D slingshot-gravity endless-arcade browser game (Three.js + TS + Vite): auto-orbit → drag-aim with live trajectory preview (same integrator as flight — no fake preview) → ballistic flight under k-nearest gravity → capture/flyby/crystals/fuel, seeded procedural corridor with difficulty ramp, fixed-timestep loop with interpolation, exemplary object pooling in the render layer. Strict pure-core discipline: `src/core`, `src/physics`, `src/world` have zero Three.js/DOM imports and are fully headless-testable.

Findings to act on:
- `src/physics/gravity.ts:17-19` `accelerationAt` copies + sorts **all** bodies per call to find K_NEAREST=3 — called up to 8×/frame in ticks and 360×/frame while aiming. The only allocation in an otherwise allocation-free hot path.
- `src/main.ts` (249 lines, `boot()`) is the least-tested, most-patched file — three separate "forgot to reset X" bug fixes live there; the reset sequence is duplicated in three places. No test covers the event-drain logic where the documented "launch event dropped" bug sat.
- No solvability guarantee: `generator.test.ts` proves determinism/bounds but never that consecutive planet gaps are reachable within `[POWER_MIN..POWER_MAX]`.
- Bundle: one 570 kB chunk (145 kB gzip), Vite warns on every build.
- Audio is five oscillator blips; ambient pad / flyby Doppler deferred since bootstrap.

Hard project boundaries (from PROJECT.md/spec — do not violate): fully static, **no backend, no leaderboard, no levels/upgrades, no mid-flight thrust**; honest framing (no perf claims that weren't measured); German UI texts; pure-core layering (core/physics/world stay free of Three.js/DOM).

**Reality check that shapes this plan:** nothing here has ever run on a real GPU or been *felt* by a human. Everything below is chosen to be buildable and testable headless; game-feel, theme choice, FPS claims and the trailer need Nico.

## Goal

Use the project's own architectural wager — a deterministic pure core — to ship the two features that prove it (ghost replay, daily seed), close the engine-hygiene gaps, and bring the branch to merge-ready state for Nico's GPU session.

## Execution rules

- Continue on `autopilot/work`. Conventional Commits, English. Gates after every task: `npm run test:run && npm run typecheck && npm run lint`; before finishing: `npm run build` (no new warnings beyond the known chunk one until Task 5 lands).
- New logic follows the layering: record/replay/seed/achievement logic is pure (core/), rendering of it stays in render/, wiring in main.ts — and every pure module ships with tests.
- No new runtime dependencies (Three.js stays the only one). No assets >10 kB (synthesized audio only).
- UI strings German, code English.

---

## Phase A — Engine hygiene

### Task 1: Top-K gravity without sort
**Files:** `src/physics/gravity.ts`, `tests/gravity.test.ts`.
Replace copy+sort with a manual top-K selection (single pass, K=3 insertion into a small fixed array — no allocations). Golden test: identical acceleration output vs. the old implementation across randomized body sets (port the old logic into the test as reference).
**Accept:** byte-identical trajectories on existing golden tests; no `[...bodies]` allocation in the hot path.

### Task 2: Decompose `boot()` — structural fix for the reset bugs
**Files:** `src/main.ts`, new `src/core/run-lifecycle.ts` (or similar), tests.
Extract the run-reset sequence (currently duplicated 3×: aiming state, preview.hide(), pendingAim, plus sim/score/camera resets) into one pure-ish lifecycle module with an explicit ordered list of resettables; main.ts calls it from all three sites. Extract input→sim event wiring into a testable unit (queue in, drained events out).
**Accept:** the three call sites collapse to one function; a unit test enumerates every resettable and fails if a new stateful subsystem is registered without a reset entry (registry pattern).

### Task 3: Event-drain smoke test
**Files:** new `tests/main-integration.test.ts` (jsdom + minimal Three.js mock, pattern: mock `three` module surface used by render/).
Simulate: aim → launch → event queue drained exactly once → pause during flight → resume → capture. Pin the historical "launch event dropped" regression.
**Accept:** test fails when the launch-drain line is reverted (verify by temporary mutation, then restore).

### Task 4: Solvability/reachability test for the generator
**Files:** `tests/reachability.test.ts`, possibly a small pure helper in `src/world/`.
Over N=50 seeds and the first ~40 planets each: for every consecutive planet pair, assert a launch exists (sweep a coarse grid of angle × power ≤ POWER_MAX through `simulateTrajectory`) whose path enters the target's capture radius. Budget the test (coarse grid, early exit) to stay <10s.
**Accept:** test green on current constants; deliberately doubling `RAMP_DISTANCE` spacing in a fixture makes it fail (guard demonstrated, then reverted).

### Task 5: Bundle chunking
**Files:** `vite.config.ts`.
Manual chunk for `three` (vendor split). Do not raise `chunkSizeWarningLimit` — split instead, so future regressions surface.
**Accept:** build emits app chunk + vendor chunk, no size warning, total gzip not larger than before.

---

## Phase B — Features the architecture earned (all headless-testable)

### Task 6: Ghost replay of the best run
**Files:** new `src/core/replay.ts` (record/playback, pure), `src/render/ghost.ts` (translucent ship + optional faded trail), storage extension in the existing persistence module, wiring in main.ts, tests.
- Record per run: seed + timestamped input events (launches with angle/power). On new highscore: persist recording (localStorage, versioned schema, size-capped — cap ~50 launches, drop ghost beyond).
- Playback: a second sim instance driven by the recorded inputs, same fixed timestep — renders as a ghost ship. Determinism is the whole point and the test: **same seed + same inputs ⇒ identical state sequence** (assert on hashed per-tick positions).
- Ghost is visual-only: no collision, no score interaction; toggle in the pause menu ("Geist: an/aus", persisted).
**Accept:** pure round-trip test (record → replay → identical states); schema-version migration test (old/corrupt recording → silently no ghost); UI toggle wired.

### Task 7: Daily seed + share link (no backend)
**Files:** `src/world/` seed plumbing (exists), new `src/core/daily.ts`, UI (start screen), tests.
- `?seed=<string>` URL param selects the world seed (validated, fallback to random). "Tages-Challenge"-button on the start screen → seed `YYYY-MM-DD` (UTC).
- After a daily run: "Teilen"-button copies text + link to clipboard (`Planet Hopper Tages-Challenge 2026-07-21: 4.320 Punkte — schaffst du mehr? <url>?seed=2026-07-21`). Clipboard API with graceful fallback (show the text for manual copy).
- Daily highscore stored per seed-date, separate from the endless highscore.
**Accept:** seed param round-trip test; date-seed determinism test; share-text formatting test; no network calls anywhere (grep).

### Task 8: Milestone toasts
**Files:** new `src/core/milestones.ts` (pure), small toast UI, tests.
Fixed set (no meta-progression — boundary!): first flyby, 3×-multiplier, first 1.000/5.000/10.000 points, 5 crystals in one run. Pure evaluator over the score/sim state emits at most one toast per tick; UI shows German text 2s, non-blocking, pointer-events none.
**Accept:** evaluator unit tests (each milestone once per run, reset on restart via the Task-2 registry); no layout shift (position: fixed overlay).

### Task 9: Audio deepening (code side)
**Files:** `src/audio/sfx.ts`, tests where logic allows (frequency ramp math).
Synthesized only: quiet ambient pad (two detuned oscillators + slow LFO gain, starts after first interaction, respects mute), Doppler-style pitch ramp on flyby (map relative speed → playbackRate/frequency ramp), layered death sound (noise burst + low sine drop). Conservative default mix (pad ≤ −24 dB rel. to effects). **Flag in the outcome section: final mix is Nico's ear — one line on how to tweak the three gain constants.**
**Accept:** no autoplay violations (pad gated on interaction), mute kills everything (test via the existing audio state), constants documented.

---

## Phase C — Merge readiness

### Task 10: Theme-prototype resolution (decision tree — do not pick the look yourself)
**Files:** `src/render/theme-prototype.ts`, hooks in `src/render/meshes.ts` + `src/render/scene.ts`, README.
The four variants (`?variant=A|B|C|D`) exist for **Nico's eyes**; an agent must not choose optics on SwiftShader. Execute whichever branch applies at execution time:
1. **Nico's go names a winner** (A/B/C/D): fold that variant's material/backdrop code properly into `meshes.ts`/`scene.ts` (no dev-flag), delete the prototype file + both hooks, note the choice in README.
2. **No decision yet**: leave the prototype in place (it is dev-only and tree-shaken — verified safe), add a prominent "Offene Entscheidung: Theme A–D unter `npm run dev` + `?variant=`" line to README and the Needs-Nico list, and ensure both hooks are clearly fenced with removal instructions.
**Accept:** either a folded-in theme with prototype deleted, or a documented, safely-fenced open decision. No half-merged look.

### Task 11: README + verification table
**Files:** `README.md`.
Honest verification table (feature × proven-by: unit test / headless build / **pending GPU**), controls, daily-challenge explainer, ghost feature note, dev/`?variant=` instructions, bundle size (measured, post-Task-5). No FPS claims — "60 fps target, unverified on real hardware" until Nico's session says otherwise.
**Accept:** every claim traceable; the pending-GPU items match the Needs-Nico list exactly.

---

## Verification before completion
1. Full gates: `npm run test:run && npm run typecheck && npm run lint && npm run build` — green, no chunk warning.
2. Determinism sweep: ghost round-trip + generator golden tests + reachability suite.
3. Headless render smoke (existing pattern) still passes with ghost + toasts active.
4. Append an **Outcome** section here: built/deviations, audio mix constants, bundle sizes before/after, which Task-10 branch ran.

## Needs Nico (not agent-executable — the fun stuff)
- Go for this plan; theme decision A–D (`npm run dev`, then `?variant=B` etc. — 5 minutes with real eyes).
- Live GPU session: game feel, real FPS, mobile viewport check, audio mix veto (three constants).
- Trailer GIF/clip for README (5s flyby+capture screen recording — no agent can do this honestly).
- Merge to `main`, final name decision, remote/deploy (GH Pages fits the fully-static constraint), portfolio entry.

---

## Outcome (2026-09-27)

**Executed:** Tasks 1–11 on `autopilot/work`, 18 commits `d123d7f`..the bookkeeping commit, one
logical change each, gate (`test:run` + `typecheck` + `lint`, unpiped) green before every
commit, `npm run build` clean at the end. Tests 80 → 144 (25 files).

### What was built
| Task | Result |
|---|---|
| 1 Top-K gravity | single-pass insertion into reused typed-array scratch; golden test vs. the ported copy+sort (2000 randomized sets incl. ties + a 3000-step generated-world flight) bit-identical; mutation (`<` → `<=`) caught. Node micro-bench: 360 calls over 15 bodies 0.184 → 0.032 ms (5.8×). |
| 2 boot() decomposition | `core/run-driver` (seeded world + RunState + ticks; generation/prune moved per-tick, O(1) idle — makes a run depend on tick count only), `core/session` (phase, held aim, accumulator, one event queue drained once per frame; one `clearGesture()`), `core/run-lifecycle` (`RUN_RESETTABLES` registry: Record type forces a handler, unlisted handlers throw). main.ts 249 → 254 lines, but now thin glue that also wires daily/ghost/toasts; the logic lives in tested core modules. |
| 3 Event-drain test | `tests/session-integration.test.ts`: aim → release → drain once → pause (0 ticks) → resume → capture; preview follows the orbiting ship; ship flies the previewed samples bit-for-bit; death → gameover. Mutation (drop the launch enqueue) fails it. |
| 4 Reachability | `tests/reachability.test.ts` + `tests/helpers/reach.ts`: 50 seeds × 40 gaps = 2000/2000 reachable in ~5 s (orbit angle × 32 directions × 5 powers, live pruned window, void rule applied). |
| 5 Chunking | `codeSplitting.groups`: three-core + three + app, no warning, limit untouched. |
| 6 Ghost | `core/replay` (versioned, validated, cap 50 launches), second RunDriver in lockstep, `render/ghost` translucent ship, stored per seed, "Geist: an/aus" in pause (persisted). Determinism test on hashed per-tick positions, also after JSON round-trip; 1e-12 input change diverges. |
| 7 Daily + share | `core/daily` (validated string seeds, FNV-1a, UTC date, German share text), start screen "Tages-Challenge", `?seed=` links, "Teilen" with Clipboard API + pre-selected fallback, "Menü" (new gameover → menu transition), per-seed bests (4 slots) apart from the endless record; static test: no network API in `src/`. |
| 8 Milestones | `core/milestones` (fixed set, once per run, ≤ 1 per check) + `ui/toast` (fixed, pointer-events none, queued 2 s each), reset via the registry. |
| 9 Audio | `audio/mix.ts` constants + Doppler math, pad (2 detuned triangles + LFO, started from the Start click), Doppler flyby, noise + sine death; one master gain so mute kills everything (fake-AudioContext tests). |
| 10 Theme | branch 2 — no decision from Nico: prototype kept (re-verified absent from prod), both hooks BEGIN/END-fenced with removal steps, README + PLAN Needs-Nico, orientation grid `docs/screenshots/theme-variants.jpg`. |
| 11 README | verification table (unit / headless / pending GPU), controls, modes, measured sizes, audio constants, deploy notes. |

### Beyond the plan (mission items 2–4)
- **First real render + play:** Playwright 1.63 (the globally installed `@playwright/cli`
  bundle — no new project dependency) driving headless Chromium with SwiftShader against
  `vite preview`. Menu/aim/flight screenshots in `docs/screenshots/` (33–41 kB JPEG).
- **Runtime bugs found and fixed:** (1) the preview was only recomputed on `pointermove`
  — holding still let it drift up to half an orbit from the real launch point
  (`08d735e`); (2) leaving the launch planet's flyby band counted as a flyby — every
  launch paid +400 × mult and stacked the multiplier (`225889b`); (3) the dev fps overlay
  computed 1000 / CPU-ms ("362 fps" at a real ~10 fps) and would have faked the 60 fps
  acceptance check (`9000f2f`); (4) mid-round, `ghost?.advance(session.advance(dt))` froze
  the sim whenever there was no ghost (optional chaining skips argument evaluation) —
  caught headless before it was committed.
- **Profiling:** CDP CPU profile (unminified scratch build) during orbit/aim/flight: main
  thread ~97 % idle, game JS ≈ 0.1–0.3 ms/frame — no JS hot spot. Inlining `dist()` to
  avoid a temporary Vec measured 0.181 → 0.171–0.177 ms per 360-step preview (noise; V8
  already elides it) → not committed.
- **Deploy prep:** `BASE_PATH` override in `vite.config.ts` (default stays the relative
  `./`, which already works on Pages project sites); workflow action pins bumped to the
  Node 24 majors (unverified until a real run). No remote, no push.

### Numbers
- Bundle gzip: before 145.40 kB JS (1 chunk, warning) + 0.95 kB CSS → after 11.43 + 50.92
  + 87.52 = 149.87 kB JS (3 chunks, no warning) + 1.12 kB CSS. Split overhead ≈ 1.2 kB;
  new features ≈ 2.6 kB app code. Acceptance "total gzip not larger" is therefore **not
  met** by ~1.2 kB — the price of every chunk < 500 kB without raising the limit.
- Frame time **software-rendered** (SwiftShader, 1280×720, 3 runs): 6–10 fps. Not a GPU
  statement.

### Deviations (with reason)
- **Task order 7 before 6:** a ghost only makes sense on a replayed seed; seeds had to exist first.
- **Ghost only for seeded runs** (daily / `?seed=`), not the endless highscore: a random
  endless world is never replayed, so its ghost would fly through planets that don't exist.
- **Task 3 without jsdom/three mock:** the drain logic moved into the pure session in Task 2,
  so the test drives the real code path with no DOM and no new dev dependency.
- **Task 4 guard:** doubling the spacing does NOT break reachability (measured 0/200 gaps
  unreachable at 2×, 20/200 at 3×), so the permanent guard is a 450 wu void gap.
- **Task 5:** total gzip +1.2 kB (see Numbers).
- **Task 8:** the milestone check runs once per rendered frame after the ticks, not per
  tick — same "≤ 1 toast per check" guarantee; the toast queue shows each for 2 s.
- **Share text for custom seeds** reads `Seed „abc“` instead of `Tages-Challenge <date>`.

### Audio mix constants (Nico's ear)
`src/audio/mix.ts`: `SFX_GAIN = 1` (all effects), `PAD_GAIN = 0.012` (≈ −24.4 dB below the
loudest effect), `DEATH_NOISE_GAIN = 0.12`. Linear gains — halve ≈ −6 dB, double ≈ +6 dB.

### Open points
All in PLAN.md "Needs Nico": theme A–D; live GPU session (feel, real fps via the fixed
overlay, looks, ghost/toast readability, mobile/touch, WebGL fallback); audio mix; balance
feel after the flyby fix; trailer clip; name; remote + merge to `main` (= first Pages
deploy, which also tests the bumped action pins); portfolio entry.
