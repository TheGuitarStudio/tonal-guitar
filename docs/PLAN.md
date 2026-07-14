# @tonaljs/guitar — Implementation Plan

## Context

We're building a guitar fretboard/shapes/patterns library as a new package in the Tonal.js monorepo. After extensive research (11 docs) and experimentation (6 test files, 126 passing tests), we've validated the core approach and identified 11 issues to fix. Codex independently verified our audit against Tonal's source code and found 5 additional edge cases. This plan consolidates everything into an ordered build sequence.

**Goal:** A `@tonaljs/guitar` package that follows Tonal conventions exactly — pure functions, named exports, `empty` sentinel pattern, parameter injection for customization — and integrates deeply with Scale, Mode, Key, Chord, Interval, Note, and Pcset modules.

---

## Architecture

```
packages/guitar/
├── index.ts              # Public API re-exports
├── tuning.ts             # Tuning constants and helpers
├── fretboard.ts          # Core fretboard math (noteAt, fretFor, findNote, fretboard)
├── shape.ts              # Shape types, registry (add/get/all/removeAll)
├── build.ts              # buildFrettedScale, buildFromScale, applyChordShape
├── walker.ts             # Unified bidirectional pattern walker
├── pattern.ts            # Pattern generators (intervals, groupings)
├── sequence.ts           # Sequence engine (applySequence, incremental, bounded)
├── notation.ts           # parseChordFrets, formatChordFrets, parseScalePattern
├── output/
│   ├── alphatex.ts       # toAlphaTeX formatter (with rhythm support)
│   ├── ascii-tab.ts      # toAsciiTab formatter
│   └── index.ts          # Re-export formatters
├── data/
│   ├── caged-scales.ts   # 5 CAGED major scale shapes
│   ├── caged-chords.ts   # 5 CAGED major chord shapes
│   ├── three-nps.ts      # 7 three-notes-per-string patterns
│   ├── pentatonic.ts     # 5 pentatonic boxes
│   ├── tunings.ts        # Standard, Drop D, DADGAD, 7-string, etc.
│   └── sequences.ts      # Common practice sequences (3rds, groupings, etc.)
├── test.ts               # Consolidated tests
├── package.json
└── README.md
```

### Internal Dependency Order

```
tuning.ts            ← no internal deps
fretboard.ts         ← tuning
shape.ts             ← no internal deps (pure types + registry)
build.ts             ← fretboard, shape, tuning
walker.ts            ← build types
pattern.ts           ← pure, no deps
sequence.ts          ← walker, pattern, build types
notation.ts          ← pure, no deps
output/*             ← build types, tuning
index.ts             ← re-exports everything
```

### External Tonal Dependencies

```
@tonaljs/note       — fromMidiSharps, enharmonic, transpose, pitchClass, midi, chroma
@tonaljs/interval   — num, fromSemitones, simplify, semitones
@tonaljs/scale      — get, degrees, steps, modeNames, detect
@tonaljs/chord      — detect (re-exported from chord-detect)
@tonaljs/pcset      — isSubsetOf
@tonaljs/mode       — notes, relativeTonic
@tonaljs/key        — majorKey, majorKeyChords
@tonaljs/midi       — toMidi
```

---

## Issues to Fix (mapped to tasks)

| # | Severity | Issue | Fix in | Task |
|---|----------|-------|--------|------|
| 1 | CRITICAL | degree/scaleIndex confusion | build.ts, walker.ts | 3.1, 4.2 |
| 2 | CRITICAL | Octave calculation fragile | fretboard.ts, build.ts | 1.3, 3.1 |
| 3 | HIGH | No Scale/Mode/Key integration | build.ts | 2.3, 6.1 |
| 4 | HIGH | Walker ascending-only | walker.ts | 4.2 |
| 5 | HIGH | findFretInPosition inconsistent range | fretboard.ts | 1.3 |
| 6 | HIGH | Root with octave → malformed notes | build.ts | 3.1 |
| 7 | HIGH | Negative degrees unsupported | walker.ts | 4.2 |
| 8 | MEDIUM | No `empty` pattern | shape.ts, build.ts | 1.1, 3.1 |
| 9 | MEDIUM | 7-string root anchoring broken | build.ts | 2.5 |
| 10 | MEDIUM | AlphaTeX dead code / bad bar format | alphatex.ts | 5.1 |
| 11 | MEDIUM | applyChordShape startFret=Infinity | build.ts | 3.1 |

