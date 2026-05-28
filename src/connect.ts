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
   * Connector strategy. Currently only `"auto"` is supported — the §3.1
   * truth table picks `"none"`, `"extend"`, or `"reach-back"`, and the
   * choice is reported back in `ConnectSequencesResult.strategy`. The
   * variant labels `"linear"` and `"motif-extend"` are reserved for future
   * releases and are intentionally absent from the type until implemented.
   */
  strategy?: "auto";
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
// Internal helpers (TG2, TG3, TG4)
//
// NOTE: The helpers below are `export`ed solely so unit tests can exercise
// the §3.1 classifier and §3.3 strategy builders directly. Each is tagged
// `@internal` and is NOT re-exported from `index.ts` — the only public
// surface of this module is `connectSequences` plus its types.
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
 * Two `FrettedNote`s occupy the same physical position when they share the
 * same `string` and `fret`. For a given tuning this also uniquely determines
 * `midi`, so callers don't need to compare midi separately.
 */
function samePosition(a: FrettedNote, b: FrettedNote): boolean {
  return a.string === b.string && a.fret === b.fret;
}

/**
 * Collect notes on `refString` from two scales, dedup by midi (prev wins),
 * sorted by midi ascending. Used by the same-string bridge builder so the
 * connector only contains pairs the user can finger on a single string.
 *
 * @internal
 */
function sameStringCombined(
  prev: FrettedScale,
  next: FrettedScale,
  refString: number,
): FrettedNote[] {
  const seen = new Map<number, FrettedNote>();
  for (const n of prev.notes) {
    if (n.string === refString && !seen.has(n.midi)) seen.set(n.midi, n);
  }
  for (const n of next.notes) {
    if (n.string === refString && !seen.has(n.midi)) seen.set(n.midi, n);
  }
  return [...seen.values()].sort((a, b) => a.midi - b.midi);
}

/** Two FrettedNotes are identical iff their (midi, string, fret) match. */
function sameNote(a: FrettedNote, b: FrettedNote): boolean {
  return a.midi === b.midi && a.string === b.string && a.fret === b.fret;
}

/**
 * Build the extend strategy result. The extend strategy applies when the
 * direction reverses and the next shape sits in a non-overlapping pitch range
 * (higher for asc→desc, lower for desc→asc).
 *
 * The bridge stays on `prev.lastNote.string` and uses only scale notes on
 * that single string — both shapes contribute notes to the same-string pool.
 * The motif walks those same-string notes in the bridge direction (toward
 * next shape's natural starting pitch), and pairs whose final note lies past
 * the seam are emitted as the `connector`. The `nextNotes` are then the
 * unmodified natural walk of `next.scale`; if the bridge's final pair is
 * byte-for-byte identical to `nextNotes`' first pair, the overlap is
 * collapsed (no double-play).
 *
 * Example — E↑ → D↓ thirds (1,3) in A major:
 *   prev.lastNote = B4@[s5,f7], target = D5@[s5,f10]
 *   same-string pool (high E) = G#4, A4, B4, C#5, D5
 *   walked asc with [1,3] = (G#4, B4), (A4, C#5), (B4, D5)
 *   connector = pairs past seam = (A4, C#5), (B4, D5)
 *   nextNotes = D shape descending walk starting at D5
 *
 * @internal
 */
