/**
 * Extended chord shapes: sixths, ninths, jazz core, and altered dominants.
 *
 * Fifteen canonical chord types — `6`, `m6`, `9`, `maj9`, `m9`, `add9`, `13`,
 * `dim7`, `mMaj7`, `7sus4`, `6/9`, `7b9`, `7#9`, `7#5`, `7b5` — each shipping
 * a movable **E-form** (`rootString: 0`) and/or **A-form** (`rootString: 1`)
 * voicing in the established `ChordShape` format. This mirrors
 * `caged-chords-7th.ts` exactly: one interval per string (or `null` for
 * muted/unplayed strings), a per-shape JSDoc deriving the interval row from
 * a concrete six-string prototype grip, and a single bottom
 * `.forEach(chordShapes.add.bind(chordShapes))` registration block.
 *
 * ## Tonal-first naming contract
 *
 * Every `chordType` string here equals the symbol suffix `@tonaljs/chord`'s
 * `Chord.get` accepts (e.g. `Chord.get("Cmaj9").symbol === "Cmaj9"`), so the
 * chord ↔ scale ↔ arpeggio vocabulary in `arpeggioFromShape` /
 * `arpeggioFromScale` / `identifyChord` (`src/integration.ts`) needs no
 * translation layer. Interval rows use Tonal's compound-interval vocabulary
 * (`9M`, `13M`, not `2M`/`6M`) and are a chroma-subset of
 * `Chord.get("<root><chordType>").intervals` — a voicing may omit tones (see
 * `omittedIntervals`) but MUST NOT add a tone outside the chord.
 *
 * ## Interop divergence catalog
 *
 * Tonal's `detect(notes)` does not always echo the `Chord.get` symbol back
 * verbatim. Where the two diverge, this file keeps the `Chord.get` symbol as
 * `chordType` and documents the alias `detect` prefers instead — tests
 * assert chroma membership / the documented alias, never a mismatched exact
 * string:
 *
 * | `chordType` (= `Chord.get` symbol) | `detect(notes)` returns   | Handling                                                        |
 * | ----------------------------------- | ------------------------- | --------------------------------------------------------------- |
 * | `add9`                              | `Madd9` (e.g. `CMadd9`)   | key stays `add9`; tests assert chroma membership, not `detect` equality |
 * | `mMaj7`                              | `m/ma7` (e.g. `Cm/ma7`)   | key stays `mMaj7`; documented alias                              |
 * | `6/9`                                | `6add9` (e.g. `C6add9`)   | key stays `6/9`; documented alias                                |
 * | `7#5`                                | `7#5` first, `7b13` also  | first `detect` entry IS the exact symbol; `7b13` is a secondary, non-divergent alias |
 *
 * `aug7` and `7#5` are **the same Tonal chord** — identical intervals
 * (`1P 3M 5A 7m`) and overlapping `detect` aliases.
 * `Chord.get("Caug7").symbol` is `"Caug7"` (Tonal does NOT normalize it to
 * `7#5`), but `detect(notes)` for that pitch-class set prefers `C7#5`. We
 * register **`7#5` only** — `aug7` is not a separate registry key.
 * `chordShapes.query({ chordType: "aug7" })` intentionally returns nothing:
 * the registry is an exact-string index with no alias resolution at query
 * time.
 *
 * ## Standard-tuning scope (D-008)
 *
 * These are **standard six-string** shapes — `strings`/`fingers` arrays are
 * six slots wide, matching `STANDARD` tuning. Alternate tunings and 7/8-string
 * tunings are best-effort only: `applyChordShape` maps a six-slot shape onto
 * the *lowest* six strings of a longer tuning, which is not where a
 * guitarist would actually place the grip on a 7/8-string instrument. This
 * is not guaranteed or tested for extended shapes here (see
 * `docs/PLAN.md` / CLAUDE.md "Remaining work" — 7/8-string rootString
 * auto-adjustment is tracked separately).
 *
 * ## Registration
 *
 * Shapes are registered into the chord shape registry at import time via
 * `EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes))`. See
 * `src/index.ts` for the side-effect import that wires this file in. This
 * file adds data only — no new engine, no `ChordShape`/registry changes, no
 * public re-exports (consumers use the existing `chordShapes`,
 * `applyChordShape`, `arpeggioFromShape` / `arpeggioFromScale`, and
 * `identifyChord` APIs).
 */

import { chordShapes, ChordShape } from "../shape";

