# CLAUDE.md

## Project Overview

tonal-guitar is a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences. It uses [Tonal.js](https://github.com/tonaljs/tonal) primitives as peer dependencies for note/interval operations, with optional deeper integration for scale/chord/key analysis.

**Status:** v0.4.0 published to npm ([tonal-guitar](https://www.npmjs.com/package/tonal-guitar)) — see `CHANGELOG.md`. Two entry points: the root barrel and the pure `tonal-guitar/chord-types` subpath.

## Commands

Standard scripts (`build`, `test`, `lint`, `format`, etc.) are in `package.json`. The non-obvious one: `npm run release` publishes to npm — it sources `.env` for `NPM_TOKEN` (see `.env.example`), and `src/version.ts` `VERSION` must be bumped alongside `package.json`.

## Architecture

### Dependency layers

**Zero Tonal deps** (pure TypeScript):
`tuning.ts`, `shape.ts`, `pattern.ts`, `notation.ts`, `walker.ts`, `sequence.ts`, `arpeggio.ts`, `connect.ts`, `chord-scale.ts`, `chord-types.ts`, `changeset.ts`, `data/*` — **except** `data/caged-scales-minor.ts`, `data/pentatonic-minor.ts`, and `data/blues.ts`, which call `relabelShape`/`addPassingTone` at import time and therefore transitively require the required peers via `transform.ts` (see below). Every other `data/*` file remains zero-Tonal-dep. `chord-scale.ts` has no imports at all; `changeset.ts` imports only types from `./shape`.

**`chord-types.ts` MUST have zero imports** (not even types from `./shape`): it is its own tsup entry (`tonal-guitar/chord-types`), and importing it must register no shapes and pull in neither Tonal nor `data/*`. `src/chord-types.test.ts` enforces this statically and at runtime. Adding a subpath means touching `exports`, `typesVersions`, both tsup entry lists in `package.json` scripts, and `scripts/check-dts.mjs`.

**Required peer deps** (`@tonaljs/note`, `@tonaljs/interval`):
`fretboard.ts`, `build.ts`, `audit.ts`, `transform.ts`, `output/alphatex.ts`, `output/ascii-tab.ts` — `audit.ts` imports only `./build`, `./shape`, `./tuning`, and `@tonaljs/note`; it MUST NOT import `./integration`/`./audit-integration` or optional Tonal peers. `transform.ts` imports `@tonaljs/interval` (`semitones`) directly, `./build` (for `addPassingTone`'s fret geometry, so `@tonaljs/note` transitively), `./tuning`, and `./shape` for types only; it MUST NOT import `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key` or `./integration`, so `data/caged-scales-minor.ts`/`data/pentatonic-minor.ts`/`data/blues.ts` can call it at import time with zero optional peers.

**Optional peer deps** (`@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`):
`integration.ts` — `buildFromScale`, `relatedScales`, `identifyChord`, `analyzeInKey`, `isShapeCompatible`, `modeShapes`, `relabelShapeToScale` (the last is an integration-tier wrapper over `transform.ts`'s pure `relabelShape`, adding only the `@tonaljs/scale` name-resolution step). `audit-integration.ts` is the second optional-peer module — chord-identification/chord-tone audit checks (`checkIdentifyMismatch`, `checkChordTonesOnly`, `checkCoversChord`, `checkContainsChordGrip`, and the `auditChordShapeIntegration`/`auditArpeggioShapeIntegration`/`auditChordShapeFull` composers) that need `@tonaljs/chord`; it imports `./audit` (required-peer) but MUST NOT be imported by it. `index.ts` pulls the optional tier in through both modules (side-effect/re-export imports of `./integration` and `./audit-integration`).

### `packages/` and `site/`

Private, unpublished consumers of the library. Each is a **separate npm root** `file:`-linked to the repo root (not an npm workspace), so each needs its own `npm ci`; CI's install order (`.github/workflows/ci.yml`) is the dependency order. They resolve `tonal-guitar` through the root's `package.json` → **`dist/`**, so after changing `src/` run `npm run build` before package tests, the workbench, the site, or `shapes:merge` will see it. Root `npm test` also runs `packages/*/src/**` tests.

Dependency direction (never the reverse; the root library imports nothing from `packages/`):
- `fretboard-ui` (React fretboard/editor) → `tonal-guitar`
- `shape-catalog` (pure catalog/diff/changeset helpers) → `tonal-guitar`
- `shape-library-ui` (React browse/edit components) → `fretboard-ui`, `shape-catalog`
- `shape-workbench` (local-only Vite authoring app) → all of the above
- `site/` (Next.js docs, `transpilePackages`) → `tonal-guitar`, `fretboard-ui`, `shape-catalog`, `shape-library-ui`. It deep-imports `shape-library-ui/src/*` on purpose (the package has no `sideEffects: false`), so don't switch those to the barrel.

### Shape authoring: workbench → changeset → merge

1. `npm run workbench` — the dev server's `workbench-io` plugin (serve-only; must never be imported client-side) writes `.workbench/changeset.json` (gitignored), a `tonal-guitar/changeset@1` document typed by `src/changeset.ts`.
2. `npm run shapes:merge -- .workbench/changeset.json [--check]` — imports the **built** `dist/`, validates, audits, and rewrites only `// shapes-merge:begin/end <IDENT>` blocks in `src/data/*.ts` + `src/index.ts`, plus test assertions tagged `// shapes-merge:count <name>`. Undo: `git checkout -- src/data`.

Rules: `scripts/lib/render-shape.mjs` is the single TS printer for shape constants (re-exported by `shape-catalog` for "Copy TS") — never reimplement it. Files with the `GENERATED FILE` header are merge-owned; of the hand-written files only `caged-chords.ts` is managed, and the derived `caged-scales-minor`/`pentatonic-minor` are refused even with `--force`. Spec: `.tonal-guitar/features/shape-workbench/spec.md` (the "spec §N" refs in code).

### Design conventions

- **Pure functions only** — no side effects, no mutation, no classes
- **Named exports** — no default exports
- **Error handling** — returns empty objects/sentinel values (`NoFrettedScale`), not exceptions
- **Registry pattern** — shapes registered via `add()` at import time (side-effect imports in index.ts)
- **Tunings are plain `string[]`** — no wrapper objects

## Reference

- `.tonal-guitar/features/<name>/` — per-feature spec, decisions, and tasks (the current source of design intent)
- `docs/api/*.md` — API reference (the published docs site renders `site/content/docs/*.mdx`)
- `docs/QUESTIONS.md` — open design questions from code review
- `docs/PLAN.md`, `docs/design.md`, `docs/research.md` — historical: the original plan/research from when this was scoped as `@tonaljs/guitar`; not kept current
- `experiments/` — historical prototype tests that validated the approach; not part of `npm test`
