/**
 * 7th-chord CAGED shapes for maj7, m7, 7 (dominant), and m7b5.
 *
 * Each shape mirrors the format of caged-chords.ts: one interval per string
 * (or null for muted/excluded strings), with the new harmonic-metadata fields
 * (chordType, voicingFamily, system, stringSet, inversion) populated per R-4.1.
 *
 * These are movable shapes — no canonicalRoot is set. Apply them to any root
 * via applyChordShape(shape, root).
 *
 * Coverage: E-shape, A-shape, and D-shape forms for each type. The E-shape
 * and A-shape carry the root on strings 0 and 1 respectively.
 *
 * Per-string intervals are derived from the standard open voicings transposed:
 *
 *   Emaj7 open 0,2,1,1,0,0 → E B D# G# B E → 1P 5P 7M 3M 5P 1P
 *   Em7   open 0,2,0,0,0,0 → E B D  G  B E → 1P 5P 7m 3m 5P 1P
 *   E7    open 0,2,0,1,0,0 → E B D  G# B E → 1P 5P 7m 3M 5P 1P
 *   Em7b5 voicing x,1,2,0,x,x → Bb D G → (as E-shape: 1P 5d 7m 3m x x)
 *
 *   Amaj7 open x,0,2,1,2,0 → A E G# C# E  → x 1P 5P 7M 3M 5P
 *   Am7   open x,0,2,0,1,0 → A E G  C  E  → x 1P 5P 7m 3m 5P
 *   A7    open x,0,2,0,2,0 → A E G  C# E  → x 1P 5P 7m 3M 5P
 *   Am7b5 voicing x,0,1,1,1,x → A Eb G C  → x 1P 5d 7m 3m x
 *
 *   Dmaj7 open x,x,0,2,2,2 → D A C# F#  → x x 1P 5P 7M 3M
 *   Dm7   open x,x,0,2,1,1 → D A C  F   → x x 1P 5P 7m 3m
 *   D7    open x,x,0,2,1,2 → D A C  F#  → x x 1P 5P 7m 3M
 *
 * Per-string interval order is low→high pitch (respecting the fretInWindow
 * pitch-order convention in build.ts so all shapes build correctly through
 * applyChordShape).
 *
 * Shapes are registered into the chord shape registry at import time.
 */

import { chordShapes, ChordShape } from "../shape";

// ============================================================
// maj7 shapes
// ============================================================

/**
 * E-shape maj7
 * Prototype: Emaj7 open 0,2,1,1,0,0 → E B D# G# B E
 * Intervals:  1P  5P  7M  3M  5P  1P
 */
