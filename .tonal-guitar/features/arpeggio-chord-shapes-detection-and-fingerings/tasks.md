# Task Breakdown: Arpeggio & Chord Shapes — Detection and Fingerings

## Overview

Total Tasks: 10 Task Groups

This feature adds arpeggio derivation, registry-driven shape inference, curated chord-shape data (7th-chord CAGED, selective chords-db import, jazz shells), and grouped simultaneous-note rendering to both output formatters — all in the library (`src/`) only. Lab integration (sub-feature E) is explicitly out of scope.

## Task List

### Module / Types Layer

#### Task Group 1: Type Extensions, `VoicingFamily`, `VoicingPatternDictionary`, and `chordShapes.query`

**Dependencies:** None

- [ ] 1.0 Extend `src/shape.ts` with new exported types and the registry query method
  - [ ] 1.1 Write focused tests in `src/shape.test.ts` (create if absent)
    - Import smoke: `VoicingFamily`, `VoicingPatternDictionary` resolve from `src/index`
    - `chordShapes.query({})` returns all registered chord shapes (baseline)
    - `chordShapes.query({ chordType: "maj7" })` returns only maj7 shapes when some exist
    - `chordShapes.query({ voicingFamily: "caged", system: "caged" })` is conjunctive
    - `chordShapes.query({ stringSet: [0,1,2] })` matches by exact array equality
    - `chordShapes.query({ chordType: "m7" })` on an empty registry returns `[]`
    - `ChordShape` now accepts optional fields (`chordType`, `inversion`, `voicingFamily`, `stringSet`, `omittedIntervals`, `canonicalRoot`, `baseFret`) without breaking existing shapes that omit them
  - [ ] 1.2 Extend `src/shape.ts`
    - Add `export type VoicingFamily = "caged" | "shell" | "open" | "barre" | "drop2" | "drop3" | "drop2+4" | "sweep"` (R-1.2)
    - Add `export type VoicingPatternDictionary = Record<string, string[]>` (R-1.3)
    - Extend `ChordShape` interface with seven optional fields: `chordType?`, `inversion?`, `voicingFamily?`, `stringSet?`, `omittedIntervals?`, `canonicalRoot?`, `baseFret?` (R-1.1). All existing `ChordShape` objects remain valid — no data changes needed in `caged-chords.ts`
    - Add `query(filter: { chordType?: string; system?: string; voicingFamily?: VoicingFamily; stringSet?: number[] }): ChordShape[]` to the `chordShapes` object; implement as a conjunctive filter over `all()`; `stringSet` match uses `JSON.stringify` equality (order-sensitive per spec) (R-1.4)
  - [ ] 1.3 Wire re-exports in `src/index.ts`
    - Add `export type { VoicingFamily, VoicingPatternDictionary } from "./shape"` (R-6.1)
    - `chordShapes` is already re-exported; `.query` is available automatically
  - [ ] 1.4 Ensure tests pass
    - `npx vitest run src/shape.test.ts`

**Acceptance Criteria:**

- `src/shape.ts` compiles; `npm run build` passes
- `VoicingFamily`, `VoicingPatternDictionary` are importable from `src/index`
- `chordShapes.query` is callable and returns conjunctive results
- All 7 tests from 1.1 pass; no pre-existing tests broken

---

#### Task Group 2: New Module Scaffold — `src/arpeggio.ts` (types + stubs)

**Dependencies:** Task Group 1

- [ ] 2.0 Create `src/arpeggio.ts` with all exported types, `InferenceProbe`, `ScoreBreakdown`, `filterChordTones` stub, and `scoreShapeMatch` stub
  - [ ] 2.1 Write import-smoke tests in `src/arpeggio.test.ts`
    - All named exports resolve from both `src/arpeggio` and `src/index`
    - `InferenceProbe` and `ScoreBreakdown` compile as types
    - Stub `filterChordTones` throws `"not implemented"` so integration layer can replace it
    - Stub `scoreShapeMatch` throws `"not implemented"`
  - [ ] 2.2 Create `src/arpeggio.ts`
    - Zero Tonal deps (pure tier — see CLAUDE.md §Dependency layers); only import from `./shape`
    - Export `InferenceProbe` interface (R-2.4): `{ pitchClasses: number[]; rootCandidates: { pc: string; chroma: number }[]; anchorFret: number; anchorString: number }`
    - Export `ScoreBreakdown` interface: `{ tightness: number; anchorHit: boolean; rootOnAnchorString: boolean; positionAgreement: number; rootPreference: number }`
    - Stub `export function filterChordTones(scale: FrettedScale, intervals: string[]): FrettedScale`
    - Stub `export function scoreShapeMatch(probe: InferenceProbe, shape: ScaleShape, root: { pc: string; chroma: number }, built: FrettedScale): { total: number; coverage: number; matchedIntervals: string[]; matchedNotes: FrettedNote[]; breakdown: ScoreBreakdown }`
    - Internal (non-exported) `pcChroma(pc: string): number` helper (letter + accidental arithmetic, no Tonal dep)
  - [ ] 2.3 Wire re-exports in `src/index.ts`
    - Add `export { filterChordTones, scoreShapeMatch } from "./arpeggio"`
    - Add `export type { InferenceProbe, ScoreBreakdown } from "./arpeggio"`
  - [ ] 2.4 Ensure tests pass
    - `npx vitest run src/arpeggio.test.ts`

**Acceptance Criteria:**

- `src/arpeggio.ts` exists; `npm run build` passes
- `filterChordTones`, `scoreShapeMatch`, `InferenceProbe`, `ScoreBreakdown` importable from `src/index`
- Smoke tests pass; stubs intentionally throw

---

