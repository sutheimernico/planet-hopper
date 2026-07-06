# Planet Hopper — Design Spec

Date: 2026-07-06 · Status: awaiting Nico's review
Decisions taken during brainstorming (visual companion + terminal); register in `PROJECT.md §Decisions`.

## 1 · Goal & audience

A 3D browser arcade game as a portfolio showpiece. The target viewer is a recruiter or
engineering lead who clicks a link, plays for ~60 seconds, and should come away thinking
"this person can build real things well". That drives every trade-off: instant load,
instant wow, visible technical depth (custom physics, procedural generation, live
rendering), and disciplined polish over feature count.

Success criteria: wow within 10 seconds · 60 fps on integrated GPU · playable run of
1–3 minutes · works desktop (primary) and touch (proper fallback) · fully static, no
backend.

## 2 · Core loop (player experience)

1. Ship auto-orbits the current planet.
2. Player presses and drags (mouse or finger) → aim vector (direction + power) with a
   **live trajectory preview** — a glowing dashed path computed by the *same* physics
   integrator as the flight. No fake preview.
3. Release → launch. Fuel is spent proportional to launch power.
4. Ship flies ballistically under gravity of nearby planets. Skilled players shave close
   past planets for **flyby bonuses** (score multiplier) instead of capturing.
5. Entering a planet's capture radius → automatic orbit insertion (planets never kill).
6. Repeat. Runs end by: burning in a sun, drifting into the void (warning first), or
   being stranded in orbit with no fuel.

Score = distance progressed + crystals collected + flyby multipliers. Local highscore
in `localStorage`. Run length 1–3 minutes by design (difficulty ramp, fuel pressure).

## 3 · Mechanics in detail

- **Aiming**: drag length maps to launch power (clamped); drag direction sets the launch
  vector. Preview simulates ~3 s ahead, rendered as a fading dashed line.
- **Fuel**: single resource. Launch cost ∝ power. Crystals floating in space refill a
  fixed amount. Fuel is visible at all times (HUD). No fuel + in orbit = stranded (run
  ends after a short "no move possible" grace).
- **Capture**: each planet has a capture radius (visualized as a faint dashed ring on
  approach). Crossing it circularizes the ship into a stable orbit at entry side.
- **Flyby bonus**: passing within a planet's flyby band (outside capture radius, inside
  gravity influence) without capturing grants a stacking multiplier with a short decay
  timer — the skill-expression mechanic for replay value.
- **Hazards**: suns (lethal radius, strong gravity, visually unmistakable), void drift
  (leaving the populated corridor triggers a warning + countdown, then ends the run).
- **Difficulty ramp**: planet spacing grows, suns appear more often, crystal density
  falls. The first ~10 planets are hand-tuned parameters (not hand-placed geometry) to
  guarantee a gentle, teachable start — this addresses the known tuning risk of gravity
  gameplay.

## 4 · Physics model

- Fixed timestep **120 Hz** simulation with an accumulator; rendering interpolates
  between the last two states. Game logic is frame-rate independent and deterministic.
- Semi-implicit Euler integration; gravity from the **3 nearest planets** (n-body
  light — cheap, stable, and produces real slingshot behavior).
- Trajectory preview runs the identical integrator/stepping over the preview horizon.
- All physics is pure TypeScript in `src/physics/` — no Three.js, no DOM — and
  unit-tested (orbit stability, capture correctness, preview determinism).

## 5 · World generation

- Seeded PRNG; a run is fully reproducible from its seed.
- Planets are generated as a corridor chain in the travel direction: position, radius,
  mass, palette, decoration (rings/moons), plus crystals and hazards, with
  difficulty-ramp parameters as a function of distance.
- Generation is chunked ahead of the ship and recycled behind it (object pooling).
- Pure TypeScript in `src/world/`, unit-tested: reproducibility per seed, no unplayable
  gaps (every planet reachable with available fuel economy), ramp monotonicity.

## 6 · Visual direction

