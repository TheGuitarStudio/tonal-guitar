# Specification: Arpeggio & Chord Shapes — Detection and Fingerings

**Phase:** 2 (Shape) | **Issue:** #16 | **Date:** 2026-06-12 (rev 2, post external review)
**Builds on:** `research.md`, `requirements.md`, `decisions.md` (D-001..D-012), `deferred.md`
**External review:** `reviews/spec-review.md` (Codex) — all 4 blockers and 8 should-fixes incorporated; see Review Changelog at the end.

This spec is the contract Phase 3 (Plan) and Phase 4 (Implement) work against. Anything not specified here is undefined behavior. It follows the connector-algorithm spec's house style: formal algorithms with committed worked fixtures that become Phase 4 test assertions.

---

## Goal

Give `tonal-guitar` first-class, Tonal-aligned support for **arpeggios** (chord-tone subsets of scale shapes) and **chord-shape detection** (mapping a grip or arpeggio back to the parent pattern shape it lives in), plus the **minimal curated fingering data** those capabilities need. Specifically:

1. **Arpeggio derivation (A).** A pure interval filter (`filterChordTones`) plus integration-tier builders (`arpeggioFromScale`, `arpeggioFromShape`) that separate the **parent scale context** (e.g. C major, G-shape) from the **target chord** (e.g. Am7) and match chord membership by **chroma** — so relative/diatonic arpeggios (Am7 inside C major) work, not just tonic chords. Derived arpeggios flow through the existing walker / sequence / connector machinery unchanged.
2. **Shape inference / detection (C).** A formal, registry-driven, scale-agnostic algorithm that takes a fret-array grip or a `FrettedScale`/arpeggio and returns a ranked, scored list of candidates with a transparent score breakdown; empty array = no match.
3. **Minimal curated data (D).** 7th-chord CAGED `ChordShape`s, a selective chords-db import of open-position + standard-barre core types, and jazz shell grips on string sets 654/543, all using a Tonal-aligned harmonic-metadata extension of `ChordShape` and the voicing-dictionary interval-pattern FORMAT.
4. **Simultaneous-note rendering.** Both `toAlphaTeX` and `toAsciiTab` render grouped (strummed) chord voicings, in addition to their current sequential behavior.

Out of scope: the voicing generation engine (B), Lab UI (E), sweep arpeggios, full chords-db import, any new peer dependency, grip→`ChordShape` classification, diatonic-degree sugar API. See **Out of Scope**.

---

## User Stories

- **As a guitarist**, I can take a CAGED or 3NPS scale shape and get the maj7 / m7 / dom7 / m7b5 arpeggio that lives inside it, then run it through the walker/sequence engine as an exercise.
- **As a guitarist**, I can ask for the **Am7 arpeggio inside the C-major G-shape** (relative/diatonic, not just tonic chords) and get the right chord tones with their parent-scale context intact.
- **As a student holding a chord** (e.g. `x32010`), I can ask "what shape is this and what root?" and get a ranked answer (C major, C-shape, open position) with a score breakdown I can inspect.
- **As a student playing an arpeggio** (Am7 rooted on the 6th string, 5th fret), I can ask "which scale shape does this live in?" and learn it is the G-shape of C major — and see the ranked alternatives.
- **As a teacher with a custom pattern system**, I can register my own `ScaleShape`s and have inference classify grips/arpeggios against them with no code change — CAGED and 3NPS are just registered data, not special cases.
- **As a developer**, I can render a strummed voicing to AlphaTeX or ASCII tab as a chord (simultaneous notes), not only as a sequence.
- **As a future maintainer of the voicing engine (B)**, I have a stable curated-dictionary format, a `voicingFamily` vocabulary, and registry-query needs already defined to build on.

---

## Tonal Alignment

Per D-009 ("we are a tonal extension essentially"), field names and values align with Tonal.js. Findings from `@tonaljs/chord`, `@tonaljs/chord-type`, and `@tonaljs/voicing-dictionary`:

### `Chord.get(name)` output shape (the interval source for arpeggios)

`Chord.get()` returns a `Chord` (which extends `ChordType`), with `NoChord` as the empty sentinel (`empty: true`). Fields this feature consumes:

| Field | Type | Use here |
| --- | --- | --- |
| `empty` | `boolean` | Guard — treat truthy as no-match → empty result |
| `intervals` | `string[]` | **Primary** — e.g. `["1P","3m","5P","7m"]` for m7; transposed from the chord tonic to chromas for membership tests |
| `aliases` | `string[]` | Canonical chord-type alias vocabulary (see below) |
| `quality` | `string` | `"Major" \| "Minor" \| "Augmented" \| "Diminished" \| "Unknown"` — optional metadata |
| `tonic` | `string \| null` | Chord root when the name carries one (e.g. `Chord.get("Am7").tonic === "A"`); falls back to the parent root for bare types |
| `type` | `string` | Canonical type name, e.g. `"minor seventh"` |
| `name` | `string` | Full display name |

The interval strings are exactly the `interval` format already used by `FrettedNote.interval` and `ScaleShape.strings` (`"1P"`, `"3M"`, `"3m"`, `"5P"`, `"5d"`, `"7M"`, `"7m"`, `"5A"`…).

**Two interval frames exist and must never be conflated** (external review Blocker 1): `FrettedNote.interval` is relative to the **parent scale root**; `Chord.get().intervals` is relative to the **chord tonic**. They coincide only for tonic chords. Therefore:
- `filterChordTones` (pure) filters by **parent-frame interval strings** — callers supply parent-frame sets (e.g. `{6M,1P,3M,5P}` for Am7-in-C).
- `arpeggioFromScale` / `arpeggioFromShape` (integration) translate the chord to **chromas** (tonic + chord intervals → pitch-class chromas) and filter by chroma, so chord-frame inputs work against any parent context.

### Chord-type alias vocabulary (adopted verbatim for any `chordType` field)

We adopt Tonal's `@tonaljs/chord-type` **first short alias** as the canonical value of our `chordType` field, so a round-trip through `Chord.get(chordType)` is lossless:

| Quality | `chordType` (our field) | Intervals (Tonal) | Other Tonal aliases |
| --- | --- | --- | --- |
| Major triad | `"M"` | `1P 3M 5P` | `^`, `maj` |
| Minor triad | `"m"` | `1P 3m 5P` | `min`, `-` |
| Major seventh | `"maj7"` | `1P 3M 5P 7M` | `Δ`, `ma7`, `M7`, `^7` |
| Minor seventh | `"m7"` | `1P 3m 5P 7m` | `min7`, `mi7`, `-7` |
| Dominant seventh | `"7"` | `1P 3M 5P 7m` | `dom` |
| Half-diminished | `"m7b5"` | `1P 3m 5d 7m` | `ø`, `-7b5`, `h7`, `h` |
| Diminished | `"dim"` | `1P 3m 5d` | `°`, `o` |
| Augmented | `"aug"` | `1P 3M 5A` | `+`, `+5` |

Rule (R-2.5): the canonical stored value is the alias such that `Chord.get(chordType).empty === false` and `Chord.get(chordType).intervals` equals the shape's chord-tone set **minus any intervals declared in `omittedIntervals`** (shells legitimately omit the 5th — review S-9). `chordType` names the intended harmonic function; `omittedIntervals` records what the voicing leaves out. We standardize on `M, m, maj7, m7, 7, m7b5, dim, aug` for the curated data.

### Voicing-dictionary interval-pattern FORMAT (adopted, dependency NOT taken — D-002)

`@tonaljs/voicing-dictionary` shape is `VoicingDictionary = { [symbol: string]: string[] }`, mapping a chord-type symbol to an array of **space-joined interval-pattern strings**, e.g.:

```
m7:   ["3m 5P 7m 9M", "7m 9M 10m 12P"]
"^7": ["3M 5P 7M 9M", "7M 9M 10M 12P"]
m7b5: ["3m 5d 7m 8P", "7m 8P 10m 12d"]
"7":  ["3M 6M 7m 9M", "7m 9M 10M 13M"]
```

We adopt this exact format for our curated **shell dictionary** (`src/data/jazz-shells.ts`): a `VoicingPatternDictionary = Record<string, string[]>` keyed by our `chordType` alias, values = space-joined interval-pattern strings ordered **low voice to high voice** (the order in which they sit on ascending string sets). We do **not** import the package; the format is reproduced as plain data. Shell patterns use compound intervals (`10M`, `12P`) where a voice sits an octave up, matching the dictionary convention.