### Core Logic Layer

#### Task Group 3: `filterChordTones` (pure, parent-frame interval filter)

**Dependencies:** Task Group 2

- [ ] 3.0 Implement `filterChordTones` in `src/arpeggio.ts` and verify against spec fixtures
  - [ ] 3.1 Write focused tests in `src/arpeggio.test.ts`
    - **Fixture (a) low-level path:** `filterChordTones(buildFrettedScale(CAGED_G, "C"), ["6M","1P","3M","5P"])` retains exactly 10 notes with intervals only in `{"6M","1P","3M","5P"}` and none with `"7M"`, `"2M"`, `"4P"` (Fixture a equivalence)
    - **Fixture (d) low-level path:** `filterChordTones(buildFrettedScale(CAGED_E, "G"), ["1P","3M","5P","7M"])` retains exactly 10 notes; every note has `interval ∈ {"1P","3M","5P","7M"}`; parent-scale `degree` field is preserved on each retained note (Fixture d)
    - Empty scale input → `NoFrettedScale` (R-2.3)
    - Filter that removes every note → empty sentinel with `empty: true`, `notes: []`, `root/tuning/shapeName` preserved, `scaleType: ""`, `scaleName: ""` (R-2.3)
    - Non-empty filter → new `FrettedScale` object; input scale not mutated; input notes array not mutated (R-2.2)
    - Order-preserving: retained notes appear in the same relative order as in `scale.notes`
    - `[]` interval set → empty sentinel (not a throw)
  - [ ] 3.2 Replace the stub in `src/arpeggio.ts`
    - Algorithm per spec §A.1: build a `Set(intervals)`, single-pass filter `scale.notes` preserving order; `FrettedNote` objects reused (immutable references); return a fresh `FrettedScale` with a fresh `notes` array
    - Guard: `if (scale.empty) return { ...NoFrettedScale }` first
    - Empty filter result: return `{ ...NoFrettedScale, root: scale.root, tuning: scale.tuning, shapeName: scale.shapeName }`
    - Never throws for valid-typed inputs
  - [ ] 3.3 Ensure tests pass
    - `npx vitest run src/arpeggio.test.ts`

**Acceptance Criteria:**

- `filterChordTones` passes all 7 tests from 3.1
- Algorithm is a single pass over `scale.notes`; no mutation of inputs
- Empty-sentinel structure matches `NoFrettedScale` shape exactly
- Fixture (a) and (d) low-level paths produce the committed note counts and interval sets

---

#### Task Group 4: `pcChroma` helper and `scoreShapeMatch` (pure scoring core)

**Dependencies:** Task Group 3

- [ ] 4.0 Implement the internal `pcChroma` pure helper and the exported `scoreShapeMatch` in `src/arpeggio.ts`
  - [ ] 4.1 Write focused tests in `src/arpeggio.test.ts`
    - `pcChroma("C") === 0`, `pcChroma("Bb") === 10`, `pcChroma("A#") === 10` (enharmonic equality)
    - `pcChroma("F#") === 6`, `pcChroma("Gb") === 6`
    - `pcChroma("")` returns a sentinel (e.g. `-1`) without throwing
    - `scoreShapeMatch` coverage: probe chromas all in built chromas → `coverage === 1.0`
    - `scoreShapeMatch` tightness: `probe.pitchClasses.length / distinctChromas(built.notes)`, value in `(0, 1]`
    - `anchorHit` = `true` when a `"1P"` built note is on `probe.anchorString` and its chroma equals `probe.rootCandidates[0].chroma`
    - `rootOnAnchorString` = `true` when any `"1P"` built note is on `probe.anchorString`
    - Circular positionAgreement: `|anchorFret 11 − probeAnchorFret 0|` with mod-12 → `circularDelta 1` → `positionAgreement 1 − 1/12` (Fixture g cross-check)
    - `rootPreference` = `1 / (1 + rootRank)`: rank 0 → 1.0, rank 1 → 0.5
    - `matchedIntervals` is in built-note order, deduped by chroma using first-match semantics (review S-8)
    - `matchedNotes` contains the concrete built `FrettedNote`s whose chroma is in the probe set
    - Total score formula: `100*coverage + 40*tightness + 30*anchorHit + 10*rootOnAnchorString + 20*positionAgreement + 15*rootPreference` (all weights per spec §B.3)
    - Chroma collision (two built notes share a chroma): `matchedIntervals` uses first-match-in-built-note-order, no duplication
  - [ ] 4.2 Implement in `src/arpeggio.ts`
    - `pcChroma(pc: string): number` — pure letter+accidental arithmetic; no `@tonaljs` dep; `A=9` chromatic reference; return `-1` for unrecognizable input
    - `scoreShapeMatch`: build `builtChromas` set; compute all five sub-scores; build `matchedIntervals` via `Map<number, string>` (first-match-wins) in built-note order; collect `matchedNotes`; compute `total`; return structured object (zero Tonal deps)
    - Circular position distance: `d = Math.abs(builtAnchorFret - probe.anchorFret) % 12; circularDelta = Math.min(d, 12 - d)` — `FrettedScale` does not carry `anchorFret`, so `scoreShapeMatch` receives `builtAnchorFret: number` as an additional parameter alongside `built` (the integration tier computes this from `buildFrettedScale` + `findShapeAnchorFret`; the pure tier does not call `build.ts`). Document the parameter contract in a JSDoc.
    - Update the `scoreShapeMatch` stub signature from Task 2.2 to add `builtAnchorFret: number` as the fifth parameter. This is a deliberate extension of the spec's formal 4-parameter signature (spec Exact API surface) — necessary because `FrettedScale` carries no anchor field; note the divergence in the JSDoc.
  - [ ] 4.3 Ensure tests pass
    - `npx vitest run src/arpeggio.test.ts`

