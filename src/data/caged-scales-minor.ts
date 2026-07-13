/**
 * The 5 minor CAGED scale shapes, derived from the 5 major CAGED shapes via
 * `relabelShape` (chroma-anchored, enharmonic-safe rotation into the natural
 * minor interval frame). Geometry is identical to the major-frame parent —
 * only interval labels, rootString, name, and quality metadata differ.
 *
 * Mapping (see feature spec R4.1 — the paired minor barre form per D-006):
 *   CAGED_E ("E Shape") -> "Dm Shape"
 *   CAGED_D ("D Shape") -> "Cm Shape"
 *   CAGED_C ("C Shape") -> "Am Shape"
 *   CAGED_A ("A Shape") -> "Gm Shape"
 *   CAGED_G ("G Shape") -> "Em Shape"
 *
 * Interval arrays are computed by relabelShape at import time — NOT
 * hand-authored. Shapes are registered into the scale shape registry at
 * import time.
 */

import { relabelShape, RelabelOptions } from "../transform";
import { add, ScaleShape } from "../shape";
import { CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G } from "./caged-scales";

const MINOR_INTERVALS = ["1P", "2M", "3m", "4P", "5P", "6m", "7m"];

/**
 * The 5 CAGED major shapes are verified (spec R2.4/R4.1) to relabel cleanly
 * into the natural minor frame, so a failed relabel here indicates a broken
 * build-time invariant rather than a runtime condition to handle gracefully.
 */
function relabelOrThrow(
  source: ScaleShape,
  targetIntervals: string[],
  options: RelabelOptions,
): ScaleShape {
  const result = relabelShape(source, targetIntervals, options);
  if (!result) {
    throw new Error(
      `caged-scales-minor: relabelShape(${source.name} -> ${options.name}) returned undefined — expected a valid natural-minor relabeling per spec R4.1`,
    );
  }
  return result;
}

export const CAGED_DM: ScaleShape = relabelOrThrow(CAGED_E, MINOR_INTERVALS, {
  name: "Dm Shape",
  quality: "minor",
  parentShape: CAGED_E.name,
});

export const CAGED_CM: ScaleShape = relabelOrThrow(CAGED_D, MINOR_INTERVALS, {
  name: "Cm Shape",
  quality: "minor",
  parentShape: CAGED_D.name,
});

export const CAGED_AM: ScaleShape = relabelOrThrow(CAGED_C, MINOR_INTERVALS, {
  name: "Am Shape",
  quality: "minor",
  parentShape: CAGED_C.name,
});

export const CAGED_GM: ScaleShape = relabelOrThrow(CAGED_A, MINOR_INTERVALS, {
  name: "Gm Shape",
  quality: "minor",
  parentShape: CAGED_A.name,
});

export const CAGED_EM: ScaleShape = relabelOrThrow(CAGED_G, MINOR_INTERVALS, {
  name: "Em Shape",
  quality: "minor",
  parentShape: CAGED_G.name,
});

// Register all minor CAGED scale shapes
[CAGED_DM, CAGED_CM, CAGED_AM, CAGED_GM, CAGED_EM].forEach(add);
