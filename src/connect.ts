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
// Internal helpers (TG2)
// ============================================================

/**
 * Determine whether `next` scale is pitched higher, lower, or at the same
 * range as `prev` scale. Uses the conjunction rule from spec §3.2:
 * both the top AND bottom of next must strictly exceed those of prev
 * (or both be strictly lower) to be classified as "higher"/"lower".
 * Anything that doesn't satisfy either strict conjunction is "same".
 *
 * Guard: if either scale has no notes, returns "same".
 *
 * @internal
 */
export function nextSide(
  prevScale: FrettedScale,
  nextScale: FrettedScale,
): "higher" | "lower" | "same" {
  if (prevScale.notes.length === 0 || nextScale.notes.length === 0) {
    return "same";
  }

  const prevMidis = prevScale.notes.map((n) => n.midi);
  const nextMidis = nextScale.notes.map((n) => n.midi);

  const prevTop = Math.max(...prevMidis);
  const prevBottom = Math.min(...prevMidis);
  const nextTop = Math.max(...nextMidis);
  const nextBottom = Math.min(...nextMidis);

  if (nextTop > prevTop && nextBottom > prevBottom) return "higher";
  if (nextTop < prevTop && nextBottom < prevBottom) return "lower";
  return "same";
}

/**
 * Classify which connector strategy to use given the direction pair and the
 * pitch-side relationship. Encodes the §3.1 truth table:
 *
 * | prevDir → nextDir | higher      | lower       | same        |
 * |-------------------|-------------|-------------|-------------|
 * | asc → asc         | none        | none        | none        |
 * | desc → desc       | none        | none        | none        |
 * | asc → desc        | extend      | reach-back  | reach-back  |
 * | desc → asc        | reach-back  | extend      | reach-back  |
 *
 * @internal
 */
export function classifyStrategy(
  prevDir: ChainDirection,
  nextDir: ChainDirection,
  side: "higher" | "lower" | "same",
): ConnectorStrategy {
  // Same-direction pairs always produce no bridge (beginner restart semantics).
  if (prevDir === nextDir) return "none";

  if (prevDir === "ascending" && nextDir === "descending") {
    return side === "higher" ? "extend" : "reach-back";
  }

  // prevDir === "descending" && nextDir === "ascending"
  return side === "lower" ? "extend" : "reach-back";
}

// ============================================================
// Internal strategy builders (TG3, TG4)
// ============================================================

/**
 * Build a deduplicated, midi-sorted combined note array from two scales.
 * Notes from `prevScale` win over `nextScale` on a `(string, fret)` collision.
 *
 * @internal
 */
export function dedupAndSortCombined(
  prevScale: FrettedScale,
  nextScale: FrettedScale,
): FrettedNote[] {
  const seen = new Map<string, FrettedNote>();
  for (const n of [...prevScale.notes, ...nextScale.notes]) {
    const key = `${n.string}:${n.fret}`;
    if (!seen.has(key)) seen.set(key, n);
  }
  return [...seen.values()].sort((a, b) => a.midi - b.midi);
}

/**
 * Build the extend strategy result. The extend strategy applies when the
 * direction reverses and the next shape sits in a non-overlapping pitch range
 * (higher for asc→desc, lower for desc→asc). A linear diatonic "pickup" is
 * inserted between prev's last note and next's extreme, then next is walked
 * normally with the duplicate pivot note optionally deduped.
 *
 * Algorithm (spec §3.3 extend):
 *   seam     = prev.lastNote.midi
 *   target   = ascending → max(next.scale.notes[*].midi)
 *              descending → min(next.scale.notes[*].midi)
 *   combined = prev.scale.notes ∪ next.scale.notes, deduped by (string, fret),
 *              sorted by midi ascending
 *   connector (ascending):  combined.filter(n => n.midi >  seam && n.midi <= target)
 *   connector (descending): combined.filter(n => n.midi <  seam && n.midi >= target).reverse()
 *   nextNotes = walkShapeMotif(next.scale, effectiveMotif, { direction: next.direction })
 *   dedupSeam: drop nextNotes[0] if it matches connector.at(-1) on (midi, string, fret);
 *              or, if connector is empty, drop nextNotes[0] if it matches prev.lastNote on (string, fret)
 *
 * @internal
 */