---

## Epics and Tasks

### Epic 1: Core Foundation

**Task 1.1 — Types** (`shape.ts`)

Define all shared types with critical fixes applied:

```typescript
interface FrettedNote {
  string: number;          // 0 = lowest string
  fret: number;
  note: string;            // "A2" — full note with octave
  pc: string;              // "A" — pitch class
  interval: string;        // "1P", "3M" — from root
  scaleIndex: number;      // 0-based position in scale (FIX #1)
  degree: number;          // 1-based = scaleIndex + 1 (FIX #1)
  intervalNumber: number;  // Interval.num(ivl) — e.g. 3 for "3M" (FIX #1)
  midi: number;
}

interface FrettedScale {
  empty: boolean;          // Tonal convention (FIX #8)
  root: string;            // tonic pitch class: "A", "C#"
  scaleType: string;       // scale type: "major", "minor pentatonic", "dorian"
  scaleName: string;       // full name: "A major", "A minor pentatonic"
  shapeName: string;       // shape used: "E Shape", "3NPS Pattern 1 (Ionian)"
  tuning: string[];
  notes: FrettedNote[];
}

// NoFrettedScale sentinel:
{ empty: true, root: "", scaleType: "", scaleName: "", shapeName: "", tuning: [], notes: [] }
```

`scaleName` is the full `Scale.get()` name (e.g. "A major pentatonic"). Users can
look up aliases via `Scale.get(frettedScale.scaleName).aliases`. `scaleType` is
the type portion (e.g. "major pentatonic") so users can match shapes to scale
types without re-parsing the name.

**Task 1.2 — Tuning** (`tuning.ts`)

Plain `string[]` arrays. Named constants for common tunings:
- STANDARD, DROP_D, DADGAD, OPEN_G, STANDARD_7, STANDARD_8

**Task 1.3 — Fretboard math** (`fretboard.ts`)

Consolidate from 4 experiment files. Key fixes:

- **FIX #2 (octave):** Replace `Math.floor((midi - chroma) / 12) - 1` with:
  ```typescript
  const rawNote = Note.fromMidiSharps(midi);
  const correctNote = Note.enharmonic(rawNote, targetPc);
  ```
- **FIX #5 (range):** `findFretInPosition` accepts optional `span` (default 5).
  Window: `ref - Math.ceil(span/2)` to `ref + span`
- **FIX #6 (root octave):** Strip octave early: `Note.pitchClass(root)`

Functions:

- `noteAt(tuning, stringIndex, fret)` — note at a position
- `fretFor(tuning, stringIndex, targetNote)` — reverse lookup
- `findNearestFret(tuning, stringIndex, pitchClass)` — chroma-based
- `findFretInPosition(tuning, stringIndex, pitchClass, referenceFret, span?)` — position-aware
- `findNote(pitchClass, tuning, fretRange?)` — all positions of a note
- `fretboard(tuning, fretRange?)` — **NEW**: generate complete fretboard grid.
  Returns `FrettedNote[]` for every string × fret combination in range. Multiple
  notes share the same pitch (e.g. two C2s on different strings) — each is a
  distinct `FrettedNote` with unique `string`/`fret`. Users filter by string:
  `fretboard(...).filter(n => n.string === 2)`

**Task 1.4 — Tests for Epic 1**

Port from `shapes.test.ts` noteAt/fretFor sections. New tests for octave fix, span-based positioning, root-with-octave input, full fretboard generation with duplicate notes on different strings.

---

### Epic 2: Shape System

**Task 2.1 — Shape registry** (`shape.ts`)