---

## Specific Requirements

Requirements are grouped by the adapted stack layers and numbered `R-n` for Phase-3 coverage tracking.

### Layer 1 — Types & Registry (`src/shape.ts`)

- **R-1.1 `ChordShape` harmonic-metadata extension.** Extend `ChordShape` with OPTIONAL fields so its original geometric intent (D-009) remains fully usable (every existing field stays; existing shapes in `caged-chords.ts` need no change):
  ```ts
  export interface ChordShape {
    name: string;
    system: string;                 // "caged" | "shell" | "open" | "barre" | custom
    strings: (string | null)[];     // one interval per string (unchanged)
    fingers: (number | null)[];
    barres: Barre[];
    rootString: number;
    // --- new optional harmonic metadata (D-009) ---
    chordType?: string;             // Tonal chord-type alias: "maj7" | "m7" | "7" | "m7b5" | "M" | ...
    inversion?: number;             // 0 = root position, 1 = 1st inv (bass = 3rd), 2, 3...
    voicingFamily?: VoicingFamily;  // see R-1.2
    stringSet?: number[];           // 0-based PLAYED string indices only (muted excluded), ascending
                                    //   low→high pitch: set "654" = [0,1,2]; set "543" = [1,2,3]
    omittedIntervals?: string[];    // chord-frame intervals the voicing intentionally omits (e.g. ["5d"] for shell m7b5)
    canonicalRoot?: string;         // for concrete (non-movable) imported open shapes: the documented key, e.g. "C"
    baseFret?: number;              // for imported open/barre data: lowest fretted fret of the canonical diagram (informational)
  }
  ```
  All new fields are settable as plain data (Lab forward-compat, D-009). `applyChordShape` ignores them (geometry unchanged): applying an open shape to a root other than `canonicalRoot` is **supported** and yields the transposed (no-longer-open) fingering — `canonicalRoot` records where the diagram is canonical, it does not restrict use (review S-10).

- **R-1.2 `VoicingFamily` vocabulary (frozen for B — D-010).** Add a string-literal union; only `"caged"` and `"shell"` are produced by this feature plus `"open"`/`"barre"` from the import, the rest are reserved extension points for B:
  ```ts
  export type VoicingFamily =
    | "caged"     // CAGED-position grips (this feature)
    | "shell"     // jazz shell grips (this feature)
    | "open"      // open-position cowboy chords (chords-db import)
    | "barre"     // standard movable barre (chords-db import)
    | "drop2" | "drop3" | "drop2+4"  // reserved for B (not produced here)
    | "sweep";    // reserved for deferred sweep data
  ```

- **R-1.3 `VoicingPatternDictionary` type (frozen format for B — D-002/D-010).**
  ```ts
  export type VoicingPatternDictionary = Record<string, string[]>;
  // key: Tonal chord-type alias ("maj7"); value: space-joined interval patterns, low→high voice
  ```

- **R-1.4 Chord-shape registry query extension.** The existing `chordShapes` registry (`shape.ts:104-123`) keeps `get/all/names/add/removeAll`. Add ONE query method (the registry-query need B will reuse — D-010), implemented as a pure filter over `all()`:
  ```ts
  // Added to the chordShapes object:
  query(filter: { chordType?: string; system?: string; voicingFamily?: VoicingFamily; stringSet?: number[] }): ChordShape[]
  ```
  Matching is conjunctive; `stringSet` matches by exact array equality (order-sensitive). Omitted filter keys match everything. No new global state; pure derivation from the dictionary.

- **R-1.5 No new `FrettedNote` field.** Arpeggios reuse `FrettedNote.interval`; confirmed sufficient by research. No change to `FrettedNote`.

### Layer 2 — Core Logic, pure tier (zero Tonal deps) — `src/arpeggio.ts` (new)

- **R-2.1 `filterChordTones(scale, intervals)`** — pure, zero-Tonal-dep, **parent-frame** interval filter (see Tonal Alignment frame rule). Filters a `FrettedScale`'s notes to those whose `interval` is in the given set, preserving order, returning a new `FrettedScale`. See **Algorithms §A.1**.

- **R-2.2 Determinism & purity.** No mutation of the input scale or its notes; returns a fresh object with a fresh `notes` array. Never throws; bad input → `NoFrettedScale`-shaped empty result (R-2.3).

- **R-2.3 Empty-result sentinel.** If the filter removes every note, return a `FrettedScale` with `empty: true`, `notes: []`, preserving `root/tuning/shapeName` but with `scaleType: ""`, `scaleName: ""`. This is the convention-consistent empty sentinel.

- **R-2.4 Pure inference core.** The scoring math (Algorithm §B.3) lives as pure exported helpers in `arpeggio.ts`: `scoreShapeMatch(probe, shape, root, built)` plus the exported `InferenceProbe` type (review S-11). Chroma math in the pure tier uses an internal pure helper `pcChroma(pc: string): number` (letter + accidental arithmetic — no Tonal dep). The only Tonal-dependent parts (`Chord.get`, note spelling) stay in the integration tier.
  ```ts
  export interface InferenceProbe {
    pitchClasses: number[];                       // distinct chromas, 0-11
    rootCandidates: { pc: string; chroma: number }[];  // bass-first, deduped, order preserved
    anchorFret: number;                           // min fret among probe notes
    anchorString: number;                         // string index of the lowest-MIDI probe note
  }
  ```

- **R-2.5 Chord-type alias rule** — see Tonal Alignment (round-trip equality modulo `omittedIntervals`).

### Layer 3 — Integration tier (optional peer deps) — `src/integration.ts`

- **R-3.1 Arpeggio builders (review Blocker 1).** Two functions that separate parent context from target chord and match by chroma:
  ```ts
  arpeggioFromScale(parent: FrettedScale, chordName: string): FrettedScale
  arpeggioFromShape(shape: ScaleShape, chordName: string, parentRoot: string, tuning?: string[]): FrettedScale
  ```
  `arpeggioFromScale` filters an already-built parent (from `buildFrettedScale`/`buildFromScale` — works for non-major parents too). `arpeggioFromShape` is the convenience composition (`buildFrettedScale` + `arpeggioFromScale`). Chord tonic comes from `Chord.get(chordName).tonic`, falling back to the parent root for bare types (`"m7"`). See **Algorithms §A.2**. Result metadata: `root` = chord tonic pc, `scaleType` = `chord.type`, `scaleName` = `"<tonic> <chord.type>"`; parent-frame `interval`/`degree` metadata on the notes is preserved. Empty/`NoChord` → `NoFrettedScale`.

- **R-3.2 `inferShapeContext(input, options?)`** — the detection entry point (D-005/D-006/D-007). Accepts a grip (`string | (number|null)[]`, parseChordFrets-compatible) OR a `FrettedScale`. Returns ranked `InferenceCandidate[]` (empty = no match). Candidates expose `anchorFret` (build-engine anchor) and `rootFret` (review Blocker 3), a `breakdown` (review S-6), and `matchedNotes` (review C-15). Probes with fewer than 3 distinct pitch classes return `[]` unless `options.includeWeak` (review S-7). See **Algorithms §B**.

- **R-3.3 Tier placement.** All three functions sit in `integration.ts` (optional-peer-dep tier) because they need `@tonaljs/chord` / `@tonaljs/note`. The pure scoring core lives in `arpeggio.ts` (R-2.4). No new peer dep (D-002).

### Layer 4 — Curated Data (`src/data/*`)

- **R-4.1 `src/data/caged-chords-7th.ts`** — 7th-chord CAGED `ChordShape`s for `maj7`, `m7`, `7`, `m7b5`, one per applicable CAGED position. See **Data file specs §1**. Registered via `chordShapes.add` at import; imported for side-effect in `index.ts`. Each shape sets `chordType`, `voicingFamily: "caged"`, `system: "caged"`, `rootString`, `stringSet`.

- **R-4.2 `src/data/open-chords.ts`** — selective chords-db (MIT) import: open-position + standard-barre shapes for core types only (`M, m, 7, maj7, m7, dim, aug, sus2, sus4, m7b5`). See **Data file specs §2** for the extraction process, license attribution, `-1 → null` normalization, `baseFret` handling, and the `canonicalRoot` rule for concrete open shapes. `voicingFamily: "open"` or `"barre"`; `system: "open"` or `"barre"`.

