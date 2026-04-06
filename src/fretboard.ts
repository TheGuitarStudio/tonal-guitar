/**
 * Core fretboard math: pure functions for note-at-position lookups.
 * All functions accept tuning as a plain string[] (low to high).
 */

import {
  transpose,
  midi as toMidi,
  chroma as toChroma,
  fromMidiSharps,
  enharmonic,
} from "@tonaljs/note";
import { fromSemitones } from "@tonaljs/interval";
import { STANDARD } from "./tuning";

// ============================================================
// Basic position math
// ============================================================

/**
 * Return the note name at a given string and fret.
 */
export function noteAt(
  tuning: string[],
  stringIndex: number,
  fret: number,
): string {
  const openNote = tuning[stringIndex];
  return transpose(openNote, fromSemitones(fret));
}

/**
 * Reverse lookup: given a full note name (with octave), return the fret
 * on a given string. Returns null if negative (unreachable).
 */
export function fretFor(
  tuning: string[],
  stringIndex: number,
  targetNote: string,
): number | null {
  const openMidi = toMidi(tuning[stringIndex]);
  const targetMidi = toMidi(targetNote);
  if (openMidi == null || targetMidi == null) return null;
  const fret = targetMidi - openMidi;
  return fret >= 0 ? fret : null;
}

// ============================================================
// Pitch-class (chroma-based) lookups
// ============================================================

/**
 * Find the nearest (lowest) fret >= 0 where a pitch class appears on a string.
 * Does not consider position context.
 */
export function findNearestFret(
  tuning: string[],
  stringIndex: number,
  pitchClass: string,
): number | null {
  const openChr = toChroma(tuning[stringIndex]);
  const targetChr = toChroma(pitchClass);
  if (
    openChr == null ||
    targetChr == null ||
    isNaN(openChr) ||
    isNaN(targetChr)
  )
    return null;
  let fret = targetChr - openChr;
  if (fret < 0) fret += 12;
  return fret;
}

/**
 * Find the fret for a pitch class on a given string, within a position window
 * centered on referenceFret.
 *
 * Window: [ref - ceil(span/2), ref + span]
 * Default span: 5
 */
export function findFretInPosition(
  tuning: string[],
  stringIndex: number,
  pitchClass: string,
  referenceFret: number,
  span: number = 5,
): number | null {
  const openChr = toChroma(tuning[stringIndex]);
  const targetChr = toChroma(pitchClass);
  if (
    openChr == null ||
    targetChr == null ||
    isNaN(openChr) ||
    isNaN(targetChr)
  )
    return null;

  let fret = targetChr - openChr;
  if (fret < 0) fret += 12;

  const lowerBound = referenceFret - Math.ceil(span / 2);
  const upperBound = referenceFret + span;

  while (fret < lowerBound) fret += 12;
  while (fret > upperBound) fret -= 12;

  return fret >= 0 ? fret : null;
}

// ============================================================
// Full fretboard queries
// ============================================================

export interface FretboardPosition {
  string: number;
  fret: number;
  note: string;
  midi: number;
}

/**
 * Find all fretboard positions for a given pitch class.
 * Returns positions with correct note names (octave included).
 */
export function findNote(
  pitchClass: string,
  tuning: string[] = STANDARD,
  fretRange: [number, number] = [0, 24],
): FretboardPosition[] {
  const [minFret, maxFret] = fretRange;
  const results: FretboardPosition[] = [];

  for (let s = 0; s < tuning.length; s++) {
    const openMidi = toMidi(tuning[s]);
    if (openMidi == null) continue;

    const openChr = toChroma(tuning[s]);
    const targetChr = toChroma(pitchClass);
    if (
      openChr == null ||
      targetChr == null ||
      isNaN(openChr) ||
      isNaN(targetChr)
    )
      continue;

    let fret = targetChr - openChr;
    if (fret < 0) fret += 12;

    while (fret <= maxFret) {
      if (fret >= minFret) {
        const m = openMidi + fret;
        const rawNote = fromMidiSharps(m);
        const correctNote = enharmonic(rawNote, pitchClass);
        const fullNote = correctNote || rawNote;
        results.push({ string: s, fret, note: fullNote, midi: m });
      }
      fret += 12;
    }
  }

  return results;
}

/**
 * Generate the complete fretboard grid for a given tuning and fret range.
 */
export function fretboard(
  tuning: string[] = STANDARD,
  fretRange: [number, number] = [0, 24],
): FretboardPosition[] {
  const [minFret, maxFret] = fretRange;
  const results: FretboardPosition[] = [];

  for (let s = 0; s < tuning.length; s++) {
    const openMidi = toMidi(tuning[s]);
    if (openMidi == null) continue;

    for (let fret = minFret; fret <= maxFret; fret++) {
      const m = openMidi + fret;
      const note = fromMidiSharps(m);
      results.push({ string: s, fret, note, midi: m });
    }
  }

  return results;
}