export function buildExtend(
  input: ConnectSequencesInput,
  dedupSeam: boolean,
  effectiveMotif: number[],
): ConnectSequencesResult {
  const { prev, next } = input;

  // Defensive: callers reaching this helper directly (e.g. unit tests) bypass
  // the empty-notes guard in connectSequences. Without this check, the
  // Math.max/min calls below would resolve to ±Infinity and silently produce
  // a wrong `target`.
  if (next.scale.notes.length === 0) {
    return { connector: [], nextNotes: [], strategy: "extend" };
  }

  const seam = prev.lastNote.midi;

  // Build the same-string pool and walk it with the motif in prev's direction.
  // The bridge stays on prev.lastNote.string, so only pairs the user can
  // finger on a single string are emitted.
  const stringNotes = sameStringCombined(
    prev.scale,
    next.scale,
    prev.lastNote.string,
  );
  const stringScale: FrettedScale = {
    ...next.scale,
    notes: stringNotes,
    empty: stringNotes.length === 0,
  };
  const walked = walkShapeMotif(stringScale, effectiveMotif, {
    direction: prev.direction,
  });

  // Emit whole motif periods whose final note lies past the seam in the walk
  // direction. The bridge naturally ends when the same-string pool runs out
  // — no explicit "target" cutoff is needed.
  const period = effectiveMotif.length;
  const connector: FrettedNote[] = [];
  for (let i = 0; i + period <= walked.length; i += period) {
    const last = walked[i + period - 1];
    const isPastSeam =
      prev.direction === "ascending" ? last.midi > seam : last.midi < seam;
    if (isPastSeam) {
      for (let j = 0; j < period; j++) connector.push(walked[i + j]);
    }
  }

  // Walk next shape naturally — positions inside next.scale are preserved.
  let nextNotes = walkShapeMotif(next.scale, effectiveMotif, {
    direction: next.direction,
  });

  // Overlap dedup: when the bridge's final pair (a same-string period the
  // user just played) matches nextNotes' first pair note-for-note, drop the
  // overlap. This happens when the natural next-walk starts on the same
  // string-and-position the bridge just ended on (typical for desc→asc into
  // a higher shape whose lowest notes ARE the bridge's top).
  if (connector.length >= period && nextNotes.length >= period) {
    const bridgeEnd = connector.slice(-period);
    const overlap = bridgeEnd.every((n, idx) => sameNote(n, nextNotes[idx]));
    if (overlap) nextNotes = nextNotes.slice(period);
  }

  // Legacy single-note dedup. dedupSeam: true (the library default) drops
  // nextNotes[0] if its physical position equals the bridge end. The lab
  // passes dedupSeam: false so the seam-pivot note repeats musically (e.g.
  // the "top" D5 at the asc→desc turn).
  if (dedupSeam && nextNotes.length > 0) {
    const reference =
      connector.length > 0 ? connector[connector.length - 1] : prev.lastNote;
    if (samePosition(nextNotes[0], reference)) {
      nextNotes = nextNotes.slice(1);
    }
  }

  return { connector, nextNotes, strategy: "extend" };
}

/**
 * Build the reach-back strategy result. Reach-back applies when the direction
 * reverses and the next shape's natural starting pitch sits on the "near"
 * side of the seam (overlapping or further from the seam in next's direction).
 *
 * Same shape of algorithm as buildExtend, with two differences:
 *   1. The bridge walks in **next.direction** (preparing for next's run)
 *      rather than prev.direction.
 *   2. The bridge filter is **inclusive** of the seam pitch — the seam note
 *      itself acts as the first note of the new ascending/descending run.
 *
 * Example — E↓ → D↑ thirds (1,3) in A major:
 *   prev.lastNote = G#2@[s0,f4], next.naturalStart = B2@[s0,f7]
 *   same-string pool (low E) = G#2, A2, B2, C#3, D3
 *   walked asc with [1,3] = (G#2, B2), (A2, C#3), (B2, D3)
 *   connector = (G#2, B2), (A2, C#3), (B2, D3) — all pairs from seam upward
 *   nextNotes = D shape ascending walk, with first pair (B2, D3) dropped
 *               because it duplicates the bridge's final pair note-for-note,
 *               so next continues at (C#3, E3).
 *
 * @internal
 */
