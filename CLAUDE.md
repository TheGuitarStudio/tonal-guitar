# CLAUDE.md

## Project Overview

tonal-guitar is a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences. It uses [Tonal.js](https://github.com/tonaljs/tonal) primitives as peer dependencies for note/interval operations, with optional deeper integration for scale/chord/key analysis.

**Status:** v0.2.0 published to npm ([tonal-guitar](https://www.npmjs.com/package/tonal-guitar)) — see `CHANGELOG.md`.

## Commands

Standard scripts (`build`, `test`, `lint`, `format`, etc.) are in `package.json`. The non-obvious one: `npm run release` publishes to npm — it sources `.env` for `NPM_TOKEN` (see `.env.example`), and `src/version.ts` `VERSION` must be bumped alongside `package.json`.

## Architecture

### Dependency layers

**Zero Tonal deps** (pure TypeScript):
`tuning.ts`, `shape.ts`, `pattern.ts`, `notation.ts`, `walker.ts`, `sequence.ts`, `arpeggio.ts`, `connect.ts`, `data/*` — **except** `data/caged-scales-minor.ts` and `data/pentatonic-minor.ts`, which call `relabelShape` at import time and therefore transitively require `@tonaljs/interval` via `transform.ts` (see below). Every other `data/*` file remains zero-Tonal-dep.

**Required peer deps** (`@tonaljs/note`, `@tonaljs/interval`):
`fretboard.ts`, `build.ts`, `audit.ts`, `transform.ts`, `output/alphatex.ts`, `output/ascii-tab.ts` — `audit.ts` imports only `./build`, `./shape`, `./tuning`, and `@tonaljs/note`; it MUST NOT import `./integration` or optional Tonal peers. `transform.ts` imports `@tonaljs/interval` (`semitones`) directly, and `./shape` for types only; it MUST NOT import `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key` or `./integration`, so `data/caged-scales-minor.ts`/`data/pentatonic-minor.ts` can call it at import time with zero optional peers.

**Optional peer deps** (`@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`):
`integration.ts` only — `buildFromScale`, `relatedScales`, `identifyChord`, `analyzeInKey`, `isShapeCompatible`, `modeShapes`, `relabelShapeToScale` (the last is an integration-tier wrapper over `transform.ts`'s pure `relabelShape`, adding only the `@tonaljs/scale` name-resolution step)

### Design conventions

- **Pure functions only** — no side effects, no mutation, no classes
- **Named exports** — no default exports
- **Error handling** — returns empty objects/sentinel values (`NoFrettedScale`), not exceptions
- **Registry pattern** — shapes registered via `add()` at import time (side-effect imports in index.ts)
- **Tunings are plain `string[]`** — no wrapper objects

## Reference

- `docs/PLAN.md` — full implementation plan with issue tracking
- `docs/QUESTIONS.md` — open design questions from code review
- `docs/research.md` — initial research into guitar theory libraries
- `docs/design.md` — design decisions and API shape exploration
- `experiments/` — 6 prototype test files that validated the approach (126 tests)
