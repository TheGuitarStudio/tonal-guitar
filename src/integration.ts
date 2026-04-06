/**
 * Tonal integration: connects guitar shapes to Scale, Chord, Mode, Key, and Pcset.
 */

import { get as getScale, modeNames } from "@tonaljs/scale";
import { detect as detectChord } from "@tonaljs/chord";
import { majorKey } from "@tonaljs/key";

import { FrettedScale, NoFrettedScale, ScaleShape, all } from "./shape";
import { buildFrettedScale } from "./build";
import { noteAt } from "./fretboard";
import { STANDARD } from "./tuning";

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
