# Specification: Curated Extended Chord Shapes Import

## Goal

Add a curated, high-value set of 15 extended chord types (sixths, ninths, jazz core, and altered
dominants) to the chord-shape registry as a new `src/data/extended-chords.ts`, each with a movable
E-form and A-form voicing in the established `ChordShape` format. Every type is verified to
round-trip cleanly through Tonal.js (`@tonaljs/chord`) so chord ↔ scale ↔ arpeggio relationships
stay derivable across both libraries without a translation layer. This is purely additive data on
shipped infrastructure (#16) — no new engine — that enriches the Lab chord palette (#29) and gives
`arpeggioFromShape` useful sixth/ninth/altered sources, moving the library toward a credible,
publish-ready vocabulary.

## User Stories

- As a Lab user, I want to pick `Cmaj9` or `A7b9` and see a real fingering, so the chord step covers
  more than triads and basic 7ths.
- As an exercise generator, I want `arpeggioFromShape` to accept sixth/ninth/altered chords, so I can
  drill jazz and blues arpeggios.
- As a developer using `tonal` + `tonal-guitar` together, I want chord symbols, intervals, and
  degrees to share one vocabulary, so I can resolve chord ↔ scale ↔ arpeggio relationships across
  both libraries without writing a translation layer.
- As a library evaluator, I want a credible chord vocabulary out of the box, so tonal-guitar reads
  as publish-ready.

## Specific Requirements

### Data Layer — `src/data/extended-chords.ts` (new file)

**File shape.** Mirror `src/data/caged-chords-7th.ts` exactly: a header JSDoc explaining the set and
the Tonal interop contract; one `export const` per shape with a JSDoc deriving its interval row from
a named open/movable voicing; a single `[...].forEach(chordShapes.add.bind(chordShapes))` at the
bottom. `import { chordShapes, ChordShape } from "../shape";`. Zero Tonal imports at module load
(pure data, like every other `data/*` file).

**Chord set (15 canonical `chordType`s, all verified to resolve in `@tonaljs/chord`; `aug7` is an
alias of `7#5`, not a separate key).** `chordType` MUST equal
Tonal's `Chord.get` symbol suffix. Interval rows MUST use Tonal compound-interval vocabulary and be a
subset of `Chord.get(symbol).intervals` (a voicing may omit tones but MUST NOT add tones outside the
chord). Reference chord-tone sets (the canonical full chord; voicings draw from these):

| Tier | `chordType` | Full chord tones (`Chord.get` intervals) | Notes |
| ---- | ----------- | ----------------------------------------- | ----- |
| 1 | `6`     | `1P 3M 5P 6M`           | |
| 1 | `m6`    | `1P 3m 5P 6M`           | |
| 1 | `9`     | `1P 3M 5P 7m 9M`        | 5 tones (may be complete on a 5-string grip) |
| 1 | `maj9`  | `1P 3M 5P 7M 9M`        | 5 tones |
| 1 | `m9`    | `1P 3m 5P 7m 9M`        | 5 tones |
| 1 | `add9`  | `1P 3M 5P 9M`           | no 7th |
| 2 | `13`    | `1P 3M 5P 7m 9M 13M`    | 6 tones → omit 5th then 9th |
| 2 | `dim7`  | `1P 3m 5d 7d`           | symmetric |
| 2 | `mMaj7` | `1P 3m 5P 7M`           | |
| 2 | `7sus4` | `1P 4P 5P 7m`           | no 3rd (suspended) |
| 2 | `6/9`   | `1P 3M 5P 6M 9M`        | 5 tones |
| 3 | `7b9`   | `1P 3M 5P 7m 9m`        | 5 tones |
| 3 | `7#9`   | `1P 3M 5P 7m 9A`        | 5 tones ("Hendrix") |
| 3 | `7#5`   | `1P 3M 5A 7m`           | register as `7#5`, NOT `aug7` (same Tonal chord) |
| 3 | `7b5`   | `1P 3M 5d 7m`           | |

**Forms per type.** Each `chordType` gets **two** movable shapes: an **E-form** (`rootString: 0`,
root on string 0) and an **A-form** (`rootString: 1`, root on string 1). ≈30 shapes (15 types × 2;
`7#5` is the single altered-aug entry). A type may ship only one form if no practical second movable
grip exists — in that case the test file documents why.

**Per-shape field requirements** (per `ChordShape`, `src/shape.ts:42-64`):
- `name` — globally unique (registry indexes by name). Scheme: `"E Shape <symbol>"` / `"A Shape
  <symbol>"`, e.g. `"E Shape maj9"`, `"A Shape 7#5"`.
- `system: "caged"`, `voicingFamily: "caged"`, `inversion: 0`.
- `strings` — one interval per string low→high (pitch order, per the `fretInWindow` convention);
  `null` for muted/unplayed strings. Intervals from the chord-tone set above (compound `9M`/`13M`).
- `fingers` — fretting-hand finger per string; `null` muted, `0` open. Must be a physically plausible
  grip (≤4 fretting fingers; barres expressed via `barres`).
- `barres` — `Barre[]` where a finger bars multiple strings; `[]` otherwise.
- `rootString` — 0 (E-form) or 1 (A-form); the listed first interval on this string MUST be `"1P"`.
- `stringSet` — the played string indices only (e.g. `[0,1,2,3,4]`).
- `omittedIntervals` — REQUIRED whenever the grip drops a chord tone. Omission priority: **5th
  first**, then (only for `13`) the **9th**. Never omit the 3rd, the characteristic extension, or the
  7th (for `7sus4` the 4th replaces the 3rd and is never omitted).

**Two worked examples** (format reference for implementation; remaining grips follow the same rules):

```ts
// E-form sixth — full 4-tone chord, no omission
// Prototype: E6 movable → E B E G# C# E ... use a clean 5-string grip
export const EXT_CHORD_E_6: ChordShape = {
  name: "E Shape 6",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "6M", null], // low→high; top string muted
  fingers: [1, 3, 1, 1, 1, null],
  barres: [{ fret: 0, fromString: 0, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "6",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4],
  // no omittedIntervals — all of 1P 3M 5P 6M present
};

// A-form dominant 13 — 6-tone chord, omit only the 5th (priority 1)
// Prototype: standard movable C13 A-root grip → x 3 2 3 3 5 (C E Bb D A)
export const EXT_CHORD_A_13: ChordShape = {
  name: "A Shape 13",
  system: "caged",
  strings: [null, "1P", "3M", "7m", "9M", "13M"], // A/D/G/B/e set: C E Bb D A for root C
  fingers: [null, 2, 1, 3, 4, 4], // illustrative — finalized in implementation
  barres: [],
  rootString: 1,
  chordType: "13",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
  omittedIntervals: ["5P"], // only the 5th dropped; 9 and 13 retained
};
```

> **The interval `strings` row is the normative part; `fingers`/`barres` in these examples are
> illustrative and are finalized during implementation.** Frets are derived at apply-time from the
> interval row: `EXT_CHORD_A_13` applied to C builds to `x 3 2 3 3 5` (a real, playable C13);
> `EXT_CHORD_E_6` applied to F builds to `1 3 3 2 3 x`. Implementation MUST derive each shape from a
> concrete six-string prototype grip (in JSDoc) and verify it is playable — correct fret span and a
> plausible fingering — not merely that the intervals build to *some* fret.

### Integration Layer — interop verification (no code change, verification only)

The new data must satisfy these Tonal round-trips using the **existing** `src/integration.ts` bridge
(no new functions):
- **Resolution:** for every `chordType` symbol `S`, `Chord.get("C"+S)` is non-empty and its
  `intervals` superset-matches the shape's interval row (shape intervals ⊆ chord intervals, modulo
  octave/compound equivalence by chroma).
