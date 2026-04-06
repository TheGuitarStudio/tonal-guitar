# CLAUDE.md

## Project Overview

tonal-guitar is a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences. It uses [Tonal.js](https://github.com/tonaljs/tonal) primitives as peer dependencies for note/interval operations, with optional deeper integration for scale/chord/key analysis.

**Status:** v0.1.0 — core implementation complete, 227 tests passing. Needs README and documentation before publishing.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build with tsup (ESM + CJS + types) |
| `npm test` | Run tests once (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |

### Running a single test

```bash
npx vitest run src/index.test.ts -t "test name"
```

## Architecture

### Source layout

```
src/
├── index.ts              # Public API re-exports + data registration side-effects
├── index.test.ts         # 227 tests
├── tuning.ts             # Tuning constants (STANDARD, DROP_D, etc.)
├── fretboard.ts          # Core fretboard math (noteAt, fretFor, findNote, fretboard)
├── shape.ts              # Types (FrettedNote, ScaleShape, etc.) + registries
├── build.ts              # buildFrettedScale, applyChordShape
├── walker.ts             # Bidirectional pattern walker
├── pattern.ts            # Pattern generators (intervals, groupings)
├── sequence.ts           # Sequence engine (incremental, bounded)
├── notation.ts           # parseChordFrets, formatChordFrets, parseScalePattern
├── integration.ts        # Tonal Scale/Chord/Key integration (optional deps)
├── output/
│   ├── alphatex.ts       # AlphaTeX formatter (with rhythm support)
│   ├── ascii-tab.ts      # ASCII tab formatter
│   └── index.ts          # Re-exports
└── data/
    ├── caged-scales.ts   # 5 CAGED major scale shapes
    ├── caged-chords.ts   # 5 CAGED major chord shapes
    ├── three-nps.ts      # 7 three-notes-per-string patterns
    ├── pentatonic.ts     # 5 pentatonic boxes
    └── sequences.ts      # Named sequence constants
```

### Dependency layers

**Zero Tonal deps** (pure TypeScript):
`tuning.ts`, `shape.ts`, `pattern.ts`, `notation.ts`, `walker.ts`, `sequence.ts`, `data/*`

**Required peer deps** (`@tonaljs/note`, `@tonaljs/interval`):
`fretboard.ts`, `build.ts`, `output/alphatex.ts`, `output/ascii-tab.ts`

**Optional peer deps** (`@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`):
`integration.ts` only — `buildFromScale`, `relatedScales`, `identifyChord`, `analyzeInKey`, `isShapeCompatible`, `modeShapes`

### Design conventions

- **Pure functions only** — no side effects, no mutation, no classes
- **Named exports** — no default exports
- **Error handling** — returns empty objects/sentinel values (`NoFrettedScale`), not exceptions
- **Registry pattern** — shapes registered via `add()` at import time (side-effect imports in index.ts)
- **Tunings are plain `string[]`** — no wrapper objects

### Key types

- `FrettedNote` — a note on the fretboard: string, fret, note, pc, interval, scaleIndex, degree, intervalNumber, midi
- `ScaleShape` — geometry of a scale pattern: intervals per string, rootString, system
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
walker.ts            ← shape (types only)
sequence.ts          ← walker, shape
integration.ts       ← build, fretboard, shape, tuning
output/*             ← shape, tuning
index.ts             ← re-exports everything
```

## Reference

- `docs/PLAN.md` — full implementation plan with issue tracking
- `docs/QUESTIONS.md` — open design questions from code review
- `docs/research.md` — initial research into guitar theory libraries
- `docs/design.md` — design decisions and API shape exploration
- `experiments/` — 6 prototype test files that validated the approach (126 tests)

## Remaining work

- [ ] README.md with API documentation and examples
- [ ] Task 2.5: 7/8-string rootString auto-adjustment logic
- [ ] ASCII tab column alignment for multi-digit frets (QUESTIONS.md Q2)
- [ ] Consider `analyzeInKey` chord name normalization (QUESTIONS.md Q3)
