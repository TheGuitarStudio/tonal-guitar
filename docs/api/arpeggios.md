---
title: Arpeggios & Chord Detection
description: Arpeggio derivation, chord-shape inference, and curated voicing data
---

```js
import * as Guitar from "tonal-guitar";

const arpeggio = Guitar.arpeggioFromShape(Guitar.get("G Shape"), "Am7", "C");
const candidates = Guitar.inferShapeContext("x32010");
```

This module adds three capabilities: deriving chord-tone arpeggios from existing scale shapes, detecting which registered scale shapes cover a given grip or arpeggio, and a set of curated chord-shape data (7th-chord CAGED, open/barre chords, and jazz shell voicings).

## Two Interval Frames

The most important conceptual point in this API is that **every `FrettedNote` carries its interval in the parent-scale frame, not the chord frame**. The two frames use different tonic references:

| Frame | Tonic | Example (Am7 inside C major) |
|-------|-------|------------------------------|
| **Parent frame** | Parent scale root (C) | A=6M, C=1P, E=3M, G=5P |
| **Chord frame** | Chord tonic (A) | A=1P, C=3m, E=5P, G=7m |

When `arpeggioFromScale` or `arpeggioFromShape` filters C-major notes to the Am7 chord tones, the retained `FrettedNote` objects still carry their C-major `interval` and `degree` fields unchanged. This is intentional: the parent-frame fields let you answer "where does this note sit in the scale?" while the chord name tells you what harmony it represents.

This means the `scaleType` field on an arpeggio result is a **source/type label** (e.g. `"minor seventh"`) indicating what chord was filtered, not a claim that the notes form a complete scale or that all scale degrees are present.

If you need to work in the chord frame explicitly, use `filterChordTones` with intervals expressed relative to the parent root (see below).

---

## filterChordTones

`filterChordTones(scale: FrettedScale, intervals: string[]) => FrettedScale`

Filter a `FrettedScale` to only those notes whose `interval` field (in the **parent-scale frame**) appears in the provided set. This is the low-level, dependency-free filter — it does not resolve chord names or translate frames.

```js
import { buildFrettedScale, filterChordTones, get } from "tonal-guitar";

// Am7 chord tones in C major, expressed in the PARENT frame (root = C):
//   A = "6M", C = "1P", E = "3M", G = "5P"
const cMajorScale = buildFrettedScale(get("G Shape"), "C");
const arpeggio = filterChordTones(cMajorScale, ["6M", "1P", "3M", "5P"]);
// => FrettedScale with 10 notes, all with interval in {"6M","1P","3M","5P"}
// Each note still carries its C-major parent-frame interval and degree.
```

**Parameters:**
- `scale` — the parent `FrettedScale` to filter
- `intervals` — interval strings in the parent-scale frame (e.g. `"1P"`, `"6M"`)

**Behavior:**
- Returns a fresh `FrettedScale`; the input is never mutated.
- If `scale.empty` is true, returns `NoFrettedScale`.
- If no notes match, returns the empty sentinel with `root`, `tuning`, and `shapeName` preserved from the input (so callers can still identify what shape was searched).
- Never throws for valid-typed inputs.

**When to use `filterChordTones` vs `arpeggioFromScale`:**
`filterChordTones` requires you to supply parent-frame intervals manually. Use it when you have already computed the interval mapping or are working in the pure tier (no Tonal peer deps). Use `arpeggioFromScale` or `arpeggioFromShape` when you want to name a chord and let the library translate automatically.

---

## arpeggioFromScale

`arpeggioFromScale(parent: FrettedScale, chordName: string) => FrettedScale`

Derive a chord-tone arpeggio from an already-built parent `FrettedScale`. Filtering is **chroma-based**: chord membership is determined by computing the pitch-class chromas of the chord tonic transposed by each of the chord's intervals, then retaining parent notes whose `pc` chroma falls in that set.

This approach is frame-safe — relative/diatonic arpeggios (Am7 inside C major) work without any manual interval translation.

```js
import { buildFrettedScale, arpeggioFromScale, get } from "tonal-guitar";

const cMajor = buildFrettedScale(get("G Shape"), "C");
const am7Arp = arpeggioFromScale(cMajor, "Am7");
// => FrettedScale {
//      empty: false,
//      root: "A",               // chord tonic
//      scaleType: "minor seventh", // chord type label (not a scale claim)
//      scaleName: "A minor seventh",
//      shapeName: "G Shape",
//      notes: [/* 10 FrettedNotes with A, C, E, G chromas */]
//    }

// The retained notes still carry their parent-frame intervals:
am7Arp.notes[0].interval; // e.g. "6M" (A in C major), not "1P"
```