**Acceptance Criteria:**

- `pcChroma` is not exported from `src/index`; used only within `src/arpeggio.ts`
- `scoreShapeMatch` passes all tests in 4.1 including enharmonic, chroma-collision, and circular-distance cases
- Zero Tonal peer-dep imports in `src/arpeggio.ts`
- `matchedIntervals` and `matchedNotes` are well-defined for all spec edge cases

---

### Integration Layer

#### Task Group 5: `arpeggioFromScale` and `arpeggioFromShape` (chroma-based builders)

**Dependencies:** Task Group 3 (filterChordTones complete), Task Group 1 (types)

- [ ] 5.0 Add `arpeggioFromScale` and `arpeggioFromShape` to `src/integration.ts` and wire public re-exports
  - [ ] 5.1 Write focused tests in `src/integration.test.ts` (create file — it does not exist yet; existing tests live in `src/index.test.ts`)
    - **Fixture (a) friendly API:** `arpeggioFromShape(CAGED_G, "Am7", "C")` → exactly 10 notes; every note has chroma in `{9,0,4,7}` (A,C,E,G); `root === "A"`, `scaleType === "minor seventh"`, `scaleName === "A minor seventh"`, `shapeName === "G Shape"`; parent-frame `interval`/`degree` preserved on each retained note
    - **Fixture (d) friendly API:** `arpeggioFromShape(CAGED_E, "maj7", "G")` → 10 notes; every note `interval ∈ {"1P","3M","5P","7M"}`; `root === "G"`, `scaleType === "major seventh"`, `scaleName === "G major seventh"`; each note retains parent `degree`
    - **Fixture (e) 3NPS derivation:** `arpeggioFromShape(NPS_PATTERN_1, "maj7", "C")` → 10 notes, all `interval ∈ {"1P","3M","5P","7M"}`, `scaleType === "major seventh"`, `walkShapeMotif(result, [1,2,3,4])` runs without error
    - **Fixture (e) partial-filter sub-assertion:** `arpeggioFromShape(NPS_PATTERN_1, "Cm7", "C")` → non-empty result; every note chroma ∈ `{0,7}` (C and G only); `scaleType === "minor seventh"`
    - `arpeggioFromScale` on an empty/NoFrettedScale parent → `NoFrettedScale`
    - Unknown chord name (e.g. `"Qxyz7"`) → `NoFrettedScale`
    - Bare chord type `"m7"` (no tonic in symbol) → tonic falls back to parent root; result `root` = parent root pc
    - Chord tones ALL absent from parent → empty sentinel (R-2.3)
    - `arpeggioFromScale` works with a non-major parent (build a dorian `FrettedScale` manually via `buildFrettedScale` with a custom shape, confirm chord tones filter correctly)
    - Enharmonic: chord symbol `"Bbm7"` over a parent rooted at `"Bb"` — chroma membership, not spelling equality
  - [ ] 5.2 Add to `src/integration.ts`
    - Import `Chord` from `@tonaljs/chord` (already an optional peer dep in this tier)
    - Import `filterChordTones` from `./arpeggio`; import `buildFrettedScale` from `./build`; import `STANDARD` from `./tuning`
    - `arpeggioFromScale(parent, chordName)`: guard empty parent → `NoFrettedScale`; call `Chord.get(chordName)`; guard `chord.empty` → `NoFrettedScale`; derive `tonic = chord.tonic ?? parent.root`; compute `chordChromas` (using `Note.chroma(Note.transpose(tonic, ivl))` for each interval); filter `parent.notes` by chroma membership; if empty → sentinel with `root: pc(tonic)`, `tuning: parent.tuning`, `shapeName: parent.shapeName`; else → fresh `FrettedScale` with `root: pc(tonic)`, `scaleType: chord.type`, `scaleName: \`${pc(tonic)} ${chord.type}\``, `shapeName: parent.shapeName`, `tuning: parent.tuning`, `notes: kept` (per spec §A.2)
    - `arpeggioFromShape(shape, chordName, parentRoot, tuning = STANDARD)`: compose `buildFrettedScale(shape, parentRoot, tuning)` then `arpeggioFromScale(result, chordName)` (spec §A.2, one line)
    - Never throws; all edge cases return `NoFrettedScale` or partial results
  - [ ] 5.3 Wire re-exports in `src/index.ts`
    - Add `export { arpeggioFromScale, arpeggioFromShape } from "./integration"` (R-6.1)
  - [ ] 5.4 Ensure tests pass
    - `npx vitest run src/integration.test.ts`

**Acceptance Criteria:**

- `arpeggioFromScale` and `arpeggioFromShape` importable from `src/index`
- Fixtures (a), (d), (e) (including partial-filter sub-assertion) all pass
- Bare chord type, unknown chord, empty parent, all-absent tones all return correct sentinels/partials
- `walkShapeMotif(arpeggioFromShape(NPS_PATTERN_1, "maj7", "C"), [1,2,3,4])` runs without error (proves arpeggio rides existing walker machinery unchanged)
- No mutation of input `FrettedScale` or its `notes` array

---

#### Task Group 6: `inferShapeContext` (detection entry point)

**Dependencies:** Task Group 4 (scoreShapeMatch), Task Group 5 (integration layer established)