- **Arpeggio derivability:** `arpeggioFromShape(parentScaleShape, "C"+S, "C")` and
  `arpeggioFromScale` keep exactly the chord tones present in the parent (chroma membership) — i.e.
  the chord is usable as an arpeggio source.
- **Identification — split by completeness (D-007):** building the shape via `applyChordShape` then
  `identifyChord(frets)`:
  - **Full voicings** (no `omittedIntervals`): `detect` returns a non-empty result whose first entry
    is the exact symbol or a documented alias.
  - **Partial voicings** (has `omittedIntervals`): assert only that the built notes are a **chroma
    subset** of `Chord.get(root+symbol).intervals` and that `Chord.get` resolves. Do **NOT** require
    `detect` to name the full chord — omitted-tone grips frequently return `[]` or an incomplete
    label (e.g. a C13 shell `C E Bb A` detects nothing; `C E Bb D` → `C9no5`, not `C9`).
- **Key analysis (documented limit):** `analyzeInKey` returns an empty numeral/degree for
  non-diatonic extensions — assert this is the case for a representative extension, documenting it as
  expected behavior.

**Interop divergence catalog (MUST be documented in the file header JSDoc and the spec).** Where
`Chord.get(symbol).symbol` ≠ `detect(notes)[0]`:

| `chordType` (our key = `Chord.get` symbol) | `detect(notes)` returns | Handling |
| ------------------------------------------- | ----------------------- | -------- |
| `add9` | `Madd9` (e.g. `CMadd9`) | key stays `add9`; tests assert chroma membership |
| `mMaj7` | `m/ma7` (e.g. `Cm/ma7`) | key stays `mMaj7`; documented alias |
| `6/9` | `6add9` (e.g. `C6add9`) | key stays `6/9`; documented alias |
| `7#5` | also `C7b13` after `C7#5` | first `detect` = `C7#5` (our key); note the alternate |
| `aug7` (not registered) | `C7#5` | `aug7`/`7#5` are the **same chord**; `Chord.get("Caug7").symbol` = `Caug7` (NOT normalized), `detect` prefers `C7#5`. We register `7#5`; `aug7` documented as an alias. `chordShapes.query({chordType:"aug7"})` will NOT match — exact-string registry. |

