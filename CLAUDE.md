# planet-hopper — Arbeitsweise & Locked Decisions

Globale persönliche Regeln (`~/.claude/CLAUDE.md`) gelten. Diese Datei ergänzt projekt-spezifisch.
Source of Truth: `PROJECT.md` — when this file and PROJECT.md disagree, PROJECT.md wins.
Codebase operations (stack, architecture, run/build/test): `AGENTS.md`.

## Locked decisions (2026-07-06) — full register in PROJECT.md §Decisions
- Konzept: Slingshot-Gravity-Arcade ("Planet Hopper"), polierter Arcade-Loop 1–3 Min.
- Stack: vanilla Three.js + TypeScript + Vite — bewusst KEIN React Three Fiber/Babylon.
- HUD Variante A (freie Ecken); untere Bildhälfte bleibt frei für die Zieh-Geste.
- Physik: fixed timestep 120 Hz, Preview = gleicher Integrator wie Flug (nie faken).
- UI-Texte deutsch; Code/Kommentare/Doku englisch.

## Wie Claude hier arbeitet
- **Flow:** Trivial → direkt. Sonst Superpowers: `brainstorming` → `writing-plans` (Go abwarten) →
  `executing-plans`/`subagent-driven-development` → `verification-before-completion`.
- **Orchestrierung:** Read/Recherche/Review/Sweeps an Subagents (nur Konklusion zurück).
  Write/Build mit Abhängigkeiten single-threaded inline.
- **Self-Review:** iterativ pro Arbeitsschritt, nicht erst vor dem PR.
- **Game-Feel-Urteile** (fühlt es sich gut an, sieht es geil aus) sind Nico-Gebiet — bauen,
  messbar machen, vorführen; nicht selbst als "fertig poliert" deklarieren.

## Conventions
- Code, Bezeichner, Kommentare, Commits, Doku Englisch; Chat Deutsch.
- Conventional Commits. Nie direkt auf `main` — Branch (`autopilot/work`, `feat/…`, `fix/…`).
- Neue Logik kommt mit Test. Pure Logik (physics/world/core) importiert kein Three.js und
  kein DOM.
- Gate: `npm run gate`. Dev-Server: `npm run dev` (Port 5173).

## Plan, spec & session docs
- Specs: `docs/superpowers/specs/YYYY-MM-DD-*.md` · Pläne: `docs/superpowers/plans/YYYY-MM-DD-*.md`
- Session-Handoffs: `docs/sessions/YYYY-MM-DD_HHMM_<topic>.md`
- Doku ist committed.