Follow `ScaleType`/`ChordType` pattern: `dictionary[]` + `index{}` internals.

```typescript
// Scale shapes registry
export function get(name: string): ScaleShape     // returns NoScaleShape if not found
export function all(): ScaleShape[]
export function names(): string[]
export function add(shape: ScaleShape): ScaleShape
export function removeAll(): void

// Chord shapes: separate namespace
export const chordShapes = { get, all, names, add, removeAll }
```

**Task 2.2 — Built-in shape data** (`data/`)

Extract from experiments, add `span` field:
- `caged-scales.ts` — 5 shapes (E, D, C, A, G) from `all-shapes.test.ts`
- `caged-chords.ts` — 5 shapes with fingering/barre from `shapes.test.ts`
- `three-nps.ts` — 7 patterns from `all-shapes.test.ts`
- `pentatonic.ts` — 5 pentatonic boxes
- `tunings.ts` — consolidated tuning constants
- `sequences.ts` — **NEW**: common practice sequences (see Epic 4)

Each calls `add()` at import time (matches `scale-type/data.ts` pattern).

**Task 2.3 — Scale/Mode integration** (FIX #3)

```typescript
export function buildFromScale(
  shape: ScaleShape,
  scaleName: string,              // "A major", "A dorian", "A minor pentatonic"
  tuning?: string[]
): FrettedScale
```

Uses `Scale.get(scaleName)` to validate and extract tonic + intervals. Populates
`FrettedScale.scaleType` and `FrettedScale.scaleName` from the Scale result.

**Task 2.4 — Shape overrides**

Spread/merge + parameter injection (no required global state):
```typescript
const myShapes = { ...Guitar.caged, E: { ...Guitar.caged.E, strings: [...] } };
buildFrettedScale(myShapes.E, "A");
```

**Task 2.5 — 7/8-string support** (FIX #9) ✅ COMPLETE

Implemented via `stringOffset()` in `src/build.ts`. When `tuning.length > shape.strings.length`,
all shape string indices are shifted by `tuning.length - shape.strings.length` so the shape maps
onto the standard-equivalent high-side strings (e.g. strings 1–6 on a 7-string tuning, strings 2–7
on an 8-string tuning). Applied consistently across `findShapeAnchorFret`, `shapeFitsAtAnchor`,
and `buildFrettedScale`. `applyChordShape` inherits the fix via delegation to `buildFrettedScale`.
When `tuning.length < shape.strings.length`, the existing loop guard truncates extra shape strings
(deliberate behavior, no change). Tests in `src/index.test.ts` — see Task 2.5 describe blocks.

**Task 2.6 — Tests for Epic 2**

Port from `all-shapes.test.ts` and `shapes.test.ts`. New tests for 7-string, shape overrides, invalid shapes.

---

### Epic 3: Build Engine

**Task 3.1 — buildFrettedScale / applyChordShape** (`build.ts`)

Consolidate from experiments. All critical fixes applied here:

- **FIX #1 (scaleIndex):** Build unique intervals from shape, sort by semitones,
  create `intervalToIndex` map. `scaleIndex = intervalToIndex.get(interval)`.
  Use `Interval.num()` not regex. Two notes with the same interval at different
  octaves (e.g. two "1P" entries) share the same `scaleIndex`.
- **FIX #2 (octave):** Via fretboard.ts fix
- **FIX #6 (root octave):** `Note.pitchClass(root)` at top
- **FIX #8 (empty):** Return `NoFrettedScale` for invalid inputs
- **FIX #11 (Infinity):** Guard `Math.min()` on empty array

`buildFrettedScale` populates `scaleType` and `scaleName` when a Scale object
is provided (via `buildFromScale`), or leaves them as the shape's system name
when called with just a root string.

**Task 3.2 — Tests for Epic 3**

Port chord shape tests (A/G/C/F major in E shape, D in A shape, etc). New tests
for pentatonic scaleIndex values (should be 0-4), invalid root, 7-string.

---

### Epic 4: Pattern & Sequence Engine

**Task 4.1 — Pattern generators** (`pattern.ts`)

Accept `scaleLength` parameter (FIX #14 from review):
```typescript
ascendingIntervals(scaleLength, interval, octaves?)
descendingIntervals(scaleLength, interval, startDegree?)
ascendingLinear(from, to)
descendingLinear(from, to)
grouping(scaleLength, groupSize, step?)
```

Convenience: `thirds(shape)`, `fourths(shape)`, `sixths(shape)` that derive scaleLength.

**Task 4.2 — Unified pattern walker** (`walker.ts`) — FIXES #4, #7

Single function replacing `walkPattern` + `walkPatternDescending`:

```typescript
walkPattern(scale, pattern, options?: {
  direction?: "auto" | "up" | "down" | "nearest"  // default: "auto"
}): FrettedNote[]
```

- **Auto direction:** Compare consecutive degrees in the pattern.
  `current > prev` → pick next note ascending in pitch.
  `current < prev` → pick next note descending in pitch.
  `current == prev` → repeat same note.
  First step is always ascending unless first degree is higher than second.
- **Negative degrees:** Normalize via `((deg % len) + len) % len`.
- **Scale length:** `const scaleLen = new Set(scale.notes.map(n => n.scaleIndex)).size`
- **Modulo fix:** `% scaleLen` not `% 7`

This handles **any sequence of degrees** regardless of direction — the pattern
`[1, 3, 5, 7, 6, 5, 4, 3, 2, 1]` naturally ascends 1→3→5→7 then descends
7→6→5→4→3→2→1 because auto-direction detects the inflection.

**Task 4.3 — Sequence engine** (`sequence.ts`) — **NEW**

A sequence is a degree pattern that can be applied incrementally across a scale,
bounded by a shape's range. This is a higher-level abstraction over `walkPattern`.

```typescript
interface SequenceOptions {
  incremental?: boolean;     // start from each successive degree (default: false)
  boundToShape?: boolean;    // clip to shape's note range (default: true)
  startDegree?: number;      // which degree to start from (default: 1)
  passes?: number;           // how many incremental passes (default: all that fit)
}

/** Apply a degree sequence to a fretted scale, optionally incrementing */
export function applySequence(
  scale: FrettedScale,
  sequence: number[],
  options?: SequenceOptions,
): FrettedNote[][]   // one array per pass

/** Flatten multiple passes into a single note array */
export function flattenSequence(passes: FrettedNote[][]): FrettedNote[]
```

**How incremental works:**

Given sequence `[1, 3, 5, 7, 6, 5, 4, 3, 2, 1]` applied incrementally:
```
Pass 1 (start degree 1): [1, 3, 5, 7, 6, 5, 4, 3, 2, 1]
Pass 2 (start degree 2): [2, 4, 6, 8, 7, 6, 5, 4, 3, 2]
Pass 3 (start degree 3): [3, 5, 7, 9, 8, 7, 6, 5, 4, 3]
...continues until bounded by shape's highest/lowest note
```

Each pass offsets every degree in the sequence by `(passIndex)`. The `boundToShape`
option clips passes that would exceed the shape's range — any note that falls
outside the shape's available notes truncates that pass.

**How it chains with output:**

```typescript
const scale = buildFromScale(CAGED_E, "A major");
const seq = [1, 3, 5, 7, 6, 5, 4, 3, 2, 1];
const passes = applySequence(scale, seq, { incremental: true });
const allNotes = flattenSequence(passes);
const tab = toAlphaTeX(allNotes, { duration: 8, key: "A" });
```

**Task 4.4 — Built-in sequences** (`data/sequences.ts`)

Common practice patterns as named constants:

```typescript
// Intervals
export const ASCENDING_THIRDS = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8];
export const DESCENDING_THIRDS = [8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3, 1];

// Sequences (designed for incremental application)
export const SEQ_1235 = [1, 2, 3, 5];           // arpeggio run
export const SEQ_1234_GROUP = [1, 2, 3, 4];     // 4-note ascending group
export const SEQ_UP_DOWN = [1, 2, 3, 4, 3, 2];  // wave
export const SEQ_TRIAD_CLIMB = [1, 3, 5, 3];    // triad arpeggio
export const SEQ_1357_DESC = [1, 3, 5, 7, 6, 5, 4, 3, 2, 1];  // up arpeggio, descend linear
```

Users can define their own sequences — they're just `number[]`.

**Task 4.5 — Tests for Epic 4**

Port from `patterns.test.ts` and `pattern-walker.test.ts`. New tests for:
- Auto-direction with mixed ascending/descending sequences
- Incremental sequence application across degrees
- Shape bounding (truncation at shape edges)
- Pentatonic patterns (5-degree sequences)
- Negative degrees
- Chaining sequences into combined exercises

---

### Epic 5: Output Formatters

**Task 5.1 — AlphaTeX** (`output/alphatex.ts`) — FIX #10, rhythm support

Clean implementation with rhythm/duration control:

```typescript
interface AlphaTexOptions {
  title?: string;
  tempo?: number;
  duration?: number;           // default note duration: 4, 8, 16
  tuning?: string[];
  notesPerBar?: number;
  key?: string;
  timeSignature?: [number, number];
  // Rhythm control — NEW
  noteDurations?: number[];    // per-note duration override (same length as notes)
  rhythmPattern?: number[];   // repeating duration pattern: [8, 8, 16, 16] cycles
  tripletGroups?: [number, number][];  // index ranges for triplet grouping
}

export function toAlphaTeX(notes: FrettedNote[], options?: AlphaTexOptions): string
```

**Rhythm rendering in AlphaTeX:**

Per-note durations emit inline duration changes:
```
:8 5.6 7.5 :16 9.4 6.3 7.3 9.3 :8 7.2 5.1
```

Rhythm patterns repeat cyclically across notes. Triplet groups use AlphaTeX's
tuplet syntax (if supported) or group notes with duration adjustment.

String conversion: `alphaTexString = stringCount - internalString`.

**Task 5.2 — ASCII tab** (`output/ascii-tab.ts`)

Dynamic string labels derived from tuning pitch classes (not hardcoded array).

**Task 5.3 — Notation parsing** (`notation.ts`)

```typescript
parseChordFrets(input: string | (number|null)[]): (number|null)[]
formatChordFrets(frets: (number|null)[]): string
parseScalePattern(input: string): number[][]
```

**Task 5.4 — Tests for Epic 5**

Port from pattern-walker AlphaTeX/ASCII sections. New tests for:
- Per-note duration changes in AlphaTeX
- Rhythm pattern cycling
- High frets, 7-string tunings, empty input

---

### Epic 6: Tonal Integration

**Task 6.1 — Scale/Mode validation and relationships**

```typescript
isShapeCompatible(shape, scaleName): boolean
modeShapes(modeName, shapeSystem?): ScaleShape[]
```

Uses `Scale.get()`, `Mode.notes()`, `Mode.relativeTonic()`, `Pcset.isSubsetOf()`.

**Task 6.2 — Related scales** — **NEW**

```typescript
relatedScales(frettedScale: FrettedScale): { root: string; scale: string }[]
```

Given a fretted scale, find all scales that share the same pitch classes.
Uses `Scale.modeNames()` which already does this:

```typescript
Scale.modeNames("C major pentatonic") → [
  ["C", "major pentatonic"],
  ["D", "egyptian"],
  ["E", "malkos raga"],
  ["G", "ritusen"],
  ["A", "minor pentatonic"]
]
```

This answers "this Am pentatonic box is also a C major pentatonic" automatically.

**Task 6.3 — Chord identification**

```typescript
identifyChord(frets: (number|null)[], tuning?): string[]
```

Converts frets → notes → `Chord.detect()` (which handles octaves internally — no
need to strip pitch classes first, confirmed by Codex review).

**Task 6.4 — Key analysis**

```typescript
analyzeInKey(frets, keyName, tuning?): { chord, numeral, degree } | { empty: true }
```

Uses `Key.majorKey()` + `Chord.detect()` + grade lookup.

**Task 6.5 — Tests for Epic 6**

Based on `api-sketch.test.ts` analysis sections. New tests for:
- `relatedScales` with pentatonic (should find 5 related scales)
- `identifyChord` with common chord shapes (x32010=C, 022100=E, 577655=A)
- `analyzeInKey` showing same chord in different keys (C in key of C=I, G=IV, F=V)

---

### Epic 7: Package Setup

**Task 7.1 — index.ts**

Named exports for everything. Deprecated default export (Tonal convention).

**Task 7.2 — package.json**

```json
{
  "name": "@tonaljs/guitar",
  "version": "0.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": { "build": "tsup index.ts --sourcemap --dts --format esm,cjs" }
}
```

**Task 7.3 — Add to tonal aggregator**

Add `@tonaljs/guitar` to `packages/tonal/package.json` and re-export from `packages/tonal/index.ts`.

---

### Epic 8: Documentation (see [DOCS_EPIC.md](./DOCS_EPIC.md) for full plan)

**Task 8.1 — Package README** (`README.md`) — full API reference with install, usage, all function signatures and examples -- DONE

**Task 8.2 — API docs pages** (`docs/api/`) — 7 markdown pages: overview, fretboard, shapes, patterns, sequences, output, integration -- DONE

**Task 8.3 — Interactive experiments page** (`site/`) — Next.js + Fumadocs site with pipeline builder (Guitar Lab) where users compose guitar functions with live results, SVG fretboard visualization, and presets -- DONE (needs `npm install` in site/)

**Task 8.4 — Deploy setup** — GitHub Pages via gh-pages package

**Task 8.5 — Archive experiments** — move to `_research/` or exclude via `files` field

**Task 8.6 — Changeset** — version bump for publishing

---

## Build Sequence

```
Epic 1 (Foundation) ──→ Epic 2 (Shapes) ──→ Epic 3 (Build Engine)
                                                    │
                                           ┌────────┼────────┐
                                           ▼        ▼        ▼
                                      Epic 4    Epic 5    Epic 6
                                    (Patterns  (Output) (Integration)
                                   + Sequences)    │        │
                                           │       │        │
                                           └───────┼────────┘
                                                   ▼
                                             Epic 7 (API)
                                                   │
                                                   ▼
                                             Epic 8 (Docs)
```

Epics 4, 5, and 6 can be developed in parallel after Epic 3.

---

## Verification

After each epic, run:
```bash
npx vitest run packages/guitar/test.ts
```

After all epics, run full pipeline:
```bash
npm run test:all
```

Key things to verify end-to-end:
- `buildFrettedScale(CAGED_E, "A")` produces correct frets [5-9 range], notes [A major], 15 positions
- Same shape in all 12 keys produces correct results
- Pentatonic `scaleIndex` is 0-4 (not 0,2,3,4,6)
- `walkPattern` with `[1,3,5,7,6,5,4,3,2,1]` auto-detects ascending then descending
- `applySequence` with incremental mode produces correct pass offsets
- `applySequence` with `boundToShape: true` truncates at shape edges
- `toAlphaTeX` with `rhythmPattern: [8,8,16,16]` cycles durations correctly
- `toAlphaTeX` produces valid AlphaTeX that AlphaTab can render
- `identifyChord([null,3,2,0,1,0])` returns `["C"]`
- `buildFromScale(CAGED_E, "A dorian")` validates and works
- `relatedScales` on Am pentatonic returns C major pentatonic (and others)
- `fretboard()` returns multiple C2 entries on different strings with correct `string`/`fret`
- Chaining: `applySequence → flattenSequence → toAlphaTeX` produces valid output
- All existing 126 experiment tests continue to pass (regression)

---

## Tonal Functions to Use (not reinvent)

| Instead of | Use |
|------------|-----|
| `parseInt(ivl.match(/\d+/))` | `Interval.num(ivl)` |
| `Math.floor((midi - chroma) / 12) - 1` | `Note.fromMidiSharps(midi)` + `Note.enharmonic(result, pc)` |
| Custom scale validation | `Scale.get(scaleName)` |
| Manual mode notes | `Mode.notes(mode, tonic)` |
| Manual relative key | `Mode.relativeTonic(dest, src, tonic)` |
| Manual chord detection | `Chord.detect(noteNames)` (handles octaves) |
| Manual pitch class extraction | `Note.pitchClass(note)` |
| Manual key chord analysis | `Key.majorKey(tonic)` / `Key.majorKeyChords(tonic)` |
| Manual interval validation | `Pcset.isSubsetOf(set)(notes)` |
| Manual mode name lookup | `Scale.modeNames(scaleName)` |
| Manual scale detection | `Scale.detect(noteNames)` |

---

## Key Design Decisions

### Pentatonic/Modal same-shape relationship

**Status: IMPLEMENTED** (v0.2.0, minor-quality-shape-relabeling feature — Task 6.1 docs, see `src/transform.ts`, `src/data/caged-scales-minor.ts`, `src/data/pentatonic-minor.ts`).

A shape is geometry. The scale gives it meaning. Same fret positions can be
multiple scales — this is handled two ways:

1. `relatedScales()` using `Scale.modeNames()` (pre-existing): given an already-built
   `FrettedScale`, find every scale name that shares its pitch-class set.
2. `relabelShape()` / `relabelShapeToScale()` (new): given a `ScaleShape` template,
   rewrite its interval labels into a different rotation-compatible frame — e.g.
   turning the major-frame `"G Shape"` into `"Em Shape"` (natural-minor labels, same
   geometry). This is now exercised at import time to register 5 minor CAGED shapes
   and 5 minor pentatonic boxes (10 new entries total), so consumers get first-class
   `get("Em Shape")` / `get("Pentatonic Box 1 Minor")` lookups and correct
   `modeShapes("A minor", "caged")` / `buildFromScale(shape, "A minor")` results
   without hand-deriving the relabel table. See `README.md` § Minor-Quality Entries
   and `docs/api/transform.md` for the full mapping and worked example.

```
Pentatonic Box 1 with root "A" = A minor pentatonic
Pentatonic Box 1 with root "C" = C major pentatonic
Same frets, different interval labels.
```

`buildFromScale(shape, "A minor pentatonic")` and `buildFromScale(shape, "C major
pentatonic")` produce the same frets but different `interval`/`scaleIndex`/`degree`
values on each `FrettedNote`. As of v0.2.0, `buildFromScale` relabels `shape` into
the requested scale's frame first, so passing the pre-registered minor entry
(`get("Pentatonic Box 1 Minor")`) and the major-frame source shape at their
respective tonics both produce correct pitch content — see `CHANGELOG.md`.

Out of scope for this pass: registered entries for the other diatonic modes
(dorian, phrygian, etc.) and harmonic/melodic minor — `relabelShape` supports
deriving them on demand, but no first-class registry entries are seeded. 3NPS
modal-name revision remains deferred; see `docs/QUESTIONS.md` Q4.

### Sequences vs Patterns

- **Pattern**: a degree sequence for the walker — `[1,3,2,4,3,5]`. Can be any
  direction. The walker handles direction automatically.
- **Sequence**: a pattern applied incrementally across scale degrees, bounded by
  the shape. Built on top of the walker. Each pass offsets all degrees by +1.
- **Interval pattern generators** (ascending 3rds, etc.) are convenience functions
  that produce degree arrays. They feed into either the walker or the sequence engine.

### Rhythm

Rhythm is an output concern, not a note concern. `FrettedNote` has no duration
field. Duration is specified at render time via `toAlphaTeX` options:
- `duration: 8` — all eighth notes
- `rhythmPattern: [8, 8, 16, 16]` — cycling pattern
- `noteDurations: [8, 8, 8, 8, 16, 16, 16, 16]` — per-note

This keeps the note/pattern/output layers cleanly separated.
