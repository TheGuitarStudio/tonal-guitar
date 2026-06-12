# Research: Arpeggio & Chord Shapes — Detection and Fingerings

**Date:** 2026-06-12 | **Issue:** #16

Merged output of three Phase 1 research agents: codebase research, product research, and an
external domain survey (the issue is explicitly research-first, so a third agent surveyed
existing voicing libraries, pedagogy, and the derive-vs-curate question).

---

## Codebase Research

### Types and Data

**`FrettedNote`** (`src/shape.ts:10-20`) carries `string`, `fret`, `note`, `pc`, `interval`,
`scaleIndex`, `degree`, `intervalNumber`, `midi`. The `interval` field (interval from root,
e.g. `"3M"`) is exactly what chord-tone filtering needs: filtering `FrettedScale.notes` by
interval membership (e.g. `["1P","3m","5P","7m"]` for m7) directly yields an arpeggio subset.
**No changes to `FrettedNote` are required for arpeggios.**

**`ScaleShape`** (`src/shape.ts:22-28`) uses `strings: (string[] | null)[]` — multiple
intervals per string. The `system` field is an open string with no enforcement — pluggable
pattern systems already work this way.

**`ChordShape`** (`src/shape.ts:30-44`) uses `strings: (string | null)[]` — strictly one
interval per string — plus `fingers`, `barres`, `rootString`. It **cannot represent**
voicing-family metadata: no `chordType` field, no `inversion`, no `voicingFamily`, no
string-set identity. Adequate for single-root movable shapes only.

**`Fingering`** (`src/build.ts:240-246`) — output of `applyChordShape`: purely geometric
(positions, frets, root, shapeName, startFret), no harmonic metadata.

**Built-in data:**

| File | Contents | Notes |
| ---- | -------- | ----- |
| `src/data/caged-scales.ts` | 5 CAGED major scale shapes | Foundation for chord-tone filtering |
| `src/data/caged-chords.ts` | 5 major-triad chord shapes (`1P 3M 5P` only) | The **entire** curated chord library — no minor, 7th, dim, aug |
| `src/data/three-nps.ts` | 7 shapes, 3 intervals/string | Mode names are positional labels (QUESTIONS.md Q4) |
| `src/data/pentatonic.ts` | 5 boxes, major pentatonic | |

**Registry pattern** (`src/shape.ts:70-123`): parallel scale/chord registries
(`add`/`get`/`all`/`names`/`removeAll`), global singletons keyed by name, registered as
side-effects in `src/index.ts:104-107`. Any caller can `add()` a shape with an arbitrary
`system` string — **teacher-custom pattern systems are fully extensible today**;
`modeShapes()` already accepts a `shapeSystem` filter.

### Pure-Function Primitives

- **`buildFrettedScale`** (`src/build.ts:160-234`): already works for any interval set — a
  `ScaleShape` containing only chord-tone intervals builds correctly. Caveat: it assumes each
  string's interval array is in pitch order; drop-2/3 voicings that place a voice "out of
  register" need testing against `fretInWindow`.
- **`applyChordShape`** (`src/build.ts:253-283`): wraps `buildFrettedScale` (one interval per
  string → single-element arrays). Curated-shape path only; no algorithmic generation.
- **Walker** (`src/walker.ts`): `walkShape` (:22), `walkShapeMotif` (:51), `walkPattern`
  (:103) all treat any `FrettedScale` as a sequence source. A chord-tone-filtered
  `FrettedScale` produces arpeggio exercises **through the existing walker/sequence machinery
  unchanged**. `walkShapeMotif` with `[1,3,5]` / `[1,3,5,7]` already produces rudimentary
  arpeggio exercises over full scale shapes today.
- **Sequence engine** (`src/sequence.ts`): `applySequence`/`flattenSequence` work unchanged.
- **Fretboard math** (`src/fretboard.ts`): `findNote`, `findNearestFret`,
  `findFretInPosition` (:82, takes `referenceFret` + `span`) are the primitives for
  algorithmic voicing search; `fretboard()` (:169) supports brute-force enumeration.
- **Connector** (`src/connect.ts`): operates on note positions/midi only — works against
  arpeggio `FrettedScale`s without modification.

**Key insight:** the one missing core primitive is the **chord-tone filter** —
`FrettedScale` + chord intervals → chord-tone `FrettedScale`. Everything downstream
(walker, sequences, connector, formatters-for-sequences) composes with it unchanged.

