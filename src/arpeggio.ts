/**
 * Arpeggio derivation and shape-scoring — pure tier (zero Tonal peer deps).
 *
 * All functions here are pure (no side effects, no mutation) and have no
 * dependency on @tonaljs/scale, @tonaljs/chord, or @tonaljs/key.
 * Only @tonaljs/note and @tonaljs/interval are used as peer deps elsewhere;
 * this file imports only from ./shape.
 */

import type { FrettedNote, FrettedScale, ScaleShape } from "./shape";
import { NoFrettedScale } from "./shape";

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
 * Reference: A = 9 (chromatic scale starting from C = 0).
 * Letter base chromas: C=0, D=2, E=4, F=5, G=7, A=9, B=11.
 * Each '#' adds 1, each 'b' subtracts 1 (modulo 12).
 *
 * Returns -1 for unrecognisable input (empty string, bad letter, etc.).
 *
 * Not exported from this module or from src/index — internal to arpeggio.ts only.
 */
function pcChroma(pc: string): number {
  if (!pc || pc.length === 0) return -1;

  const letter = pc[0].toUpperCase();
  const letterChromas: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  const base = letterChromas[letter];
  if (base === undefined) return -1;

  let chroma = base;
  for (let i = 1; i < pc.length; i++) {
    if (pc[i] === "#") {
      chroma += 1;
    } else if (pc[i] === "b") {
      chroma -= 1;
    } else {
      // Unrecognised accidental character
      return -1;
    }
  }

  return ((chroma % 12) + 12) % 12;
}

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
  scale: FrettedScale,
  intervals: string[],
): FrettedScale {
  // Guard: empty/sentinel scale → return NoFrettedScale (R-2.3)
  if (scale.empty) return { ...NoFrettedScale };

  const wanted = new Set(intervals);
  // Single-pass filter preserving order; FrettedNote objects reused (immutable references)
  const kept = scale.notes.filter((n) => wanted.has(n.interval));

  // Empty filter result: preserve root/tuning/shapeName (R-2.3)
  if (kept.length === 0) {
    return {
      ...NoFrettedScale,
      root: scale.root,
      tuning: scale.tuning,
      shapeName: scale.shapeName,
    };
  }

  // Return a fresh FrettedScale with a fresh notes array (R-2.2)
  return {
    empty: false,
    root: scale.root,
    scaleType: "",   // callers may overwrite
    scaleName: "",
    shapeName: scale.shapeName,
    tuning: scale.tuning,
    notes: kept,
  };
}

/**
 * Score how well a candidate (shape + root + built scale) matches a probe.
 *
 * All terms are deterministic; the formula is:
 *   total = 100*coverage + 40*tightness + 30*anchorHit + 10*rootOnAnchorString
 *         + 20*positionAgreement + 15*rootPreference
 *
 * @param probe            Normalised inference probe (chromas + root candidates).
 * @param shape            The ScaleShape candidate being scored.
 * @param root             The root the shape was built on (pc + chroma).
 * @param built            The FrettedScale produced by buildFrettedScale(shape, root.pc, tuning).
 * @param builtAnchorFret  The fret at which the built scale is anchored, as computed
 *                         by findShapeAnchorFret (the fret of the FIRST interval in
 *                         shape.strings[shape.rootString]).  This is passed as a separate
 *                         parameter because FrettedScale carries no anchorFret field.
 *                         The integration tier (inferShapeContext, TG6) computes this via
 *                         findShapeAnchorFret from build.ts before calling scoreShapeMatch.
 *
 * Divergence from spec's formal 4-parameter signature (spec §Exact API surface):
 * The spec lists scoreShapeMatch(probe, shape, root, built) but FrettedScale has no
 * anchorFret field.  A fifth parameter is required; the integration tier computes it
 * and passes it here.  The pure tier never calls build.ts.
 *
 * Pure: zero Tonal deps, no mutation.
 *
 * R-2.4 — spec §B.3 / tasks.md TG4.2
 */
