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
  strings: [
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M"],
    ["7M", "1P", "2M"],
  ],
  rootString: 0,
};

export const CAGED_D: ScaleShape = {
  name: "D Shape",
  system: "caged",
  strings: [
    ["2M", "3M", "4P"],
    ["5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
  ],
  rootString: 2,
};

export const CAGED_C: ScaleShape = {
  name: "C Shape",
  system: "caged",
  // Root on string 1 (A string)
  strings: [
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
  ],
  rootString: 1,
};

export const CAGED_A: ScaleShape = {
  name: "A Shape",
  system: "caged",
  // Root on string 1 (A string)
  strings: [
    ["5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M"],
  ],
  rootString: 1,
};

export const CAGED_G: ScaleShape = {
  name: "G Shape",
  system: "caged",
  // Root on string 0 (low E)
  strings: [
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
  ],
  rootString: 0,
};

// Register all CAGED scale shapes
[CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G].forEach(add);
