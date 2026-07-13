# CLAUDE.md

## Project Overview

tonal-guitar is a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences. It uses [Tonal.js](https://github.com/tonaljs/tonal) primitives as peer dependencies for note/interval operations, with optional deeper integration for scale/chord/key analysis.

**Status:** v0.1.0 — published to npm ([tonal-guitar](https://www.npmjs.com/package/tonal-guitar)). 845 tests passing across 9 test files.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build with tsup (ESM + CJS + types) |
| `npm test` | Run tests once (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run release` | Publish to npm (sources .env for NPM_TOKEN; see .env.example) |

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
├── transform.ts               # Shape relabeling (relabelShape)
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
    ├── caged-chords.ts        # 5 CAGED major chord shapes
    ├── caged-chords-7th.ts    # CAGED 7th-chord shapes (maj7, m7, 7, m7b5)
    ├── open-chords.ts         # Open-position + barre chord shapes (curated from chords-db)
    ├── jazz-shells.ts         # Jazz shell voicings (root-3rd-7th, two string sets)
    ├── extended-chords.ts     # 30 extended chord shapes (15 types, E/A forms)
    ├── three-nps.ts           # 7 three-notes-per-string patterns
    ├── pentatonic.ts          # 5 pentatonic boxes
    ├── sequences.ts           # Named sequence constants
    ├── data.test.ts           # Build-equivalence tests (7th/open/jazz shapes)
    └── extended-chords.test.ts # Extended chord shape tests
```

### Dependency layers

**Zero Tonal deps** (pure TypeScript):
`tuning.ts`, `shape.ts`, `pattern.ts`, `notation.ts`, `walker.ts`, `sequence.ts`, `arpeggio.ts`, `connect.ts`, `data/*`

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
arpeggio.ts          ← shape
connect.ts           ← shape, walker
integration.ts       ← build, fretboard, shape, tuning, arpeggio, notation
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

- [x] README.md with API documentation and examples
- [x] API docs pages (docs/api/ — 7 markdown files)
- [x] Interactive experiments page (site/ — Guitar Lab)
- [x] Deploy site to GitHub Pages
- [x] Task 2.5: 7/8-string rootString auto-adjustment logic
- [ ] ASCII tab column alignment for multi-digit frets (QUESTIONS.md Q2)
- [x] Consider `analyzeInKey` chord name normalization (QUESTIONS.md Q3)
