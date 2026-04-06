/**
 * The 5 minor pentatonic box shapes.
 *
 * Box 1 starts on the root (1P), with subsequent boxes starting on successive
 * pentatonic scale degrees: 3m, 4P, 5P, 7m.
 *
 * Each box covers all 5 pentatonic scale degrees across all 6 strings (12 notes).
 *
 * Boxes are registered into the scale shape registry at import time.
 */

import { add, ScaleShape } from "../shape";

export const PENTA_BOX_1: ScaleShape = {
  name: "Pentatonic Box 1",
  system: "pentatonic",
  strings: [
    ["1P", "3m"],  // low E
    ["4P", "5P"],  // A
    ["7m", "1P"],  // D
    ["3m", "4P"],  // G
    ["5P", "7m"],  // B
    ["1P", "3m"],  // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_2: ScaleShape = {
  name: "Pentatonic Box 2",
  system: "pentatonic",
  strings: [
    ["3m", "4P"],  // low E
    ["5P", "7m"],  // A
    ["1P", "3m"],  // D
    ["4P", "5P"],  // G
    ["7m", "1P"],  // B
    ["3m", "4P"],  // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_3: ScaleShape = {
  name: "Pentatonic Box 3",
  system: "pentatonic",
  strings: [
    ["4P", "5P"],  // low E
    ["7m", "1P"],  // A
    ["3m", "4P"],  // D
    ["5P", "7m"],  // G
    ["1P", "3m"],  // B
    ["4P", "5P"],  // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_4: ScaleShape = {
  name: "Pentatonic Box 4",
  system: "pentatonic",
  strings: [
    ["5P", "7m"],  // low E
    ["1P", "3m"],  // A
    ["4P", "5P"],  // D
    ["7m", "1P"],  // G
    ["3m", "4P"],  // B
    ["5P", "7m"],  // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_5: ScaleShape = {
  name: "Pentatonic Box 5",
  system: "pentatonic",
  strings: [
    ["7m", "1P"],  // low E
    ["3m", "4P"],  // A
    ["5P", "7m"],  // D
    ["1P", "3m"],  // G
    ["4P", "5P"],  // B
    ["7m", "1P"],  // high E
  ],
  rootString: 0,
};

// Register all pentatonic boxes
[PENTA_BOX_1, PENTA_BOX_2, PENTA_BOX_3, PENTA_BOX_4, PENTA_BOX_5].forEach(add);