- [ ] 6.0 Add `inferShapeContext` plus all supporting types to `src/integration.ts` and wire public re-exports
  - [ ] 6.1 Write focused tests in `src/integration.test.ts` (extends the file created in Task Group 5)
    - **Registry isolation setup:** all inference tests use a `beforeEach`/`afterEach` block that calls `removeAll()` and re-registers exactly the built-in CAGED/3NPS/pentatonic sets (plus any fixture-specific custom shapes); import those sets explicitly (review N-19)
    - **Probe-script gate (ranking fixtures):** before writing assertions for fixtures (a)–(c) and (g), run the probe script (see 6.2) to confirm committed rankings from the real implementation; only after probe confirmation write the hard assertions
    - **Fixture (a) inference direction:** `inferShapeContext(arpeggioResult, { system: "caged" })` where `arpeggioResult` is the `arpeggioFromShape(CAGED_G, "Am7", "C")` result; assert top candidate `shape.name === "G Shape"`, `shapeRoot === "C"`, `anchorFret === 5`, `rootFret === 8`, `breakdown.positionAgreement === 1`, `matchedIntervals` contains `["6M","1P","3M","5P"]` in built-note order; other C-rooted CAGED shapes also present (ambiguity)
    - **Fixture (b) grip detection:** `inferShapeContext("x32010", { system: "caged" })` → top candidate `shape.name === "C Shape"`, `shapeRoot === "C"`, `anchorFret === 0`, `rootFret === 3`, `breakdown.anchorHit === true`; second candidate is A Shape of C with lower score
    - **Fixture (c) E-shape barre:** `inferShapeContext("133211", { system: "caged" })` → top candidate `shape.name === "E Shape"`, `shapeRoot === "F"`, `anchorFret === 0`, `rootFret === 1`, `breakdown.anchorHit === true`
    - **Fixture (f) custom-system inference:** register a custom `ScaleShape` with `system: "myteacher"` (minor-pentatonic intervals on string 0 as root); feed a grip whose notes all lie within it; assert `inferShapeContext(grip, { system: "myteacher" })` returns the custom shape and NOT CAGED shapes; without filter, custom shape and any covering CAGED scale both appear
    - **Fixture (g) ambiguous A major open grip:** `inferShapeContext("x02220", { system: "caged" })` → `result[0].shape.name === "A Shape"`, `result[1].shape.name === "C Shape"`, `result[0].score > result[1].score`; all five A-rooted CAGED shapes present; two consecutive calls return identically ordered results (determinism)
    - **Fixture (h) no-match:** `inferShapeContext([null,13,14,13,null,null])` → `[]`; all-muted `"xxxxxx"` → `[]`; two-PC grip `"x033xx"` → `[]` by min-evidence gate; same two-PC grip with `{ includeWeak: true }` → non-empty
    - Min-evidence gate: probe with 1 distinct PC → `[]`; probe with 2 distinct PCs → `[]`; probe with 3 distinct PCs → candidates (unless no shape covers them)
    - `options.system = "caged"` filters to caged shapes only; non-matching system → `[]`
    - `options.limit = 2` caps output at 2 candidates
    - Invalid limit values: `limit = 0` → no limit (all candidates); `limit = NaN` → no limit; `limit = 1.7` → floor to 1 (B.4)
    - Determinism: two calls with identical input → byte-identical ordered results
    - `FrettedScale` input form (not just grip strings) works for all fixture paths
  - [ ] 6.2 Write the probe script
    - Create `src/arpeggio-probe.ts` (one-off, not committed as a test file — run manually before assertions land)
    - Script calls `inferShapeContext` over fixtures (a)–(c) and (g) and prints ranked candidates with scores and breakdowns
    - Run `npx tsx src/arpeggio-probe.ts` (or equivalent) to confirm committed rankings before hard-asserting them in tests
    - Delete or archive after confirmation (connector precedent)
  - [ ] 6.3 Implement `inferShapeContext` in `src/integration.ts`
    - Export types: `InferenceInput`, `InferenceOptions`, `InferenceCandidate` (per spec Exact API surface)
    - Import: `scoreShapeMatch`, `InferenceProbe` from `./arpeggio`; `all` from `./shape`; `buildFrettedScale` from `./build`; `parseChordFrets` from `./notation`; `noteAt` from `./fretboard`; `Chord` or `Note` from Tonal for chroma arithmetic; `STANDARD` from `./tuning`
    - `extractProbe(input, tuning)`: private helper — normalizes grip or `FrettedScale` to `InferenceProbe` per spec §B.1; grip path uses `parseChordFrets` then `noteAt`; `FrettedScale` path uses declared root first in `rootCandidates`
    - Min-evidence gate: `if (probe.pitchClasses.length < 3 && !options?.includeWeak) return []`
    - Export `findShapeAnchorFret` from `src/build.ts` (currently an unexported function at `src/build.ts:115`) — definitive approach; do not inline-duplicate the logic
    - Candidate enumeration per §B.2: iterate `all()` filtered by `options.system`; for each shape and each root candidate, call `buildFrettedScale`; compute `builtAnchorFret` via the newly-exported `findShapeAnchorFret`; call `scoreShapeMatch`; gate on `score.coverage === 1`; compute `rootFret` (lowest fret of a `"1P"` on `shape.rootString` in built notes)
    - Ranking per §B.4: sort descending by `total`, then ascending `shape.name`, then ascending `shapeRoot` (note-name string compare), then ascending `anchorFret`; apply `limit` (floored, non-positive/NaN → no limit)
    - Return `InferenceCandidate[]`; `[]` when none pass coverage gate or min-evidence gate
  - [ ] 6.4 Wire re-exports in `src/index.ts`
    - Add `export { inferShapeContext } from "./integration"`
    - Add `export type { InferenceCandidate, InferenceOptions, InferenceInput } from "./integration"`
  - [ ] 6.5 Ensure tests pass
    - `npx vitest run src/integration.test.ts`

**Acceptance Criteria:**

