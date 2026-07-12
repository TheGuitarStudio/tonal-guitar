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
// Populated tier-by-tier per
// .tonal-guitar/features/extended-chord-shapes-import/tasks.md:
//   Tier 1 — 6, m6, 9, maj9, m9, add9
//   Tier 2 — 13, dim7, mMaj7, 7sus4, 6/9
//   Tier 3 — 7b9, 7#9, 7#5, 7b5   (this task group)
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
//
// Tier 2 identification note (empirically verified the same way):
//   - `13` E-form is a FULL 6-tone voicing (the open-E13 grip) and detects
//     cleanly (`F13`). The A-form `13` is the classic 5-string grip that
//     omits the 5th (priority 1) — `detect` returns `C13no5` (partial,
//     D-007; chroma-subset assertion only).
//   - `dim7` full voicings detect exactly (`Fdim7`, `Cdim7` first), with
//     the three enharmonic-root inversions as secondary entries (the chord
//     is symmetric).
//   - `mMaj7` full voicings detect as `${root}m/ma7` (e.g. `Fm/ma7`) — the
//     documented alias from the divergence catalog above.
//   - `7sus4` full voicings detect exactly (`F7sus4`, `C7sus4` first).
//   - `6/9` full voicings detect as `${root}6add9` (e.g. `G6add9`) — the
//     documented alias. `Chord.get("C6/9")` resolves non-empty with symbol
//     `C6/9`, so the `chordType` key stays `6/9` per the naming contract.
//
// Tier 3 identification note (empirically verified the same way):
//   - `7b9` E-form is a FULL 5-tone voicing (open-E7b9-style grip, root/5th
//     doubled) and detects cleanly (`F7b9` first). The A-form `7b9` is the
//     classic movable "diminished-shape" shell (5th omitted, priority 1) —
//     `detect` on it returns `Calt7` (a partial/alternate label, not `C7b9`
//     or a documented alias); expected per D-007, asserted only as a
//     chroma subset, never a full-chord `detect` match.
//   - `7#9` E-form is a FULL 5-tone voicing (the open "E7#9" grip — same
//     skeleton as the Tier 1 `E Shape 9`, with the top string raised a
//     semitone) and detects cleanly (`F7#9`). The A-form `7#9` is the
//     famous "Hendrix chord" shell (5th omitted) — `detect` returns `[]`
//     for the incomplete grip (expected, D-007; chroma-subset only).
//   - `7#5` is a 4-tone chord (`1P 3M 5A 7m`) with no 5th to omit — the
//     augmented 5th itself is the (only) 5th present, so both forms are
//     FULL voicings. `detect` on both forms returns the exact symbol first
//     (`F7#5` / `C7#5`), with `F7b13`/`C7b13` as a secondary, non-divergent
//     alias — matching the divergence-catalog row above. Registered as
//     `7#5`, never `aug7`.
//   - `7b5` is likewise a 4-tone chord (`1P 3M 5d 7m`) with no extra 5th to
//     omit — both forms are FULL voicings and `detect` returns the exact
//     symbol first (`F7b5` / `C7b5`).
// ============================================================

// ============================================================
// 6 (major sixth) shapes
// ============================================================

/**
 * E-shape 6
 * Prototype: open E6 → 0,2,2,1,2,x → E B E G# C# (top string muted)
 * Intervals:            1P 5P 1P 3M 6M x
 * Applied to F (avoids the open-string edge case): 1 3 3 2 3 x (span 2).
 * Complete 4-tone chord (1P 3M 5P 6M) — no omission.
 */
export const EXT_CHORD_E_6: ChordShape = {
  name: "E Shape 6",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "6M", null],
  fingers: [1, 3, 3, 2, 4, null],
  barres: [
    { fret: 0, fromString: 0, toString: 4, finger: 1 },
    { fret: 2, fromString: 1, toString: 2, finger: 3 },
  ],
  rootString: 0,
  chordType: "6",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4],
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
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
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
};

// ============================================================
// 13 (dominant thirteenth) shapes
// ============================================================

/**
 * E-shape 13
 * Prototype: open E13 → 0,2,0,1,2,2 → E B D G# C# F#
 * Intervals:             1P 5P 7m 3M 13M 9M
 * Applied to F: 1 3 1 2 3 3 (span 2). Complete 6-tone chord (1P 3M 5P 7m
 * 9M 13M) — no omission; `detect` returns the exact name (`F13`).
 */