export const CAGED_CHORD_E_MAJ7: ChordShape = {
  name: "E Shape maj7",
  system: "caged",
  strings: ["1P", "5P", "7M", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "maj7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape maj7
 * Prototype: Amaj7 open x,0,2,1,2,0 → A E G# C# E
 * Intervals:  x  1P  5P  7M  3M  5P
 */
export const CAGED_CHORD_A_MAJ7: ChordShape = {
  name: "A Shape maj7",
  system: "caged",
  strings: [null, "1P", "5P", "7M", "3M", "5P"],
  // Prototype x,0,2,1,2,0: strings 1 and 5 share the base fret (finger 0 in
  // the open voicing is invalid once transposed, CR-005) — joined into the
  // index-finger barre alongside string 1.
  fingers: [null, 1, 3, 4, 2, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "maj7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

/**
 * D-shape maj7
 * Prototype: Dmaj7 open x,x,0,2,2,2 → D A C# F#
 * Intervals:  x  x  1P  5P  7M  3M
 */
export const CAGED_CHORD_D_MAJ7: ChordShape = {
  name: "D Shape maj7",
  system: "caged",
  strings: [null, null, "1P", "5P", "7M", "3M"],
  // Prototype x,x,0,2,2,2 (CR-005/CR-006): the root (was finger 0, invalid
  // once transposed) gets its own finger; strings 3-5 are a genuine
  // three-string mini-barre (all at the same fret) backed by a barre entry.
  fingers: [null, null, 1, 2, 2, 2],
  barres: [{ fret: 2, fromString: 3, toString: 5, finger: 2 }],
  rootString: 2,
  chordType: "maj7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [2, 3, 4, 5],
};

// ============================================================
// m7 shapes
// ============================================================

/**
 * E-shape m7
 * Prototype: Em7 open 0,2,0,0,0,0 → E B D G B E
 * Intervals:   1P  5P  7m  3m  5P  1P
 */
export const CAGED_CHORD_E_M7: ChordShape = {
  name: "E Shape m7",
  system: "caged",
  strings: ["1P", "5P", "7m", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape m7
 * Prototype: Am7 open x,0,2,0,1,0 → A E G C E
 * Intervals:   x  1P  5P  7m  3m  5P
 */
export const CAGED_CHORD_A_M7: ChordShape = {
  name: "A Shape m7",
  system: "caged",
  strings: [null, "1P", "5P", "7m", "3m", "5P"],
  // Prototype x,0,2,0,1,0 (CR-005): strings 1, 3, and 5 share the base
  // fret — the open-voicing finger 0s are invalid once transposed, so all
  // three join the index-finger barre.
  fingers: [null, 1, 3, 1, 2, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

/**
 * D-shape m7
 * Prototype: Dm7 open x,x,0,2,1,1 → D A C F
 * Intervals:  x  x  1P  5P  7m  3m
 */
export const CAGED_CHORD_D_M7: ChordShape = {
  name: "D Shape m7",
  system: "caged",
  strings: [null, null, "1P", "5P", "7m", "3m"],
  // Prototype x,x,0,2,1,1 (CR-005/CR-006): the root (was finger 0) gets its
  // own finger; strings 4-5 are a genuine two-string mini-barre one fret up.
  fingers: [null, null, 1, 3, 2, 2],
  barres: [{ fret: 1, fromString: 4, toString: 5, finger: 2 }],
  rootString: 2,
  chordType: "m7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [2, 3, 4, 5],
};

// ============================================================
// 7 (dominant seventh) shapes
// ============================================================

/**
 * E-shape dominant 7
 * Prototype: E7 open 0,2,0,1,0,0 → E B D G# B E
 * Intervals:        1P  5P  7m  3M  5P  1P
 */
export const CAGED_CHORD_E_DOM7: ChordShape = {
  name: "E Shape 7",
  system: "caged",
  strings: ["1P", "5P", "7m", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

/**
 * A-shape dominant 7
 * Prototype: A7 open x,0,2,0,2,0 → A E G C# E
 * Intervals:        x  1P  5P  7m  3M  5P
 */
export const CAGED_CHORD_A_DOM7: ChordShape = {
  name: "A Shape 7",
  system: "caged",
  strings: [null, "1P", "5P", "7m", "3M", "5P"],
  // Prototype x,0,2,0,2,0 (CR-005): strings 1, 3, and 5 share the base
  // fret and join the index-finger barre. Strings 2 and 4 both land on the
  // same higher fret but a lower-fret string sits between them, so they
  // cannot share a barre and get distinct fingers instead.
  fingers: [null, 1, 2, 1, 3, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4, 5],
};

/**
 * D-shape dominant 7
 * Prototype: D7 open x,x,0,2,1,2 → D A C F#
 * Intervals:         x  x  1P  5P  7m  3M
 */
export const CAGED_CHORD_D_DOM7: ChordShape = {
  name: "D Shape 7",
  system: "caged",
  strings: [null, null, "1P", "5P", "7m", "3M"],
  // Prototype x,x,0,2,1,2 (CR-005): the root (was finger 0) gets its own
  // finger. Strings 3 and 5 land on the same higher fret but string 4 sits
  // between them one fret lower, so a barre would misfret it — distinct
  // fingers for all three upper notes instead.
  fingers: [null, null, 1, 3, 2, 4],
  barres: [],
  rootString: 2,
  chordType: "7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [2, 3, 4, 5],
};

// ============================================================
// m7b5 (half-diminished) shapes
// ============================================================

/**
 * E-shape m7b5
 * Common 4-string voicing (low-E root): 0,1,0,0,x,x → E Bb D G
 * Intervals: 1P 5d 7m 3m x x
 * (Played strings 0-3 only)
 */
export const CAGED_CHORD_E_M7B5: ChordShape = {
  name: "E Shape m7b5",
  system: "caged",
  strings: ["1P", "5d", "7m", "3m", null, null],
  // Prototype 0,1,0,0 (CR-005): strings 0, 2, and 3 share the base fret
  // (finger 0 in the open voicing is invalid once transposed) and join the
  // index-finger barre; string 1 is the one genuinely separate, higher note.
  fingers: [1, 2, 1, 1, null, null],
  barres: [{ fret: 0, fromString: 0, toString: 3, finger: 1 }],
  rootString: 0,
  chordType: "m7b5",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3],
};

/**
 * A-shape m7b5
 * Prototype: Am7b5 x,0,1,1,1,x → A Eb G C
 * Intervals:       x  1P  5d  7m  3m  x
 */
export const CAGED_CHORD_A_M7B5: ChordShape = {
  name: "A Shape m7b5",
  system: "caged",
  strings: [null, "1P", "5d", "7m", "3m", null],
  // Interval math (1P/5d/7m/3m against standard tuning) puts strings 1 and 3
  // on the same base fret and strings 2 and 4 one fret higher — but string 3
  // sits between 2 and 4 at the *lower* base fret, which blocks a barre
  // across 2-4 (CR-005: finger 0 was invalid once transposed off the nut).
  fingers: [null, 1, 2, 1, 3, null],
  barres: [{ fret: 0, fromString: 1, toString: 3, finger: 1 }],
  rootString: 1,
  chordType: "m7b5",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [1, 2, 3, 4],
};

// Register all 7th-chord CAGED shapes
[
  CAGED_CHORD_E_MAJ7,
  CAGED_CHORD_A_MAJ7,
  CAGED_CHORD_D_MAJ7,
  CAGED_CHORD_E_M7,
  CAGED_CHORD_A_M7,
  CAGED_CHORD_D_M7,
  CAGED_CHORD_E_DOM7,
  CAGED_CHORD_A_DOM7,
  CAGED_CHORD_D_DOM7,
  CAGED_CHORD_E_M7B5,
  CAGED_CHORD_A_M7B5,
].forEach(chordShapes.add.bind(chordShapes));
