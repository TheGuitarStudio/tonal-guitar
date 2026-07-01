# Task Breakdown: Curated Extended Chord Shapes Import

## Overview

Total Tasks: 5 Task Groups

**GitHub sub-issues** (parent #31): TG1 → #42 · TG2 → #43 · TG3 → #44 · TG4 → #45 · TG5 → #46.

Library-only feature (`src/` only — no `site/`, no `output/`, no public re-exports). Adds a new
data file `src/data/extended-chords.ts` registering ~30 movable E-form/A-form `ChordShape`s across
15 canonical extended `chordType`s, plus a new test file `src/data/extended-chords.test.ts` verifying
build/playability and Tonal.js interop. One side-effect import line is added to `src/index.ts`.

> **Parallelism warning for `/implement`:** Task Groups 2, 3, and 4 all edit the **same file**
> (`src/data/extended-chords.ts`) and its sibling test. They **must run sequentially**, not in
> parallel worktrees, or they will merge-conflict. Only TG1→(TG2→TG3→TG4)→TG5 ordering is safe.

## Task List

### Module / Data Layer

#### Task Group 1: Scaffold + parametrized test harness

**Dependencies:** None

- [ ] 1.0 Create the data-file shell, wire registration + the public side-effect import, and build a
      reusable per-shape test harness that later tiers extend.
  - [ ] 1.1 Create `src/data/extended-chords.ts`:
    - Header JSDoc modeled on `src/data/caged-chords-7th.ts` — explain the set, the Tonal-first
      naming contract, the **interop divergence catalog** (spec §Integration: `add9`→`CMadd9`,
      `mMaj7`→`Cm/ma7`, `6/9`→`C6add9`; `aug7`/`7#5` same chord, `detect` prefers `C7#5`,
      `Chord.get("Caug7").symbol`=`Caug7`), and the **standard-six-string scope note** (D-008).
    - `import { chordShapes, ChordShape } from "../shape";`
    - Establish the bottom registration block: `const EXTENDED_CHORD_SHAPES: ChordShape[] = [ ... ]`
      then `EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes));` (empty array for now).
  - [ ] 1.2 Wire the side-effect import in `src/index.ts` after line 124
    (`import "./data/jazz-shells";`): add `import "./data/extended-chords";`. Preserve ordering. No
    re-exports.
  - [ ] 1.3 Create `src/data/extended-chords.test.ts` with reusable assertion helpers (parametrized
    over a shape list; later tiers add their shapes to it):
    - `assertRegistered(shape)` — in `chordShapes.query({ chordType })`; `name` unique across
      `chordShapes.names()`.
    - `assertBuildsPlayable(shape, root)` — `applyChordShape(shape, root)` (STANDARD tuning, root
      `F` or `C`): non-null `frets` count === `stringSet.length`; built intervals === `strings`
      minus nulls; fretted-fret span ≤ ~4; ≤4 distinct fretting fingers implied.
    - `assertResolutionSubset(shape, root)` — `Chord.get(root+chordType)` non-empty; shape interval
      chromas ⊆ chord interval chromas.
    - `assertArpeggioMembership(shape, root)` — chord tones derivable via `arpeggioFromScale` /
      `arpeggioFromShape` (chroma membership).
    - `assertOmissionIntegrity(shape)` — if `omittedIntervals` set, those are absent from `strings`
      and present in the full `Chord.get` chord; else shape contains all chord tones.
    - `assertIdentification(shape, root)` — **split (D-007):** full voicing → `detect` first entry is
      exact symbol or documented alias; partial voicing → built notes chroma-subset only (no
      full-chord `detect` required).
  - [ ] 1.4 Run `npx vitest run src/data/extended-chords.test.ts` (harness compiles; empty-set run
    passes) and `npm run build`.

**Acceptance Criteria:**

- `src/data/extended-chords.ts` and `src/data/extended-chords.test.ts` exist; `npm run build` passes.
- The file is imported by `src/index.ts`; importing it registers zero shapes (empty array) without
  error.
- Header JSDoc contains the divergence catalog and the standard-tuning scope note.
- Test harness helpers compile and run green over an empty shape list.

---

### Data — Shape Curation (sequential; all edit `extended-chords.ts`)

#### Task Group 2: Tier 1 — Essential shapes (`6 m6 9 maj9 m9 add9`)

**Dependencies:** Task Group 1

- [ ] 2.0 Add E-form + A-form movable voicings for the 6 Tier-1 types (~12 shapes).
  - [ ] 2.1 For each type, derive a concrete six-string **prototype grip** (from `tombatossals/chords-db`
    references, format per `docs/chord-formats-research.md`) for E-form (`rootString: 0`) and A-form
    (`rootString: 1`); record it in the shape's JSDoc.
  - [ ] 2.2 Convert each prototype to an interval `strings` row (compound `9M`/`6M` vocabulary),
    matching `Chord.get(symbol).intervals`; set `chordType` = the `Chord.get` symbol
    (`6`, `m6`, `9`, `maj9`, `m9`, `add9`); set `fingers`, `barres`, `stringSet`.
    - Set `omittedIntervals` per priority (drop 5th first) for any partial voicing; `9`/`maj9`/`m9`
      may be complete 5-string grips (no omission) where practical.
  - [ ] 2.3 Add the consts to `EXTENDED_CHORD_SHAPES` and add each to the test list in
    `extended-chords.test.ts` (runs the full harness from 1.3).
  - [ ] 2.4 Run `npx vitest run src/data/extended-chords.test.ts` + `npm run build`.

**Acceptance Criteria:**

- ~12 shapes registered covering all 6 Tier-1 `chordType`s; each has E-form and A-form (or one form
  with a JSDoc note if no practical second grip).
- Every shape passes all harness assertions (build/playable, resolution/subset, arpeggio, omission,
  identification split).
- Each shape's JSDoc cites its prototype grip.

---

#### Task Group 3: Tier 2 — Jazz core shapes (`13 dim7 mMaj7 7sus4 6/9`)

**Dependencies:** Task Group 2 (same file — sequential)

- [ ] 3.0 Add E-form + A-form voicings for the 5 Tier-2 types (~10 shapes), same process as TG2.
  - [ ] 3.1 Derive prototype grips (JSDoc) for E/A forms of each type.
    - `13` (6 tones): omit 5th then 9th per priority; e.g. A-form `x 3 2 3 3 5` (C13, omit 5th).
    - `dim7` symmetric; `mMaj7`; `7sus4` (4th replaces 3rd — never omit the 4th); `6/9`.
  - [ ] 3.2 Interval rows + metadata; `chordType` = `Chord.get` symbol; `omittedIntervals` as needed.
  - [ ] 3.3 Register + add to test list.
  - [ ] 3.4 Run feature tests + `npm run build`.

**Acceptance Criteria:**

- ~10 shapes registered covering all 5 Tier-2 `chordType`s; harness green.
- `13` voicings retain root/3rd/♭7 and the 13th; omissions recorded in `omittedIntervals`.
- `7sus4` shapes contain no 3rd (suspended) and are labeled correctly.

---

#### Task Group 4: Tier 3 — Altered dominant shapes (`7b9 7#9 7#5 7b5`)

**Dependencies:** Task Group 3 (same file — sequential)

- [ ] 4.0 Add E-form + A-form voicings for the 4 Tier-3 types (~8 shapes), same process.
  - [ ] 4.1 Derive prototype grips (JSDoc). Register **`7#5`** as the altered-aug entry (NOT `aug7`);
    note `aug7` as an alias in JSDoc.
  - [ ] 4.2 Interval rows (`9m`, `9A`, `5A`, `5d` vocab) + metadata + `omittedIntervals`.
  - [ ] 4.3 Register + add to test list.
  - [ ] 4.4 Run feature tests + `npm run build`.

**Acceptance Criteria:**

- ~8 shapes registered covering all 4 Tier-3 `chordType`s (`7b9`, `7#9`, `7#5`, `7b5`); harness green.
- `7#5` is the registered key; no shape uses `chordType: "aug7"`.

---

### Integration Verification / Testing Layer

#### Task Group 5: Cross-cutting interop, aggregate checks, docs, and final verification

**Dependencies:** Task Groups 2–4

- [ ] 5.0 Add the cross-cutting interop + aggregate tests, optional docs touch, and run the full
      verification gate.
  - [ ] 5.1 Divergence-catalog tests (spec §Integration): assert the documented `detect` results for
    `add9`/`mMaj7`/`6/9`; assert `7#5` first-detect is `C7#5` (note `C7b13` alternate); assert
    `chordShapes.query({ chordType: "aug7" })` returns `[]` (exact-string registry).
  - [ ] 5.2 `analyzeInKey` documented-limit test: a representative extension (e.g. `Cmaj9`) returns
    an empty numeral/degree — assert and comment as expected behavior.
  - [ ] 5.3 Aggregate sanity: exactly 15 canonical `chordType`s present; ~30 total new shapes; all
    shape names unique across the whole registry; no `chordType: "aug7"`.
  - [ ] 5.4 (Optional docs) If a chord-type listing exists in `README.md` or `docs/api/*.md`, add the
    new extended vocabulary + the `aug7`↔`7#5` alias note. Skip if no such listing exists (no public
    API changed). Do NOT invent new docs pages.
  - [ ] 5.5 Full verification: `npx vitest run src/data/extended-chords.test.ts`, then `npm test`
    (no regressions in the 227 existing tests), `npm run build`, `npm run lint`.

**Acceptance Criteria:**

- All divergence, `analyzeInKey`, and aggregate assertions pass.
- `npm test`, `npm run build`, `npm run lint` all pass with no regressions.
- No unrelated files modified; no new public re-exports added.

---

## Execution Order

1. **Task Group 1: Scaffold + test harness** — foundation; safe to run alone.
2. **Task Group 2: Tier 1 shapes** — after TG1.
3. **Task Group 3: Tier 2 shapes** — after TG2 (same file).
4. **Task Group 4: Tier 3 shapes** — after TG3 (same file).
5. **Task Group 5: Interop + aggregate + docs + final gate** — after TG2–4.

**Parallelism:** None of the shape-curation groups (2–4) may run in parallel — they edit the same
file. This feature is inherently sequential. (If parallelism were required, the only safe split would
be one file per tier, which the spec does not want.)

## Files to Create

| File Path | Task |
| --------- | ---- |
| `src/data/extended-chords.ts` | 1.1 (scaffold), 2–4 (shapes) |
| `src/data/extended-chords.test.ts` | 1.3 (harness), 2–5 (cases) |

## Files to Modify

| File Path | Task |
| --------- | ---- |
| `src/index.ts` | 1.2 (one side-effect import line) |
| `README.md` / `docs/api/*.md` | 5.4 (optional — only if a chord-type listing exists) |

## Technical Notes

### Format precedent
- Clone `src/data/caged-chords-7th.ts` structure: const-per-shape + JSDoc derivation + bottom
  `forEach(chordShapes.add.bind(chordShapes))`. Partial voicings use `null` in `strings`/`fingers`
  and a reduced `stringSet` — see `CAGED_CHORD_E_M7B5` (`src/data/caged-chords-7th.ts:223`).

### ChordShape contract
- `src/shape.ts:42-64`. `strings` holds **interval strings** (not frets), low→high pitch order;
  `rootString`'s first listed interval must be `"1P"`. Registry keys by `name` (must be globally
  unique) and queries `chordType` by exact string (`src/shape.ts:150`).

### Build + interop (used unchanged)
- `applyChordShape` (`src/build.ts:253`) is chroma-based and compound-interval-safe (`9M`/`13M`
  place like `2M`/`6M`). 12-fret window (`LOOKBACK=4`/`LOOKAHEAD=8`, `src/build.ts:37-42`) — verify
  no notes drop (1.3 build assertion).
- `arpeggioFromScale`/`arpeggioFromShape` (`src/integration.ts:60-118`) take a chord **name** and
  use `Chord.get` intervals + chroma membership. `identifyChord` (`:185-205`) wraps `detect`.
  `analyzeInKey` (`:233-259`) looks up diatonic 7ths only.

### Conventions (CLAUDE.md)
- Pure data, named exports, no default exports, no mutation. Register at import time via side effect.
- Test with vitest; run a single file via `npx vitest run src/data/extended-chords.test.ts`.
