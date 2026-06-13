/**
 * Tonal integration: connects guitar shapes to Scale, Chord, Mode, Key, and Pcset.
 */

import { get as getScale, modeNames } from "@tonaljs/scale";
import { get as getChord, detect as detectChord } from "@tonaljs/chord";
import {
  chroma as noteChroma,
  transpose as noteTranspose,
  pitchClass,
  midi as toMidi,
} from "@tonaljs/note";
import { majorKey } from "@tonaljs/key";

import { FrettedNote, FrettedScale, NoFrettedScale, ScaleShape, all } from "./shape";
import { buildFrettedScale, findShapeAnchorFret } from "./build";
import { noteAt } from "./fretboard";
import { STANDARD } from "./tuning";
import { scoreShapeMatch, InferenceProbe, ScoreBreakdown } from "./arpeggio";
import { parseChordFrets } from "./notation";

// ============================================================
// arpeggioFromScale / arpeggioFromShape
// ============================================================

/**
 * Strip octave from a note name or pitch-class string, returning the pitch class.
 * e.g. "A4" → "A", "Bb" → "Bb", "C#3" → "C#"
 */
function pc(note: string): string {
  return pitchClass(note) || note;
}

/** Guard: true when `c` is a valid chroma number (not null/undefined). */
function isValidChroma(c: number | null | undefined): c is number {
  return c != null;
}

/**
 * Derive a chord-tone arpeggio from an already-built parent `FrettedScale`.
 *
 * Filtering is chroma-based (frame-safe): chord membership is computed as the
 * set of chromas produced by transposing the chord tonic by each of the chord's
 * intervals (`Chord.get(chordName).intervals`). Notes are kept if their pitch
 * class chroma falls in that set — so relative/diatonic arpeggios (Am7 inside
 * C major) work without any parent-frame interval translation.
 *
 * The chord tonic comes from `Chord.get(chordName).tonic`; for bare types with
 * no tonic (e.g. `"m7"`) it falls back to `parent.root`.
 *
 * Parent-frame `interval` and `degree` fields on each retained note are
 * preserved as-is (per spec §A.2 "Two Interval Frames" invariant).
 *
 * Never throws. Returns `NoFrettedScale` for empty parent or unrecognised chord.
 * Returns the all-absent sentinel (root/tuning/shapeName preserved, empty: true)
 * if no chord tones land in the parent shape.
 *
 * R-3.1 / spec §A.2
 */
export function arpeggioFromScale(
  parent: FrettedScale,
  chordName: string,
): FrettedScale {
  if (parent.empty) return { ...NoFrettedScale };

  const chord = getChord(chordName);
  if (chord.empty || chord.intervals.length === 0) return { ...NoFrettedScale };

  const tonic = chord.tonic || parent.root;
  const chordChromas = new Set<number | null>(
    chord.intervals.map((ivl) => noteChroma(noteTranspose(tonic, ivl))),
  );
  // Remove null (failed transpose) just in case
  chordChromas.delete(null);

  const kept = parent.notes.filter((n) => {
    const c = noteChroma(n.pc);
    return isValidChroma(c) && chordChromas.has(c);
  });

  const tonicPc = pc(tonic);

  if (kept.length === 0) {
    return {
      ...NoFrettedScale,
      root: tonicPc,
      tuning: parent.tuning,
      shapeName: parent.shapeName,
    };
  }

  return {
    empty: false,
    root: tonicPc,
    scaleType: chord.type,
    scaleName: `${tonicPc} ${chord.type}`,
    shapeName: parent.shapeName,
    tuning: parent.tuning,
    notes: kept,
  };
}

/**
 * Convenience composition: build the parent scale shape then derive the arpeggio.
 *
 * Equivalent to:
 *   `arpeggioFromScale(buildFrettedScale(shape, parentRoot, tuning), chordName)`
 *
 * R-3.1 / spec §A.2
 */