export function buildReachBack(
  input: ConnectSequencesInput,
  dedupSeam: boolean,
  effectiveMotif: number[],
): ConnectSequencesResult {
  const { prev, next } = input;

  if (next.scale.notes.length === 0) {
    return { connector: [], nextNotes: [], strategy: "reach-back" };
  }

  const seam = prev.lastNote.midi;

  // Same-string bridge pool — only notes on prev.lastNote.string contribute.
  const stringNotes = sameStringCombined(
    prev.scale,
    next.scale,
    prev.lastNote.string,
  );
  const stringScale: FrettedScale = {
    ...next.scale,
    notes: stringNotes,
    empty: stringNotes.length === 0,
  };
  const walked = walkShapeMotif(stringScale, effectiveMotif, {
    direction: next.direction,
  });

  // Emit whole motif periods whose **first** note is at-or-past the seam in
  // the walk direction. Inclusive at the seam: the seam pitch repeats as the
  // anchor of the new run (musically intentional pivot).
  const period = effectiveMotif.length;
  const connector: FrettedNote[] = [];
  for (let i = 0; i + period <= walked.length; i += period) {
    const first = walked[i];
    const isAtOrPastSeam =
      next.direction === "ascending" ? first.midi >= seam : first.midi <= seam;
    if (isAtOrPastSeam) {
      for (let j = 0; j < period; j++) connector.push(walked[i + j]);
    }
  }

  // Walk next shape naturally.
  let nextNotes = walkShapeMotif(next.scale, effectiveMotif, {
    direction: next.direction,
  });

  // Overlap dedup: drop nextNotes' first pair when it equals the bridge's
  // final pair (note-for-note).
  if (connector.length >= period && nextNotes.length >= period) {
    const bridgeEnd = connector.slice(-period);
    const overlap = bridgeEnd.every((n, idx) => sameNote(n, nextNotes[idx]));
    if (overlap) nextNotes = nextNotes.slice(period);
  }

  // Legacy single-note dedup (lab passes dedupSeam: false).
  if (
    dedupSeam &&
    connector.length > 0 &&
    samePosition(connector[0], prev.lastNote)
  ) {
    // Drop the leading seam repetition.
    connector.shift();
  }

  return { connector, nextNotes, strategy: "reach-back" };
}

// ============================================================
// Public API
// ============================================================

/**
 * Given two adjacent chain entries, returns the bridge phrase that connects
 * them across the seam, so that exercises can chain across CAGED (or any
 * compatible) shapes and play as one continuous run.
 *
 * Output shape — `{ connector, nextNotes, strategy }`:
 *
 * - **`strategy: "none"`** — same-direction chains (asc→asc, desc→desc) and
 *   degenerate inputs. `connector` is `[]`; `nextNotes` is the natural walk
 *   of `next.scale` (or `[]` for degenerate inputs).
 *
 * - **`strategy: "extend"`** — direction reverses, next sits beyond prev in
 *   the prev-walk direction (asc→desc with next higher, or desc→asc with
 *   next lower). `connector` is a **same-string** pickup — motif periods
 *   walked along `prev.lastNote.string` from the combined prev∪next scale,
 *   in prev's direction, keeping pairs whose final note is past the seam.
 *   `nextNotes` is the natural walk of `next.scale` with an overlap dedup
 *   that drops the first pair when it duplicates the bridge's last pair.
 *
 * - **`strategy: "reach-back"`** — direction reverses, next sits "on the
 *   wrong side" or overlaps prev (asc→desc with next not strictly higher,
 *   or desc→asc with next not strictly lower). Same-string bridge as above,
 *   but walked in `next.direction` and **inclusive** of the seam pitch —
 *   the seam note anchors the new run (musical pivot). `nextNotes` and
 *   overlap dedup work identically to `extend`.
 *
 * Both `extend` and `reach-back` now emit a non-empty `connector` in the
 * typical case. The pre-2026-05 contract returned `connector: []` for
 * reach-back; that semantics was superseded when lab integration testing
 * showed it didn't produce coherent bridges. See `connect.test.ts` and
 * `connect.examples.test.ts` for the worked scenarios.
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

  // Guard: degenerate scale inputs → graceful empty result. This is the
  // "nothing to walk on either side" path, distinct from the `strategy ===
  // "none"` case below (same-direction chains) — that path returns the
  // natural walk of next, this one returns nothing.
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

  const dedupSeam = options?.dedupSeam ?? true;

  const side = nextSide(prev.scale, next.scale);
  const strategy = classifyStrategy(prev.direction, next.direction, side);

  switch (strategy) {
    case "none":
      // Same-direction chains: no bridge, but walk next normally.
      return {
        connector: [],
        nextNotes: walkShapeMotif(next.scale, effectiveMotif, {
          direction: next.direction,
        }),
        strategy: "none",
      };
    case "extend":
      return buildExtend(input, dedupSeam, effectiveMotif);
    case "reach-back":
      return buildReachBack(input, dedupSeam, effectiveMotif);
    default: {
      const _exhaustive: never = strategy;
      return _exhaustive;
    }
  }
}
