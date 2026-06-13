/**
 * Arpeggio derivation and shape-scoring — pure tier (zero Tonal peer deps).
 *
 * All functions here are pure (no side effects, no mutation) and have no
 * dependency on @tonaljs/scale, @tonaljs/chord, or @tonaljs/key.
 * Only @tonaljs/note and @tonaljs/interval are used as peer deps elsewhere;
 * this file imports only from ./shape.
 */

import type { FrettedNote, FrettedScale, ScaleShape } from "./shape";

// ============================================================
// Exported types
// ============================================================

/**
 * A normalized representation of a probe (grip or arpeggio) used by the
 * pure scoring core.  The integration tier extracts this from a raw grip or
 * FrettedScale before calling scoreShapeMatch.
 *
 * R-2.4 (spec §B.1)
 */
export interface InferenceProbe {
  /** Distinct chromas (0–11) present in the probe, deduped. */
  pitchClasses: number[];
  /**
   * Root candidates: bass / declared-root first, then other distinct pitch
   * classes in order of first appearance.  Each entry carries both the
   * pitch-class name and its precomputed chroma.
   */
  rootCandidates: { pc: string; chroma: number }[];
  /** Minimum fret among the probe's played notes. */
  anchorFret: number;
  /** String index (0-based, low-string-first) of the lowest-MIDI probe note. */
  anchorString: number;
}

/**
 * Transparent breakdown of every term in the scoreShapeMatch formula.
 * Exposed on every InferenceCandidate so callers can explain rankings.
 *
 * R-2.4 / review S-6 (spec §B.3)
 */
export interface ScoreBreakdown {
  /** probe.pitchClasses.length / distinctChromaCount(built) — in (0, 1]. */
  tightness: number;
  /**
   * True when a "1P" built note sits on probe.anchorString at the probe's
   * bass pitch class.
   */
  anchorHit: boolean;
  /** True when any "1P" built note sits on probe.anchorString. */
  rootOnAnchorString: boolean;
  /**
   * Circular mod-12 position agreement: 1 at exact match, 0.5 at worst case
   * (6-fret circular distance).  Uses mod-12 to avoid penalising shapes
   * anchored an octave from the probe (e.g. CAGED_A of A anchors at fret 11).
   */
  positionAgreement: number;
  /** 1/(1+rootRank): rank 0 → 1.0, rank 1 → 0.5, rank 2 → 0.333, … */
  rootPreference: number;
}

// ============================================================
// Internal pure helper (not exported from this module or index.ts)
// ============================================================

/**
 * Convert a pitch-class name (e.g. "C", "Bb", "F#") to its chroma (0–11)
 * using letter + accidental arithmetic.  No Tonal peer dep.
 *
 * Reference: A = 9.
 * Returns -1 for unrecognisable input (empty string, bad letter, etc.).
 *
 * Note: this is intentionally a stub for Task Group 2; the full implementation
 * is provided in Task Group 4.
 */
function pcChroma(_pc: string): number {
  throw new Error("not implemented");
}

// Suppress unused-variable lint warning on the stub until TG4 replaces it.
void pcChroma;

// ============================================================
// Exported stubs (implemented in later task groups)
// ============================================================

/**
 * Filter a FrettedScale to only those notes whose `interval` (in the
 * **parent-scale frame**) is in the provided set.
 *
 * This is a **parent-frame** filter — the intervals must be expressed
 * relative to the parent scale root, not the chord tonic.  For example, to
 * filter the Am7 arpeggio from a C-major shape, supply
 * `["6M", "1P", "3M", "5P"]` (the parent-frame intervals for A, C, E, G in
 * C major), NOT the Am7 chord-frame intervals `["1P", "3m", "5P", "7m"]`.
 *
 * For the chord-frame convenience API that translates automatically, see
 * `arpeggioFromScale` / `arpeggioFromShape` in `src/integration.ts`.
 *
 * Pure: never mutates `scale` or its notes; always returns a fresh object.
 * Never throws; empty/bad input returns the NoFrettedScale sentinel.
 *
 * R-2.1, R-2.2, R-2.3 — spec §A.1
 */
export function filterChordTones(
  _scale: FrettedScale,
  _intervals: string[],
): FrettedScale {
  throw new Error("not implemented");
}

/**
 * Score how well a candidate (shape + root + built scale) matches a probe.
 *
 * All terms are deterministic; the formula is:
 *   total = 100*coverage + 40*tightness + 30*anchorHit + 10*rootOnAnchorString
 *         + 20*positionAgreement + 15*rootPreference
 *
 * @param probe          Normalised inference probe (chromas + root candidates).
 * @param shape          The ScaleShape candidate being scored.
 * @param root           The root the shape was built on (pc + chroma).
 * @param built          The FrettedScale produced by buildFrettedScale(shape, root.pc, tuning).
 *
 * Note: the spec's formal API surface lists 4 parameters.  The integration
 * tier (inferShapeContext) computes builtAnchorFret separately (via
 * findShapeAnchorFret from build.ts) and will pass it as a fifth parameter
 * in Task Group 4.  The stub here matches the 4-parameter form; the
 * signature will be extended in TG4 to add `builtAnchorFret: number`.
 *
 * Pure: zero Tonal deps, no mutation.
 *
 * R-2.4 — spec §B.3
 */
export function scoreShapeMatch(
  _probe: InferenceProbe,
  _shape: ScaleShape,
  _root: { pc: string; chroma: number },
  _built: FrettedScale,
): {
  total: number;
  coverage: number;
  matchedIntervals: string[];
  matchedNotes: FrettedNote[];
  breakdown: ScoreBreakdown;
} {
  throw new Error("not implemented");
}