- `inferShapeContext` importable from `src/index`
- Probe script confirms committed rankings before hard assertions land (gating condition)
- Fixtures (a)–(c), (f), (g), (h) all pass in their registry-isolated test context
- Min-evidence gate, `includeWeak`, `system` filter, `limit` normalization all verified
- All results are fully deterministic across repeated calls
- `InferenceCandidate` exposes `anchorFret`, `rootFret?`, `matchedIntervals`, `matchedNotes`, `score`, `breakdown` on every result

---

### Output / Formatter Layer

#### Task Group 7: Grouped simultaneous-note rendering in `toAlphaTeX` and `toAsciiTab`

**Dependencies:** Task Group 1 (types), no dependency on inference groups

- [ ] 7.0 Extend both output formatters to accept `FrettedNote[][]` (grouped beats) in addition to `FrettedNote[]`
  - [ ] 7.1 Write focused tests in the existing output test file (or create `src/output/output.test.ts` if absent)
    - **Fixture (i) AlphaTeX grouped:** `toAlphaTeX([[...openCNotes]])` emits `(3.5 2.4 0.3 1.2 0.1)` as the beat (AlphaTeX parenthesized simultaneous-beat syntax; string numbering per existing `stringCount - n.string` convention)
    - **Fixture (i) backward-compat AlphaTeX flat:** existing flat-`FrettedNote[]` call produces byte-identical output to the pre-change formatter; `[]` flat input → same empty output as before
    - **Fixture (i) AlphaTeX option semantics:** with grouped input, `notesPerBar` and `rhythmPattern` index by group (beat), not by individual note; one `rhythmPattern` entry applies to the whole strum
    - **Fixture (i) ASCII tab grouped:** `toAsciiTab([[...openCNotes]])` produces a single chord column across all 6 rows; non-played strings show `-`; column width equals `max fretStr.length` in the group
    - **Fixture (i) ASCII tab two-digit column:** a group containing fret `10` → `colWidth = 2`; single-digit frets in the same group are padded to width 2; non-played strings show `--` (width 2)
    - **Fixture (i) ASCII tab backward-compat flat:** flat `FrettedNote[]` with all single-digit frets → byte-identical output to pre-change formatter
    - Empty inner group `[[]]` in grouped input → rest/blank column: AlphaTeX emits `r`, ASCII tab emits all `-` cells
    - Multi-group input: `[[group1], [group2]]` → two beat columns
    - Single-note group of length 1 in AlphaTeX: no parentheses (same as sequential format)
  - [ ] 7.2 Update `src/output/alphatex.ts`
    - Change signature to `toAlphaTeX(notes: FrettedNote[] | FrettedNote[][], options?: AlphaTexOptions): string`
    - Detection: `Array.isArray(notes[0])` → grouped path; `[]` → flat path (current empty behavior)
    - Normalize flat `FrettedNote[]` to `FrettedNote[][]` of singletons internally so the bar/beat loop runs once
    - Beat emission: group length 1 → `fret.string` (no parens); group length ≥ 2 → `(fret.string fret.string …)` per AlphaTeX simultaneous-beat syntax; empty group → `r` rest
    - Option semantics: `notesPerBar`, `noteDurations`, `rhythmPattern` index by beat (group) index — document in JSDoc (R-5.3)
    - Sequential flat path must produce byte-identical output for all existing test cases (R-5.2)
  - [ ] 7.3 Update `src/output/ascii-tab.ts`
    - Change signature to `toAsciiTab(notes: FrettedNote[] | FrettedNote[][], options?: AsciiTabOptions): string`
    - Same detection and normalization as alphatex
    - Column model per spec §2: for each beat compute `colWidth = Math.max(1, max fretStr.length in group)`; each string row cell is the played fret string left-padded to `colWidth`, or `'-'.repeat(colWidth)` if not played; join cells with `-` separator; empty group → all `-` cells of width 1
    - Flat path for all-single-digit data → byte-identical to pre-change (R-5.2)
  - [ ] 7.4 Update `src/output/index.ts` re-export types if signatures changed (add overloads or update type exports)
  - [ ] 7.5 Ensure tests pass
    - `npx vitest run src/output`

**Acceptance Criteria:**

- `toAlphaTeX` and `toAsciiTab` accept both `FrettedNote[]` and `FrettedNote[][]`; `npm run build` passes
- Fixture (i) AlphaTeX and ASCII tab assertions all pass
- Backward-compat: all pre-existing formatter tests produce byte-identical output
- Multi-digit fret alignment within a chord column verified for both formatters
- Option semantics (beat-indexed) are documented in JSDoc and asserted in tests

---

### Core Logic Layer (Data)

#### Task Group 8: Curated Data Files — `caged-chords-7th`, `open-chords`, `jazz-shells`

**Dependencies:** Task Group 1 (extended `ChordShape` type, `VoicingPatternDictionary`)

