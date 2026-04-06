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

export const CAGED_CHORD_A: ChordShape = {
  name: "A Shape Major",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 1, 3, 3, 3, 1],
  barres: [],
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

export const CAGED_CHORD_C: ChordShape = {
  name: "C Shape Major",
  system: "caged",
  strings: [null, "3M", "1P", "5P", "1P", "3M"],
  fingers: [null, 3, 2, 0, 1, 0],
  barres: [],
  rootString: 1,
};

export const CAGED_CHORD_G: ChordShape = {
  name: "G Shape Major",
  system: "caged",
  strings: ["1P", "3M", "5P", "1P", "3M", "5P"],
  fingers: [2, 1, 0, 0, 0, 3],
  barres: [],
  rootString: 0,
};

// Register all CAGED chord shapes
[CAGED_CHORD_E, CAGED_CHORD_A, CAGED_CHORD_D, CAGED_CHORD_C, CAGED_CHORD_G].forEach(
  chordShapes.add.bind(chordShapes),
);