### Module / Public API

- Add exactly one line to `src/index.ts` after the existing data imports (`src/index.ts:124`):
  `import "./data/extended-chords";`.
- **No** new public re-exports (consumers use existing `chordShapes`, `applyChordShape`,
  `arpeggioFromShape`/`arpeggioFromScale`, `identifyChord`). Optional: export the shape consts is not
  required and should be omitted to match `caged-chords-7th.ts`.

### Testing — `src/data/extended-chords.test.ts` (new file)

Mirror chord-shape test patterns from `src/data/data.test.ts`. For **every** registered shape:
1. **Registered & queryable:** `chordShapes.query({ chordType })` includes the shape; its `name` is
   unique across the whole registry.
2. **Builds correctly & is playable:** `applyChordShape(shape, root)` at a representative root
   (STANDARD tuning; use a root such as F or C that avoids open-string edge cases) produces a
   `Fingering` whose non-null `frets` count equals `stringSet.length` (no notes dropped by the
   12-fret window), whose built intervals equal `strings` minus `null`s, and whose fretted span is
   playable (fretted frets within ~4 of each other; a plausible ≤4-finger grip).
3. **Interop — resolution & subset:** `Chord.get("<root><chordType>")` is non-empty and the shape's
   interval chromas are a subset of the chord's interval chromas.
4. **Interop — arpeggio membership:** chord tones are derivable via `arpeggioFromScale` /
   `arpeggioFromShape` (chroma membership).
5. **Omission integrity:** if `omittedIntervals` is set, those intervals are absent from `strings`
   and present in the full `Chord.get` chord; if unset, the shape contains all chord tones.
6. **Identification split (D-007):** full voicings → `detect` first entry is exact/alias; partial
   voicings → built notes are a chroma subset of the full chord (no full-chord `detect` required).
