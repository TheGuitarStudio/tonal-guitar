/**
 * Pure cells<->ArpeggioShape conversion for the Editor screen — the
 * arpeggio counterpart of `deriveShape.ts`. Wraps `fretboard-ui`'s
 * `cellsToScaleShapeStrings`/`frettedNotesToCells` with the two rules that
 * helper doesn't know about:
 *
 *  - `cellsToScaleShapeStrings` takes `rootString` from the FIRST `isRoot`
 *    cell, but `frettedNotesToCells` marks every `1P` as a root — so
 *    `rootString` is recomputed here as the lowest string whose interval
 *    list contains `"1P"` (the arpeggio analog of `deriveRootString`).
 *  - it sorts each string's intervals by fret and only emits the 12 simple
 *    interval names, so a string whose chroma set is unchanged keeps the
 *    base shape's own list verbatim (order and spelling), exactly as
 *    `preserveBaseSpelling` does for chords — otherwise an unedited string
 *    would spuriously land in the save patch.
 *
 * No React/DOM imports — testable without rendering anything.
 */
import { cellsToScaleShapeStrings, frettedNotesToCells, type EditorCell } from "fretboard-ui";
import { buildFrettedScale } from "tonal-guitar";
import type { ArpeggioShape } from "tonal-guitar";
import { semitones } from "@tonaljs/interval";
import type { RawGeometry } from "../store";

/** The lowest string index whose interval list contains `"1P"`, or
 * `undefined` when none does — the save-refusal condition. */
export function deriveArpeggioRootString(strings: (string[] | null)[]): number | undefined {
  const index = strings.findIndex((intervals) => intervals?.includes("1P") ?? false);
  return index === -1 ? undefined : index;
}

function chromaSet(intervals: string[]): string {
  const chromas = intervals.map((ivl) => (((semitones(ivl) % 12) + 12) % 12));
  return [...new Set(chromas)].sort((a, b) => a - b).join(",");
}

function preserveBaseSpelling(base: ArpeggioShape, derived: (string[] | null)[]): (string[] | null)[] {
  return derived.map((intervals, i) => {
    const baseIntervals = base.strings[i];
    if (intervals === null || baseIntervals === null || baseIntervals === undefined) return intervals;
    return chromaSet(intervals) === chromaSet(baseIntervals) ? baseIntervals : intervals;
  });
}

/**
 * Merges freshly-derived `strings`/`rootString` into `base` (every other
 * field — name, chordType, tags, fingers, ... — carried through). Returns
 * `undefined` when there's no root pitch class or no string carries `"1P"`.
 */
export function buildArpeggioFromCells(
  base: ArpeggioShape,
  cells: EditorCell[],
  tuning: string[],
  rootPitchClass: string | undefined,
): ArpeggioShape | undefined {
  const result = cellsToScaleShapeStrings(cells, tuning, rootPitchClass);
  if (result === null) return undefined;
  const rootString = deriveArpeggioRootString(result.strings);
  if (rootString === undefined) return undefined;
  return { ...base, strings: preserveBaseSpelling(base, result.strings), rootString };
}

/** Seeds `FretboardEditor` cells from an authored arpeggio at `root`. */
export function seedCellsFromArpeggio(shape: ArpeggioShape, tuning: string[], root: string): EditorCell[] {
  return frettedNotesToCells(buildFrettedScale(shape, root, tuning).notes);
}

/** Whether the arpeggio has no notes at all (a fresh gap draft). */
export function arpeggioIsBlank(shape: ArpeggioShape): boolean {
  return shape.strings.every((s) => s === null || s.length === 0);
}

/** The Editor's initial cells for a slot: `rawGeometry` when present (so a
 * cleared grip stays cleared on resume), else a blank/seeded derivation.
 * Barres are always `[]` for arpeggios. */
export function seedForArpeggioDraft(
  draft: { shape: ArpeggioShape; rawGeometry?: RawGeometry },
  tuning: string[],
  root: string,
): { cells: EditorCell[]; barres: [] } {
  if (draft.rawGeometry !== undefined) return { cells: draft.rawGeometry.cells, barres: [] };
  if (arpeggioIsBlank(draft.shape)) return { cells: [], barres: [] };
  return { cells: seedCellsFromArpeggio(draft.shape, tuning, root), barres: [] };
}
