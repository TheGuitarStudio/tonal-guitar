/**
 * Shape relabeling: rewrite a ScaleShape's per-string interval labels into
 * a different (rotation-compatible) interval frame, e.g. turning a
 * major-frame CAGED shape into its natural-minor labeling.
 *
 * Pure tier — MAY import `@tonaljs/interval` (required peer, already used
 * by build.ts) and `./shape` (types only). MUST NOT import
 * `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key` or `./integration`, so
 * `src/data/*` can call this at import time with zero optional peers.
 */

import { ScaleShape } from "./shape";

export interface RelabelOptions {
  name?: string; // override the derived name
  quality?: string; // value written to result.quality
  parentShape?: string; // value written to result.parentShape (defaults to input shape.name)
}

/**
 * Rewrite `shape`'s interval labels into `targetIntervals`, an interval
 * frame such as `["1P","2M","3m","4P","5P","6m","7m"]` for natural minor.
 * Geometry (which string/fret each note lands on) is unchanged — only
 * interval labels, `rootString`, `name`, `quality`, `parentShape` change.
 *
 * Returns `undefined` (no throw — consistent with the project's empty-result
 * convention, cf. `src/build.ts:188,192`) when no valid relabeling exists.
 *
 * STUB: full chroma-anchored relabel algorithm lands with the relabel
 * implementation (see feature spec R2.3–R2.9). This placeholder always
 * returns `undefined`.
 */
export function relabelShape(
  shape: ScaleShape,
  targetIntervals: string[],
  options?: RelabelOptions,
): ScaleShape | undefined {
  // Referenced only to keep the stub's signature lint-clean; the real
  // algorithm (R2.3–R2.9) will consume these.
  void shape;
  void targetIntervals;
  void options;
  return undefined;
}