Low-poly toon look: flat-shaded icosphere planets in saturated biome palettes against a
deep-dark space background; neon accents (crystals, engine trail, preview line).

- **Post-processing**: bloom (suns, crystals, engine glow); kept cheap and tuned for
  integrated GPUs.
- **Ship**: small stylized craft with a glowing particle/ribbon trail.
- **Backdrop**: instanced starfield + subtle nebula gradients; parallax with camera.
- **Juice** (game feel): smooth-follow camera with speed-dependent zoom, FOV kick on
  launch, screen shake + particle burst on capture, sparkle on crystal pickup, slight
  time-dilation on flyby bonus.
- **HUD — variant A "free corners"** (chosen in mockup comparison): fuel bar top-left,
  score + combo top-right, contextual hint bottom-center; HUD dims to ~40 % opacity
  during flight. Bottom half stays clear for the drag gesture.
- **Screens**: start (title, "drag to aim" one-liner, highscore), pause (tab blur or
  Esc/button), game over (score, distance, highscore, restart). DOM overlay, German UI
  texts.

## 7 · Audio

Synthesized at runtime via WebAudio (no asset files, no licensing): launch whoosh,
capture chime, crystal pickup, flyby riser, ambient pad. Mute toggle persisted in
`localStorage`. Audio starts only after first user interaction (browser autoplay policy).

## 8 · Input

Pointer Events unify mouse and touch (`src/input/`). Drag anywhere to aim (no tiny hit
targets on mobile). Esc/button pauses. No keyboard requirement — desktop uses the mouse.

## 9 · Architecture

```
src/
  core/       fixed-timestep loop, state machine (menu → playing → paused → gameover), scoring
  physics/    gravity integrator, capture, trajectory preview      ← pure, tested
  world/      seeded procedural generation, chunk recycling        ← pure, tested
  render/     Three.js scene, materials, post-FX, particles, camera
  input/      Pointer Events → aim state
  ui/         DOM overlay: HUD, screens (German texts)
  audio/      WebAudio synth
tests/        Vitest unit tests for everything pure
```

Hard boundary: `physics/`, `world/`, and scoring in `core/` never import Three.js or
touch the DOM. `render/` reads simulation state; it contains no game rules.

## 10 · Performance budget (60 fps on integrated GPU)

- Instancing for stars, particles, crystals; object pooling for world chunks.
- Capped `devicePixelRatio` (≤ 2, lower under load); frustum-friendly corridor layout.
- Cheap materials (flat/toon shading, no shadow maps); bloom as the single big post
  effect.
- Dev-only FPS/frame-time overlay; performance is checked per render-side task, not
  once at the end.

## 11 · Error handling & robustness

- WebGL support check at boot → clean German fallback message with a link to the repo.
- Pause on tab blur (`visibilitychange`); correct resize/orientation handling.
- `localStorage` access guarded (private mode); game runs without persistence if blocked.

## 12 · Testing strategy

- **Vitest (pure logic)**: integrator behavior (stable orbit, energy sanity), capture
  logic, preview-equals-flight determinism, seeded generator reproducibility and
  playability constraints, scoring/multiplier rules, fuel economy.
- **Manual/visual** (verification-before-completion + Nico's eye): game feel, look,
  fps on real hardware. Never self-declared "polished" — measured and demoed.
- Gate: `npm run gate` = typecheck + vitest + eslint.

## 13 · Out of scope (v1)

Online leaderboard/backend, levels/progression/upgrades, mid-flight thrust (pure
slingshot only), gamepad, i18n beyond German UI texts, mobile-first optimizations
beyond touch controls + DPR capping.

## 14 · Deployment

Public GitHub repo + GitHub Pages via Actions (same pattern as grid-scout), Vite `base`
configured for Pages. Publish checklist (secret scan, noreply history, MIT license)
applies before going public. Portfolio entry once presentable.

## 15 · Needs Nico

Git remote + visibility decision · name confirmation ("Planet Hopper" = working title) ·
game-feel/visual/fps sign-off on real hardware · portfolio entry.
