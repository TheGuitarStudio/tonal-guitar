// GENERATED FILE — managed by `npm run shapes:merge`. Edit via the Shape Workbench.

import { chordShapes, ChordShape } from "../shape";

// shapes-merge:begin CAGED_CHORD_EM
export const CAGED_CHORD_EM: ChordShape = {
  name: "E Shape Minor",
  system: "caged",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 1, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m",
  inversion: 0,
  voicingFamily: "caged",
  stringSet: [0, 1, 2, 3, 4, 5],
  cagedPosition: "E",
  parentShape: "E Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CAGED_CHORD_EM

// shapes-merge:begin CAGED_CHORD_AM
export const CAGED_CHORD_AM: ChordShape = {
  name: "A Shape Minor",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3m", "5P"],
  fingers: [null, 1, 3, 4, 2, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m",
  inversion: 0,
  voicingFamily: "caged",
  stringSet: [1, 2, 3, 4, 5],
  cagedPosition: "A",
  parentShape: "A Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CAGED_CHORD_AM

// shapes-merge:begin CAGED_CHORD_GM
export const CAGED_CHORD_GM: ChordShape = {
  name: "G Shape Minor",
  system: "caged",
  strings: ["1P", "3m", "5P", "1P", "5P", "1P"],
  fingers: [3, 2, 1, 1, 4, 4],
  barres: [
    { fret: 0, fromString: 2, toString: 3, finger: 1 },
    { fret: 3, fromString: 4, toString: 5, finger: 4 },
  ],
  rootString: 0,
  chordType: "m",
  inversion: 0,
  voicingFamily: "caged",
  stringSet: [0, 1, 2, 3, 4, 5],
  cagedPosition: "G",
  parentShape: "G Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CAGED_CHORD_GM

// shapes-merge:begin CAGED_CHORD_DM
export const CAGED_CHORD_DM: ChordShape = {
  name: "D Shape Minor",
  system: "caged",
  strings: [null, null, "1P", "5P", "1P", "3m"],
  fingers: [null, null, 1, 3, 4, 2],
  barres: [],
  rootString: 2,
  chordType: "m",
  inversion: 0,
  voicingFamily: "caged",
  stringSet: [2, 3, 4, 5],
  cagedPosition: "D",
  parentShape: "D Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CAGED_CHORD_DM

// shapes-merge:begin CAGED_CHORD_CM
export const CAGED_CHORD_CM: ChordShape = {
  name: "C Shape Minor",
  system: "caged",
  strings: [null, "1P", "3m", "5P", "1P", null],
  fingers: [null, 4, 2, 1, 3, null],
  barres: [],
  rootString: 1,
  chordType: "m",
  inversion: 0,
  voicingFamily: "caged",
  stringSet: [1, 2, 3, 4],
  cagedPosition: "C",
  parentShape: "C Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CAGED_CHORD_CM

[CAGED_CHORD_EM, CAGED_CHORD_AM, CAGED_CHORD_GM, CAGED_CHORD_DM, CAGED_CHORD_CM].forEach(chordShapes.add.bind(chordShapes));