- [ ] 8.0 Author and register the three curated chord-shape data files
  - [ ] 8.1 Write build-equivalence tests in `src/data/data.test.ts` (create if absent)
    - **R-4.5 per-shape build tests for `caged-chords-7th`:** for each 7th-chord CAGED shape, `applyChordShape(shape, verificationRoot)` produces notes matching the committed fret layout, where `verificationRoot` is a hardcoded root chosen per form (e.g. `"E"` for E-shape forms, `"A"` for A-shape forms — these movable shapes have no `canonicalRoot` field). At minimum: verify `chordType`, `system`, `voicingFamily` fields are populated and the shape builds without error for both the E-shape and A-shape forms of each type
    - **R-4.5 per-shape build tests for `open-chords` (open shapes):** for each imported open shape, `applyChordShape(shape, shape.canonicalRoot!).frets` equals the source chords-db frets for the documented key (sample: C major open, G major open)
    - **R-4.5 per-shape build tests for `open-chords` (barre shapes):** barre shapes have no `canonicalRoot` — for each, apply a hardcoded verification root (e.g. `"F"` for E-form barres at fret 1, `"Bb"` for A-form barres at fret 1) and assert the produced frets match the expected movable layout at that position
    - **R-4.5 build tests for `jazz-shells`:** for each shell shape, `applyChordShape(shape, "C")` places the 3rd below the 7th (R-7-3) or 7th below the 3rd (R-3-7) as the dictionary specifies; R-7-3 compound interval test (e.g. `10M` voice sits an octave above the 7th)
    - `chordShapes.query({ chordType: "maj7", voicingFamily: "caged" })` returns at least 2 shapes (E and A forms) after all data imports
    - `chordShapes.query({ voicingFamily: "shell", stringSet: [0,1,2] })` returns 4 shell shapes (one per chord type, R-3-7 ordering on strings 654)
    - After importing `open-chords`, at least one shape has `canonicalRoot` set and `voicingFamily === "open"`
    - `SHELL_DICTIONARY` export from `jazz-shells.ts` compiles as `VoicingPatternDictionary`
  - [ ] 8.2 Author `src/data/caged-chords-7th.ts`
    - Format mirrors `src/data/caged-chords.ts` (R-4.4 pattern): `ChordShape` objects with `chordType`, `voicingFamily: "caged"`, `system: "caged"`, `rootString`, `stringSet`, `inversion: 0`, `barres` as needed
    - Coverage: `maj7`, `m7`, `7`, `m7b5` — at minimum E-shape and A-shape forms per type (spec §1); add C/D/G forms where a canonical grip exists
    - Per-string `strings` intervals computed against standard movable diagrams and verified by 8.1 build tests
    - End with `[...].forEach(chordShapes.add.bind(chordShapes))` (R-4.4)
  - [ ] 8.3 Author `src/data/open-chords.ts`
    - Source: one-time manual extraction from tombatossals/chords-db `lib/guitar.json` (MIT) — do NOT commit the JSON blob or add a runtime dependency
    - Coverage: `M, m, 7, maj7, m7, dim, aug, sus2, sus4, m7b5` — open-position shapes for C/A/G/E/D family + E-shape and A-shape movable barre forms per type (spec §2)
    - `-1 → null` normalization; `baseFret` handling: `absFret = baseFret === 1 ? frets[i] : frets[i] + (baseFret - 1)` for non-null frets
    - `strings` intervals derived by computing the interval of each played note from the chord root via `noteAt` and `Note.transpose` (one-time computation at authoring time; values hardcoded as data)
    - Open shapes: `canonicalRoot` set to documented key; `voicingFamily: "open"`, `system: "open"`
    - Barre shapes: `voicingFamily: "barre"`, `system: "barre"`, no `canonicalRoot`
    - File header comment with chords-db attribution (MIT license credit) per spec §2
    - End with `[...].forEach(chordShapes.add.bind(chordShapes))` (R-4.4)
  - [ ] 8.4 Author `src/data/jazz-shells.ts`
    - Export `SHELL_DICTIONARY: VoicingPatternDictionary` keyed by `chordType` alias, values = space-joined interval patterns low→high voice (spec §3):
      - `maj7: ["1P 3M 7M", "1P 7M 10M"]`
      - `m7: ["1P 3m 7m", "1P 7m 10m"]`
      - `"7": ["1P 3M 7m", "1P 7m 10M"]`
      - `m7b5: ["1P 3m 7m", "1P 7m 10m"]`
    - Generate one `ChordShape` per `(chordType, stringSet, ordering)` from the dictionary: string sets `[0,1,2]` (654) and `[1,2,3]` (543); assign each pattern interval to consecutive strings of the set; remaining strings `null`
    - Each shape: `voicingFamily: "shell"`, `system: "shell"`, `stringSet`, `omittedIntervals` (e.g. `["5P"]` for maj7/m7/7 shells, `["5d"]` for m7b5), `rootString` = string carrying `"1P"`, `inversion: 0`
    - End with `[...].forEach(chordShapes.add.bind(chordShapes))` (R-4.4)
  - [ ] 8.5 Wire side-effect imports in `src/index.ts`
    - Add three lines to the side-effect import block (after existing data imports, `index.ts:104-107`):
      ```
      import "./data/caged-chords-7th";
      import "./data/open-chords";
      import "./data/jazz-shells";
      ```
  - [ ] 8.6 Ensure tests pass
    - `npx vitest run src/data/data.test.ts`
    - `npm run build` — confirm all data files compile

**Acceptance Criteria:**

- Three data files created and registered; `npm run build` passes
- All R-4.5 build-equivalence tests pass for representative shapes from each file
- `chordShapes.query` returns correct results for `chordType`, `voicingFamily`, `stringSet` filters across all three data sets
- `SHELL_DICTIONARY` exported from `jazz-shells.ts` and typed as `VoicingPatternDictionary`
- Attribution comment present in `open-chords.ts`
- Pitch-order assumption verified: every curated shape builds correctly through `applyChordShape` without triggering the `fretInWindow` null path

---

### Docs Layer

#### Task Group 9: API Docs and README Update

**Dependencies:** Task Groups 1–8 complete (all public API finalized)