export function arpeggioFromShape(
  shape: ScaleShape,
  chordName: string,
  parentRoot: string,
  tuning: string[] = STANDARD,
): FrettedScale {
  return arpeggioFromScale(buildFrettedScale(shape, parentRoot, tuning), chordName);
}

// ============================================================
// buildFromScale
// ============================================================

/**
 * Build a FrettedScale by looking up the scale name with Tonal's Scale module.
 * Fills in `scaleType` and `scaleName` on the returned FrettedScale.
 *
 * @param shape - the ScaleShape to apply
 * @param scaleName - full scale name, e.g. "A major", "A dorian", "A minor pentatonic"
 * @param tuning - optional string tuning (defaults to STANDARD)
 */
export function buildFromScale(
  shape: ScaleShape,
  scaleName: string,
  tuning?: string[],
): FrettedScale {
  const result = getScale(scaleName);
  if (result.empty || !result.tonic) {
    return { ...NoFrettedScale };
  }

  const frettedScale = buildFrettedScale(shape, result.tonic, tuning);
  if (frettedScale.empty) {
    return frettedScale;
  }

  return { ...frettedScale, scaleType: result.type, scaleName: result.name };
}

// ============================================================
// relatedScales
// ============================================================

/**
 * Return all modal relatives of the scale in the given FrettedScale.
 * Uses Scale.modeNames to find all modes of the same pitch class set.
 *
 * @param frettedScale - a FrettedScale with root and scaleType populated
 * @returns array of { root, scale } objects
 */
export function relatedScales(
  frettedScale: FrettedScale,
): Array<{ root: string; scale: string }> {
  if (frettedScale.empty || !frettedScale.root || !frettedScale.scaleType) {
    return [];
  }

  const fullName = `${frettedScale.root} ${frettedScale.scaleType}`;
  const modes = modeNames(fullName);

  return modes.map(([root, scale]) => ({ root, scale }));
}

// ============================================================
// identifyChord
// ============================================================

/**
 * Identify the chord(s) formed by a set of fretted strings.
 *
 * @param frets - per-string fret numbers (null = muted/unplayed), low to high
 * @param tuning - optional string tuning (defaults to STANDARD)
 * @returns array of chord name strings (may be empty if no match)
 */
export function identifyChord(
  frets: (number | null)[],
  tuning: string[] = STANDARD,
): string[] {
  const notes: string[] = [];

  for (let stringIndex = 0; stringIndex < frets.length; stringIndex++) {
    const fret = frets[stringIndex];
    if (fret == null) continue;
    const noteName = noteAt(tuning, stringIndex, fret);
    if (noteName) {
      notes.push(noteName);
    }
  }

  if (notes.length === 0) {
    return [];
  }

  return detectChord(notes);
}

// ============================================================
// analyzeInKey
// ============================================================

export interface KeyAnalysis {
  empty: boolean;
  chord: string;
  numeral: string;
  degree: number;
}

const NoKeyAnalysis: KeyAnalysis = {
  empty: true,
  chord: "",
  numeral: "",
  degree: 0,
};

/**
 * Analyze a fretted chord voicing in the context of a major key.
 * Returns the detected chord, its roman numeral, and scale degree.
 *
 * @param frets - per-string fret numbers (null = muted/unplayed), low to high
 * @param keyName - tonic of the major key, e.g. "C", "G"
 * @param tuning - optional string tuning (defaults to STANDARD)
 */
export function analyzeInKey(
  frets: (number | null)[],
  keyName: string,
  tuning?: string[],
): KeyAnalysis {
  const chordNames = identifyChord(frets, tuning);
  if (chordNames.length === 0) {
    return { ...NoKeyAnalysis };
  }

  const detectedChord = chordNames[0];
  const key = majorKey(keyName);

  // key.chords is e.g. ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5"]
  // key.grades is e.g. ["I", "II", "III", "IV", "V", "VI", "VII"]
  const chordIndex = key.chords.indexOf(detectedChord);
  if (chordIndex === -1) {
    return { ...NoKeyAnalysis, chord: detectedChord };
  }

  return {
    empty: false,
    chord: detectedChord,
    numeral: key.grades[chordIndex],
    degree: chordIndex + 1,
  };
}

