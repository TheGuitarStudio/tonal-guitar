# CLAUDE.md

## Project Overview

tonal-guitar is a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences. It uses [Tonal.js](https://github.com/tonaljs/tonal) primitives as peer dependencies for note/interval operations, with optional deeper integration for scale/chord/key analysis.

**Status:** v0.1.0 published to npm ([tonal-guitar](https://www.npmjs.com/package/tonal-guitar)); v0.2.0 (minor-quality shape relabeling — see `CHANGELOG.md`) in progress. 922 tests passing across 10 test files.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build with tsup (ESM + CJS + types) |
| `npm test` | Run tests once (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run release` | Publish to npm (sources .env for NPM_TOKEN; see .env.example) (also bump `src/version.ts` `VERSION`) |

### Running a single test

```bash
npx vitest run src/index.test.ts -t "test name"
```

## Architecture

### Source layout

```
src/
├── index.ts                  # Public API re-exports + data registration side-effects
├── index.test.ts             # Core API tests
├── tuning.ts                 # Tuning constants (STANDARD, DROP_D, etc.)
├── fretboard.ts              # Core fretboard math (noteAt, fretFor, findNote, fretboard)
├── shape.ts                  # Types (FrettedNote, ScaleShape, etc.) + registries
├── shape.test.ts             # VoicingFamily, VoicingPatternDictionary, chordShapes.query tests
├── build.ts                  # buildFrettedScale, applyChordShape
├── audit.ts                   # Shape-quality invariant checks (six checkX fns + audit aggregates)
├── audit.test.ts              # Audit check + aggregate tests (incl. registry-wide sweeps)
├── version.ts                 # VERSION constant (bumped alongside package.json at release)
├── transform.ts               # Shape relabeling (relabelShape)
├── transform.test.ts          # relabelShape tests
├── walker.ts                 # Bidirectional pattern walker
├── pattern.ts                # Pattern generators (intervals, groupings)
├── sequence.ts                # Sequence engine (incremental, bounded)
├── notation.ts                # parseChordFrets, formatChordFrets, parseScalePattern
├── arpeggio.ts                # Arpeggio extraction/scoring from scales & shapes
├── arpeggio.test.ts           # Arpeggio tests
├── connect.ts                 # Shape connector — bridges adjacent CAGED/compatible shapes
├── connect.test.ts            # Connector tests
├── connect.examples.test.ts   # Example-driven connector tests
├── integration.ts             # Tonal Scale/Chord/Key integration (optional deps)
├── integration.test.ts        # Integration tests
├── output/
│   ├── alphatex.ts            # AlphaTeX formatter (with rhythm support)
│   ├── ascii-tab.ts           # ASCII tab formatter
│   ├── util.ts                # Shared grouped-note normalization helper
│   ├── output.test.ts         # Formatter tests
│   └── index.ts               # Re-exports
└── data/
    ├── caged-scales.ts        # 5 CAGED major scale shapes
    ├── caged-scales-minor.ts  # 5 CAGED minor scale shapes, derived via relabelShape (Dm/Cm/Am/Gm/Em)
    ├── caged-chords.ts        # 5 CAGED major chord shapes
    ├── caged-chords-7th.ts    # CAGED 7th-chord shapes (maj7, m7, 7, m7b5)
    ├── open-chords.ts         # Open-position + barre chord shapes (curated from chords-db)
    ├── jazz-shells.ts         # Jazz shell voicings (root-3rd-7th, two string sets)
    ├── extended-chords.ts     # 30 extended chord shapes (15 types, E/A forms)
    ├── three-nps.ts           # 7 three-notes-per-string patterns
    ├── pentatonic.ts          # 5 pentatonic boxes
    ├── pentatonic-minor.ts    # 5 minor pentatonic boxes, derived via relabelShape
    ├── sequences.ts           # Named sequence constants
    ├── data.test.ts           # Build-equivalence tests (7th/open/jazz shapes)
    └── extended-chords.test.ts # Extended chord shape tests
```

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

### Key types

- `FrettedNote` — a note on the fretboard: string, fret, note, pc, interval, scaleIndex, degree, intervalNumber, midi
- `ScaleShape` — geometry of a scale pattern: intervals per string, rootString, system, optional `quality`/`parentShape` (set on entries derived via `relabelShape`)
- `ChordShape` — single-note-per-string shape with fingering/barre data
- `FrettedScale` — result of applying a shape to a root: notes[], root, scaleType, scaleName, shapeName, tuning

### Internal dependency order

```
tuning.ts            ← no internal deps
shape.ts             ← no internal deps
pattern.ts           ← no internal deps
notation.ts          ← no internal deps
fretboard.ts         ← tuning
build.ts             ← fretboard, shape, tuning
audit.ts             ← build, shape, tuning — also imports @tonaljs/note directly
version.ts           ← no internal deps
transform.ts         ← shape (types only) — also imports @tonaljs/interval directly
walker.ts            ← shape (types only)
sequence.ts          ← walker, shape
arpeggio.ts          ← shape
connect.ts           ← shape, walker
integration.ts       ← build, fretboard, shape, tuning, arpeggio, notation, transform
output/*             ← shape, tuning
data/caged-scales-minor.ts   ← transform, shape, data/caged-scales
data/pentatonic-minor.ts     ← transform, shape, data/pentatonic
index.ts             ← re-exports everything
```

## Reference

- `docs/PLAN.md` — full implementation plan with issue tracking
- `docs/QUESTIONS.md` — open design questions from code review
- `docs/research.md` — initial research into guitar theory libraries
- `docs/design.md` — design decisions and API shape exploration
- `experiments/` — 6 prototype test files that validated the approach (126 tests)

## Remaining work

- [x] README.md with API documentation and examples
- [x] API docs pages (docs/api/ — 9 markdown files)
- [x] Interactive experiments page (site/ — Guitar Lab)
- [x] Deploy site to GitHub Pages
- [x] Task 2.5: 7/8-string rootString auto-adjustment logic
- [ ] ASCII tab column alignment for multi-digit frets (QUESTIONS.md Q2)
- [x] Consider `analyzeInKey` chord name normalization (QUESTIONS.md Q3)
