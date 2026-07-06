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
Phases 1+ are populated from the approved implementation plan
(`docs/superpowers/plans/`, produced by writing-plans — next step after Nico's spec
review). The loop MUST NOT invent tasks beyond the spec; if this section is empty,
there is nothing to build yet — exit.

## Standing mandate (per AUTOPILOT, once per phase — not per iteration)
- [ ] Phase boundaries: run the self-challenge/SOTA step; write an ADR under `docs/adr/` if it
      changes the plan.

## Needs Nico (loop cannot do these itself)
- Git remote / public-visibility decision before any first push.
- Game-feel + visual sign-off on a real GPU/display; fps verification on a real laptop.
- Name confirmation ("Planet Hopper" is the working title).