// ============================================================
// isShapeCompatible
// ============================================================

/**
 * Check whether a ScaleShape is compatible with a given scale.
 * A shape is compatible if every interval it uses is present in the scale
 * (i.e. the shape's interval set is a subset of or equal to the scale's intervals).
 *
 * @param shape - the ScaleShape to check
 * @param scaleName - full scale name, e.g. "A major"
 */
export function isShapeCompatible(
  shape: ScaleShape,
  scaleName: string,
): boolean {
  const scale = getScale(scaleName);
  if (scale.empty) {
    return false;
  }

  // Collect unique intervals used by the shape
  const shapeIntervals = Array.from(
    new Set(shape.strings.flatMap((s) => s || [])),
  );

  if (shapeIntervals.length === 0) {
    return false;
  }

  // The scale's intervals (from root), e.g. ["1P","2M","3M","4P","5P","6M","7M"]
  const scaleIntervalSet = new Set(scale.intervals);

  // Every interval in the shape must be in the scale
  return shapeIntervals.every((ivl) => scaleIntervalSet.has(ivl));
}

// ============================================================
// modeShapes
// ============================================================

/**
 * Return all registered ScaleShapes that are compatible with a given mode/scale.
 * Optionally filter by system (e.g. "caged", "3nps", "pentatonic").
 *
 * @param modeName - full scale/mode name, e.g. "dorian", "C major", "minor pentatonic"
 * @param shapeSystem - optional system filter, e.g. "caged"
 */
export function modeShapes(
  modeName: string,
  shapeSystem?: string,
): ScaleShape[] {
  const shapes = all();
  return shapes.filter((shape) => {
    if (shapeSystem && shape.system !== shapeSystem) {
      return false;
    }
    return isShapeCompatible(shape, modeName);
  });
}

// ============================================================
// inferShapeContext — shape detection / inference
// ============================================================

/**
 * The full set of valid inputs to inferShapeContext.
 *
 * - string: compact or delimited chord-fret notation, e.g. "x32010", "1-3-3-2-1-1"
 * - (number|null)[]: fret array, null = muted
 * - FrettedScale: an already-built scale or arpeggio (e.g. from arpeggioFromShape)
 *
 * R-3.2, spec §B
 */
export type InferenceInput = string | (number | null)[] | FrettedScale;

/**
 * Options for inferShapeContext.
 *
 * R-3.2, spec §B
 */
export interface InferenceOptions {
  /** Optional registry system filter, e.g. "caged". Omit to search all systems. */
  system?: string;
  /** Tuning to use for grip inputs. Defaults to STANDARD. */
  tuning?: string[];
  /** Cap on returned candidates after ranking. Non-positive/NaN → no limit. Fractional → floored. */
  limit?: number;
  /**
   * If false (default), probes with fewer than 3 distinct pitch classes return [].
   * Set true to include weak (1–2 PC) probes.
   */
  includeWeak?: boolean;
}

/**
 * A single ranked candidate returned by inferShapeContext.
 *
 * R-3.2, spec §B, review S-6 / S-11 / C-15
 */
