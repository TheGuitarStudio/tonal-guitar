/**
 * The 5 minor blues and 5 major blues box shapes, derived at import time —
 * NOT hand-authored.
 *
 * Minor blues (1P 3m 4P 5d 5P 7m) = each minor pentatonic box plus the b5
 * passing tone, placed by `addPassingTone` (one fret above each 4P; edge
 * tones that would need a stretch are dropped). For A minor blues:
 *   Box 1 (5–8):   A:6, G:8
 *   Box 2 (7–10):  low E:11 (stretch), G:8        — high E:11 dropped (edge + stretch)
 *   Box 3 (9–13):  low E:11, D:13, high E:11
 *   Box 4 (12–15): D:13, B:16 (stretch)
 *   Box 5 (2–5):   A:6 (stretch), B:4
 *
 * Major blues (1P 2M 3m 3M 5P 6M) has the same pitch set as its relative
 * minor blues (C major blues = A minor blues), so each major blues box is
 * the minor blues box relabeled via `relabelShape` — identical geometry,
 * with the passing tone reading as the b3. Box numbers are shared with the
 * pentatonic boxes (box number is geometry identity, not quality identity —
 * see feature spec D-007).
 *
 * Shapes are registered into the scale shape registry at import time.
 */

import { addPassingTone, relabelShape } from "../transform";
import { add, ScaleShape } from "../shape";
import {
  PENTA_BOX_1_MINOR,
  PENTA_BOX_2_MINOR,
  PENTA_BOX_3_MINOR,
  PENTA_BOX_4_MINOR,
  PENTA_BOX_5_MINOR,
} from "./pentatonic-minor";

const MAJOR_BLUES_INTERVALS = ["1P", "2M", "3m", "3M", "5P", "6M"];

/**
 * The 5 minor pentatonic boxes are verified (blues.test.ts) to
 * accept a b5 and relabel cleanly into the major-blues frame, so a failed
 * derivation here indicates a broken build-time invariant rather than a
 * runtime condition to handle gracefully.
 */
function deriveOrThrow(
  result: ScaleShape | undefined,
  name: string,
): ScaleShape {
  if (!result) {
    throw new Error(`blues: deriving "${name}" returned undefined`);
  }
  return result;
}

function minorBlues(source: ScaleShape, box: number): ScaleShape {
  const name = `Blues Box ${box} Minor`;
  return deriveOrThrow(
    addPassingTone(source, "5d", { name, quality: "minor-blues" }),
    name,
  );
}

function majorBlues(source: ScaleShape, box: number): ScaleShape {
  const name = `Blues Box ${box} Major`;
  return deriveOrThrow(
    relabelShape(source, MAJOR_BLUES_INTERVALS, {
      name,
      quality: "major-blues",
    }),
    name,
  );
}

// Featured (D-006 amendment 3, spec §Library): Box 1 is the canonical
// (system, quality) representative for each blues quality — spread on here
// for the same reason as pentatonic-minor.ts.
export const BLUES_BOX_1_MINOR: ScaleShape = {
  ...minorBlues(PENTA_BOX_1_MINOR, 1),
  featured: true,
};
export const BLUES_BOX_2_MINOR = minorBlues(PENTA_BOX_2_MINOR, 2);
export const BLUES_BOX_3_MINOR = minorBlues(PENTA_BOX_3_MINOR, 3);
export const BLUES_BOX_4_MINOR = minorBlues(PENTA_BOX_4_MINOR, 4);
export const BLUES_BOX_5_MINOR = minorBlues(PENTA_BOX_5_MINOR, 5);

export const BLUES_BOX_1_MAJOR: ScaleShape = {
  ...majorBlues(BLUES_BOX_1_MINOR, 1),
  featured: true,
};
export const BLUES_BOX_2_MAJOR = majorBlues(BLUES_BOX_2_MINOR, 2);
export const BLUES_BOX_3_MAJOR = majorBlues(BLUES_BOX_3_MINOR, 3);
export const BLUES_BOX_4_MAJOR = majorBlues(BLUES_BOX_4_MINOR, 4);
export const BLUES_BOX_5_MAJOR = majorBlues(BLUES_BOX_5_MINOR, 5);

// Register all blues box shapes
[
  BLUES_BOX_1_MINOR,
  BLUES_BOX_2_MINOR,
  BLUES_BOX_3_MINOR,
  BLUES_BOX_4_MINOR,
  BLUES_BOX_5_MINOR,
  BLUES_BOX_1_MAJOR,
  BLUES_BOX_2_MAJOR,
  BLUES_BOX_3_MAJOR,
  BLUES_BOX_4_MAJOR,
  BLUES_BOX_5_MAJOR,
].forEach(add);
