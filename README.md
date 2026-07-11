# planet-hopper

Slingshot a ship from planet to planet through an endless, procedurally generated
star field — a 3D browser arcade game built with Three.js + TypeScript. Portfolio
showpiece: custom gravity physics, deterministic world generation, 60 fps on
integrated GPUs, no backend, no install.

## Status
v1 code-complete on `autopilot/work` (2026-07-11): full arcade loop wired end to
end (aim → launch → capture/crash → score → restart), 79 tests green, gate clean,
production build clean (145 kB gzip). Verified so far via automated gate/build/
headless smoke only — no real browser/GPU session yet. Needs Nico: live game-feel/
fps verify, git remote + public-visibility decision, name confirmation.

## Honest framing
- Everything is rendered live in the browser; no prerendered footage or assets.
- Performance claims (60 fps on integrated GPU) are measured with the dev FPS overlay,
  not asserted.
- The physics is a real fixed-timestep gravity integrator; the trajectory preview runs
  the same code as the flight — no fake preview.

## Scope
v1 is a polished arcade loop (1–3 min runs): drag to aim with live trajectory preview,
release to launch, gravity does the rest. Fuel economy, crystals, flyby bonuses, local
highscore. No online features.

## Quickstart
```bash
npm install
npm run dev        # Vite dev server
npm run gate       # typecheck + tests + lint (the objective done-check)
npm run build      # production build
npm run preview    # serve the production build locally
```

## Stack
Three.js · TypeScript · Vite · Vitest · ESLint. UI is a plain DOM overlay; audio is
synthesized via WebAudio. No UI framework, no runtime network access.

## License
MIT — see `LICENSE`.