export interface InferenceCandidate {
  /** The matched ScaleShape from the registry. */
  shape: ScaleShape;
  /** The shape's system (e.g. "caged", "3nps", "pentatonic"). */
  system: string;
  /**
   * The root the shape was built on (the parent-scale root).
   * NOT the probe's chord root — for Fixture (a) this is "C", not "A".
   */
  shapeRoot: string;
  /** Build-engine anchor fret: fret of the FIRST interval in shape.strings[shape.rootString]. */
  anchorFret: number;
  /** Lowest fret of a "1P" note on shape.rootString in the built scale, if any. */
  rootFret?: number;
  /** Parent-frame intervals matched, first-match-in-built-order, deduped by chroma. */
  matchedIntervals: string[];
  /** Built FrettedNote objects whose chroma is in the probe set. */
  matchedNotes: FrettedNote[];
  /** Total score (sum of all weighted sub-scores). */
  score: number;
  /** Transparent score breakdown for all ranking terms. */
  breakdown: ScoreBreakdown;
}

/**
 * Determine if `input` is a FrettedScale (duck-type check on required fields).
 */
function isFrettedScale(input: InferenceInput): input is FrettedScale {
  return (
    typeof input === "object" &&
    !Array.isArray(input) &&
    input !== null &&
    "empty" in input &&
    "notes" in input &&
    "root" in input
  );
}

/**
 * Normalise a grip or FrettedScale into an InferenceProbe.
 * Returns null if the input is empty/all-muted.
 *
 * spec §B.1
 */
function extractProbe(
  input: InferenceInput,
  tuning: string[],
): InferenceProbe | null {
  if (isFrettedScale(input)) {
    // FrettedScale / arpeggio path (spec §B.1 FrettedScale form)
    if (input.empty || input.notes.length === 0) return null;

    // Collect distinct pitch classes by chroma (dedup)
    const seenChromas = new Set<number>();
    const pitchClasses: number[] = [];
    for (const n of input.notes) {
      const c = noteChroma(n.pc);
      if (isValidChroma(c) && !seenChromas.has(c)) {
        seenChromas.add(c);
        pitchClasses.push(c);
      }
    }

    // bassNote = min-by-midi
    const bassNote = input.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));

    // rootCandidates: declared root first, deduped, order preserved
    const declaredRootChroma = noteChroma(input.root);
    const seen = new Set<number>();
    const rootCandidates: { pc: string; chroma: number }[] = [];

    if (isValidChroma(declaredRootChroma) && !seen.has(declaredRootChroma)) {
      seen.add(declaredRootChroma);
      rootCandidates.push({ pc: pc(input.root), chroma: declaredRootChroma });
    }
    // Then bass note
    const bassChroma = noteChroma(bassNote.pc);
    if (isValidChroma(bassChroma) && !seen.has(bassChroma)) {
      seen.add(bassChroma);
      rootCandidates.push({ pc: bassNote.pc, chroma: bassChroma });
    }
    // Then other pitch classes in note order
    for (const n of input.notes) {
      const c = noteChroma(n.pc);
      if (isValidChroma(c) && !seen.has(c)) {
        seen.add(c);
        rootCandidates.push({ pc: n.pc, chroma: c });
      }
    }

    const anchorFret = Math.min(...input.notes.map((n) => n.fret));
    const anchorString = bassNote.string;

    return { pitchClasses, rootCandidates, anchorFret, anchorString };
  }

  // Grip path (string or array) — spec §B.1 Grip form
  const frets = parseChordFrets(input as string | (number | null)[]);
  const played: { string: number; fret: number; midi: number; noteName: string }[] = [];

  for (let s = 0; s < frets.length; s++) {
    const fret = frets[s];
    if (fret === null) continue;
    if (s >= tuning.length) continue;
    const noteName = noteAt(tuning, s, fret);
    if (!noteName) continue;
    const midi = toMidi(noteName);
    if (midi === null || midi === undefined) continue;
    played.push({ string: s, fret, midi, noteName });
  }

  if (played.length === 0) return null;

  // Sort by midi to identify bass note
  played.sort((a, b) => a.midi - b.midi);
  const bassPlayed = played[0];

  // Distinct chromas
  const seenChromas = new Set<number>();
  const pitchClasses: number[] = [];
  for (const p of played) {
    const c = noteChroma(p.noteName);
    if (isValidChroma(c) && !seenChromas.has(c)) {
      seenChromas.add(c);
      pitchClasses.push(c);
    }
  }

  // rootCandidates: bass first, then other distinct PCs in played order (after sorting by midi)
  const seenRoots = new Set<number>();
  const rootCandidates: { pc: string; chroma: number }[] = [];
  for (const p of played) {
    const c = noteChroma(p.noteName);
    if (isValidChroma(c) && !seenRoots.has(c)) {
      seenRoots.add(c);
      const notePc = pitchClass(p.noteName) || p.noteName;
      rootCandidates.push({ pc: notePc, chroma: c });
    }
  }

  const anchorFret = Math.min(...played.map((p) => p.fret));
  const anchorString = bassPlayed.string;

  return { pitchClasses, rootCandidates, anchorFret, anchorString };
}