7. **Divergence cases:** explicit assertions documenting the catalog rows behave as specified,
   including that `chordShapes.query({ chordType: "aug7" })` returns nothing (exact-string registry).

Aggregate sanity: total new shape count is ~30; all 15 canonical `chordType`s are present; no
duplicate names.

## Visual Design

No UI in scope. This feature is library data only; the Lab palette that renders these shapes is #29.
The sole "presentation" surface is the data file's JSDoc — it MUST follow the `caged-chords-7th.ts`
house style (per-shape derivation comment + interval annotation) so the file reads as documentation.

## Existing Code to Leverage

**Format precedent**
- `src/data/caged-chords-7th.ts` — clone its structure, JSDoc style, naming, registration, and
  partial-voicing handling (`CAGED_CHORD_E_M7B5` shows `null`-padded `strings`/`fingers` + reduced
  `stringSet`).

**Type + registry**
- `src/shape.ts:42-64` (`ChordShape`, `Barre`) and `src/shape.ts:121-167` (`chordShapes` registry +
  `.query`).

**Build + interop (used unchanged)**
- `src/build.ts:253` `applyChordShape` (chroma-based, compound-interval safe).
- `src/integration.ts` — `arpeggioFromScale`/`arpeggioFromShape` (`:60-118`), `identifyChord`
  (`:185-205`), `analyzeInKey` (`:233-259`).

**Registration + tests**
- `src/index.ts:117-124` (side-effect imports); `src/data/data.test.ts` (chord-shape test patterns).

**Source data**
- `tombatossals/chords-db` voicings (format documented in `docs/chord-formats-research.md`) as the
  reference for fret/finger choices; transcribed by hand into interval rows (no vendored JSON in
  repo).

## Out of Scope

- The derivation/voicing-generation engine and the rare long tail, including 11ths
  (`11`/`m11`/`maj11`) — these stay in #28.
- The drop2/drop3 (and `drop2+4`/`sweep`) voicing families — a separate future effort; the reserved
  enum values stay unused here.
- Lab UI / chord-palette wiring — #29.
- Any CLI / MCP server / cross-library "everything about this chord/scale/arpeggio" query helper —
  explicitly future; the schemas here are designed to *allow* it later without reshaping.
- Changes to `ChordShape`, the registry, `applyChordShape`, or `integration.ts` — this feature adds
  data and tests only.
- **Non-standard tunings (D-008):** these are **standard six-string** shapes. Alternate tunings and
  7/8-string tunings are best-effort — `applyChordShape` maps a six-slot shape onto the lowest six
  strings of a longer tuning, which is not a guitarist's top-six placement. Not guaranteed or tested
  here; documented in the data-file header.

## Acceptance Criteria (rollup)

- [ ] `src/data/extended-chords.ts` exists, registers ~30 shapes covering all 15 canonical
      `chordType`s (`aug7` documented as an alias of `7#5`), and follows the `caged-chords-7th.ts`
      format.
- [ ] Every `chordType` equals its Tonal `Chord.get` symbol; `7#5` (not `aug7`) is the altered-aug
      entry; interval rows use compound vocabulary and are chord-tone subsets.
- [ ] Every partial voicing sets `omittedIntervals` per the omission-priority rule.
- [ ] Every shape is derived from a concrete six-string prototype grip (in JSDoc) and builds to a
      **playable** grip in STANDARD tuning (fret span + plausible fingering), not merely a valid
      interval build.
- [ ] Identification tests are split full-vs-partial (D-007); partials are not required to `detect`
      as the full chord. Standard-tuning scope is documented (D-008).
- [ ] One side-effect import added to `src/index.ts`; no other public-API change.
- [ ] `src/data/extended-chords.test.ts` passes all per-shape build + interop assertions; the
      divergence catalog is covered.
- [ ] The interop divergence catalog is documented in the data file header JSDoc.
- [ ] `npm run build`, `npm test`, and `npm run lint` pass.
