/**
 * The 7 Three-Notes-Per-String (3NPS) patterns for the major scale.
 *
 * Each pattern has exactly 3 notes per string across all 6 strings (18 notes total).
 * Pattern 1 = Ionian (starts on root), Pattern 2 = Dorian, etc.
 * All 7 patterns use the same pitch classes — they differ by starting position.
 *
 * Patterns are registered into the scale shape registry at import time.
 */

import { add, ScaleShape } from "../shape";

export const NPS_PATTERN_1: ScaleShape = {
  name: "3NPS Pattern 1 (Ionian)",
  system: "3nps",
  strings: [
    ["1P", "2M", "3M"],  // low E
    ["4P", "5P", "6M"],  // A
    ["7M", "1P", "2M"],  // D
    ["3M", "4P", "5P"],  // G
    ["6M", "7M", "1P"],  // B
    ["2M", "3M", "4P"],  // high E
  ],
  rootString: 0,
};

export const NPS_PATTERN_2: ScaleShape = {
  name: "3NPS Pattern 2 (Dorian)",
  system: "3nps",
  strings: [
    ["2M", "3M", "4P"],
    ["5P", "6M", "7M"],
    ["1P", "2M", "3M"],
    ["4P", "5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
  ],
  rootString: 0,
};

export const NPS_PATTERN_3: ScaleShape = {
  name: "3NPS Pattern 3 (Phrygian)",
  system: "3nps",
  strings: [
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M", "7M"],
    ["1P", "2M", "3M"],
    ["4P", "5P", "6M"],
  ],
  rootString: 0,
};

export const NPS_PATTERN_4: ScaleShape = {
  name: "3NPS Pattern 4 (Lydian)",
  system: "3nps",
  strings: [
    ["4P", "5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M", "7M"],
  ],
  rootString: 0,
};

export const NPS_PATTERN_5: ScaleShape = {
  name: "3NPS Pattern 5 (Mixolydian)",
  system: "3nps",
  strings: [
    ["5P", "6M", "7M"],
    ["1P", "2M", "3M"],
    ["4P", "5P", "6M"],
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
  ],
  rootString: 0,
};

export const NPS_PATTERN_6: ScaleShape = {
  name: "3NPS Pattern 6 (Aeolian)",
  system: "3nps",
  strings: [
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M", "7M"],
    ["1P", "2M", "3M"],
    ["4P", "5P", "6M"],
    ["7M", "1P", "2M"],
  ],
  rootString: 0,
};

export const NPS_PATTERN_7: ScaleShape = {
  name: "3NPS Pattern 7 (Locrian)",
  system: "3nps",
  strings: [
    ["7M", "1P", "2M"],
    ["3M", "4P", "5P"],
    ["6M", "7M", "1P"],
    ["2M", "3M", "4P"],
    ["5P", "6M", "7M"],
    ["1P", "2M", "3M"],
  ],
  rootString: 0,
};

// Register all 3NPS patterns
[
  NPS_PATTERN_1,
  NPS_PATTERN_2,
  NPS_PATTERN_3,
  NPS_PATTERN_4,
  NPS_PATTERN_5,
  NPS_PATTERN_6,
  NPS_PATTERN_7,
].forEach(add);
