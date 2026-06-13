/**
 * Tonal integration: connects guitar shapes to Scale, Chord, Mode, Key, and Pcset.
 */

import { get as getScale, modeNames } from "@tonaljs/scale";
import { get as getChord, detect as detectChord } from "@tonaljs/chord";
import {
  chroma as noteChroma,
  transpose as noteTranspose,
  pitchClass,
} from "@tonaljs/note";
import { majorKey } from "@tonaljs/key";

import { FrettedScale, NoFrettedScale, ScaleShape, all } from "./shape";
import { buildFrettedScale } from "./build";
import { noteAt } from "./fretboard";
import { STANDARD } from "./tuning";

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
    return c !== null && c !== undefined && chordChromas.has(c);
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
