/**
 * Shape relabeling: rewrite a ScaleShape's per-string interval labels into
 * a different (rotation-compatible) interval frame, e.g. turning a
 * major-frame CAGED shape into its natural-minor labeling — and
 * passing-tone augmentation (`addPassingTone`), e.g. adding the b5 that
 * turns a minor pentatonic box into a blues box.
 *
 * Required-peer tier — MAY import `@tonaljs/interval`, `./build` (for
 * `addPassingTone`'s fret geometry), `./tuning`, and `./shape` (types
 * only). MUST NOT import
 * `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key` or `./integration`, so
 * `src/data/*` can call this at import time with zero optional peers.
 */

import { semitones } from "@tonaljs/interval";
import { buildFrettedScale } from "./build";
import { ScaleShape } from "./shape";
import { STANDARD } from "./tuning";

export interface RelabelOptions {
  name?: string; // override the derived name
  quality?: string; // value written to result.quality
  parentShape?: string; // value written to result.parentShape (defaults to input shape.name)
}

// Normalize an integer to [0, 12) regardless of sign.
function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

// Chroma (0-11) of an interval string, always normalized to [0, 12).
// Exported for reuse by integration.ts (isShapeCompatible) — avoids
// duplicating this interval-math helper across the pure/integration tiers.
export function chromaOf(ivl: string): number {
  return mod12(semitones(ivl));
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
      targetByChroma.has(mod12(c - t)),
    );
    if (allMapped) {
      tonicOffset = t;
      break;
    }
  }
  if (tonicOffset === undefined) return undefined;
  const offset = tonicOffset;

  // Step 4: rewrite per-string intervals, preserving order and null entries.
  // Guaranteed present by the Step 3 subset check — every remapped chroma
  // maps to a target interval — but rather than asserting that, an
  // explicit undefined check keeps the sentinel-return convention honest.
  const newStrings: (string[] | null)[] = [];
  for (const stringIntervals of shape.strings) {
    if (!stringIntervals) {
      newStrings.push(null);
      continue;
    }
    const rewritten: string[] = [];
    for (const ivl of stringIntervals) {
      const chroma = chromaOf(ivl);
      const mapped = targetByChroma.get(mod12(chroma - offset));
      if (mapped === undefined) return undefined;
      rewritten.push(mapped);
    }
    newStrings.push(rewritten);
  }

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

// ============================================================
// addPassingTone
// ============================================================

export interface PassingToneOptions extends RelabelOptions {
  tuning?: string[]; // tuning the stretch rule is evaluated against (defaults to STANDARD)
}

/**
 * Add a chromatic passing tone to a shape, e.g. the b5 (`"5d"`) that turns
 * a minor pentatonic box into a minor blues box, or the b3 (`"3m"`) that
 * turns a major pentatonic box into a major blues box.
 *
 * Placement rule: `tone` is inserted on the same string, one fret above
 * every note whose chroma is a semitone below `tone` (the b5 sits right
 * above each 4P). Every inserted tone that lands inside the shape's
 * existing pitch range is kept, even when it needs a one-fret stretch past
 * the shape's fret span. A tone that would become the shape's new highest
 * note is kept only when it fits inside the existing fret span — edge
 * tones are never added at the cost of a stretch.
 *
 * Fret geometry comes from building the shape (at root C) in
 * `options.tuning`. Interval labels, `rootString`, and `span` are otherwise
 * unchanged; `name`/`quality`/`parentShape` follow `relabelShape`'s option
 * semantics (`parentShape` defaults to the input shape's name).
 *
 * Returns `undefined` for an invalid `tone`, a shape that does not build,
 * or when no passing tone can be placed.
 */
export function addPassingTone(
  shape: ScaleShape,
  tone: string,
  options?: PassingToneOptions,
): ScaleShape | undefined {
  const toneSemitones = semitones(tone);
  if (Number.isNaN(toneSemitones)) return undefined;
  const neighborChroma = mod12(toneSemitones - 1);

  const tuning = options?.tuning ?? STANDARD;
  const built = buildFrettedScale(shape, "C", tuning);
  if (built.empty || built.notes.length === 0) return undefined;

  const frets = built.notes.map((n) => n.fret);
  const maxFret = Math.max(...frets);
  const maxMidi = Math.max(...built.notes.map((n) => n.midi));
  const builtMidis = new Set(built.notes.map((n) => n.midi));
  // Mirrors build.ts: a shorter shape maps onto the high-side strings.
  const strOffset = Math.max(0, tuning.length - shape.strings.length);

  let inserted = 0;
  const newStrings = shape.strings.map((stringIntervals, s) => {
    if (!stringIntervals) return null;
    const onString = built.notes.filter((n) => n.string === s + strOffset);
    const result: string[] = [];
    for (const ivl of stringIntervals) {
      result.push(ivl);
      if (chromaOf(ivl) !== neighborChroma) continue;

      const neighbor = onString.find((n) => n.interval === ivl);
      if (!neighbor) continue;
      const midi = neighbor.midi + 1;
      if (builtMidis.has(midi)) continue;
      const isNewEdge = midi > maxMidi;
      const isStretch = neighbor.fret + 1 > maxFret;
      if (isNewEdge && isStretch) continue;

      result.push(tone);
      inserted++;
    }
    return result;
  });
  if (inserted === 0) return undefined;

  return {
    name: options?.name ?? shape.name,
    system: shape.system,
    strings: newStrings,
    rootString: shape.rootString,
    span: shape.span,
    quality: options?.quality,
    parentShape: options?.parentShape ?? shape.name,
  };
}
