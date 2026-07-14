/**
 * The 5 pentatonic box shapes.
 *
 * Defined here as MAJOR PENTATONIC (intervals 1P, 2M, 3M, 5P, 6M) — these
 * are the raw geometric frames, labeled from the major-pentatonic root.
 *
 * To obtain the same boxes as MINOR PENTATONIC (the labeling most
 * guitarists reach for first — Box 1 anchored at the minor root, etc.),
 * use `relabelShape`/`relabelShapeToScale` (`src/transform.ts`), or the
 * pre-registered "Pentatonic Box N Minor" entries in
 * `src/data/pentatonic-minor.ts`, which relabel these same geometries into
 * the minor-pentatonic frame (e.g. for A minor pentatonic: A=1P, C=3m,
 * D=4P, E=5P, G=7m). The physical fretboard layout is identical either
 * way — only the interval labels and rootString change.
 *
 * Boxes are registered into the scale shape registry at import time.
 */

import { add, ScaleShape } from "../shape";

export const PENTA_BOX_1: ScaleShape = {
  name: "Pentatonic Box 1",
  system: "pentatonic",
  strings: [
    ["6M", "1P"], // low E
    ["2M", "3M"], // A
    ["5P", "6M"], // D
    ["1P", "2M"], // G
    ["3M", "5P"], // B
    ["6M", "1P"], // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_2: ScaleShape = {
  name: "Pentatonic Box 2",
  system: "pentatonic",
  strings: [
    ["1P", "2M"], // low E
    ["3M", "5P"], // A
    ["6M", "1P"], // D
    ["2M", "3M"], // G
    ["5P", "6M"], // B
    ["1P", "2M"], // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_3: ScaleShape = {
  name: "Pentatonic Box 3",
  system: "pentatonic",
  strings: [
    ["2M", "3M"], // low E
    ["5P", "6M"], // A
    ["1P", "2M"], // D
    ["3M", "5P"], // G
    ["6M", "1P"], // B
    ["2M", "3M"], // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_4: ScaleShape = {
  name: "Pentatonic Box 4",
  system: "pentatonic",
  strings: [
    ["3M", "5P"], // low E
    ["6M", "1P"], // A
    ["2M", "3M"], // D
    ["5P", "6M"], // G
    ["1P", "2M"], // B
    ["3M", "5P"], // high E
  ],
  rootString: 0,
};

export const PENTA_BOX_5: ScaleShape = {
  name: "Pentatonic Box 5",
  system: "pentatonic",
  strings: [
    ["5P", "6M"], // low E
    ["1P", "2M"], // A
    ["3M", "5P"], // D
    ["6M", "1P"], // G
    ["2M", "3M"], // B
    ["5P", "6M"], // high E
  ],
  rootString: 0,
};

// Register all pentatonic boxes
[PENTA_BOX_1, PENTA_BOX_2, PENTA_BOX_3, PENTA_BOX_4, PENTA_BOX_5].forEach(add);