- **R-4.3 `src/data/jazz-shells.ts`** — curated jazz shell grips on string sets 654 (`stringSet: [0,1,2]`) and 543 (`stringSet: [1,2,3]`), plus the `VoicingPatternDictionary` for shells (R-1.3). `system: "shell"`, `voicingFamily: "shell"`, `omittedIntervals` populated (e.g. `["5d"]` for shell m7b5). See **Data file specs §3**.

- **R-4.4 Registration & side-effect import.** Each new data file ends with `[...].forEach(chordShapes.add.bind(chordShapes))` (mirroring `caged-chords.ts:57-59`) and is added to the side-effect import block in `index.ts:104-107`.

- **R-4.5 Out-of-register probe (research risk).** Any imported open/barre/shell shape whose interval order is NOT low→high pitch order on its strings must be verified to build correctly through `buildFrettedScale`'s `fretInWindow` window assumption (`build.ts:99-113` documents the pitch-order convention). Each curated shape ships with a build-equivalence test (Test Fixtures) asserting `applyChordShape(shape, root).frets` equals the canonical chords-db frets.

### Layer 5 — Output formatters (`src/output/*`)

- **R-5.1 Grouped-note input (D-004).** Both `toAlphaTeX` and `toAsciiTab` accept simultaneous-note groups in addition to the current flat `FrettedNote[]`. The grouped shape is `FrettedNote[][]` (each inner array = one beat/strum of simultaneous notes). See **Formatter changes**.

- **R-5.2 Backward compatibility.** Existing callers passing `FrettedNote[]` keep identical output. Detection: if `Array.isArray(notes[0])` the input is grouped; otherwise flat — including `[]` (empty input), which takes the flat path and reproduces current empty output (review S-12). No signature break for sequential callers.

- **R-5.3 AlphaTeX chord syntax.** A simultaneous group renders as an AlphaTeX beat with notes wrapped in `( … )`, e.g. `(3.5 2.4 0.3 1.2 0.1)` for an open C. Single-note groups render as today (no parens). **Option semantics under grouped input:** `notesPerBar`, `noteDurations`, and `rhythmPattern` index by *beat (group)*, not by raw note — this is the documented contract, asserted in tests (review S-12). Flat callers see no change. See **Formatter changes §1**.

- **R-5.4 ASCII-tab chord column + multi-digit alignment (QUESTIONS.md Q2 interaction).** A simultaneous group occupies ONE column across all strings; the column width is the max fret-string width in that group, and `-` padding fills non-played strings to that width. This subsumes the existing multi-digit alignment debt for the chord path. See **Formatter changes §2**.

### Layer 6 — Public API (`src/index.ts`)

- **R-6.1 Re-exports.** Add to `index.ts`:
  ```ts
  // arpeggio (pure)
  export { filterChordTones, scoreShapeMatch } from "./arpeggio";
  export type { InferenceProbe } from "./arpeggio";
  // integration additions
  export { arpeggioFromScale, arpeggioFromShape, inferShapeContext } from "./integration";
  export type { InferenceCandidate, InferenceOptions, InferenceInput } from "./integration";
  // types
  export type { VoicingFamily, VoicingPatternDictionary } from "./shape";
  // new data side-effect imports
  import "./data/caged-chords-7th";
  import "./data/open-chords";
  import "./data/jazz-shells";
  ```
  `chordShapes` (now with `.query`) is already re-exported (`index.ts:27`).

- **R-6.2 Naming.** Final names: pure filter `filterChordTones`; builders `arpeggioFromScale` / `arpeggioFromShape`; detection `inferShapeContext`. No `voicings()` (D-010).

### Layer 7 — Docs (`docs/api/*.md`, README)

- **R-7.1** New API doc page `docs/api/arpeggios.md` documenting the two interval frames (parent vs chord), `filterChordTones`, `arpeggioFromScale`, `arpeggioFromShape`, `inferShapeContext`, the `ChordShape` metadata extension, the curated data sets, and the grouped-note formatter input. Document that an arpeggio result reuses `FrettedScale` with `scaleType` as a *source/type label* ("minor seventh"), not a claim of scale-hood (review C-17).
- **R-7.2** README gains an "Arpeggios & Chord Detection" section with the canonical Am7→G-shape example and a strummed-voicing rendering example.
- **R-7.3** `docs/QUESTIONS.md` Q2 (ASCII multi-digit alignment) updated to note the chord-column resolution from R-5.4.

---

## Algorithms

### §A — Arpeggio derivation

#### A.1 `filterChordTones(scale, intervals)` (pure, zero-Tonal-deps, parent-frame)

```
filterChordTones(scale: FrettedScale, intervals: string[]) -> FrettedScale:
  if scale.empty: return NoFrettedScale
  wanted = new Set(intervals)                    // PARENT-frame intervals, e.g. {"6M","1P","3M","5P"} for Am7-in-C
  kept = scale.notes.filter(n => wanted.has(n.interval))   // preserves existing order
  if kept.length == 0:
     return { ...NoFrettedScale, root: scale.root, tuning: scale.tuning, shapeName: scale.shapeName }
  return {
     empty: false,
     root: scale.root,
     scaleType: "",          // callers may overwrite
     scaleName: "",
     shapeName: scale.shapeName,
     tuning: scale.tuning,
     notes: kept,            // fresh array; FrettedNote objects reused (immutable)
  }
```

Notes:
- Matching is **exact interval-string equality in the parent frame**. This function does NOT translate chord-frame intervals (review Blocker 1) — that is `arpeggioFromScale`'s job.
- `scaleIndex`/`degree`/`intervalNumber` on each kept note are **left as-is** (they describe the parent scale). Downstream `walkShape`/`walkShapeMotif` sort by `midi` and don't re-derive degrees, so arpeggio exercises work unchanged. `walkPattern` (which keys off `degree`) over an arpeggio is documented as walking the parent-scale degrees of the retained notes — acceptable, not the primary path.
- Determinism: a single pass, order-preserving; no sorting introduced.

#### A.2 `arpeggioFromScale(parent, chordName)` and `arpeggioFromShape(shape, chordName, parentRoot, tuning?)` (integration tier, chroma-based)

```
arpeggioFromScale(parent: FrettedScale, chordName: string) -> FrettedScale:
  if parent.empty: return NoFrettedScale
  chord = Chord.get(chordName)
  if chord.empty or chord.intervals.length == 0: return NoFrettedScale
  tonic = chord.tonic ?? parent.root             // bare type ("m7") → tonic = parent root
  chordChromas = set( chroma(transpose(tonic, ivl)) for ivl in chord.intervals )
  kept = parent.notes.filter(n => chroma(n.pc) in chordChromas)    // CHROMA membership — frame-safe
  if kept.length == 0:
     return { ...NoFrettedScale, root: pc(tonic), tuning: parent.tuning, shapeName: parent.shapeName }
  return { empty: false,
           root: pc(tonic),                      // the ARPEGGIO's root = chord tonic
           scaleType: chord.type,                // e.g. "minor seventh" — a source/type label
           scaleName: `${pc(tonic)} ${chord.type}`,
           shapeName: parent.shapeName,
           tuning: parent.tuning,
           notes: kept }                         // parent-frame interval/degree metadata preserved

arpeggioFromShape(shape, chordName, parentRoot, tuning=STANDARD) -> FrettedScale:
  return arpeggioFromScale(buildFrettedScale(shape, parentRoot, tuning), chordName)
```

- **The canonical story now works through the friendly API:** `arpeggioFromShape(CAGED_G, "Am7", "C")` builds the C-major G-shape and keeps the notes whose chromas are in {A,C,E,G} — Fixture (a). Tonic chords also work: `arpeggioFromShape(CAGED_E, "maj7", "G")` = Gmaj7 in the E-shape — Fixture (d).
- `arpeggioFromScale` accepts any parent (e.g. a harmonic-minor `FrettedScale` from `buildFromScale`) — derivation is not major-only.
- Edge: chord tones absent from the parent are simply absent from the result — **a partial arpeggio is returned, not an error** (Fixture (e) sub-assertion pins this). If ALL chord tones are absent, the empty sentinel is returned.

### §B — Shape inference / detection