export function buildExtend(
  input: ConnectSequencesInput,
  dedupSeam: boolean,
  effectiveMotif: number[],
): ConnectSequencesResult {
  const { prev, next } = input;

  // Build combined note set: prev then next, dedup by (string, fret), first wins.
  const combined = dedupAndSortCombined(prev.scale, next.scale);

  const seam = prev.lastNote.midi;
  const nextMidis = next.scale.notes.map((n) => n.midi);
  const target =
    prev.direction === "ascending"
      ? Math.max(...nextMidis)
      : Math.min(...nextMidis);

  // Filter connector notes between seam (exclusive) and target (inclusive).
  let connector: FrettedNote[];
  if (prev.direction === "ascending") {
    connector = combined.filter((n) => n.midi > seam && n.midi <= target);
    // combined is already ascending — no need to sort again
  } else {
    // descending: notes below seam down to target, reversed to descending order
    connector = combined
      .filter((n) => n.midi < seam && n.midi >= target)
      .reverse();
  }

  // Walk next shape with the effective motif.
  let nextNotes = walkShapeMotif(next.scale, effectiveMotif, {
    direction: next.direction,
  });

  // Dedup seam: drop nextNotes[0] if it physically duplicates the bridge end.
  if (dedupSeam && nextNotes.length > 0) {
    if (connector.length > 0) {
      const connTail = connector[connector.length - 1];
      const head = nextNotes[0];
      if (
        head.midi === connTail.midi &&
        head.string === connTail.string &&
        head.fret === connTail.fret
      ) {
        nextNotes = nextNotes.slice(1);
      }
    } else {
      // Empty connector: compare against prev.lastNote by (string, fret).
      const head = nextNotes[0];
      if (
        head.string === prev.lastNote.string &&
        head.fret === prev.lastNote.fret
      ) {
        nextNotes = nextNotes.slice(1);
      }
    }
  }

  return { connector, nextNotes, strategy: "extend" };
}

/**
 * Build the reach-back strategy result. The reach-back strategy applies when
 * the direction reverses but the next shape's range overlaps or is on the
 * "wrong" side — so instead of bridging to the next shape's extreme, the
 * combined scale is re-walked from the seam point using next's motif.
 *
 * Algorithm (spec §3.3 reach-back):
 *   combined  = prev.scale.notes ∪ next.scale.notes, deduped by (string, fret),
 *               sorted by midi ascending; metadata inherited from next.scale
 *   walked    = walkShapeMotif(combined, effectiveMotif, { direction: next.direction })
 *   Trim ascending:  walked.filter(n => n.midi >= seamMidi)
 *   Trim descending: walked.filter(n => n.midi <= seamMidi)
 *   dedupSeam: drop trimmed[0] if it occupies the same (string, fret) as prev.lastNote
 *
 * @internal
 */
export function buildReachBack(
  input: ConnectSequencesInput,
  dedupSeam: boolean,
  effectiveMotif: number[],
): ConnectSequencesResult {
  const { prev, next } = input;

  // Build synthetic combined FrettedScale: dedup by (string, fret), prev wins.
  const combinedNotes = dedupAndSortCombined(prev.scale, next.scale);
  const combinedScale: FrettedScale = {
    empty: false,
    root: next.scale.root,
    scaleType: next.scale.scaleType,
    scaleName: next.scale.scaleName,
    shapeName: next.scale.shapeName,
    tuning: next.scale.tuning,
    notes: combinedNotes,
  };

  // Walk the combined scale using next's motif and direction.
  const walked = walkShapeMotif(combinedScale, effectiveMotif, {
    direction: next.direction,
  });

  // Trim: keep only notes at or past the seam in the walk direction.
  const seamMidi = prev.lastNote.midi;
  let trimmed: FrettedNote[];
  if (next.direction === "ascending") {
    trimmed = walked.filter((n) => n.midi >= seamMidi);
  } else {
    trimmed = walked.filter((n) => n.midi <= seamMidi);
  }

  // Dedup seam: drop head if it physically matches prev.lastNote (string, fret).
  let nextNotes = trimmed;
  if (
    dedupSeam &&
    nextNotes.length > 0 &&
    nextNotes[0].string === prev.lastNote.string &&
    nextNotes[0].fret === prev.lastNote.fret
  ) {
    nextNotes = nextNotes.slice(1);
  }

  return { connector: [], nextNotes, strategy: "reach-back" };
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
  input: ConnectSequencesInput,
  options?: ConnectorOptions,
): ConnectSequencesResult {
  const { prev, next } = input;

  // Guard: degenerate scale inputs → graceful empty result
  if (
    prev.scale.empty ||
    next.scale.empty ||
    prev.scale.notes.length === 0 ||
    next.scale.notes.length === 0
  ) {
    return { connector: [], nextNotes: [], strategy: "none" };
  }

  // Normalize motif: treat empty motif as [1] (linear walk)
  const effectiveMotif = next.motif.length > 0 ? next.motif : [1];

  // Normalize reserved strategy values: "linear" and "motif-extend" are
  // treated as "auto" in MVP (no-op — just don't act on them specially).
  // "auto" (or undefined) → proceed with auto classification.

  // Resolve options
  const dedupSeam = options?.dedupSeam ?? true;

  // Classify strategy
  const side = nextSide(prev.scale, next.scale);
  const strategy = classifyStrategy(prev.direction, next.direction, side);

  // Dispatch to appropriate strategy builder
  if (strategy === "none") {
    return {
      connector: [],
      nextNotes: walkShapeMotif(next.scale, effectiveMotif, {
        direction: next.direction,
      }),
      strategy: "none",
    };
  }

  if (strategy === "extend") {
    return buildExtend(input, dedupSeam, effectiveMotif);
  }

  // strategy === "reach-back"
  return buildReachBack(input, dedupSeam, effectiveMotif);
}
