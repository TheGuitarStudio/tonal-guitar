# Requirements: Curated Extended Chord Shapes Import

## Initial Description

Curate a high-value extended subset (~16 suffixes: sixths, ninths, jazz core, altered dominants)
from `tombatossals/chords-db` into a new `src/data/extended-chords.ts`, following the established
`ChordShape` metadata format. Ship 1–2 movable forms per type (E-form / A-form). Tonal.js interop
(chord ↔ scale ↔ arpeggio relationships round-tripping cleanly through `@tonaljs/chord`) is a
first-class acceptance criterion. Primary consumer is the Lab chord palette (#29); also feeds
`arpeggioFromShape` for exercise generation.

## Requirements Discussion

### Round 1 Questions (resolved via AskUserQuestion, 2026-06-30)

**Q1 — Voicing family:** E/A-form CAGED-style vs drop2/drop3 vs both?
**Answer:** **E/A-form (CAGED), per issue.** `system: "caged"`, `voicingFamily: "caged"`, continuing
the `caged-chords-7th.ts` precedent. drop2/drop3 (the dormant reserved enum values) are left to a
separate effort, closer to #28's generation engine.

**Q2 — Forms per type:** E+A only vs add open C/D forms vs one form?
**Answer:** **E-form + A-form per type (~30–35 shapes).** Matches the issue's estimate; balanced
fretboard coverage for the Lab.

**Q3 — Tonal naming/interval fidelity:** match `Chord.get` vs guitar-friendly?
**Answer:** **Match `Chord.get` symbol + compound intervals.** `chordType` = Tonal's canonical
`Chord.get` symbol; extensions written as compound intervals (`9M`, `13M`). Choose `7#5` over `aug7`
(same chord). Document the 4 `detect`-divergences rather than rename to chase them.

**Q4 — Suffix set:** all 3 tiers vs trim?
**Answer:** **All 3 tiers (~16 suffixes).** Essential + Jazz core + Altered dominant. 11ths still
deferred.

### Defaults applied (Q5/Q6 from research; lead decision, no objection raised)

**Q5 — Omitted-tone policy:** Every voicing that drops a chord tone (unavoidable for 5–6 note
extensions on a 4–5 string grip) **must** populate `omittedIntervals`, so the chord↔arpeggio
relationship stays *visible and queryable*. Omission priority: drop the **5th** first, then (for
6-tone `13`) the **9th**, never the 3rd or the characteristic extension/7th.

**Q6 — Test home & depth:** New file `src/data/extended-chords.test.ts` (keeps focus; `data.test.ts`
is already 27 KB). Each shape asserts: (a) registered & queryable by `chordType`; (b)
`applyChordShape` builds the expected interval set at a representative root; (c) Tonal interop —
`Chord.get(symbol)` resolves and built chord tones are a chroma-subset of `Chord.get(symbol).intervals`;
(d) `arpeggioFromShape`/`arpeggioFromScale` membership derivable.

### Existing Code to Reference

- **`src/data/caged-chords-7th.ts`** — the exact format precedent (const exports + JSDoc derivation
  + bottom `.forEach(chordShapes.add.bind(chordShapes))`). E-form ⇒ `rootString: 0`, A-form ⇒
  `rootString: 1`. Partial voicings use `null` in `strings`/`fingers` and a reduced `stringSet`
  (see `CAGED_CHORD_E_M7B5`).
- **`src/build.ts:253` `applyChordShape`** — consumes the interval rows; compound intervals are safe
  (chroma-based placement, 12-fret window).
- **`src/integration.ts`** — `arpeggioFromScale`/`arpeggioFromShape` (chroma membership via
  `Chord.get`), `identifyChord` (`detect`), `analyzeInKey` (diatonic-7th lookup).
- **`src/index.ts:117-124`** — add one side-effect import line.
- **`src/data/data.test.ts`** — chord-shape test patterns to mirror in the new test file.

## Visual Assets

No visual assets provided. This is a library-data feature with no UI surface (the Lab UI that
consumes it is #29, out of scope here).

## Requirements Summary

### Functional Requirements

- **Data — chord set:** Add ~16 `chordType`s across 3 tiers, each with an E-form and an A-form
  movable `ChordShape`, registered at import time. ≈30–35 shapes.
- **Data — fidelity:** `chordType` strings equal Tonal `Chord.get` symbols; interval rows use Tonal
  compound-interval vocabulary and match `Chord.get(symbol).intervals` (modulo omitted tones).
- **Data — partial voicings:** Where a grip omits tones, set `omittedIntervals` and a `stringSet`
  covering only played strings; `fingers`/`strings` use `null` for muted strings.
- **Interop catalog:** Document the `chordType` ↔ Tonal `symbol`/`detect` mapping, explicitly noting
  the 4 divergences (`add9`→`CMadd9`, `mMaj7`→`Cm/ma7`, `6/9`→`C6add9`, `aug7`→`7#5`).
- **Registration/API:** One `import "./data/extended-chords";` in `index.ts`. No new public exports
  required (consumers use existing `chordShapes`, `applyChordShape`, `arpeggioFromShape`).
- **Tests:** Per-shape build + interop assertions in `src/data/extended-chords.test.ts`.

### Reusability Opportunities

- Clone the structure and JSDoc style of `caged-chords-7th.ts` wholesale.
- Reuse `applyChordShape` and the `arpeggio*`/`identifyChord` bridge unchanged — no engine work.

### Scope Boundaries

**In Scope:** the 16-suffix curated data file, partial-voicing metadata, Tonal interop verification
+ documented mapping catalog, and the test file.

**Out of Scope:** derivation/voicing-generation engine and the long tail incl. 11ths (#28);
drop2/drop3 voicing family; Lab UI/palette wiring (#29); any CLI/MCP cross-library query layer.

### Technical Considerations

- Extended chords are 4–6 tones; E/A movable forms will frequently be **partial** (4–5 strings) —
  this is expected and handled by `omittedIntervals` + reduced `stringSet`.
- `analyzeInKey` returns an empty numeral/degree for non-diatonic extensions — a known, correct
  limitation, not a defect.
- Shape `name`s must be globally unique (registry indexes by name); use a systematic scheme
  (`"E Shape <symbol>"`, `"A Shape <symbol>"`).
