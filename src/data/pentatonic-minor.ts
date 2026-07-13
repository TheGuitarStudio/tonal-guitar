/**
 * The 5 minor pentatonic box shapes, derived from the 5 major pentatonic
 * boxes via `relabelShape` (chroma-anchored, enharmonic-safe rotation into
 * the minor-pentatonic interval frame). Geometry is identical to the
 * major-frame parent box — only interval labels, rootString, name, and
 * quality metadata differ. Box numbers are shared with the major boxes
 * (box number is geometry identity, not quality identity — see feature
 * spec D-007).
 *
 * Mapping (see feature spec R4.2):
 *   PENTA_BOX_1 -> "Pentatonic Box 1 Minor"
 *   PENTA_BOX_2 -> "Pentatonic Box 2 Minor"
 *   PENTA_BOX_3 -> "Pentatonic Box 3 Minor"
 *   PENTA_BOX_4 -> "Pentatonic Box 4 Minor"
 *   PENTA_BOX_5 -> "Pentatonic Box 5 Minor"
 *
 * Interval arrays are computed by relabelShape at import time — NOT
 * hand-authored. Shapes are registered into the scale shape registry at
 * import time.
 */

import { relabelShape, RelabelOptions } from "../transform";
import { add, ScaleShape } from "../shape";
import {
  PENTA_BOX_1,
  PENTA_BOX_2,
  PENTA_BOX_3,
  PENTA_BOX_4,
  PENTA_BOX_5,
} from "./pentatonic";

const MINOR_PENTA_INTERVALS = ["1P", "3m", "4P", "5P", "7m"];

/**
 * The 5 major pentatonic boxes are verified (spec R2.5/R4.2) to relabel
 * cleanly into the minor-pentatonic frame, so a failed relabel here
 * indicates a broken build-time invariant rather than a runtime condition
 * to handle gracefully.
 */
function relabelOrThrow(
  source: ScaleShape,
  targetIntervals: string[],
  options: RelabelOptions,
): ScaleShape {
  const result = relabelShape(source, targetIntervals, options);
  if (!result) {
    throw new Error(
      `pentatonic-minor: relabelShape(${source.name} -> ${options.name}) returned undefined — expected a valid minor-pentatonic relabeling per spec R4.2`,
    );
  }
  return result;
}

export const PENTA_BOX_1_MINOR: ScaleShape = relabelOrThrow(
  PENTA_BOX_1,
  MINOR_PENTA_INTERVALS,
  {
    name: "Pentatonic Box 1 Minor",
    quality: "minor-pentatonic",
    parentShape: PENTA_BOX_1.name,
  },
);

export const PENTA_BOX_2_MINOR: ScaleShape = relabelOrThrow(
  PENTA_BOX_2,
  MINOR_PENTA_INTERVALS,
  {
    name: "Pentatonic Box 2 Minor",
    quality: "minor-pentatonic",
    parentShape: PENTA_BOX_2.name,
  },
);

export const PENTA_BOX_3_MINOR: ScaleShape = relabelOrThrow(
  PENTA_BOX_3,
  MINOR_PENTA_INTERVALS,
  {
    name: "Pentatonic Box 3 Minor",
    quality: "minor-pentatonic",
    parentShape: PENTA_BOX_3.name,
  },
);

export const PENTA_BOX_4_MINOR: ScaleShape = relabelOrThrow(
  PENTA_BOX_4,
  MINOR_PENTA_INTERVALS,
  {
    name: "Pentatonic Box 4 Minor",
    quality: "minor-pentatonic",
    parentShape: PENTA_BOX_4.name,
  },
);

export const PENTA_BOX_5_MINOR: ScaleShape = relabelOrThrow(
  PENTA_BOX_5,
  MINOR_PENTA_INTERVALS,
  {
    name: "Pentatonic Box 5 Minor",
    quality: "minor-pentatonic",
    parentShape: PENTA_BOX_5.name,
  },
);

// Register all minor pentatonic box shapes
[
  PENTA_BOX_1_MINOR,
  PENTA_BOX_2_MINOR,
  PENTA_BOX_3_MINOR,
  PENTA_BOX_4_MINOR,
  PENTA_BOX_5_MINOR,
].forEach(add);