/**
 * Detect which registered scale shapes cover a given grip or FrettedScale,
 * returning a ranked list of candidates with transparent score breakdowns.
 *
 * Returns `[]` when:
 * - The input is empty / all-muted.
 * - Fewer than 3 distinct pitch classes (unless `options.includeWeak`).
 * - No registered shape covers all probe pitch classes.
 *
 * Ranking: descending score, then ascending shape.name, then ascending shapeRoot,
 * then ascending anchorFret. `limit` caps the result (floored; non-positive/NaN = no limit).
 *
 * R-3.2 — spec §B
 */
export function inferShapeContext(
  input: InferenceInput,
  options?: InferenceOptions,
): InferenceCandidate[] {
  const tuning = options?.tuning ?? STANDARD;

  const probe = extractProbe(input, tuning);
  if (!probe) return [];

  // Min-evidence gate (spec §B.1, review S-7)
  if (probe.pitchClasses.length < 3 && !options?.includeWeak) return [];

  // Candidate enumeration (spec §B.2)
  const shapes = all().filter((s) =>
    !options?.system || s.system === options.system,
  );

  const candidates: InferenceCandidate[] = [];

  for (const shape of shapes) {
    for (const root of probe.rootCandidates) {
      const built = buildFrettedScale(shape, root.pc, tuning);
      if (built.empty) continue;

      const builtAnchorFret = findShapeAnchorFret(tuning, shape, root.pc, 0);
      if (builtAnchorFret === null) continue;

      const score = scoreShapeMatch(probe, shape, root, built, builtAnchorFret);

      // Hard coverage gate: every probe PC must be in built scale
      if (score.coverage !== 1) continue;

      // Compute rootFret: lowest fret of a "1P" note on shape.rootString in built scale
      const rootNotesOnRootString = built.notes.filter(
        (n) => n.interval === "1P" && n.string === shape.rootString,
      );
      const rootFret =
        rootNotesOnRootString.length > 0
          ? Math.min(...rootNotesOnRootString.map((n) => n.fret))
          : undefined;

      candidates.push({
        shape,
        system: shape.system,
        shapeRoot: root.pc,
        anchorFret: builtAnchorFret,
        rootFret,
        matchedIntervals: score.matchedIntervals,
        matchedNotes: score.matchedNotes,
        score: score.total,
        breakdown: score.breakdown,
      });
    }
  }

  // Ranking (spec §B.4): descending score, then ascending name, then ascending shapeRoot, then ascending anchorFret
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.shape.name !== b.shape.name) return a.shape.name < b.shape.name ? -1 : 1;
    if (a.shapeRoot !== b.shapeRoot) return a.shapeRoot < b.shapeRoot ? -1 : 1;
    return a.anchorFret - b.anchorFret;
  });

  // Apply limit (spec §B.4)
  const rawLimit = options?.limit;
  let limit: number | undefined;
  if (rawLimit !== undefined && isFinite(rawLimit) && Math.floor(rawLimit) >= 1) {
    limit = Math.floor(rawLimit);
  }

  return limit !== undefined ? candidates.slice(0, limit) : candidates;
}