### Integration and Tonal Gap

`src/integration.ts` uses only `Chord.detect()` (via `identifyChord`, :79-99). **Not used
yet:** `Chord.get(name)` (returns `intervals`, `type`, `tonic`, `chroma` — the data source
for chord-tone filtering), `Chord.chordScales()` (compatible scales — useful for shape
inference), `Chord.degrees()`. `isShapeCompatible` (:167) is subset-logic that shape
inference needs applied in reverse. `buildFromScale` (:26) is the only path that populates
`scaleType`/`scaleName`.

`@tonaljs/voicing` + `@tonaljs/voicing-dictionary` + `@tonaljs/voice-leading` exist in the
Tonal ecosystem but are **not in `package.json`** — they'd be new optional peer deps if used.

### Output Formatters

- For **arpeggio sequences** (sequential notes): both `toAlphaTeX` and `toAsciiTab` work
  unchanged.
- For **strummed chord voicings** (simultaneous notes): neither formatter can render them —
  both treat every `FrettedNote` as a sequential event. Would require a grouped input shape
  (`FrettedNote[][]` per beat). Meaningful interface change; scope decision needed.

### Public API Fit

Conventions: named exports, pure functions, `NoXxx` sentinels. A
`voicings('Cmaj7', { near: 5, family: 'drop2' })`-style API fits, but needs: a result type
richer than `Fingering` (chordType/inversion/voicingFamily), a query layer (the flat
name-keyed registry can't serve symbol+parameter queries), and new optional peer deps. **No
type-level refactoring is needed for arpeggios** — an arpeggio is structurally a filtered
`FrettedScale`. Chords-as-voicings may warrant their own result type.

### Lab and Docs Surface

- `PipelineBuilder.tsx:67-79` MOTIFS already includes "Triads (1,3,5)" and "Sevenths
  (1,3,5,7)" — chord-tone motifs over scale shapes, with no chord-type selection step or
  arpeggio shape context.
- `PipelineRecipe` (`codeGen.ts:36-51`) has no chord-type field; an arpeggio mode is additive.
- `ShapeStep.tsx:12-17` groups by name prefix — new systems fall into "Other" unless extended.
- `docs/design.md:29` sketched an `arpeggios.ts` data file that was never built;
  `docs/research.md:64` lists drop-2/3/inversions as research topics;
  `docs/chord-formats-research.md` already documents the chords-db-style format the current
  `ChordShape` mirrors.
- No experiments prototyped arpeggio/voicing behavior beyond `api-sketch.test.ts:175-252`
  (applyShape for chords, chord identification — both already implemented).

### Key Gaps Summary

| Gap | Severity |
| --- | -------- |
| No chord-tone filter (`FrettedScale` → chord-tone subset) | Critical |
| `Chord.get()` not used for interval lookup | Critical |
| `ChordShape` lacks `chordType` / `inversion` / `voicingFamily` | High |
| Only 5 major-triad shapes in chord registry | High |
| Formatters can't render simultaneous notes | High |
| No `@tonaljs/voicing*` deps for algorithmic voicing generation | High |
| Shape inference algorithm undefined | High |
| `scaleType`/`scaleName` empty unless `buildFromScale` used | Medium |
| No curated arpeggio data (sweep shapes etc.) | Medium |
| Lab `PipelineRecipe` has no chord-type field | Medium |

### Suggested Code Placement

| New code | Module | Tier | Rationale |
| -------- | ------ | ---- | --------- |
| `filterChordTones(scale, intervals)` | new `src/arpeggio.ts` (or `build.ts`) | Zero Tonal deps | Pure array ops on existing `FrettedNote` fields |
| Algorithmic voicing search | new `src/voicing.ts` | Required peer deps | Composes `fretboard.ts` + `shape.ts` math |
| `arpeggioFromShape(shape, chordName, root, tuning?)` | `src/integration.ts` | Optional peer deps | Needs `Chord.get()` |
| `voicings(chordName, options)` | `src/integration.ts` (or `voicing.ts`) | Optional peer deps | Needs `@tonaljs/chord` (+ possibly `@tonaljs/voicing`) |
| `inferShapeContext(arpeggio, system?)` | `src/integration.ts` | Optional peer deps | Modal reasoning via `relatedScales`/`modeShapes` |
| Curated sweep arpeggios / jazz shells | `src/data/*.ts` | Zero deps | Same `add()` registration pattern |

---

## Domain Research (External Survey)

### Library Survey

| Library | License | Model | Useful? |
| ------- | ------- | ----- | ------- |
| `@tonaljs/voicing` + `voicing-dictionary` + `voice-leading` | MIT | Curated interval-pattern dictionary + range expansion + voice-leading pick. **Not guitar-aware** (no strings/frets/span) | Partially — dictionary format and voice-leading logic reusable; needs guitar-specific string-by-string search |
| felixroos/harmonical (+ jazzband notes) | unspecified | Combinatorial generation with **prune-while-building** constraint propagation (92-98% fewer calls than brute force) | Partially — the right algorithm family; replace "adjacent voices" with "adjacent strings" |
| tombatossals/chords-db | MIT | Fully curated JSON: 12 keys × 89 suffixes × 3-5 voicings; `{frets, fingers, baseFret, barres, capo, midi}` | Yes — near-exact match for `ChordShape`; selective import for open-position/barre canon. No drop voicings, no inversion labels |
| hyvyys/chord-fingering | **GPL-3.0** | Hybrid: 111 chord types, enumeration + barre detection + difficulty score, inversions via `bass` param | Reference architecture only — license blocks code reuse |
| osteele/tonic.ts | MIT | `allFrettings()` enumeration; sorts by open strings, compactness, barres | Partially — good playability heuristics; implement ourselves |
| joelle-o-world/fretboard-js | unspecified | `HandPosition` playability model: ≤4-fret span, no finger crossing, ≤2-fret adjacent stretch | Partially — the most formal playability constraint spec found |
| greird/chordictionaryjs | MIT | Tab string ↔ chord name | No — overlaps existing `identifyChord` |
| naiquevin/GuitarJs | MIT | Enumeration, 4 chord types | No — too limited, unmaintained |

### Algorithmic Voicing Generation (consensus algorithm)

1. Enumerate candidate frets per chord tone per string within a window
2. Assign one note per string
3. Hard constraints: fret span ≤4-5, ≤4 fingers, no finger crossing, adjacent fingers ≤2
   frets, barre detection (same fret across strings frees fingers)
4. Score survivors: prefer open strings, compact clusters, minimal movement from previous
   position (voice leading)
5. Optional-interval omission for 5+-tone chords (drop the 5th first, then 11th)

Prune-while-building (validate at each assignment step) is essential for tractability.

### Drop/Shell Families: Fully Derivable

- **Drop 2**: close-position stack → drop 2nd-highest note an octave. 4 inversions × string
  sets 6543/5432/4321. Fret positions are **fully computable** from interval formula +
  tuning math (the B-string offset falls out of the fretboard math automatically).
- **Drop 3**: drop 3rd-highest; spans 5 strings with an inherent string skip (6542, 5431).
  Derivable.
- **Drop 2+4**: derivable; one viable 6-string layout.
- **Shells (1-3-7)**: trivially derivable on string sets 654/543, both orderings (R-3-7,
  R-7-3).

GuitarLayers confirms empirically that drop voicings + inversions across string sets are
auto-generated from chord structures. **Derivation is the right architecture for these
families.**

### Arpeggio Pedagogy: Derivation Thesis Confirmed (one exception)

- **CAGED arpeggios** are taught as chord-tone subsets of CAGED scale positions (Jens
  Larsen: "the arpeggios are derived from these scale positions"). Derivable.
- **3NPS arpeggios**: same — chord-tone subsets of 3NPS positions. Derivable.
- **Sweep-picking shapes are the exception**: 1-note-per-string forms whose note selection
  deviates from scale-position geometry. **Require curation** (separate `system: "sweep"`
  data file).
- Advanced pedagogy (position-shifting arpeggios, upper-structure arpeggios) is expressible
  via existing shape + walker infrastructure.

### Shape Inference Precedents

**No open-source implementation of CAGED-shape classification was found** — this is novel
implementation territory. The algorithm is derivable from first principles: root
string/fret + interval pattern uniquely identifies the CAGED form for canonical shapes
(E-shape root on 6/1, A-shape on 5, G-shape on 6/1, C-shape on 5/2, D-shape on 4).
Ambiguity exists for non-standard voicings. The codebase chain
`buildFromScale` → shape already encodes chord-root → scale → position in the forward
direction; inference is the inverse. (`fretboard-ui/src/modes.ts:14-15` already notes the
chord-quality → CAGED-shape family mapping as a planned enhancement.)

### Data Import Recommendation

Import **selectively from chords-db (MIT)**: open-position + standard barre shapes for core
types (maj, min, 7, maj7, m7, dim, aug, sus2, sus4, m7b5) via a one-time extractor into the
existing data-file format (−1 → null). Do **not** import the full 89-suffix set (bloat;
let the engine derive extended types). No other database recommended (GPL or too limited).

### Recommended Derive-vs-Curate Boundary

**Curate** when the shape exploits open strings in a tuning-dependent way, is a
technique-specific form (sweep), or is a pedagogically canonical selection (standard jazz
shell grips as a named subset of valid derivations):

1. Open-position "cowboy chords" (source: chords-db)
2. Sweep-picking arpeggio shapes (`data/sweep-arpeggios.ts`)
3. Canonical jazz shell grips (`data/jazz-shells.ts` — derivable, but the canon is a curated selection)

**Derive** everything that follows from a formal interval-manipulation rule:

1. CAGED-position arpeggios (chord-tone filter on existing `caged-scales.ts`)
2. 3NPS-position arpeggios (filter on `three-nps.ts`)
3. Drop-2 (4 inversions × 3 string sets), drop-3 (× 2 sets), drop-2+4
4. Shell voicings
5. All closed-position inversions on any 4-string set (enumeration + constraints)
6. Position-system arpeggios for all chord types (maj7, m7, dom7, m7b5, dim7, …)

### Resources to Study in Shape Phase

1. felixroos/jazzband `notes/voicings.md` — prune-while-building constraint algorithm
2. `@tonaljs/voicing-dictionary` `data.ts` — chord-type coverage + interval-pattern format
3. chords-db `lib/guitar.json` — confirm which shapes are genuinely open-string-dependent
4. chord-fingering source — constraint values and scoring (reference only; GPL)
5. fretboard-js `HandPosition` — formal playability constraints
6. KTH 2013 paper "Putting a Finger on Guitars and Algorithms" — weighted fingering transitions
7. jazzguitar.be drop-2 walkthrough — verification fixtures for derived drop-2 positions

### Open Questions Unanswerable from Public Sources

1. Exact playability-score weighting (barre cost/benefit, stretch penalties) — needs
   empirical testing against known shapes
2. Barre detection threshold, esp. partial barres
3. Optional-interval omission hierarchy for extended chords (5th first, then 11th — but no
   authoritative full hierarchy)
4. Canonical sweep-shape set scope (3/5/6-string forms; triads vs. 7ths)
5. CAGED classification for non-standard voicings (ambiguous by nature)

---

## Product Research

### Roadmap Alignment

**Alignment: Strong** (completing the original design, not a new direction).

No formal `docs/product/` files exist; product narrative lives in `docs/PLAN.md`,
`docs/design.md`, `docs/DOCS_EPIC.md`, `CLAUDE.md`. `docs/design.md` goal 1: "Provide a
functional, composable API for guitar shapes (chords, scales, arpeggios)" — arpeggios were
first-class in the original design and never implemented (`design.md` sketched
`arpeggios.ts`; `PLAN.md` Epic 6.3 documented `identifyChord`). This feature is the
harmonic counterpart to the implemented melodic/sequence engine.

### Related Specifications

| Document | Relevance |
| -------- | --------- |
| `.tonal-guitar/features/connector-algorithm/` (#2, PR #4) | Complete, pending merge. `connectSequences` is shape-source-agnostic — works on arpeggio `FrettedScale`s unmodified |
| `.tonal-guitar/features/connector-lab-integration/` (#5) | Complete (all 4 task groups, user-validated). Pattern precedent: library feature first, Lab integration as separate follow-up feature |
| `docs/chord-formats-research.md` | Already identifies chords-db format as "most practical"; current `ChordShape` mirrors it |
| `docs/QUESTIONS.md` Q1-Q4 / issues #13-#15 | Maintenance follow-ups from connector review; no conflict with this feature |

**Sequencing:** the raw idea gated implementation on connectors landing. Both connector
features are functionally complete — **the stated dependency is met** (implementation can
begin once PR #4 merges and this branch rebases).

### User Context

The Lab today is a melodic-exercises engine only. Concretely missing per persona:
guitarists can't get "Cmaj7 arpeggio, E shape, position 5" exercises; developers can't
discover voicings by chord symbol (must know the registry shape name); students can't ask
"which chords live inside this shape" (`isShapeCompatible` goes the other direction);
teachers can't tie chord/arpeggio material to custom pattern systems; advanced players have
no drop-2/inversion material. The MOTIFS dropdown's "Triads/Sevenths" entries practice
chord tones with no connection to actual voicings or positions.

### Scope Assessment

**Recommended decomposition (XL → sub-features):**

| Sub-feature | Description | Assessment |
| ----------- | ----------- | ---------- |
| **A. Arpeggio derivation from scale shapes** | Chord-tone filter + `arpeggioFromShape`; rides existing walker/sequence machinery | Core MVP — highest leverage, minimal new code |
| **B. Voicing lookup engine** | `voicings('Cmaj7', {near, family})` — generation + query layer | Separate effort; needs the derive/curate research above |
| **C. Shape inference** | chord/arpeggio → parent shape in a pattern system | Separate effort; novel algorithm, needs formal model (probe-first like connector research) |
| **D. Curated shape library** | 7th-chord `ChordShape` data, sweep arpeggios, shells, selective chords-db import | Bounded data work; scope depends on A/B outcomes |
| **E. Lab integration** | Chord-type step in pipeline, arpeggio mode | Always a separate follow-up feature (connector precedent) |

**MVP recommendation:** Sub-feature A + foundational 7th-chord shape data (maj7, m7, dom7,
m7b5 per CAGED position). B, C, D as follow-ups; E always separate.

**Out of scope (this feature):** Lab UI (separate feature), strummed-chord formatter
rendering (unless required by chosen scope), full chords-db import.

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
| --------------- | -------- | ---------- |
| Shape inference has no precedent — novel algorithm, ambiguous for non-canonical voicings | High | Formal model + worked test fixtures before implementation (connector probe-first precedent) |
| `ChordShape` type can't express voicing families/inversions | High | Type extension or new `VoicingShape` type — decide in Shape phase before any data curation |
| `buildFrettedScale` pitch-order assumption may break out-of-register drop voicings | Medium | Probe-test `fretInWindow` with drop-2 layouts early |
| `@tonaljs/voicing*` not yet a dependency; piano-centric — may not pay its way | Medium | Evaluate dictionary format vs. building guitar-native search; optional-peer-dep pattern exists |
| Formatters can't render simultaneous notes | Medium | Scope decision: arpeggios (sequential) need nothing; defer chord rendering or scope explicitly |
| chord-fingering is GPL-3.0 | Low | Reference architecture only; never copy code |
| Implementation gated on connector PR #4 merge + rebase | Low | Research/spec proceed now; rebase before implement |
| Playability scoring has no authoritative formula | Medium | Empirical fixtures from known playable/unplayable shapes; jazzguitar.be drop-2 diagrams as verification data |

## Open Questions (for Shape Phase)

1. **Scope cut:** Does this feature ship sub-feature A only (arpeggio derivation MVP), or
   A + parts of B/C/D? The issue is XL and decomposes cleanly.
2. **Voicing engine architecture:** guitar-native string-by-string search (prune-while-
   building) vs. adapting `@tonaljs/voicing` note-set output via `fretFor`? New peer deps?
3. **Type design:** extend `ChordShape` (chordType/inversion/voicingFamily/stringSet) vs.
   new `VoicingShape`/`ArpeggioShape` types? What's the result type for `voicings()` (a
   richer `Fingering`)?
4. **Shape inference formal model:** exact algorithm for chord/arpeggio → parent shape
   (root-string anchor matching? interval-subset scoring across registered shapes?), and
   the rule for non-major scales (harmonic/melodic minor, symmetric) where CAGED labels
   blur.
5. **Derive/curate data plan:** which curated files ship (sweep arpeggios? jazz shells?
   selective chords-db import?) and in what order?
6. **API naming:** `arpeggioFromShape` / `filterChordTones` / `voicings` /
   `inferShapeContext` — final names and module homes (new `src/arpeggio.ts` +
   `src/voicing.ts` vs. folding into `build.ts`/`integration.ts`)?
7. **Chord rendering:** is simultaneous-note output (strummed voicings in AlphaTeX/ASCII
   tab) in scope at all, or strictly deferred?
8. **Lab recipe forward-compatibility:** should the library API be designed so
   `PipelineRecipe` can add a chord-type step without breaking codeGen (even though Lab
   work is a separate feature)?