export function scoreShapeMatch(
  probe: InferenceProbe,
  _shape: ScaleShape,
  root: { pc: string; chroma: number },
  built: FrettedScale,
  builtAnchorFret: number,
): {
  total: number;
  coverage: number;
  matchedIntervals: string[];
  matchedNotes: FrettedNote[];
  breakdown: ScoreBreakdown;
} {
  // Build the set of chromas present in the built scale
  const builtChromas = new Set<number>(
    built.notes.map((n) => pcChroma(n.pc)).filter((c) => c !== -1),
  );

  // --- coverage ---
  // Count how many probe chromas are present in the built scale
  const matchedProbeCount = probe.pitchClasses.filter((c) =>
    builtChromas.has(c),
  ).length;
  const coverage =
    probe.pitchClasses.length > 0
      ? matchedProbeCount / probe.pitchClasses.length
      : 0;

  // --- tightness ---
  // probe.pitchClasses.length / distinctChromaCount(built)
  const distinctBuiltCount = builtChromas.size;
  const tightness =
    distinctBuiltCount > 0 ? probe.pitchClasses.length / distinctBuiltCount : 0;

  // --- matchedIntervals and matchedNotes (review S-8) ---
  // Build Map<chroma, interval> in built-note order; first-match-wins (dedup by chroma).
  // Also collect matchedNotes: all built notes whose chroma is in the probe set.
  const probeChromaSet = new Set<number>(probe.pitchClasses);
  const chromaToInterval = new Map<number, string>();
  const matchedNotes: FrettedNote[] = [];

  for (const n of built.notes) {
    const chroma = pcChroma(n.pc);
    if (chroma === -1) continue;

    if (probeChromaSet.has(chroma)) {
      // Collect matchedNotes (all built notes whose chroma is in probe)
      matchedNotes.push(n);

      // First-match-wins for matchedIntervals (dedup by chroma)
      if (!chromaToInterval.has(chroma)) {
        chromaToInterval.set(chroma, n.interval);
      }
    }
  }

  // matchedIntervals in the order chromas were first encountered (built-note order)
  const matchedIntervals = Array.from(chromaToInterval.values());

  // --- anchorHit and rootOnAnchorString ---
  // rootNotesInBuilt: all built notes with interval "1P"
  const rootNotesInBuilt = built.notes.filter((n) => n.interval === "1P");
  const bassChroma =
    probe.rootCandidates.length > 0 ? probe.rootCandidates[0].chroma : -1;

  const anchorHit = rootNotesInBuilt.some(
    (n) =>
      n.string === probe.anchorString && pcChroma(n.pc) === bassChroma,
  );

  const rootOnAnchorString = rootNotesInBuilt.some(
    (n) => n.string === probe.anchorString,
  );

  // --- positionAgreement (circular mod-12) ---
  // d = abs(builtAnchorFret - probe.anchorFret) % 12
  // circularDelta = min(d, 12 - d)  — in [0, 6]
  // positionAgreement = 1 - circularDelta / 12  — in [0.5, 1]
  const d = Math.abs(builtAnchorFret - probe.anchorFret) % 12;
  const circularDelta = Math.min(d, 12 - d);
  const positionAgreement = 1 - circularDelta / 12;

  // --- rootPreference ---
  // indexOf(root in probe.rootCandidates) — 0 = bass/declared
  // rootPreference = 1 / (1 + rootRank)
  const rootRank = probe.rootCandidates.findIndex(
    (rc) => rc.chroma === root.chroma,
  );
  // If not found, treat as the last possible rank (lowest preference)
  const effectiveRank = rootRank === -1 ? probe.rootCandidates.length : rootRank;
  const rootPreference = 1 / (1 + effectiveRank);

  // --- total score ---
  const total =
    100 * coverage +
    40 * tightness +
    30 * (anchorHit ? 1 : 0) +
    10 * (rootOnAnchorString ? 1 : 0) +
    20 * positionAgreement +
    15 * rootPreference;

  return {
    total,
    coverage,
    matchedIntervals,
    matchedNotes,
    breakdown: {
      tightness,
      anchorHit,
      rootOnAnchorString,
      positionAgreement,
      rootPreference,
    },
  };
}