- [ ] 9.0 Document the new public surface
  - [ ] 9.1 Create `docs/api/arpeggios.md`
    - Document the two interval frames (parent-frame vs chord-frame) and why they differ — this is the most important conceptual clarification (R-7.1)
    - `filterChordTones(scale, intervals)` — signature, parameters, parent-frame semantics, return value (empty sentinel behavior), example
    - `arpeggioFromScale(parent, chordName)` and `arpeggioFromShape(shape, chordName, parentRoot, tuning?)` — chroma-based membership, bare-type fallback, partial-arpeggio semantics, canonical Am7→G-shape example
    - `inferShapeContext(input, options?)` — `InferenceInput` forms, `InferenceOptions` fields (including `includeWeak`, `system`, `limit`, `tuning`), `InferenceCandidate` shape (all fields including `breakdown`), min-evidence gate, empty-result convention
    - `ChordShape` harmonic-metadata extension — new optional fields, `canonicalRoot` semantics, `omittedIntervals` role
    - Curated data sets overview — `caged-chords-7th`, `open-chords`, `jazz-shells`; `SHELL_DICTIONARY` format
    - Grouped formatter input — `FrettedNote[][]` form, backward-compat guarantee, option-indexing semantics
    - Note that `scaleType` on an arpeggio result is a source/type label, not a claim of scale-hood (review C-17)
  - [ ] 9.2 Update `README.md`
    - Add "Arpeggios & Chord Detection" section with the canonical `arpeggioFromShape(CAGED_G, "Am7", "C")` example and its output description (Fixture a)
    - Add a strummed-voicing rendering example showing `toAlphaTeX([[...voicingNotes]])`
    - Update API table to include `filterChordTones`, `arpeggioFromScale`, `arpeggioFromShape`, `inferShapeContext`
  - [ ] 9.3 Update `docs/QUESTIONS.md` Q2
    - Note that multi-digit fret alignment is resolved for the chord-column path (R-5.4); the general sequential path misalignment is unchanged and remains tracked (R-7.3)
  - [ ] 9.4 Confirm docs render in site
    - `cd site && npm run dev`; navigate to the API docs section; verify `arpeggios.md` appears and renders without build error

**Acceptance Criteria:**

- `docs/api/arpeggios.md` exists and covers all new public API surface
- README "Arpeggios & Chord Detection" section is present with working examples
- `docs/QUESTIONS.md` Q2 is annotated
- Docs site builds and renders the new page without error

---

### Testing Layer

#### Task Group 10: Test Review and Gap Analysis

**Dependencies:** All earlier task groups

- [ ] 10.0 Final test review and gap fill
  - [ ] 10.1 Audit test coverage against all spec requirement sections
    - Confirm each `R-n` from spec §Specific Requirements has at least one test assertion
    - Confirm all nine fixtures (a)–(i) have committed assertions in the appropriate test file
    - Confirm edge-case table (spec §Edge Cases) is covered: all-muted grip, `<3` PC probe, `includeWeak`, `Chord.get` empty, bare type, enharmonic, chroma collision, duplicate-note grip, slash grip, octave-anchored shape, DROP_D, empty scale to `filterChordTones`, empty formatter input, empty inner group
  - [ ] 10.2 Identify gaps
    - Score determinism: run `inferShapeContext` twice on each fixture — assert array equality by shape name + shapeRoot order
    - Data integrity: `chordShapes.all()` count increases by expected number after each new data file is imported
    - Registry isolation: confirm each inference test file properly calls `removeAll()` in setup and re-registers built-ins
  - [ ] 10.3 Write up to 8 additional strategic tests (only if genuine gaps remain)
    - Priority: determinism, registry isolation, backward-compat formatter, partial-arpeggio semantics
  - [ ] 10.4 Run full suite
    - `npx vitest run src/arpeggio.test.ts`
    - `npx vitest run src/integration.test.ts`
    - `npx vitest run src/output`
    - `npx vitest run src/data/data.test.ts`
    - `npm test` — confirm no regressions in the pre-existing 227 tests

**Acceptance Criteria:**

- All spec test categories have coverage; all nine fixture letters (a)–(i) have assertions
- `npm test` passes with no regressions; total test count increases from 227
- No unrelated test files are modified
- Registry isolation is verified in every inference test

---

## Execution Order

Recommended implementation sequence with parallel opportunities:

1. **Task Group 1: Types** — Foundation; must complete first (ChordShape extension, registry query, VoicingFamily type)
2. **Task Group 2: Module Scaffold** — Must follow Group 1; creates the arpeggio module with stubs
3. **Task Groups 3 and 7 in parallel** — Group 3 (filterChordTones pure logic) and Group 7 (formatter grouped rendering) are fully independent after Group 1; dispatch concurrently
4. **Task Group 4: scoreShapeMatch** — Depends on Group 3 being complete (uses filterChordTones test infrastructure)
5. **Task Groups 5, 8 in parallel** — Group 5 (arpeggioFromScale/arpeggioFromShape) depends on Group 3; Group 8 (curated data) depends on Group 1. Both can proceed concurrently as they touch different files
6. **Task Group 6: inferShapeContext** — Depends on Groups 4 and 5 (scoring + integration established)
7. **Task Group 9: Docs** — After all API-changing groups (1–8) finalize; can start writing prose while Group 6 completes
8. **Task Group 10: Test Review** — Final; runs after all implementation groups

Parallel opportunities called out explicitly:
- Groups 3 and 7 can run simultaneously (pure filter vs formatter — zero shared files)
- Groups 5 and 8 can run simultaneously (integration builders vs data files — different output files, data imports wired at the end of Group 8)

---

## Files to Create

| File Path | Task Group |
| --------- | ---------- |
| `src/arpeggio.ts` | 2, 3, 4 |
| `src/arpeggio.test.ts` | 2, 3, 4 |
| `src/shape.test.ts` | 1 |
| `src/data/caged-chords-7th.ts` | 8 |
| `src/data/open-chords.ts` | 8 |
| `src/data/jazz-shells.ts` | 8 |
| `src/data/data.test.ts` | 8 |
| `src/integration.test.ts` | 5, 6 |
| `src/arpeggio-probe.ts` (temporary — delete after probe confirmation) | 6 |
| `docs/api/arpeggios.md` | 9 |

