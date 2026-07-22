/**
 * The 5 CAGED major chord shapes.
 * Each shape defines one interval per string (or null for muted strings),
 * plus fingering and barre information.
 *
 * Shapes are registered into the chord shape registry at import time.
 */

import { chordShapes, ChordShape } from "../shape";

export const CAGED_CHORD_E: ChordShape = {
  name: "E Shape Major",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
};

// A-shape barre chord (e.g. Bb at fret 1: x13331): the index finger (1) forms
// a full barre across strings 1-5 at the base fret, while the ring finger (3)
// flat-barres the top three strings (2-4) two frets higher. Both repeated
// finger numbers are backed by an explicit barre entry (CR-005/CR-006 sweep).
export const CAGED_CHORD_A: ChordShape = {
  name: "A Shape Major",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 1, 3, 3, 3, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 4, finger: 3 },
  ],
  rootString: 1,
};

export const CAGED_CHORD_D: ChordShape = {
  name: "D Shape Major",
  system: "caged",
  strings: [null, null, "1P", "5P", "1P", "3M"],
  fingers: [null, null, 1, 2, 3, 4],
  barres: [],
  rootString: 2,
};

// C-shape barre chord (movable — the open-string frets 3M/1P on strings 3
// and 5 of the open C-major grip become a two-string mini-barre at the base
// fret when transposed; finger 0 is invalid once moved off the nut, CR-005).
export const CAGED_CHORD_C: ChordShape = {
  name: "C Shape Major",
  system: "caged",
  strings: [null, "1P", "3M", "5P", "1P", "3M"],
  fingers: [null, 4, 3, 1, 2, 1],
  barres: [{ fret: 0, fromString: 3, toString: 5, finger: 1 }],
  rootString: 1,
};

// G-shape barre chord (movable — the three open strings of the open
// G-major grip (D/G/B) become a three-string mini-barre at the base fret
// when transposed; finger 0 is invalid once moved off the nut, CR-005).
export const CAGED_CHORD_G: ChordShape = {
  name: "G Shape Major",
  system: "caged",
  strings: ["1P", "3M", "5P", "1P", "3M", "1P"],
  fingers: [2, 1, 4, 4, 4, 3],
  barres: [{ fret: 0, fromString: 2, toString: 4, finger: 4 }],
  rootString: 0,
};

// Register all CAGED chord shapes
[
  CAGED_CHORD_E,
  CAGED_CHORD_A,
  CAGED_CHORD_D,
  CAGED_CHORD_C,
  CAGED_CHORD_G,
].forEach(chordShapes.add.bind(chordShapes));
