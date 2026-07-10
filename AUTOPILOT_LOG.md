# planet-hopper — autopilot log

One line per iteration. Newest last.

- 2026-07-10 — Task 10: scoring (`src/core/score.ts`) — distance points accrue only on new max x, crystals award `CRYSTAL_POINTS * mult`, flybys raise the multiplier (capped at `MULT_MAX`) and decay back to 1 after `MULT_DECAY_SECONDS`; 4 tests, gate green (48 tests total).
- 2026-07-10 — Task 10 review follow-up: pin distance scoring under active multiplier (new test), document `tickScore` caller contract (post-integration x, `dt >= 0`), drop stray path-header comment; gate green (49 tests total).
- 2026-07-10 — Task 11: game phase machine (`src/core/state.ts`) — pure lookup-table transition over `menu`/`playing`/`paused`/`gameover` phases and `start`/`pause`/`resume`/`die`/`restart` events, invalid events are no-ops; 8 tests, gate green (57 tests total).
- 2026-07-10 — Task 12: sim tick (`src/core/sim.ts`) — wires orbit/flight/capture/pickups/hazards/fuel into one `tickRun`, plus `newRun`/`launch`; 9 tests, gate green (66 tests total).
- 2026-07-10 — Task 12 review follow-up: replace tautological event assertion with `toEqual([])`, pin crystal refuel cap at `FUEL_MAX` and dead-state short-circuit (2 new tests), comment accepted pre-tick-x deviation in orbiting branch; gate green (68 tests total).
- 2026-07-10 — Task 13: fixed-timestep accumulator (`src/core/loop.ts`) — `createAccumulator` converts elapsed wall-clock seconds into whole `DT` steps, clamps huge frames at `MAX_STEPS_PER_FRAME` (spiral-of-death guard), and exposes `alpha()` for render interpolation; 4 tests, gate green (72 tests total).