Registry-driven, scale-agnostic, ranked output (D-005/D-006/D-007). Operates over all registered `ScaleShape`s (the `add`/`all` registry, `shape.ts:78`), optionally filtered by `system`.

#### B.1 Input normalization → `InferenceProbe`

**Pitch-class comparison rule:** ALL pitch-class membership tests compare by **chroma** (0–11), never by spelling — `A#` and `Bb` are the same pitch class. Probe extraction happens in the integration tier; the pure scoring core receives the `InferenceProbe` (chromas precomputed; `pcChroma` covers built-note comparisons).

**Minimum-evidence gate (review S-7):** if the probe has fewer than **3 distinct pitch classes**, return `[]` unless `options.includeWeak === true`. One- and two-note probes are subsets of nearly everything; ranked output over them is noise unless explicitly requested.

Two input forms (R-3.2 / D-006):

**Grip form** (`string | (number|null)[]`):
```
frets = parseChordFrets(input)                         // notation.ts
played = [ (s, fret) for s,fret in frets if fret != null ]
if played is empty: return []                          // all-muted → no match
notes = [ noteAt(tuning, s, fret) for (s,fret) in played ]   // fretboard.ts
pitchClasses = unique chromas of notes
sortByMidi(played); bass = lowest-MIDI played note
rootCandidates = [bass pc, ...other distinct pcs]      // bass first, dedup, order preserved (pc + chroma)
anchorFret = min(fret for played)
anchorString = bass.string
```

**FrettedScale/arpeggio form**:
```
if scale.empty or scale.notes empty: return []
pitchClasses = unique chromas of scale.notes
bassNote = min-by-midi(scale.notes)
rootCandidates = dedupKeepOrder([ scale.root, bassNote.pc, ...other pcs ])   // declared root first
anchorFret = min(n.fret for n in scale.notes)
anchorString = bassNote.string
tuning = scale.tuning
```

Note: for arpeggios built by `arpeggioFromScale`, `scale.root` is the **chord tonic** (§A.2) — it leads `rootCandidates`, and parent-scale interpretations enter via the other pitch classes (Fixture (a) traces this).

#### B.2 Candidate enumeration

```
shapes = all().filter(s => options.system ? s.system == options.system : true)
candidates = []
for shape in shapes:
  for root in rootCandidates:
     built = buildFrettedScale(shape, root.pc, tuning)    // parent scale placed at this root
     if built.empty: continue
     score = scoreShapeMatch(probe, shape, root, built)
     if score.coverage == 1:                              // hard gate — see B.3
        candidates.push(candidate(shape, root, built, score))   // see Exact API surface
```

- **Coverage gate:** a candidate is only emitted if **every probe pitch class is present in the built scale's chromas** (the grip/arpeggio must be a *subset* of the shape — `isShapeCompatible` logic inverted). This is the hard constraint; everything else is ranking.
- **`anchorFret`** = the built scale's anchor as computed by `findShapeAnchorFret` (`build.ts`): the fret of the FIRST interval in the shape's `rootString` array — NOT the root fret, and not necessarily the lowest fret of the whole placed shape (review Blocker 3). **`rootFret`** = the lowest fret among built notes with `interval === "1P"` on `shape.rootString`, or `undefined` if none. Display logic ("call the F barre 'position 1'") belongs to callers; the library reports both raw values.

#### B.3 Scoring function `scoreShapeMatch(probe, shape, root, built)` (pure)

All terms are deterministic. `builtChromas = set(pcChroma(n.pc) for n in built.notes)`.

`matchedIntervals` (review S-8): built as `Map<chroma, string[]>` in **built-note order**; for each probe chroma present, take the FIRST interval encountered for that chroma; the result is the deduped list in built-note order. This is well-defined even when multiple intervals share a chroma (symmetric/custom scales).

`matchedNotes` (review C-15): the built `FrettedNote`s whose chroma is in the probe set — gives callers concrete positions for overlays/debugging.

```
coverage = (count of probe.pitchClasses present in builtChromas) / probe.pitchClasses.length

// (a) Subset tightness: reward shapes whose notes are a SMALL superset of the probe.
tightness = probe.pitchClasses.length / distinctChromaCount(built)        // in (0,1]

// (b) Root-string anchor: does the shape's root land on the probe's anchor string at the probe's bass pitch?
rootNotesInBuilt = [ n for n in built.notes if n.interval == "1P" ]
anchorHit = any(n.string == probe.anchorString and pcChroma(n.pc) == probe.rootCandidates[0].chroma
                for n in rootNotesInBuilt) ? 1 : 0
rootOnAnchorString = any(n.string == probe.anchorString for n in rootNotesInBuilt) ? 1 : 0

// (c) Position agreement — CIRCULAR fret distance (review Blocker 4):
//     buildFrettedScale anchors at the nearest natural fret and shapes repeat every 12 frets,
//     so a shape may legitimately anchor an octave from the probe (CAGED_A of A anchors at 11).
//     Linear distance would punish that artifact; mod-12 distance does not.
d = abs(built.anchorFret - probe.anchorFret) % 12
circularDelta = min(d, 12 - d)                                            // in [0, 6]
positionAgreement = 1 - circularDelta / 12                                // in [0.5, 1]... normalized: 1 at exact

// (d) Root-preference: earlier rootCandidate (the bass / declared root) preferred.
rootRank = indexOf(root in probe.rootCandidates)                          // 0 = bass/declared
rootPreference = 1 / (1 + rootRank)

total = 100 * coverage          // gate guarantees 100 for emitted candidates
      +  40 * tightness
      +  30 * anchorHit
      +  10 * rootOnAnchorString
      +  20 * positionAgreement
      +  15 * rootPreference

return { total, coverage, matchedIntervals, matchedNotes,
         breakdown: { tightness, anchorHit, rootOnAnchorString, positionAgreement, rootPreference } }
```

Weight rationale:
- **coverage (100, gate):** correctness — the shape must contain all played notes.
- **tightness (40):** prefers the shape that "is" the chord over a big scale that merely includes it. **Consequence (by design):** without a `system` filter, a pentatonic box (5 distinct PCs) covering the probe outranks a 7-note scale shape. Callers wanting "which CAGED shape?" pass `options.system: "caged"` (Fixtures a–c, g do exactly this).
- **anchorHit (30) + rootOnAnchorString (10):** encodes the CAGED intuition that the named position is the one whose root sits under the played bass.
- **positionAgreement (20, circular):** prefers the shape placed near the player's hand, octave-equivalently.
- **rootPreference (15):** root-position interpretation beats slash/inversion interpretation, all else equal.

The full `breakdown` is returned on every candidate (review S-6) so the Lab and test failures can explain rankings.

#### B.4 Ranking, ties, limit, empty

```
candidates.sortBy(c => -c.score, then c.shape.name asc, then c.shapeRoot asc, then c.anchorFret asc)
limit = (options.limit is a finite number and floor(options.limit) >= 1) ? floor(options.limit) : unlimited   // review C-16
return candidates.slice(0, limit)               // [] if none survived the gates
```

- **Tie-break:** strictly deterministic — descending `score`, then ascending `shape.name`, then ascending `shapeRoot` (note-name compare), then ascending `anchorFret`.
- **Empty result:** no shape contained all probe pitch classes for any root candidate → `[]` (D-005 convention). Min-evidence gate (B.1) also yields `[]`.
- **Determinism:** every input to scoring is a pure function of inputs + registry state; the multi-key sort fully orders.

#### B.5 Cross-tuning, DROP_D, duplicate/slash grips

- The probe carries `tuning`; `noteAt`/`buildFrettedScale` use it consistently. DROP_D works because both the grip's notes and the candidate shapes are built in the supplied tuning. Caveat (CLAUDE.md Task 2.5): shapes whose `rootString` assumes 6-string standard may anchor oddly on 7/8-string tunings — documented as a known limitation, not fixed here.
- **Duplicate-note grips** (same PC on multiple strings): `pitchClasses` dedups; coverage and tightness are chroma-based, so duplicates don't distort. `anchorString`/bass logic still uses the lowest-MIDI played note.
- **Slash / inverted grips** (bass ≠ root): handled by `rootCandidates` enumerating bass-first then other PCs; the root-position interpretation still appears, ranked by `rootPreference`/`anchorHit`. The ranked list surfaces both readings (D-005 first-class ambiguity).

---

## Test Fixtures