export const EXT_CHORD_E_13: ChordShape = {
  name: "E Shape 13",
  system: "caged",
  strings: ["1P", "5P", "7m", "3M", "13M", "9M"],
  fingers: [1, 3, 1, 2, 4, 4],
  barres: [
    { fret: 0, fromString: 0, toString: 2, finger: 1 },
    { fret: 2, fromString: 4, toString: 5, finger: 4 },
  ],
  rootString: 0,
  chordType: "13",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 13
 * Prototype: the standard movable 13th grip, commonly taught rooted at
 * C: x,3,2,3,3,5 → C E Bb D A
 * Intervals:      1P 3M 7m 9M 13M
 * Applied to C directly (this *is* the reference root/fret): x 3 2 3 3 5
 * (span 3). Omits the 5th (priority 1) per the 6-tone omission rule —
 * root/3rd/♭7 plus both extensions (9th, 13th) retained. `detect` on this
 * grip returns `C13no5`, not `C13` (expected for a partial voicing,
 * D-007).
 */
export const EXT_CHORD_A_13: ChordShape = {
  name: "A Shape 13",
  system: "caged",
  strings: [null, "1P", "3M", "7m", "9M", "13M"],
  fingers: [null, 2, 1, 3, 3, 4],
  barres: [{ fret: 3, fromString: 3, toString: 4, finger: 3 }],
  rootString: 1,
  chordType: "13",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
  omittedIntervals: ["5P"],
};

// ============================================================
// dim7 (diminished seventh) shapes
// ============================================================

/**
 * E-shape dim7
 * Prototype: the classic 6th-string-root dim7 grip at Fdim7 →
 * 1,x,0,1,0,x → F Ebb Ab Cb
 * Intervals:    1P  x 7d 3m 5d  x
 * Applied to F directly: 1 x 0 1 0 x (span 1). Complete 4-tone chord —
 * no omission. The chord is symmetric (stacked minor thirds), so `detect`
 * returns the root-position name first (`Fdim7`) with the three
 * enharmonic-root inversions as secondary entries.
 */
export const EXT_CHORD_E_DIM7: ChordShape = {
  name: "E Shape dim7",
  system: "caged",
  strings: ["1P", null, "7d", "3m", "5d", null],
  fingers: [2, null, 1, 3, 1, null],
  barres: [{ fret: 0, fromString: 2, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "dim7",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 2, 3, 4],
};

/**
 * A-shape dim7
 * Prototype: the classic 5th-string-root dim7 grip at Cdim7 →
 * x,3,x,2,4,2 → C Bbb Eb Gb
 * Intervals:     x 1P  x 7d 3m 5d
 * Applied to C directly: x 3 x 2 4 2 (span 2). Complete 4-tone chord —
 * no omission; `detect` returns `Cdim7` first (symmetric-chord inversions
 * follow).
 */
export const EXT_CHORD_A_DIM7: ChordShape = {
  name: "A Shape dim7",
  system: "caged",
  strings: [null, "1P", null, "7d", "3m", "5d"],
  fingers: [null, 2, null, 1, 3, 1],
  barres: [{ fret: 2, fromString: 3, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "dim7",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 3, 4, 5],
};

// ============================================================
// mMaj7 (minor-major seventh) shapes
// ============================================================

/**
 * E-shape mMaj7
 * Prototype: open EmMaj7 → 0,2,1,0,0,0 → E B D# G B E
 * Intervals:                1P 5P 7M 3m 5P 1P
 * Applied to F: 1 3 2 1 1 1 (span 2). Complete 4-tone chord (1P 3m 5P 7M,
 * root/5th doubled) — no omission.
 * Identification note: full voicing detects as `${root}m/ma7` (e.g.
 * `Fm/ma7`), the documented `mMaj7` alias — see the divergence catalog.
 */
export const EXT_CHORD_E_MMAJ7: ChordShape = {
  name: "E Shape mMaj7",
  system: "caged",
  strings: ["1P", "5P", "7M", "3m", "5P", "1P"],
  fingers: [1, 3, 2, 1, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "mMaj7",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape mMaj7
 * Prototype: open AmMaj7 → x,0,2,1,1,0 → A E G# C E
 * Intervals:                 x 1P 5P 7M 3m 5P
 * Applied to C: x 3 5 4 4 3 (span 2). Complete 4-tone chord — no
 * omission. Identification note: full voicing detects as `${root}m/ma7`
 * (e.g. `Cm/ma7`), the documented `mMaj7` alias.
 */
export const EXT_CHORD_A_MMAJ7: ChordShape = {
  name: "A Shape mMaj7",
  system: "caged",
  strings: [null, "1P", "5P", "7M", "3m", "5P"],
  fingers: [null, 0, 3, 1, 2, 0],
  barres: [],
  rootString: 1,
  chordType: "mMaj7",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

// ============================================================
// 7sus4 (suspended dominant seventh) shapes
// ============================================================

/**
 * E-shape 7sus4
 * Prototype: open E7sus4 → 0,2,0,2,0,0 → E B D A B E
 * Intervals:                1P 5P 7m 4P 5P 1P
 * Applied to F: 1 3 1 3 1 1 (span 2). Complete 4-tone chord (1P 4P 5P 7m
 * — the 4th replaces the 3rd, no 3rd anywhere in the grip) — no omission;
 * `detect` returns the exact name (`F7sus4`).
 */
export const EXT_CHORD_E_7SUS4: ChordShape = {
  name: "E Shape 7sus4",
  system: "caged",
  strings: ["1P", "5P", "7m", "4P", "5P", "1P"],
  fingers: [1, 3, 1, 4, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "7sus4",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 7sus4
 * Prototype: open A7sus4 → x,0,2,0,3,0 → A E G D E
 * Intervals:                 x 1P 5P 7m 4P 5P
 * Applied to C: x 3 5 3 6 3 (span 3). Complete 4-tone chord (no 3rd —
 * suspended) — no omission; `detect` returns the exact name (`C7sus4`).
 */
export const EXT_CHORD_A_7SUS4: ChordShape = {
  name: "A Shape 7sus4",
  system: "caged",
  strings: [null, "1P", "5P", "7m", "4P", "5P"],
  fingers: [null, 0, 2, 0, 3, 0],
  barres: [],
  rootString: 1,
  chordType: "7sus4",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

// ============================================================
// 6/9 (six-nine) shapes
// ============================================================

/**
 * E-shape 6/9
 * Prototype: the classic movable 6th-string-root six-nine grip at G6/9 →
 * 3,2,2,2,3,x → G B E A D
 * Intervals:    1P 3M 6M 9M 5P x
 * Applied to G directly: 3 2 2 2 3 x (span 1). Complete 5-tone chord —
 * no omission. Identification note: full voicing detects as
 * `${root}6add9` (e.g. `G6add9`), the documented `6/9` alias — the
 * `chordType` key stays `6/9` (the `Chord.get` symbol; see the divergence
 * catalog).
 */
export const EXT_CHORD_E_69: ChordShape = {
  name: "E Shape 6/9",
  system: "caged",
  strings: ["1P", "3M", "6M", "9M", "5P", null],
  fingers: [2, 1, 1, 1, 3, null],
  barres: [{ fret: 2, fromString: 1, toString: 3, finger: 1 }],
  rootString: 0,
  chordType: "6/9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4],
};

/**
 * A-shape 6/9
 * Prototype: the classic movable 5th-string-root six-nine grip at C6/9 →
 * x,3,2,2,3,3 → C E A D G
 * Intervals:     x 1P 3M 6M 9M 5P
 * Applied to C directly: x 3 2 2 3 3 (span 1). Complete 5-tone chord —
 * no omission. Identification note: full voicing detects as
 * `${root}6add9` (e.g. `C6add9`), the documented `6/9` alias.
 */
export const EXT_CHORD_A_69: ChordShape = {
  name: "A Shape 6/9",
  system: "caged",
  strings: [null, "1P", "3M", "6M", "9M", "5P"],
  fingers: [null, 2, 1, 1, 3, 4],
  barres: [{ fret: 2, fromString: 2, toString: 3, finger: 1 }],
  rootString: 1,
  chordType: "6/9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

// ============================================================
// 7b9 (dominant seventh flat nine) shapes
// ============================================================

/**
 * E-shape 7b9
 * Prototype: the open E7 shape (0,2,0,1,0,0 → E B D G# B E) with the high e
 * string raised a semitone to fret 1 → 0,2,0,1,0,1 → E B D G# B F.
 * Intervals:                            1P 5P 7m 3M 5P 9m
 * Applied to F: 1 3 1 2 1 2 (span 2). Complete 5-tone chord (1P 3M 5P 7m
 * 9m, root/5th doubled) — no omission; `detect` returns the exact name
 * first (`F7b9`).
 */
export const EXT_CHORD_E_7B9: ChordShape = {
  name: "E Shape 7b9",
  system: "caged",
  strings: ["1P", "5P", "7m", "3M", "5P", "9m"],
  fingers: [0, 3, 0, 1, 0, 2],
  barres: [],
  rootString: 0,
  chordType: "7b9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 7b9
 * Prototype: the classic movable "diminished-shape" 7b9 shell (built from
 * a dim7 grip a major third above the root), commonly taught rooted at
 * C: x,3,2,3,2,x → C E Bb Db
 * Intervals:          1P 3M 7m 9m
 * Applied to C directly (this *is* the reference root/fret): x 3 2 3 2 x
 * (span 1). Omits the 5th (priority 1) — the classic 4-string voicing;
 * `detect` on this shell returns `Calt7` (a partial/alternate label, not
 * `C7b9`) — expected for a partial voicing (D-007), asserted only as a
 * chroma subset.
 */
export const EXT_CHORD_A_7B9: ChordShape = {
  name: "A Shape 7b9",
  system: "caged",
  strings: [null, "1P", "3M", "7m", "9m", null],
  fingers: [null, 2, 1, 4, 3, null],
  barres: [],
  rootString: 1,
  chordType: "7b9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P"],
};

// ============================================================
// 7#9 (dominant seventh sharp nine, "Hendrix chord") shapes
// ============================================================

/**
 * E-shape 7#9
 * Prototype: the open "E7#9" grip — the same skeleton as the Tier 1
 * `E Shape 9` (0,2,0,1,0,2 → E B D G# B F#) with the high e string raised
 * one further semitone → 0,2,0,1,0,3 → E B D G# B G.
 * Intervals:               1P 5P 7m 3M 5P 9A
 * Applied to F: 1 3 1 2 1 4 (span 3). Complete 5-tone chord (1P 3M 5P 7m
 * 9A, root/5th doubled) — no omission; `detect` returns the exact name
 * first (`F7#9`).
 */
export const EXT_CHORD_E_7SHARP9: ChordShape = {
  name: "E Shape 7#9",
  system: "caged",
  strings: ["1P", "5P", "7m", "3M", "5P", "9A"],
  fingers: [1, 3, 1, 2, 1, 4],
  barres: [{ fret: 0, fromString: 0, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "7#9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape 7#9
 * Prototype: the famous "Hendrix chord" shell, commonly taught rooted at
 * C: x,3,2,3,4,x → C E Bb D#
 * Intervals:          1P 3M 7m 9A
 * Applied to C directly (this *is* the reference root/fret): x 3 2 3 4 x
 * (span 2). Omits the 5th (priority 1) — the canonical 4-string voicing
 * (real-world "Hendrix chord" voicings never include the 5th); `detect` on
 * this shell returns `[]` (expected for a partial voicing, D-007 — no
 * full-chord label for the incomplete grip).
 */
export const EXT_CHORD_A_7SHARP9: ChordShape = {
  name: "A Shape 7#9",
  system: "caged",
  strings: [null, "1P", "3M", "7m", "9A", null],
  fingers: [null, 2, 1, 3, 4, null],
  barres: [],
  rootString: 1,
  chordType: "7#9",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
  omittedIntervals: ["5P"],
};

// ============================================================
// 7#5 (dominant seventh sharp five / altered-aug) shapes
//
// Registered as `7#5` (the `Chord.get` symbol) — NOT `aug7`. `aug7` and
// `7#5` are the same Tonal chord (identical intervals `1P 3M 5A 7m`), but
// `Chord.get("Caug7").symbol` is `"Caug7"` (Tonal does not normalize it),
// while `detect` prefers `C7#5`. Only `7#5` is registered here; see the
// divergence catalog in the file header. This is a 4-tone chord with no
// natural 5th to drop — the augmented 5th is the only (and defining) 5th,
// so neither form has `omittedIntervals`.
// ============================================================

/**
 * E-shape 7#5
 * Prototype: the open "E7#5"/"Eaug7" grip → 0,x,0,1,1,0 → E x D G# C E
 * Intervals:                                  1P x 7m 3M 5A 1P
 * Applied to F: 1 x 1 2 2 1 (span 1). Complete 4-tone chord (1P 3M 5A 7m,
 * root doubled) — no omission; `detect` returns the exact name first
 * (`F7#5`, with `F7b13` as a secondary, non-divergent alias).
 */
export const EXT_CHORD_E_7SHARP5: ChordShape = {
  name: "E Shape 7#5",
  system: "caged",
  strings: ["1P", null, "7m", "3M", "5A", "1P"],
  fingers: [0, null, 0, 1, 1, 0],
  barres: [{ fret: 1, fromString: 3, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "7#5",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 2, 3, 4, 5],
};

/**
 * A-shape 7#5
 * Prototype: a compact movable altered-dominant grip, commonly taught
 * rooted at C: x,3,x,3,5,4 → C x Bb E G#
 * Intervals:      1P x 7m 3M 5A
 * Applied to C directly (this *is* the reference root/fret): x 3 x 3 5 4
 * (span 2). Complete 4-tone chord — no omission; `detect` returns the
 * exact name first (`C7#5`, with `C7b13` as a secondary, non-divergent
 * alias).
 */
export const EXT_CHORD_A_7SHARP5: ChordShape = {
  name: "A Shape 7#5",
  system: "caged",
  strings: [null, "1P", null, "7m", "3M", "5A"],
  fingers: [null, 1, null, 2, 4, 3],
  barres: [],
  rootString: 1,
  chordType: "7#5",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 3, 4, 5],
};

// ============================================================
// 7b5 (dominant seventh flat five) shapes
//
// A 4-tone chord (1P 3M 5d 7m) with no natural (perfect) 5th to drop — the
// diminished 5th is the only (and defining) 5th, so neither form has
// `omittedIntervals`.
// ============================================================

/**
 * E-shape 7b5
 * Prototype: a compact 4-string E-form grip → 0,1,0,1,x,x → E Bb D G# x x
 * Intervals:                                     1P 5d 7m 3M  x x
 * Applied to F: 1 2 1 2 x x (span 1). Complete 4-tone chord — no
 * omission; `detect` returns the exact name first (`F7b5`).
 */
export const EXT_CHORD_E_7B5: ChordShape = {
  name: "E Shape 7b5",
  system: "caged",
  strings: ["1P", "5d", "7m", "3M", null, null],
  fingers: [0, 1, 0, 2, null, null],
  barres: [],
  rootString: 0,
  chordType: "7b5",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [0, 1, 2, 3],
};

/**
 * A-shape 7b5
 * Prototype: a compact movable A-form grip, commonly taught rooted at
 * C: x,3,2,3,x,2 → C x E Bb x Gb
 * Intervals:          1P x 3M 7m x 5d
 * Applied to C directly (this *is* the reference root/fret): x 3 2 3 x 2
 * (span 1). Complete 4-tone chord — no omission; `detect` returns the
 * exact name first (`C7b5`).
 */
export const EXT_CHORD_A_7B5: ChordShape = {
  name: "A Shape 7b5",
  system: "caged",
  strings: [null, "1P", "3M", "7m", null, "5d"],
  fingers: [null, 3, 1, 4, null, 2],
  barres: [],
  rootString: 1,
  chordType: "7b5",
  voicingFamily: "extended",
  inversion: 0,
  stringSet: [1, 2, 3, 5],
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
  EXT_CHORD_E_13,
  EXT_CHORD_A_13,
  EXT_CHORD_E_DIM7,
  EXT_CHORD_A_DIM7,
  EXT_CHORD_E_MMAJ7,
  EXT_CHORD_A_MMAJ7,
  EXT_CHORD_E_7SUS4,
  EXT_CHORD_A_7SUS4,
  EXT_CHORD_E_69,
  EXT_CHORD_A_69,
  EXT_CHORD_E_7B9,
  EXT_CHORD_A_7B9,
  EXT_CHORD_E_7SHARP9,
  EXT_CHORD_A_7SHARP9,
  EXT_CHORD_E_7SHARP5,
  EXT_CHORD_A_7SHARP5,
  EXT_CHORD_E_7B5,
  EXT_CHORD_A_7B5,
];

// Register all extended chord shapes
EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes));
