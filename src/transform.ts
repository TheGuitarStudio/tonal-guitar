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

import { semitones } from "@tonaljs/interval";
import { ScaleShape } from "./shape";

export interface RelabelOptions {
  name?: string; // override the derived name
  quality?: string; // value written to result.quality
  parentShape?: string; // value written to result.parentShape (defaults to input shape.name)
}

// Chroma (0-11) of an interval string, always normalized to [0, 12).
function chromaOf(ivl: string): number {
  return ((semitones(ivl) % 12) + 12) % 12;
}

/**
 * Rewrite `shape`'s interval labels into `targetIntervals`, an interval
 * frame such as `["1P","2M","3m","4P","5P","6m","7m"]` for natural minor.
 * Geometry (which string/fret each note lands on) is unchanged — only
 * interval labels, `rootString`, `name`, `quality`, `parentShape` change.
 *
 * Chroma-anchored, enharmonic-safe algorithm — see feature spec R2.3–R2.9.
 *
 * Returns `undefined` (no throw — consistent with the project's empty-result
 * convention, cf. `src/build.ts:188,192`) when no valid relabeling exists.
 */
export function relabelShape(
  shape: ScaleShape,
  targetIntervals: string[],
  options?: RelabelOptions,
): ScaleShape | undefined {
  // Step 1: target chroma -> target interval, first-wins on collision.
  const targetByChroma = new Map<number, string>();
  for (const ivl of targetIntervals) {
    const chroma = chromaOf(ivl);
    if (!targetByChroma.has(chroma)) {
      targetByChroma.set(chroma, ivl);
    }
  }

  // Step 2: unique chromas used by the shape's (non-null) strings.
  const parentChromas = new Set<number>();
  for (const stringIntervals of shape.strings) {
    if (!stringIntervals) continue;
    for (const ivl of stringIntervals) {
      parentChromas.add(chromaOf(ivl));
    }
  }
  if (parentChromas.size === 0) return undefined;

  // Step 3: choose tonic offset t — ascending chroma order, first t where
  // every remapped chroma is present in targetByChroma.
  const candidates = Array.from(parentChromas).sort((a, b) => a - b);
  let tonicOffset: number | undefined;
  for (const t of candidates) {
    const allMapped = Array.from(parentChromas).every((c) =>
      targetByChroma.has(((c - t) % 12 + 12) % 12),
    );
    if (allMapped) {
      tonicOffset = t;
      break;
    }
  }
  if (tonicOffset === undefined) return undefined;

  // Step 4: rewrite per-string intervals, preserving order and null entries.
  const newStrings: (string[] | null)[] = shape.strings.map((stringIntervals) => {
    if (!stringIntervals) return null;
    return stringIntervals.map((ivl) => {
      const chroma = chromaOf(ivl);
      const newChroma = ((chroma - (tonicOffset as number)) % 12 + 12) % 12;
      // Guaranteed present by the Step 3 subset check.
      return targetByChroma.get(newChroma) as string;
    });
  });

  // Step 5: recompute rootString — lowest string index whose (original)
  // intervals include the new tonic (parent chroma === tonicOffset).
  let newRootString: number | undefined;
  for (let s = 0; s < shape.strings.length; s++) {
    const stringIntervals = shape.strings[s];
    if (!stringIntervals) continue;
    if (stringIntervals.some((ivl) => chromaOf(ivl) === tonicOffset)) {
      newRootString = s;
      break;
    }
  }
  if (newRootString === undefined) return undefined;

  // Step 6: assemble the new ScaleShape (no mutation of the input).
  return {
    name: options?.name ?? shape.name,
    system: shape.system,
    strings: newStrings,
    rootString: newRootString,
    span: shape.span,
    quality: options?.quality,
    parentShape: options?.parentShape ?? shape.name,
  };
}