These are **committed contract**; Phase 4 asserts on them. All use STANDARD tuning `["E2","A2","D3","G3","B3","E4"]` (string 0 = low E). Frets and anchors computed against the actual `src/data/caged-scales.ts` shapes and `build.ts` `findShapeAnchorFret` semantics (anchor = fret of the FIRST interval in the shape's `rootString` array).

> **Registry isolation (review N-19):** every inference fixture runs with the registry pinned to known data — `removeAll()` then re-register exactly the built-in CAGED/3NPS/pentatonic sets (plus fixture-specific custom shapes) — so future side-effect data imports cannot silently change fixture outcomes.
>
> Inference fixtures (a)–(c) and (g) pass `options: { system: "caged" }` — by design, unfiltered inference may rank a pentatonic box above a full CAGED shape (tighter superset; §B.3).
>
> **Hand-computed candidate scores below are derivations, not blind guesses** — but Phase 4 MUST include a probe script (connector precedent) that runs the real implementation over fixtures (a)–(c) and (g) and confirms the committed rankings before the test assertions land. If the probe contradicts a committed ranking, implementation stops and the spec is corrected first.

### Fixture (a) — Canonical: Am7 arpeggio in the G-shape of C major

**Derivation call:** `arpeggioFromShape(CAGED_G, "Am7", "C")` — chord tonic A from the symbol; parent C major G-shape (anchor: first rootString interval `6M` = A → low-E fret 5; window [1,13]). Chord chromas {A,C,E,G} = {9,0,4,7}.

**Expected retained notes** (string, fret, pc, parent-frame interval):

| string | fret | note | pc | interval |
| --- | --- | --- | --- | --- |
| 0 (E2) | 5 | A2 | A | 6M |
| 0 | 8 | C3 | C | 1P |
| 1 (A2) | 7 | E3 | E | 3M |
| 2 (D3) | 5 | G3 | G | 5P |
| 2 | 7 | A3 | A | 6M |
| 3 (G3) | 5 | C4 | C | 1P |
| 4 (B3) | 5 | E4 | E | 3M |
| 4 | 8 | G4 | G | 5P |
| 5 (E4) | 5 | A4 | A | 6M |
| 5 | 8 | C5 | C | 1P |

Dropped (not Am7 tones): B(`7M`), D(`2M`), F(`4P`) positions. Count = **10 notes**. Result metadata: `root: "A"`, `scaleType: "minor seventh"`, `scaleName: "A minor seventh"`, `shapeName: "G Shape"`. Equivalent low-level call: `filterChordTones(buildFrettedScale(CAGED_G,"C"), ["6M","1P","3M","5P"])` retains the same 10 notes (frame-translation done by hand).

**Inference assertion (the inverse direction).** `inferShapeContext(arp, { system: "caged" })` where `arp` is the result above. Probe: chromas {9,0,4,7}, rootCandidates A(declared root) → C → E → G, anchorFret 5, anchorString 0. A-rooted major shapes fail coverage (no C/G naturals in A major), so C-rooted candidates compete (rootRank 1 for all → equal rootPreference). Expected top candidate:
```
{ shape: "G Shape", system: "caged", shapeRoot: "C", anchorFret: 5, rootFret: 8,
  matchedIntervals: ["6M","1P","3M","5P"], breakdown.positionAgreement: 1 }
```
G Shape wins on exact position agreement (anchor 5 = probe 5; E Shape of C anchors at 7) with `rootOnAnchorString` credit (its `1P` C sits on string 0 at fret 8). Lower-ranked C-rooted CAGED shapes must also be present (ambiguity, D-005).

### Fixture (b) — C major open grip `"x32010"` detection

Grip `x32010` = `[null,3,2,0,1,0]`. Played: A-str f3 = C3, D-str f2 = E3, G-str f0 = G3, B-str f1 = C4, high-E f0 = E4. Probe: chromas {0,4,7}, bass C3 on string 1 → rootCandidates C, E, G; anchorFret 0; anchorString 1.

**Expected top candidate of `inferShapeContext("x32010", { system: "caged" })`:**
```
{ shape: "C Shape", shapeRoot: "C", anchorFret: 0, rootFret: 3, breakdown.anchorHit: true }
```
C Shape of C anchors at 0 (first rootString-1 interval `6M` = A → A-string fret 0) — exact position agreement — and its `1P` C at A-string fret 3 is on the probe's anchor string at the bass pitch → `anchorHit`. Closest competitor: A Shape of C (anchorHit too — its rootString-1 `1P` C is also at fret 3 — but anchor 2 → positionAgreement 0.833); assert it ranks second with a lower score. Cross-check: existing `identifyChord("x32010")` reports C major.

### Fixture (c) — E-shape barre F major grip detection

F major barre at fret 1: `"133211"` = `[1,3,3,2,1,1]`. Notes: F2, C3, F3, A3, C4, F4. Probe: chromas {5,9,0}, bass F2 (string 0) → rootCandidates F, A, C; anchorFret 1; anchorString 0.

**Expected top candidate of `inferShapeContext("133211", { system: "caged" })`:**
```
{ shape: "E Shape", shapeRoot: "F", anchorFret: 0, rootFret: 1, breakdown.anchorHit: true }
```
**Note the anchor (review Blocker 3):** CAGED_E's rootString-0 array starts with `7M`; for F that is E natural → low-E fret **0** is the build anchor. The F root is at fret 1 — reported as `rootFret: 1` (the value display layers should show for "F barre at 1"). `anchorHit` fires (`1P` F on string 0 at the bass pitch); positionAgreement = 1 − 1/12 ≈ 0.917. Closest competitor: G Shape of F (also `1P` on string 0 within window, anchor 10 → circular delta 3); assert it ranks below E Shape.

### Fixture (d) — Chord-tone filter of a CAGED shape to a maj7 arpeggio

`arpeggioFromShape(CAGED_E, "maj7", "G")` → bare type, tonic = parent root G; Gmaj7 chromas {G,B,D,F#} = {7,11,2,6}.

CAGED_E `{1P,3M,5P,7M}` slots **(review Blocker 2 — corrected count)**: low-E `7M,1P`; A `3M,5P`; D `7M,1P`; G `3M`; B `5P`; high-E `7M,1P` → **10 notes**. With anchor `7M`=F# → low-E fret 2, the retained notes are:

| string | fret | note | interval |
| --- | --- | --- | --- |
| 0 | 2 | F#2 | 7M |
| 0 | 3 | G2 | 1P |
| 1 | 2 | B2 | 3M |
| 1 | 5 | D3 | 5P |
| 2 | 4 | F#3 | 7M |
| 2 | 5 | G3 | 1P |
| 3 | 4 | B3 | 3M |
| 4 | 3 | D4 | 5P |
| 5 | 2 | F#4 | 7M |
| 5 | 3 | G4 | 1P |

Assert: 10 notes; every retained `interval ∈ {"1P","3M","5P","7M"}`; dropped `{2M,4P,6M}` absent; `root === "G"`, `scaleType === "major seventh"`, `scaleName === "G major seventh"`; each retained note keeps its parent-scale `degree`.

### Fixture (e) — 3NPS arpeggio derivation (+ partial-filter semantics)

`arpeggioFromShape(NPS_PATTERN_1, "maj7", "C")` → C major 3NPS Pattern 1 filtered to Cmaj7 chromas.

Pattern 1 strings (`three-nps.ts:13-25`): low-E `1P,2M,3M`; A `4P,5P,6M`; D `7M,1P,2M`; G `3M,4P,5P`; B `6M,7M,1P`; high-E `2M,3M,4P`. Retained `{1P,3M,5P,7M}` slots: low-E `1P,3M`; A `5P`; D `7M,1P`; G `3M,5P`; B `7M,1P`; high-E `3M` → **10 notes**. Assert all retained intervals ∈ `{1P,3M,5P,7M}`, `scaleType === "major seventh"`, and `walkShapeMotif(result, [1,2,3,4])` runs without error (proves arpeggios ride existing machinery unchanged).

**Partial-filter sub-assertion (§A.2 semantics):** `arpeggioFromShape(NPS_PATTERN_1, "Cm7", "C")` — Cm7 chromas {C,Eb,G,Bb}; the C-major shape contains only C and G of those. Assert the result is **non-empty**, contains ONLY notes with chroma ∈ {0,7} (parent intervals `1P`/`5P`), and `scaleType === "minor seventh"`. A partial arpeggio is documented behavior, not an error — this pins the contract so it can't silently change.

### Fixture (f) — Registry-driven custom-system inference

With the registry isolated (N-19), register a custom shape with `system: "myteacher"` whose intervals form a minor-pentatonic box rooted on string 0. Feed a grip whose notes all lie within that box. Assert: with `options.system = "myteacher"`, `inferShapeContext` returns the custom shape (and not CAGED shapes); without the filter, both the custom shape and any covering CAGED scale appear, ranked. Proves D-007 (no major-scale assumption; custom systems classified with no special-casing).

### Fixture (g) — Ambiguous case, ranked output (anchor-octave artifact exercised)

Grip `"x02220"` (A major: A-E-A-C#-E). Probe: chromas {9,1,4}, bass = open A string (A2) → rootCandidates A, E, C#; anchorFret 0; anchorString 1.

Build anchors for A-rooted CAGED shapes (first rootString interval, per `build.ts`): A Shape → `7M`=G# on A-string → **fret 11**; C Shape → `6M`=F# on A-string → fret 9; G Shape → `6M`=F# on low-E → fret 2; E Shape → `7M`=G# on low-E → fret 4; D Shape → `7M`=G# on D-string → fret 6.

**Expected ranking of `inferShapeContext("x02220", { system: "caged" })` (derived from §B.3 with circular distance):**

1. **A Shape of A** — `anchorHit` (its `1P` A at A-string fret 12, probe bass pc A on string 1) + `rootOnAnchorString` + positionAgreement 1−1/12 ≈ 0.917 (circular: |11−0| → delta 1)
2. **C Shape of A** — also `anchorHit` (`1P` A at A-string fret 12) but positionAgreement 0.75 (delta 3)
3. The remaining A-rooted CAGED shapes (no `1P` on string 1), strictly lower

Assert: `result[0].shape.name === "A Shape"`, `result[1].shape.name === "C Shape"`, `result[0].score > result[1].score`, all five A-rooted CAGED shapes present, and two consecutive runs return identically ordered results (determinism). **This fixture exists precisely because linear position distance would invert ranks 1–2** (review Blocker 4): A Shape's build anchor sits an octave up (fret 11) from the open grip.

### Fixture (h) — No-match

Grip `[null,13,14,13,null,null]` in STANDARD = A-str f13 = Bb3, D-str f14 = E4, G-str f13 = G#4 → probe chromas {10, 4, 8}. With the registry isolated to the built-ins (N-19), no shape built on any root candidate (Bb, E, G#) contains all three chromas — checked by chroma so enharmonic spelling can't distort. **Assert `inferShapeContext([null,13,14,13,null,null]) === []`** (no system filter — empty across all registered systems). Also assert: all-muted grip `"xxxxxx"` → `[]`; two-PC probe `"x033xx"` (C,G only) → `[]` by the min-evidence gate, but non-empty with `{ includeWeak: true }`.

### Fixture (i) — Formatter grouped notes (D-004)

For the open C voicing notes (Fixture b positions as a single simultaneous group):
- `toAlphaTeX([group])` emits a beat `(3.5 2.4 0.3 1.2 0.1)` (AlphaTeX `fret.string`, string numbered high=1; muted low-E omitted) within the bar, distinct from the flat-array sequential output `3.5 2.4 0.3 1.2 0.1`.
- `toAsciiTab([group])` emits a single chord column: each string row shows its fret (or `-`) in one aligned column (high-e `0`, B `1`, G `0`, D `2`, A `3`, low-E `-`). Assert column width handling for a two-digit-fret group (e.g. containing fret `10`) pads single-digit frets to width 2.
- Backward-compat assertions: a flat `FrettedNote[]` input produces byte-identical output to the current formatter for an existing test case; `[]` input reproduces current empty output; with grouped input, `noteDurations`/`rhythmPattern` index per GROUP (one duration applies to the whole strum).

---

## Existing Code to Leverage

- `src/shape.ts:10-20` `FrettedNote` (`interval` field is the filter key — no change). `:30-44` `ChordShape` (extend per R-1.1). `:78,86` scale registry `all`/`add`. `:104-123` `chordShapes` registry (extend with `.query` R-1.4).
- `src/build.ts:160-234` `buildFrettedScale` (parent-scale builder for both arpeggio and inference). `:99-146` `findShapeAnchorFret` (anchor = FIRST rootString interval — the basis of `anchorFret`; pitch-order assumption R-4.5 must respect). `:49-73` `fretInWindow`. `:253-283` `applyChordShape` (curated-shape geometry; unchanged).
- `src/fretboard.ts:23-30` `noteAt` (grip → notes). `:56-73` `findNearestFret`. `:82-109` `findFretInPosition`.
- `src/integration.ts:26-42` `buildFromScale` (non-major parents for `arpeggioFromScale`; `scaleType`/`scaleName` pattern). `:79-99` `identifyChord` (grip → notes precedent; consistency cross-check). `:167-190` `isShapeCompatible` (subset logic — inference is this inverted). `:203-214` `modeShapes` (registry-filter + `system` precedent for B.2).
- `src/notation.ts:22-54` `parseChordFrets` (grip normalization for B.1, `-1 → null`).
- `src/walker.ts:22-74` `walkShape`/`walkShapeMotif` (arpeggios ride unchanged — A.1 note). `src/sequence.ts`, `src/connect.ts` (shape-source-agnostic; no change).
- `src/output/alphatex.ts:17` / `src/output/ascii-tab.ts:9` (grouped-note extension points R-5.x).
- `src/data/caged-chords.ts:11-59` (ChordShape data + registration pattern for R-4.x). `src/data/caged-scales.ts` / `src/data/three-nps.ts` (filter sources for arpeggios; fixture data).
- `src/index.ts:104-107` (side-effect import block) `:21-29` (registry re-exports).
- `docs/chord-formats-research.md` (chords-db field mapping for R-4.2). `.tonal-guitar/features/connector-algorithm/spec.md` §3.4 (worked-fixture house style + probe-first precedent).

---

## Formatter changes

### §1 — AlphaTeX (`src/output/alphatex.ts`)

- **Signature:** `toAlphaTeX(notes: FrettedNote[] | FrettedNote[][], options?)`. Detect grouped input via `Array.isArray(notes[0])`; `[]` takes the flat path (current empty output).
- **Sequential path (flat):** unchanged byte-for-byte (R-5.2). Internally normalize flat `FrettedNote[]` to `FrettedNote[][]` of singletons so the bar/duration loop runs once.
- **Beat emission:** a group of length 1 emits `fret.string` (today's form). A group of length ≥2 emits `(fret.string fret.string …)` — AlphaTeX's parenthesized simultaneous-beat syntax. String numbering is the existing `stringCount - n.string` mapping (high string = 1). Duration prefix (`:dur`) applies per beat (per group), not per note.
- **Option semantics:** `notesPerBar`, `noteDurations`, `rhythmPattern` index by *beat (group)* — documented in the option JSDoc and asserted in tests (R-5.3). Flat callers (singleton groups) get identical behavior.

### §2 — ASCII tab (`src/output/ascii-tab.ts`)

- **Signature:** `toAsciiTab(notes: FrettedNote[] | FrettedNote[][], options?)`. Same grouped detection and `[]` handling.
- **Column model (resolves QUESTIONS.md Q2 for the chord path):** build an array of beats (groups). For each beat compute `colWidth = max(1, max fretStr.length over notes in the beat)`. For each string row, the cell is the played fret left-padded to `colWidth` (or `-`×`colWidth` if that string isn't in the beat). Columns are joined by the existing `-` separator. This guarantees a chord's simultaneous notes share one vertical column and that multi-digit frets within a beat stay aligned across all six rows.
- **Backward compat:** flat input → singleton beats; for all-single-digit data this reproduces current output. (Pre-existing multi-digit *sequential* misalignment outside chords is unchanged here — only the chord-column path is newly correct; note this scope boundary in `docs/QUESTIONS.md` per R-7.3.)

---

## Edge Cases

| Case | Behavior |
| --- | --- |
| Grip all-muted (`"xxxxxx"`) | `inferShapeContext` → `[]` (B.1) |
| Probe with < 3 distinct pitch classes | `[]` unless `includeWeak: true` (B.1, review S-7) |
| Grip with muted strings mixed | Muted strings skipped; only played notes form the probe |
| Chord tone absent from parent | Absent from arpeggio; partial result, no error (§A.2, Fixture e) |
| ALL chord tones absent from parent | Empty sentinel (R-2.3) |
| `Chord.get` empty / unknown chord name | `arpeggioFromScale`/`arpeggioFromShape` → `NoFrettedScale` |
| Bare chord type (`"m7"`) with no tonic | Tonic falls back to parent root (§A.2) |
| Chord symbol tonic ≠ parent root (`"Am7"` over C parent) | Both respected: parent anchors the shape; chord tonic defines membership + result `root` (§A.2) |
| Arpeggio filter empties a string entirely | Fine — that string contributes no notes; result still valid |
| Enharmonic spellings (A# vs Bb) | Chroma comparison throughout inference and chord membership (B.1, §A.2) |
| Multiple built intervals sharing a chroma (symmetric/custom scales) | `matchedIntervals` first-match-in-built-note-order semantics (B.3, review S-8) |
| Duplicate-note grip (same PC twice) | Chroma dedup; scoring unaffected (B.5) |
| Slash / inverted grip (bass ≠ root) | Bass-first `rootCandidates`; both readings ranked (B.5) |
| Shape anchored an octave from the probe (e.g. CAGED_A of A at fret 11 vs open grip) | Circular mod-12 position distance (B.3c, review Blocker 4) |
| DROP_D / non-standard tuning | Probe + candidates built in supplied tuning; works. 7/8-string `rootString` skew documented as known limitation (CLAUDE.md Task 2.5) |
| Empty scale to `filterChordTones` | `NoFrettedScale` |
| `inferShapeContext` with `system` filter matching no shapes | `[]` |
| Invalid `limit` (≤ 0, NaN, fractional) | Floored; non-positive/NaN treated as "no limit" (B.4, review C-16) |
| Applying a concrete open shape to a different root | Supported; transposed (non-open) fingering; `canonicalRoot` is informational (R-1.1, review S-10) |
| Out-of-register curated voicing | Per-shape build-equivalence test (R-4.5); reorder intervals or exclude if mis-placed |
| Formatter `[]` input | Flat path; current empty output (R-5.2) |
| Formatter grouped input with empty inner group | Emits a rest/blank column (ASCII: all `-`; AlphaTeX: `r` rest beat) |

---

## Out of Scope

Mirrors `deferred.md` items 1–10 (each filed as a GitHub issue at Phase 3 per D-008):

1. **Voicing lookup/generation engine (sub-feature B)** — `voicings('Cmaj7', {near, family})`, guitar-native prune-while-building search, drop-2/3/2+4 derivation, playability scoring. This feature ships only B's extension points (D-010): the `VoicingPatternDictionary` format, the `VoicingFamily` vocabulary, and the `chordShapes.query` registry hook.
2. **Lab integration (sub-feature E)** — chord-type step in `PipelineRecipe`, arpeggio mode, voicing display, UI for newly settable parameters (`chordType`/`inversion`/`stringSet`). Always a separate follow-up (connector precedent).
3. **Sweep-picking arpeggio shapes** (`system: "sweep"`) — the one arpeggio family not derivable from scale positions; no authoritative canon.
4. **Full chords-db import** — the ~79 suffixes beyond the selective core-type set.
5. **`@tonaljs/voicing` / `voicing-dictionary` / `voice-leading` dependency** — Hybrid (D-002) took the FORMAT, not the dependency.
6. **Voice-leading / nearest-voicing navigation** — minimize-movement selection between successive voicings; depends on B.
7. **CAGED classification for non-standard / algorithmically-generated voicings** — inherently ambiguous; the ranked-candidates contract (D-005) leaves room but no dedicated heuristic ships now.
8. **Upper-structure arpeggio helpers** — arpeggios of substitute/related chords over a base chord.
9. **Grip → `ChordShape` classification (`inferChordShape`)** — matching grips against the curated chord-shape registry ("is this the A-form barre grip?") is a different query than parent-scale-position inference; deferred with the registry/query groundwork in place (review C-13).
10. **Diatonic-degree arpeggio sugar (`diatonicArpeggioFromShape(shape, scaleName, degree, …)`)** — "give me the ii7 arpeggio in this shape" without naming the chord; `arpeggioFromScale` + Tonal's `Key`/`Scale` helpers make this a thin follow-up (review C-14).

**Interacting debt (tracked elsewhere — not re-filed):** ASCII-tab multi-digit alignment (QUESTIONS.md Q2) is resolved here only for the chord-column path (R-5.4); the general sequential case is unchanged. Task 2.5 (7/8-string `rootString` auto-adjust) affects inference on extended-range tunings — documented limitation only.

---

## Exact API surface (consolidated)

```ts
// src/shape.ts — additions
export type VoicingFamily =
  | "caged" | "shell" | "open" | "barre"
  | "drop2" | "drop3" | "drop2+4" | "sweep";

export type VoicingPatternDictionary = Record<string, string[]>;

export interface ChordShape {            // extended
  name: string;
  system: string;
  strings: (string | null)[];
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
  chordType?: string;
  inversion?: number;
  voicingFamily?: VoicingFamily;
  stringSet?: number[];                  // 0-based PLAYED string indices, ascending low→high
  omittedIntervals?: string[];           // chord-frame intervals the voicing omits
  canonicalRoot?: string;                // documented key for concrete open shapes
  baseFret?: number;
}
// chordShapes gains: query(filter): ChordShape[]   (R-1.4)

// src/arpeggio.ts — new, pure (zero Tonal deps)
export function filterChordTones(scale: FrettedScale, intervals: string[]): FrettedScale;

export interface InferenceProbe {
  pitchClasses: number[];                              // distinct chromas 0-11
  rootCandidates: { pc: string; chroma: number }[];    // bass/declared-root first
  anchorFret: number;
  anchorString: number;
}

export interface ScoreBreakdown {
  tightness: number;
  anchorHit: boolean;
  rootOnAnchorString: boolean;
  positionAgreement: number;             // circular mod-12, in [0.5, 1]
  rootPreference: number;
}

export function scoreShapeMatch(
  probe: InferenceProbe, shape: ScaleShape, root: { pc: string; chroma: number }, built: FrettedScale
): { total: number; coverage: number; matchedIntervals: string[]; matchedNotes: FrettedNote[]; breakdown: ScoreBreakdown };

// src/integration.ts — additions (optional peer dep tier)
export function arpeggioFromScale(parent: FrettedScale, chordName: string): FrettedScale;
export function arpeggioFromShape(
  shape: ScaleShape, chordName: string, parentRoot: string, tuning?: string[]
): FrettedScale;

export type InferenceInput = string | (number | null)[] | FrettedScale;

export interface InferenceOptions {
  system?: string;        // optional registry system filter (e.g. "caged")
  tuning?: string[];      // default STANDARD; used for grip inputs
  limit?: number;         // cap after ranking; non-positive/NaN → unlimited; fractional → floored
  includeWeak?: boolean;  // default false: probes with < 3 distinct PCs return []
}

export interface InferenceCandidate {
  shape: ScaleShape;
  system: string;
  shapeRoot: string;       // root the SHAPE was built on (parent-scale root) — NOT the probe's chord root
  anchorFret: number;      // build-engine anchor (fret of first rootString interval)
  rootFret?: number;       // lowest fret of a 1P on shape.rootString in the built scale, if present
  matchedIntervals: string[];   // parent-frame, first-match-in-built-order, deduped
  matchedNotes: FrettedNote[];  // built notes whose chroma is in the probe set
  score: number;
  breakdown: ScoreBreakdown;
}

export function inferShapeContext(
  input: InferenceInput, options?: InferenceOptions
): InferenceCandidate[];   // [] when no match
```

Naming note (review S-5): the field is `shapeRoot`, not `root`, because for Fixture (a) the top candidate's value is `"C"` (the parent scale root) while the probe's chord root is A — two different musical meanings that must not share a name.

---

## Data file specs

### §1 — `src/data/caged-chords-7th.ts` (R-4.1)

- **Format:** `ChordShape` objects, one interval per string, mirroring `caged-chords.ts`, with new metadata fields populated.
- **Coverage:** `maj7`, `m7`, `7`, `m7b5`, each for the CAGED positions where a clean 4-note grip exists (ship the standard movable forms — at minimum E-shape and A-shape per type, which carry the root on strings 0 and 1 respectively; add C/D/G-position forms where a canonical grip exists).
- **Per shape:** `chordType` = Tonal alias (`"maj7"` etc.), `voicingFamily: "caged"`, `system: "caged"`, `rootString`, `stringSet` (played strings only), `inversion: 0`, `barres` where the shape barres.
- **Per-string interval/finger arrays** are computed in Phase 4 against the standard movable diagrams and verified by a build-equivalence test (R-4.5).
- **Registration:** `[...].forEach(chordShapes.add.bind(chordShapes))`; side-effect import in `index.ts`.

### §2 — `src/data/open-chords.ts` (R-4.2)

- **Source:** tombatossals/chords-db `lib/guitar.json` (MIT). **Attribution:** file header comment crediting chords-db + its MIT license; the repo `README`/`LICENSE` notes the third-party data origin.
- **Extraction process:** one-time scripted extraction (no runtime dependency, no committed JSON blob beyond the curated subset). For each selected `{key, suffix}`:
  - Take the first (canonical) voicing's `frets`, `fingers`, `baseFret`, `barres`, `capo`.
  - **`-1 → null` normalization:** chords-db uses `-1` for muted; map to `null` (consistent with `parseChordFrets`).
  - **`baseFret` handling:** chords-db `frets` are RELATIVE to `baseFret`. Convert to absolute by `absFret = baseFret === 1 ? frets[i] : frets[i] + (baseFret - 1)` for non-null frets; store `baseFret` on the shape for reference. The shape's per-string `strings` intervals are derived by computing the interval of each played note from the chord root (using the key + suffix → root, and `noteAt`).
  - **Open (concrete) vs barre (movable):** open shapes set `canonicalRoot` to the documented key (review S-10); they remain `ChordShape`s (root-relative intervals) and CAN be applied to other roots — the result is simply the transposed, non-open fingering. Standard-barre shapes are movable with `voicingFamily: "barre"` and no `canonicalRoot`.
- **Coverage:** core types only — `M, m, 7, maj7, m7, dim, aug, sus2, sus4, m7b5` — open position for the C/A/G/E/D family + the two standard movable barre families (E-shape, A-shape) per type. NOT the full 89-suffix set (deferred item 4).
- **Per shape:** `chordType`, `voicingFamily ∈ {"open","barre"}`, `system ∈ {"open","barre"}`, `stringSet` (played strings only), `baseFret`, `canonicalRoot` (open only).
- **R-4.5 test:** each shape's `applyChordShape(shape, canonicalRoot ?? root).frets` equals the source frets (build-equivalence), guarding the pitch-order assumption.

### §3 — `src/data/jazz-shells.ts` (R-4.3)

- **`VoicingPatternDictionary` (adopted format, D-002):** keyed by `chordType`, low→high voice patterns. Entries:
  ```ts
  export const SHELL_DICTIONARY: VoicingPatternDictionary = {
    maj7: ["1P 3M 7M", "1P 7M 10M"],   // R-3-7 and R-7-3 orderings (compound 10M = 3rd above the 7th)
    m7:   ["1P 3m 7m", "1P 7m 10m"],
    "7":  ["1P 3M 7m", "1P 7m 10M"],
    m7b5: ["1P 3m 7m", "1P 7m 10m"],    // shell omits the b5 — see omittedIntervals
  };
  ```
- **`omittedIntervals` (review S-9):** each generated shell `ChordShape` declares what the voicing omits relative to `Chord.get(chordType).intervals` — `["5P"]` for maj7/m7/7 shells, `["5d"]` for m7b5. This reconciles the shell data with the R-2.5 round-trip rule: `chordType` names the harmonic function; the omission is explicit metadata.
- **String-set convention:** `stringSet` lists 0-based played string indices low→high. Set "654" = `[0,1,2]`; set "543" = `[1,2,3]`.
- **Shapes:** generate one `ChordShape` per `(chordType, stringSet, ordering)` from the dictionary by assigning each pattern interval to consecutive strings of the set, with the remaining strings `null`.
- **Per shape:** `chordType`, `voicingFamily: "shell"`, `system: "shell"`, `stringSet`, `omittedIntervals`, `rootString` = the string carrying `1P`, `inversion: 0`.
- **R-4.5 test:** shells place the 7th below the 3rd in the R-7-3 ordering (compound `10M`/`10m` voice); build-equivalence test confirms `applyChordShape` yields the intended frets or the interval order is adjusted to satisfy the window convention.

---

## Quality Criteria

- **Requirements are specific & testable.** Each `R-n` names a file, a function/type, and an observable behavior. Every algorithm step (§A, §B) is deterministic — weights, gates, and tie-breaks are explicit numbers and ordered sort keys.
- **The two interval frames are never conflated.** Pure filtering is parent-frame; chord membership is chroma-based (review Blocker 1). Every fixture states which frame it exercises.
- **API shapes fully typed.** Every new function has a complete TS signature; every type lists all fields and optionality; `InferenceProbe`/`ScoreBreakdown` are exported for the pure-tier tests (review S-11); module placement follows CLAUDE.md tiers; index.ts re-export list enumerated (R-6.1).
- **Fixtures computed from real data and probe-verified.** Counts, frets, and anchors derive from `src/data/*` and `build.ts` `findShapeAnchorFret` semantics (anchor = first rootString interval — review Blockers 2/3). Ranking fixtures (a)–(c), (g) additionally require a Phase 4 probe script confirming the committed order before assertions land (review Blocker 4 discipline; connector probe-first precedent).
- **Tonal alignment documented** so reviewers can verify `chordType` values round-trip through `Chord.get()` modulo `omittedIntervals`, and the shell dictionary matches the `@tonaljs/voicing-dictionary` format.
- **No new peer dependency** (D-002); only existing `@tonaljs/chord` (optional) and `@tonaljs/note` (required) are used, and only in the integration tier.
- **Backward compatibility preserved:** existing `ChordShape` data unchanged; existing formatter callers get byte-identical output (including `[]`); `applyChordShape` geometry untouched.
- **Out-of-scope items mirror `deferred.md` 1–10** and the interacting debt is acknowledged without over-promising.

---

## Review Changelog (rev 2)

External review by Codex (`reviews/spec-review.md`), all findings resolved:

| Finding | Resolution |
| --- | --- |
| B-1 chord-frame vs parent-frame conflation | API split: `filterChordTones` (parent-frame, pure) + `arpeggioFromScale`/`arpeggioFromShape` (chroma-based, parent root and chord name separated). Tonal Alignment documents the two frames |
| B-2 Fixture (d) wrong count (9→10) | Corrected with full note table verified against `caged-scales.ts` |
| B-3 `position: 1` vs build anchor 0 | Candidate exposes `anchorFret` + `rootFret`; `position` removed; fixtures updated |
| B-4 Fixture (g) ranking false | Root cause: linear distance vs octave-anchored shapes (CAGED_A of A anchors at 11). Fixed with circular mod-12 position distance; fixture recomputed and now exercises the artifact deliberately; probe-script gate added before assertions land |
| S-5 ambiguous `root` | Renamed `shapeRoot` with naming note |
| S-6 opaque score | `breakdown: ScoreBreakdown` on every candidate |
| S-7 tiny probes | Min-evidence gate (3 distinct PCs) + `includeWeak` option |
| S-8 chroma collisions | `Map<chroma, string[]>` first-match-in-built-order semantics |
| S-9 shell m7b5 vs alias rule | `omittedIntervals` field; R-2.5 rule is round-trip modulo omissions |
| S-10 concrete open shapes | `canonicalRoot` field; transposed application explicitly supported |
| S-11 `InferenceProbe` undefined | Defined and exported from `arpeggio.ts`, with `pcChroma` pure helper |
| S-12 formatter semantics | Group-indexed option contract documented + tested; `[]` input pinned |
| C-13 grip→ChordShape classification | Deferred item 9 |
| C-14 diatonic-degree sugar | Deferred item 10 |
| C-15 matchedNotes | Added to candidate |
| C-16 limit semantics | Normalization rule in B.4 |
| C-17 scaleType label semantics | Doc note in R-7.1 |
| N-18/19/20 | Fixed in fixtures (d), registry isolation note, stringSet "played strings only" |
