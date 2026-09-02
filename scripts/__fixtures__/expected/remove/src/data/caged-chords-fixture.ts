// GENERATED FILE — managed by `npm run shapes:merge`. Edit via the Shape Workbench.

import { chordShapes, ChordShape } from "../shape";

// shapes-merge:begin CHORD_Z_SHAPE_FIXTURE_MINOR
export const CHORD_Z_SHAPE_FIXTURE_MINOR: ChordShape = {
  name: "Z Shape Fixture Minor",
  system: "caged",
  strings: [null, "1P", "3m", "5P", "1P", null],
  fingers: [null, 3, 1, 4, 2, null],
  barres: [],
  rootString: 1,
  chordType: "m",
  voicingFamily: "caged",
  cagedPosition: "C",
  parentShape: "C Shape Major",
  tags: ["caged", "triad", "core"],
};
// shapes-merge:end CHORD_Z_SHAPE_FIXTURE_MINOR

[CHORD_Z_SHAPE_FIXTURE_MINOR].forEach(chordShapes.add.bind(chordShapes));