// ============================================================
// Shape definitions
//
// Populated tier-by-tier by subsequent task groups per
// .tonal-guitar/features/extended-chord-shapes-import/tasks.md:
//   Tier 1 — 6, m6, 9, maj9, m9, add9   (this task group)
//   Tier 2 — 13, dim7, mMaj7, 7sus4, 6/9
//   Tier 3 — 7b9, 7#9, 7#5, 7b5
//
// Tier 1 identification note (empirically verified against the installed
// Tonal version, `@tonaljs/chord` `detect`):
//   - `6`, `m6`, `9`, `maj9`, `m9` full voicings detect cleanly as their
//     exact chord name (e.g. `detect(["F","C","F","A","D","G"])[0] ===
//     "F9"`) — no alias needed.
//   - `add9` full voicings detect as `${root}Madd9` (e.g. `FMadd9`,
//     `CMadd9`), per the divergence catalog above — tests pass this as the
//     documented alias.
//   - The A-form `9`/`maj9`/`m9` shells below omit the 5th (the classic,
//     universally-taught 4-string "shell" jazz voicings) and are therefore
//     PARTIAL voicings (`omittedIntervals: ["5P"]`); `detect` on these
//     returns an incomplete/empty label (e.g. `C9no5` for the `9` shell,
//     `[]` for the `maj9`/`m9` shells) — expected per D-007, asserted only
//     as a chroma subset, never a full-chord `detect` match.
// ============================================================

// ============================================================
// 6 (major sixth) shapes
// ============================================================

/**
 * E-shape 6
 * Prototype: open E6 → 0,2,2,1,2,0 → E B E G# C# E
 * Intervals:            1P 5P 1P 3M 6M 1P
 * Applied to F (avoids the open-string edge case): 1 3 3 2 3 1 (span 2).
 * Complete 4-tone chord (1P 3M 5P 6M, root doubled) — no omission.
 */
export const EXT_CHORD_E_6: ChordShape = {
  name: "E Shape 6",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "6M", "1P"],
  fingers: [1, 3, 3, 2, 4, 1],
  barres: [
    { fret: 0, fromString: 0, toString: 5, finger: 1 },
    { fret: 2, fromString: 1, toString: 2, finger: 3 },
  ],
  rootString: 0,
  chordType: "6",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 6
 * Prototype: open A6 → x,0,2,2,2,2 → A E A C# F#
 * Intervals:              x 1P 5P 1P 3M 6M
 * Applied to C: x 3 5 5 5 5 (span 2). Complete — no omission.
 */
