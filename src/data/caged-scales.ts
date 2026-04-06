/**
 * The 5 CAGED major scale shapes.
 * Each shape covers all 7 scale degrees across 6 strings within a ~4-5 fret span.
 *
 * Shapes connect sequentially up the neck: E → D → C → A → G → E
 * Intervals are relative to the scale root.
 *
 * Shapes are registered into the scale shape registry at import time.
 */

import { add, ScaleShape } from "../shape";

export const CAGED_E: ScaleShape = {
  name: "E Shape",
  system: "caged",
  // Root on string 0 (low E) and string 5 (high E)
  strings: [
    ["1P", "2M"],         // low E: root, 2nd
    ["4P", "5P"],         // A:     4th, 5th
    ["7M", "1P", "2M"],  // D:     7th, root, 2nd
    ["3M", "4P", "5P"],  // G:     3rd, 4th, 5th
    ["6M", "7M"],         // B:     6th, 7th
    ["1P", "2M", "3M"],  // high E: root, 2nd, 3rd
  ],
  rootString: 0,
};

export const CAGED_D: ScaleShape = {
  name: "D Shape",
  system: "caged",
  // Root on string 2 (D string)
  strings: [
    ["2M", "3M", "4P"],  // low E: 2nd, 3rd, 4th
    ["5P", "6M", "7M"],  // A:     5th, 6th, 7th
    ["1P", "2M", "3M"],  // D:     root, 2nd, 3rd
    ["4P", "5P", "6M"],  // G:     4th, 5th, 6th
    ["7M", "1P", "2M"],  // B:     7th, root, 2nd
    ["3M", "4P", "5P"],  // high E: 3rd, 4th, 5th
  ],
  rootString: 2,
};

export const CAGED_C: ScaleShape = {
  name: "C Shape",
  system: "caged",
  // Root on string 1 (A string)
  strings: [
    ["5P", "6M"],         // low E: 5th, 6th
    ["1P", "2M", "3M"],  // A:     root, 2nd, 3rd
    ["4P", "5P", "6M"],  // D:     4th, 5th, 6th
    ["7M", "1P", "2M"],  // G:     7th, root, 2nd
    ["3M", "4P"],         // B:     3rd, 4th
    ["6M", "7M", "1P"],  // high E: 6th, 7th, root
  ],
  rootString: 1,
};

export const CAGED_A: ScaleShape = {
  name: "A Shape",
  system: "caged",
  // Root on string 1 (A string)
  strings: [
    ["7M", "1P"],         // low E: 7th, root
    ["3M", "4P", "5P"],  // A:     3rd, 4th, 5th
    ["6M", "7M", "1P"],  // D:     6th, 7th, root
    ["2M", "3M", "4P"],  // G:     2nd, 3rd, 4th
    ["5P", "6M"],         // B:     5th, 6th
    ["1P", "2M"],         // high E: root, 2nd
  ],
  rootString: 1,
};

export const CAGED_G: ScaleShape = {
  name: "G Shape",
  system: "caged",
  // Root on string 0 (low E)
  strings: [
    ["5P", "6M", "7M"],  // low E: 5th, 6th, 7th
    ["1P", "2M", "3M"],  // A:     root, 2nd, 3rd
    ["4P", "5P"],         // D:     4th, 5th
    ["1P", "2M"],         // G:     root, 2nd
    ["3M", "4P", "5P"],  // B:     3rd, 4th, 5th
    ["6M", "7M"],         // high E: 6th, 7th
  ],
  rootString: 0,
};

// Register all CAGED scale shapes
[CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G].forEach(add);