---

## Files to Modify

| File Path | Task Group |
| --------- | ---------- |
| `src/shape.ts` | 1 |
| `src/index.ts` | 1, 2, 5, 6, 8 |
| `src/build.ts` (export `findShapeAnchorFret`) | 6 |
| `src/integration.ts` | 5, 6 |
| `src/output/alphatex.ts` | 7 |
| `src/output/ascii-tab.ts` | 7 |
| `src/output/index.ts` | 7 |
| `README.md` | 9 |
| `docs/QUESTIONS.md` | 9 |

---

## Technical Notes

### Two Interval Frames — Never Conflate

The spec's central correctness invariant (review Blocker 1, D-011): `FrettedNote.interval` is relative to the parent scale root; `Chord.get().intervals` is relative to the chord tonic. `filterChordTones` (`src/arpeggio.ts`) operates in the parent frame only. `arpeggioFromScale`/`arpeggioFromShape` (`src/integration.ts`) translate chord membership to chroma — frame-safe and enharmonic-safe. The pure tier never sees chord symbols; the integration tier handles all Tonal calls.

### `buildFrettedScale` Anchor Semantics (review Blockers 3 and 4)

`findShapeAnchorFret` in `src/build.ts:115` anchors on the FIRST interval in `shape.strings[shape.rootString]`, not the root interval. For CAGED_E's F major placement: rootString-0 first interval is `7M` = E → anchor at fret 0 (not fret 1). For CAGED_A of A: the A-string first interval `7M` = G# → anchor at fret 11. `inferShapeContext` must compute `anchorFret` from `findShapeAnchorFret` (or equivalent logic) and pass it to `scoreShapeMatch` as `builtAnchorFret`. If `findShapeAnchorFret` is not currently exported from `build.ts`, export it or inline the same lookup logic in the integration tier. `rootFret` is separately computed as the lowest fret among built notes where `interval === "1P"` and `string === shape.rootString`.

### Circular Fret Distance for Position Agreement

Linear fret distance breaks for shapes anchored an octave up (CAGED_A of A at fret 11 vs open position). The scoring formula uses `d = Math.abs(builtAnchorFret - probe.anchorFret) % 12; circularDelta = Math.min(d, 12 - d)`. Fixture (g) is the regression test for this artifact — a linear distance implementation would invert the committed ranking.

### Registry Pattern for Data Files

Every new data file ends with `[...].forEach(chordShapes.add.bind(chordShapes))` — mirror `src/data/caged-chords.ts:57-59`. The three new data files are added to the side-effect import block in `src/index.ts:104-107`. The scale shape registry (`add`/`all`/`removeAll` at `src/shape.ts:78-96`) is separate from the chord shape registry (`chordShapes` at `src/shape.ts:104-123`); inference iterates the scale shape registry (`all()`), not the chord registry.

### Registry Isolation in Inference Tests

Per review N-19, every inference fixture runs with the registry pinned: `beforeEach(() => { removeAll(); /* re-register CAGED + 3NPS + pentatonic explicitly */ })`. Import the named shape constants from `src/data/caged-scales.ts`, `src/data/three-nps.ts`, and `src/data/pentatonic.ts` directly in the test file and call `add()` on each — do not rely on side-effect imports that may change as data grows.

### `scoreShapeMatch` `anchorFret` Parameter

`FrettedScale` does not carry an `anchorFret` field. The integration tier must compute `builtAnchorFret` before calling `scoreShapeMatch`. Definitive approach (Task 6.3): export `findShapeAnchorFret` from `src/build.ts` (currently unexported at `src/build.ts:115`) so the integration tier can call `findShapeAnchorFret(tuning, shape, root.pc, 0)` after each `buildFrettedScale` call. Do not inline-duplicate the anchor logic. Note: `scoreShapeMatch` therefore takes `builtAnchorFret: number` as a fifth parameter — a deliberate extension of the spec's formal 4-parameter signature (the spec's R-6.1 re-export block also omits `ScoreBreakdown`, which the tasks correctly re-export per the spec's Quality Criteria / review S-11; both divergences are intentional resolutions of spec inconsistencies).

### Formatter Detection Idiom

`Array.isArray(notes[0])` distinguishes grouped from flat input. The `[]` (empty flat array) case: `notes[0]` is `undefined`; `Array.isArray(undefined) === false`, so empty input takes the flat path and reproduces current behavior — no special case needed (review S-12). Document this contract in both formatter function JSDoc comments.

### `omittedIntervals` and the Round-Trip Alias Rule (R-2.5)

`chordType` names the harmonic function; `Chord.get(chordType).intervals` is the full chord interval set. A shell voicing omits intervals (e.g. `"5P"` for maj7 shell); this does not violate the alias rule — `omittedIntervals` explicitly declares what is absent. The alias rule is: `chordType` round-trips through `Chord.get()` as a recognizable chord, not that the stored intervals equal `Chord.get(chordType).intervals` exactly. The `SHELL_DICTIONARY` entries are the voicing patterns, not the full chord interval sets.

### `stringSet` Array Equality in `chordShapes.query`

`stringSet` matching is order-sensitive exact equality (`JSON.stringify([0,1,2]) === JSON.stringify([0,1,2])`). Low-to-high pitch ordering is the convention: string set "654" = `[0,1,2]` (indices of strings 6, 5, 4 in 0-based low-string-first notation); string set "543" = `[1,2,3]`.