**Bare chord type fallback:** When you pass a chord type with no tonic (e.g. `"m7"`), the chord tonic falls back to `parent.root`.

```js
// "m7" has no tonic — tonic falls back to parent.root = "C"
arpeggioFromScale(cMajor, "m7");
// same as arpeggioFromScale(cMajor, "Cm7")
```

**Partial arpeggio semantics:** If the parent shape only covers some chord tones (e.g. a pentatonic shape that happens to contain 3 of 4 Am7 notes), the result contains only those notes that are present. This is correct — you get a partial arpeggio, not an error.

**Returns `NoFrettedScale`** for:
- `parent.empty === true`
- Unrecognised chord name (Tonal cannot resolve it)

**Returns the empty sentinel** (with `root`, `tuning`, `shapeName` preserved) when no parent notes hit any chord-tone chroma.

---

## arpeggioFromShape

`arpeggioFromShape(shape: ScaleShape, chordName: string, parentRoot: string, tuning?: string[]) => FrettedScale`

Convenience composition that builds the parent scale then derives the arpeggio in one call. Equivalent to:

```js
arpeggioFromScale(buildFrettedScale(shape, parentRoot, tuning), chordName)
```

**Canonical example:**

```js
import { arpeggioFromShape, get } from "tonal-guitar";

const am7 = arpeggioFromShape(get("G Shape"), "Am7", "C");
// Parent: C major in G Shape (17 notes across 6 strings)
// Filtered to: A, C, E, G chromas → 10 notes
// am7.root === "A"
// am7.scaleType === "minor seventh"
// All notes have pc in {"A","C","E","G"}
```

**Parameters:**
- `shape` — the `ScaleShape` to build the parent scale from
- `chordName` — chord name understood by Tonal (e.g. `"Am7"`, `"Cmaj7"`, `"G7"`)
- `parentRoot` — root note for the parent scale (e.g. `"C"`)
- `tuning` — optional tuning array (defaults to `STANDARD`)

---

## inferShapeContext

`inferShapeContext(input: InferenceInput, options?: InferenceOptions) => InferenceCandidate[]`

Detect which registered scale shapes cover a given grip or arpeggio. Returns a ranked list of candidates, each describing which shape, at which root and fret position, best explains the probe.

### InferenceInput

```ts
type InferenceInput = string | (number | null)[] | FrettedScale;
```

Three input forms are accepted:

- **String** — compact or delimited chord-fret notation: `"x32010"`, `"1-3-3-2-1-1"`
- **Array** — fret array, `null` = muted: `[null, 3, 2, 0, 1, 0]`
- **FrettedScale** — an already-built scale or arpeggio (e.g. from `arpeggioFromShape`)

```js
import { inferShapeContext } from "tonal-guitar";

// From a grip string
inferShapeContext("x32010");

// From a fret array
inferShapeContext([null, 3, 2, 0, 1, 0]);

// From an arpeggio
const arp = arpeggioFromShape(get("G Shape"), "Am7", "C");
inferShapeContext(arp);
```

### InferenceOptions

```ts
interface InferenceOptions {
  system?: string;       // filter registry to one system, e.g. "caged", "3nps"
  tuning?: string[];     // tuning for grip inputs (default: STANDARD)
  limit?: number;        // cap on returned candidates (floored; non-positive/NaN = no limit)
  includeWeak?: boolean; // if false (default), probes with <3 distinct pitch classes return []
}
```

### InferenceCandidate

```ts
interface InferenceCandidate {
  shape: ScaleShape;          // the matched shape from the registry
  system: string;             // shape system, e.g. "caged", "3nps", "pentatonic"
  shapeRoot: string;          // parent-scale root the shape was built on (e.g. "C", not "A")
  anchorFret: number;         // build-engine anchor fret (first interval on rootString)
  rootFret?: number;          // lowest "1P" fret on shape.rootString in the built scale
  matchedIntervals: string[]; // parent-frame intervals matched, deduped by chroma
  matchedNotes: FrettedNote[];// built notes whose chroma is in the probe set
  score: number;              // total weighted score
  breakdown: ScoreBreakdown;  // transparent per-term score breakdown
}
```

**`shapeRoot` vs chord root:** `shapeRoot` is the parent-scale root, not the chord root. For the canonical Am7 example, `shapeRoot` is `"C"` (the C-major shape that contains Am7), not `"A"`.

