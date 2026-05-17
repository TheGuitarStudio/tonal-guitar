/**
 * Connector algorithm — bridges adjacent chain entries across CAGED or any
 * compatible scale shapes.
 *
 * This module sits in the "zero Tonal deps" dependency tier and imports only:
 *   - `FrettedScale`, `FrettedNote` from `./shape` (types)
 *   - `walkShapeMotif` from `./walker` (function)
 */

import { FrettedNote, FrettedScale } from "./shape";
import { walkShapeMotif } from "./walker";

// Suppress "unused import" warnings — these will be used in later task groups.
void (walkShapeMotif as unknown);

// ============================================================
// Types (spec §4.1)
// ============================================================

export type ChainDirection = "ascending" | "descending";

export interface ConnectSequencesInput {
  prev: {
    /** The full fretted scale the previous entry was walked over. */
    scale: FrettedScale;
    /** The actual last note prev emitted (time-order, not pitch-order). */
    lastNote: FrettedNote;
    /** Which way prev's motif was walked. */
    direction: ChainDirection;
  };
  next: {
    /** The full fretted scale the next entry will be walked over. */
    scale: FrettedScale;
    /** Motif used to walk next, e.g. [1] linear, [1,3] thirds, [1,2,3,4] groups. */
    motif: number[];
    /** Which way next's motif is being walked. */
    direction: ChainDirection;
  };
}

export interface ConnectorOptions {
  /**
   * Force a specific strategy. Default "auto" picks via §3.1 truth table.
   * "linear" / "motif-extend" are reserved for future variants and are
   * NOT implemented in MVP — passing them is equivalent to "auto".
   */
  strategy?: "auto" | "linear" | "motif-extend";
  /**
   * Drop next's first note when it duplicates the physical position of the
   * connector's last note (or, in reach-back, of prev's last note).
   * Default: true.
   */
  dedupSeam?: boolean;
}

export type ConnectorStrategy = "none" | "extend" | "reach-back";

export interface ConnectSequencesResult {
  /** Bridge notes to play between prev's last and next's first. May be empty. */
  connector: FrettedNote[];
  /**
   * Notes to play for the next entry, post-connector. In "none" this is the
   * natural walk of next; in "extend" it's the natural walk minus the dedup'd
   * head; in "reach-back" it's a re-walk over the combined scale starting at
   * prev's seam.
   */
  nextNotes: FrettedNote[];
  /** Strategy actually used (for debugging / lab UI display). */
  strategy: ConnectorStrategy;
}

// ============================================================
// Public API
// ============================================================

/**
 * Given two adjacent chain entries, returns the bridge phrase that connects
 * them across the seam, so that exercises can chain across CAGED (or any
 * compatible) shapes and play as one continuous run.
 *
 * The function never throws. All degenerate inputs resolve to a graceful
 * return of `{ connector: [], nextNotes: [], strategy: "none" }`.
 *
 * @note AlphaTeX bar alignment for connector notes is out of MVP scope.
 *   Bars re-flow automatically when connector notes are inserted.
 */
export function connectSequences(
  _input: ConnectSequencesInput,
  _options?: ConnectorOptions,
): ConnectSequencesResult {
  throw new Error("not implemented");
}