export const EXT_CHORD_A_6: ChordShape = {
  name: "A Shape 6",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3M", "6M"],
  fingers: [null, 0, 1, 1, 1, 1],
  barres: [{ fret: 2, fromString: 2, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "6",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

// ============================================================
// m6 (minor sixth) shapes
// ============================================================

/**
 * E-shape m6
 * Prototype: open Em6 → 0,2,2,0,2,0 → E B E G C# E
 * Intervals:             1P 5P 1P 3m 6M 1P
 * Applied to F: 1 3 3 1 3 1 (span 2). Complete (1P 3m 5P 6M) — no omission.
 */
export const EXT_CHORD_E_M6: ChordShape = {
  name: "E Shape m6",
  system: "caged",
  strings: ["1P", "5P", "1P", "3m", "6M", "1P"],
  fingers: [1, 1, 1, 0, 2, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m6",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape m6
 * Prototype: open Am6 → x,0,2,2,1,2 → A E A C F#
 * Intervals:              x 1P 5P 1P 3m 6M
 * Applied to C: x 3 5 5 4 5 (span 2). Complete — no omission.
 */
export const EXT_CHORD_A_M6: ChordShape = {
  name: "A Shape m6",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3m", "6M"],
  fingers: [null, 0, 2, 2, 1, 3],
  barres: [{ fret: 2, fromString: 2, toString: 3, finger: 2 }],
  rootString: 1,
  chordType: "m6",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

// ============================================================
// 9 (dominant ninth) shapes
// ============================================================

/**
 * E-shape 9
 * Prototype: open E9 → 0,2,0,1,0,2 → E B D G# B F#
 * Intervals:            1P 5P 7m 3M 5P 9M
 * Applied to F: 1 3 1 2 1 3 (span 2). Complete 5-tone chord — no omission.
 */
export const EXT_CHORD_E_9: ChordShape = {
  name: "E Shape 9",
  system: "caged",
  strings: ["1P", "5P", "7m", "3M", "5P", "9M"],
  fingers: [1, 3, 1, 2, 1, 4],
  barres: [{ fret: 0, fromString: 0, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 9
 * Prototype: the universal movable "9th chord" shell, commonly taught
 * rooted at C: x,3,2,3,3,x → C E Bb D
 * Intervals:      1P 3M 7m 9M
 * Applied to C directly (this *is* the reference root/fret): x 3 2 3 3 x
 * (span 1). Omits the 5th (priority 1) — the classic 4-string voicing;
 * `detect` on this shell returns `C9no5`, not `C9` (expected for a partial
 * voicing, D-007).
 */
export const EXT_CHORD_A_9: ChordShape = {
  name: "A Shape 9",
  system: "caged",
  strings: [null, "1P", "3M", "7m", "9M", null],
  fingers: [null, 2, 1, 3, 3, null],
  barres: [{ fret: 3, fromString: 3, toString: 4, finger: 3 }],
  rootString: 1,
  chordType: "9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P"],
};

// ============================================================
// maj9 shapes
// ============================================================

/**
 * E-shape maj9
 * Prototype: open Emaj9 → 0,2,1,1,0,2 → E B D# G# B F#
 * Intervals:               1P 5P 7M 3M 5P 9M
 * Applied to F: 1 3 2 2 1 3 (span 2). Complete 5-tone chord — no omission.
 */
export const EXT_CHORD_E_MAJ9: ChordShape = {
  name: "E Shape maj9",
  system: "caged",
  strings: ["1P", "5P", "7M", "3M", "5P", "9M"],
  fingers: [1, 3, 2, 2, 1, 4],
  barres: [
    { fret: 0, fromString: 0, toString: 4, finger: 1 },
    { fret: 1, fromString: 2, toString: 3, finger: 2 },
  ],
  rootString: 0,
  chordType: "maj9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape maj9
 * Prototype: the universal movable "maj9" shell, commonly taught rooted at
 * C: x,3,2,4,3,x → C E B D
 * Intervals:          1P 3M 7M 9M
 * Applied to C directly: x 3 2 4 3 x (span 2). Omits the 5th (priority 1);
 * `detect` on this shell returns `[]` (expected for a partial voicing,
 * D-007 — no full-chord label for the incomplete grip).
 */
export const EXT_CHORD_A_MAJ9: ChordShape = {
  name: "A Shape maj9",
  system: "caged",
  strings: [null, "1P", "3M", "7M", "9M", null],
  fingers: [null, 2, 1, 4, 3, null],
  barres: [],
  rootString: 1,
  chordType: "maj9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P"],
};

// ============================================================
// m9 shapes
// ============================================================

/**
 * E-shape m9
 * Prototype: open Em9 → 0,2,0,0,0,2 → E B D G B F#
 * Intervals:             1P 5P 7m 3m 5P 9M
 * Applied to F: 1 3 1 1 1 3 (span 2). Complete 5-tone chord — no omission.
 */
export const EXT_CHORD_E_M9: ChordShape = {
  name: "E Shape m9",
  system: "caged",
  strings: ["1P", "5P", "7m", "3m", "5P", "9M"],
  fingers: [1, 2, 1, 1, 1, 3],
  barres: [{ fret: 0, fromString: 0, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "m9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape m9
 * Prototype: the universal movable "m9" shell, commonly taught rooted at
 * C: x,3,1,3,3,x → C Eb Bb D
 * Intervals:          1P 3m 7m 9M
 * Applied to C directly: x 3 1 3 3 x (span 2). Omits the 5th (priority 1);
 * `detect` on this shell returns `[]` (expected for a partial voicing,
 * D-007).
 */
export const EXT_CHORD_A_M9: ChordShape = {
  name: "A Shape m9",
  system: "caged",
  strings: [null, "1P", "3m", "7m", "9M", null],
  fingers: [null, 2, 1, 3, 3, null],
  barres: [{ fret: 3, fromString: 3, toString: 4, finger: 3 }],
  rootString: 1,
  chordType: "m9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P"],
};

// ============================================================
// add9 shapes
// ============================================================

/**
 * E-shape add9
 * Prototype: open Eadd9 → 0,2,2,1,0,2 → E B E G# B F#
 * Intervals:                1P 5P 1P 3M 5P 9M
 * Applied to F: 1 3 3 2 1 3 (span 2). Complete 4-tone chord (1P 3M 5P 9M,
 * no 7th) — no omission.
 * Identification note: full voicing detects as `${root}Madd9` (e.g.
 * `FMadd9`), the documented `add9` alias — see the divergence catalog.
 */
export const EXT_CHORD_E_ADD9: ChordShape = {
  name: "E Shape add9",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "5P", "9M"],
  fingers: [1, 2, 2, 3, 1, 4],
  barres: [
    { fret: 0, fromString: 0, toString: 4, finger: 1 },
    { fret: 2, fromString: 1, toString: 2, finger: 2 },
  ],
  rootString: 0,
  chordType: "add9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape add9
 * Prototype: the common movable "add9" shape, commonly taught rooted at
 * C: x,3,2,0,3,x → C E G D (open G string as the 5th)
 * Intervals:          1P 3M 5P 9M
 * Applied to C directly: x 3 2 0 3 x (span 3). Complete 4-tone chord — no
 * omission. Identification note: full voicing detects as `${root}Madd9`
 * (e.g. `CMadd9`), the documented `add9` alias.
 */
export const EXT_CHORD_A_ADD9: ChordShape = {
  name: "A Shape add9",
  system: "caged",
  strings: [null, "1P", "3M", "5P", "9M", null],
  fingers: [null, 2, 1, 0, 3, null],
  barres: [],
  rootString: 1,
  chordType: "add9",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
};

export const EXTENDED_CHORD_SHAPES: ChordShape[] = [
  EXT_CHORD_E_6,
  EXT_CHORD_A_6,
  EXT_CHORD_E_M6,
  EXT_CHORD_A_M6,
  EXT_CHORD_E_9,
  EXT_CHORD_A_9,
  EXT_CHORD_E_MAJ9,
  EXT_CHORD_A_MAJ9,
  EXT_CHORD_E_M9,
  EXT_CHORD_A_M9,
  EXT_CHORD_E_ADD9,
  EXT_CHORD_A_ADD9,
];

// Register all extended chord shapes
EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes));