**`ScoreBreakdown`** exposes all ranking terms for transparency:

```ts
interface ScoreBreakdown {
  tightness: number;          // probe PCs / built distinct chromas — in (0, 1]
  anchorHit: boolean;         // root note sits on probe's bass string at bass chroma
  rootOnAnchorString: boolean;// any root note sits on probe's bass string
  positionAgreement: number;  // circular mod-12 fret agreement — in [0.5, 1]
  rootPreference: number;     // 1/(1+rootRank) — rank 0 → 1.0, rank 1 → 0.5, …
}
```

### Ranking and result semantics

Candidates are ranked by:
1. Descending `score` (higher = better)
2. Ascending `shape.name` (tiebreak)
3. Ascending `shapeRoot` (tiebreak)
4. Ascending `anchorFret` (tiebreak)

`score` formula: `100*coverage + 40*tightness + 30*anchorHit + 10*rootOnAnchorString + 20*positionAgreement + 15*rootPreference`

Only shapes with full coverage (all probe pitch classes present in the built scale) are included.

### Empty-result convention

Returns `[]` when:
- The input is empty or all-muted
- Fewer than 3 distinct pitch classes and `includeWeak` is not set
- No registered shape covers all probe pitch classes

```js
// Min-evidence gate
inferShapeContext("xx0000"); // => [] (fewer than 3 distinct PCs by default)
inferShapeContext("xx0000", { includeWeak: true }); // tries anyway

// System filter (arp built above)
inferShapeContext(arp, { system: "caged", limit: 3 });
```

---

## ChordShape Harmonic Metadata

The `ChordShape` interface now carries optional harmonic-metadata fields that describe the chord's theoretical context:

```ts
interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[];      // one interval per string (or null = muted)
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
  // Optional harmonic metadata:
  chordType?: string;              // Tonal chord type alias, e.g. "maj7", "m7", "M"
  inversion?: number;              // 0 = root position, 1 = first inversion, etc.
  voicingFamily?: VoicingFamily;   // "caged" | "shell" | "open" | "barre" | "drop2" | ...
  stringSet?: number[];            // played string indices (0-based), e.g. [0,1,2]
  omittedIntervals?: string[];     // intervals absent from this voicing, e.g. ["5P"]
  canonicalRoot?: string;          // documented key for open shapes (informational only)
  baseFret?: number;               // lowest fretted fret in source diagram
}
```

**`canonicalRoot` semantics:** For open-position shapes (e.g. `"C Major Open"`), `canonicalRoot` records the key the open fingering was documented for. It does **not** restrict `applyChordShape` — you can apply any `ChordShape` to any root. The transposed, non-open fingering is returned when you apply an open shape to a different root.

**`omittedIntervals` role:** Records theoretically-expected intervals that are absent from this voicing. For jazz shell voicings, `omittedIntervals: ["5P"]` documents that the fifth is intentionally dropped. This field is informational; it does not affect building or filtering.

**`VoicingFamily` type:**

```ts
type VoicingFamily =
  | "caged"
  | "shell"
  | "open"
  | "barre"
  | "drop2"
  | "drop3"
  | "drop2+4"
  | "sweep";
```

**`VoicingPatternDictionary` type:**

```ts
type VoicingPatternDictionary = Record<string, string[]>;
```

A dictionary keyed by chord-type alias, with values as space-joined interval pattern strings (low voice to high voice). Used by jazz shell shapes.

### Querying chord shapes

`chordShapes.query` provides a conjunctive filter over all registered chord shapes:

```js
import { chordShapes } from "tonal-guitar";

// All maj7 shapes
chordShapes.query({ chordType: "maj7" });

// All CAGED shell voicings on the 654 string set
chordShapes.query({ voicingFamily: "shell", stringSet: [0, 1, 2] });

// All open shapes
chordShapes.query({ system: "open" });

// Conjunctive: CAGED system + voicingFamily "caged"
chordShapes.query({ system: "caged", voicingFamily: "caged" });
```

---

## Curated Data Sets

Three additional chord-shape data sets are registered at import time (alongside the original 5 CAGED chord shapes):

### caged-chords-7th

7th-chord movable shapes in E, A, and D CAGED forms for `maj7`, `m7`, `7` (dominant), and `m7b5`. These are derived from standard open voicings transposed to movable shape form. No `canonicalRoot` is set — apply them to any root via `applyChordShape`.

```js
import { chordShapes } from "tonal-guitar";

// All 7th-chord CAGED shapes
const caged7ths = chordShapes.query({ system: "caged", chordType: "maj7" });

// E-shape maj7
chordShapes.get("E Shape maj7");
```

