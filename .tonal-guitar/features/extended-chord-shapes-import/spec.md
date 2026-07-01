# Specification: Curated Extended Chord Shapes Import

## Goal

Add a curated, high-value set of ~16 extended chord types (sixths, ninths, jazz core, and altered
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

**Chord set (16 `chordType`s, all verified to resolve in `@tonaljs/chord`).** `chordType` MUST equal
Tonal's `Chord.get` symbol suffix. Interval rows MUST use Tonal compound-interval vocabulary and be a
subset of `Chord.get(symbol).intervals` (a voicing may omit tones but MUST NOT add tones outside the
chord). Reference chord-tone sets (the canonical full chord; voicings draw from these):

| Tier | `chordType` | Full chord tones (`Chord.get` intervals) | Notes |
| ---- | ----------- | ----------------------------------------- | ----- |
| 1 | `6`     | `1P 3M 5P 6M`           | |
| 1 | `m6`    | `1P 3m 5P 6M`           | |
| 1 | `9`     | `1P 3M 5P 7m 9M`        | 5 tones → partial grip |
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

// A-form dominant 13 — 6-tone chord, omit the 5th (priority 1)
export const EXT_CHORD_A_13: ChordShape = {
  name: "A Shape 13",
  system: "caged",
  strings: [null, "1P", "7m", "3M", "13M", null], // root–b7–3–13 on the A/D/G/B set
  fingers: [null, 1, 1, 2, 4, null],
  barres: [],
  rootString: 1,
  chordType: "13",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P", "9M"], // 5th then 9th dropped to fit a 4-string grip
};
```

> The exact frets are derived at apply-time from these interval rows; implementation must verify each
> grip is playable and builds correctly (see Testing). Interval rows above are illustrative of the
> *format and omission policy* — implementation finalizes the precise voicing per type.

### Integration Layer — interop verification (no code change, verification only)

The new data must satisfy these Tonal round-trips using the **existing** `src/integration.ts` bridge
(no new functions):
- **Resolution:** for every `chordType` symbol `S`, `Chord.get("C"+S)` is non-empty and its
  `intervals` superset-matches the shape's interval row (shape intervals ⊆ chord intervals, modulo
  octave/compound equivalence by chroma).
- **Arpeggio derivability:** `arpeggioFromShape(parentScaleShape, "C"+S, "C")` and
  `arpeggioFromScale` keep exactly the chord tones present in the parent (chroma membership) — i.e.
  the chord is usable as an arpeggio source.
- **Identification (chroma, not string-equality):** building the shape via `applyChordShape` then
  `identifyChord(frets)` returns a chord whose tones are consistent with the type; assertions use
  chord-tone chroma membership, not exact symbol equality, where `detect` diverges (below).
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
| `aug7` | `7#5` | register `7#5` only; `aug7` noted as the alias |

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
2. **Builds correctly:** `applyChordShape(shape, root)` at a representative root produces a
   `Fingering` whose non-null `frets` count equals `stringSet.length` (no notes dropped by the
   12-fret window), and whose built intervals equal `strings` minus `null`s.
3. **Interop — resolution & subset:** `Chord.get("<root><chordType>")` is non-empty and the shape's
   interval chromas are a subset of the chord's interval chromas.
4. **Interop — arpeggio membership:** chord tones are derivable via `arpeggioFromScale` /
   `arpeggioFromShape` (chroma membership).
5. **Omission integrity:** if `omittedIntervals` is set, those intervals are absent from `strings`
   and present in the full `Chord.get` chord; if unset, the shape contains all chord tones.
6. **Divergence cases:** explicit assertions documenting the 4 catalog rows behave as specified.

Aggregate sanity: total new shape count is ~30; all 16 `chordType`s are present; no duplicate names.

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

## Acceptance Criteria (rollup)

- [ ] `src/data/extended-chords.ts` exists, registers ~30 shapes covering all 16 `chordType`s, and
      follows the `caged-chords-7th.ts` format.
- [ ] Every `chordType` equals its Tonal `Chord.get` symbol; `7#5` (not `aug7`) is the altered-aug
      entry; interval rows use compound vocabulary and are chord-tone subsets.
- [ ] Every partial voicing sets `omittedIntervals` per the omission-priority rule.
- [ ] One side-effect import added to `src/index.ts`; no other public-API change.
- [ ] `src/data/extended-chords.test.ts` passes all per-shape build + interop assertions; the
      divergence catalog is covered.
- [ ] The interop divergence catalog is documented in the data file header JSDoc.
- [ ] `npm run build`, `npm test`, and `npm run lint` pass.