### open-chords

Open-position and standard barre chord shapes sourced from tombatossals/chords-db (MIT License). Covers core types: `M`, `m`, `7`, `maj7`, `m7`, `dim`, `aug`, `sus2`, `sus4`, `m7b5`. Open-position shapes carry `canonicalRoot` and `voicingFamily: "open"`; barre shapes carry `voicingFamily: "barre"`.

```js
chordShapes.get("C Major Open");       // x32010
chordShapes.get("E Major Open");       // 022100
chordShapes.query({ voicingFamily: "open", chordType: "m7" });
```

### jazz-shells

3-note shell voicings (root + 3rd + 7th, omitting the 5th) for `maj7`, `m7`, `7`, and `m7b5`. Two string sets: `[0,1,2]` (low-E, A, D) and `[1,2,3]` (A, D, G). Each chord type has two voicing orderings:

- **R37** — root, then 3rd (or b3), then 7th
- **R73** — root, then 7th, then 3rd voiced an octave up

The `SHELL_DICTIONARY` follows the `@tonaljs/voicing-dictionary` format:

```ts
const SHELL_DICTIONARY: VoicingPatternDictionary = {
  maj7:  ["1P 3M 7M",  "1P 7M 10M"],
  m7:    ["1P 3m 7m",  "1P 7m 10m"],
  "7":   ["1P 3M 7m",  "1P 7m 10M"],
  m7b5:  ["1P 3m 7m",  "1P 7m 10m"],
};
```

All shell shapes have `omittedIntervals: ["5P"]` (or `["5d"]` for `m7b5`) and `inversion: 0`.

```js
import { chordShapes } from "tonal-guitar";

// All shell voicings
chordShapes.query({ system: "shell" });

// m7 shells on the A-D-G string set
chordShapes.query({ system: "shell", chordType: "m7", stringSet: [1, 2, 3] });

// Apply a shell voicing to a specific root
const shape = chordShapes.get("Shell maj7 R37 012");
import { applyChordShape } from "tonal-guitar";
const fingering = applyChordShape(shape, "G");
```

---

## Grouped Formatter Input

Both `toAlphaTeX` and `toAsciiTab` now accept `FrettedNote[][]` (a grouped array) in addition to the original flat `FrettedNote[]`. Each inner array represents one simultaneous beat (strum/chord).

```ts
// Flat (original — unchanged behavior)
toAlphaTeX(notes: FrettedNote[], options?): string;

// Grouped (new — each inner array = one beat)
toAlphaTeX(notes: FrettedNote[][], options?): string;
```

Detection is automatic: `Array.isArray(notes[0])` selects the grouped path. An empty outer array (`[]`) takes the flat path.

**Backward compatibility:** For single-note (sequential) content, flat `FrettedNote[]` produces identical output to before.

### Strummed voicing example

```js
import { applyChordShape, chordShapes, toAlphaTeX, toAsciiTab } from "tonal-guitar";

const shape = chordShapes.get("C Major Open");
const voicing = applyChordShape(shape, "C");
const notes = voicing.positions; // FrettedNote[]

// Render as a strummed chord (all notes simultaneous = one beat)
const tex = toAlphaTeX([notes], { duration: 4 });
// => header...
//    :4 (3.5 2.4 0.3 1.2 0.1) |

// ASCII tab column view (R-5.4 chord-column path)
const tab = toAsciiTab([notes]);
// e|0|
// B|1|
// G|0|
// D|2|
// A|3|
// E|-|
```

### Option indexing under grouped input

Under grouped input, `notesPerBar`, `noteDurations`, and `rhythmPattern` index by **beat (group)**, not by individual note. One `rhythmPattern` entry covers the whole strum.

```js
// Mixed arpeggio + strum: 3 sequential notes then a full chord
const arpNotes = [note1, note2, note3]; // individual beats
const chordBeat = voicing.positions;   // simultaneous beat

toAlphaTeX([[note1], [note2], [note3], chordBeat], {
  rhythmPattern: [8, 8, 8, 4],  // beats 0-2 = eighth notes; beat 3 = quarter
  notesPerBar: 4,
});
```

**ASCII tab column alignment (R-5.4):** In the grouped path, each beat occupies one column of uniform width (`Math.max(1, max fret digit width in the group)`), so multi-digit frets (e.g. fret 10) align correctly across string rows. See QUESTIONS.md Q2 for the status of alignment in the sequential (flat) path.
