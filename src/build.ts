/**
 * Build engine: applies ScaleShape or ChordShape to a root + tuning,
 * returning concrete fretted positions.
 */

import {
  transpose,
  midi as toMidi,
  pitchClass as toPitchClass,
  fromMidiSharps,
  enharmonic,
} from "@tonaljs/note";
import {
  num as intervalNum,
  semitones as intervalSemitones,
} from "@tonaljs/interval";
import { findNearestFret, findFretInPosition } from "./fretboard";
import {
  FrettedNote,
  FrettedScale,
  NoFrettedScale,
  ScaleShape,
  ChordShape,
} from "./shape";
import { STANDARD } from "./tuning";

// ============================================================
// Scale shapes
// ============================================================

/**
 * Apply a ScaleShape to a root note and tuning, returning all fretted positions.
 */
export function buildFrettedScale(
  shape: ScaleShape,
  root: string,
  tuning: string[] = STANDARD,
): FrettedScale {
  // FIX #6: Strip octave from root
  const pc = toPitchClass(root);
  if (!pc) return { ...NoFrettedScale };

  const rootFret = findNearestFret(tuning, shape.rootString, pc);
  if (rootFret == null) return { ...NoFrettedScale };

  // FIX #1: Build interval-to-scaleIndex map
  const allIntervals = shape.strings.flatMap((s) => s || []);
  const uniqueIntervals = Array.from(new Set(allIntervals));
  uniqueIntervals.sort(
    (a, b) => (intervalSemitones(a) ?? 0) - (intervalSemitones(b) ?? 0),
  );
  const intervalToIndex = new Map<string, number>();
  uniqueIntervals.forEach((ivl, i) => intervalToIndex.set(ivl, i));

  const notes: FrettedNote[] = [];

  for (let s = 0; s < shape.strings.length && s < tuning.length; s++) {
    const intervals = shape.strings[s];
    if (!intervals) continue;

    for (const ivl of intervals) {
      const targetPc = transpose(pc, ivl);
      if (!targetPc) continue;

      const fret = findFretInPosition(
        tuning,
        s,
        targetPc,
        rootFret,
        shape.span,
      );
      if (fret == null) continue;

      const openMidi = toMidi(tuning[s]);
      if (openMidi == null) continue;
      const midi = openMidi + fret;

      // FIX #2: Correct octave calculation via enharmonic lookup
      const rawNote = fromMidiSharps(midi);
      const correctNote = enharmonic(rawNote, targetPc);
      const fullNote = correctNote || rawNote;

      // FIX #1: Use intervalNum() not regex
      const ivlNum = intervalNum(ivl) ?? 0;
      const scaleIndex = intervalToIndex.get(ivl) ?? 0;

      notes.push({
        string: s,
        fret,
        note: fullNote,
        pc: toPitchClass(targetPc) || targetPc,
        interval: ivl,
        scaleIndex,
        degree: scaleIndex + 1,
        intervalNumber: ivlNum,
        midi,
      });
    }
  }

  notes.sort((a, b) => a.midi - b.midi || a.string - b.string);

  return {
    empty: false,
    root: pc,
    scaleType: "",
    scaleName: "",
    shapeName: shape.name,
    tuning,
    notes,
  };
}

// ============================================================
// Chord shapes
// ============================================================

export interface Fingering {
  positions: FrettedNote[];
  frets: (number | null)[];
  root: string;
  shapeName: string;
  startFret: number;
}

/**
 * Apply a ChordShape to a root note and tuning.
 * Converts the chord shape to a ScaleShape (single interval per string)
 * and delegates to buildFrettedScale.
 */
export function applyChordShape(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
): Fingering {
  const asScaleShape: ScaleShape = {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };

  const result = buildFrettedScale(asScaleShape, root, tuning);
  const frets: (number | null)[] = tuning.map(() => null);
  for (const p of result.notes) {
    frets[p.string] = p.fret;
  }

  // FIX #11: Guard against empty array
  const fretValues = result.notes.map((n) => n.fret);
  const startFret = fretValues.length > 0 ? Math.min(...fretValues) : 0;

  return {
    positions: result.notes,
    frets,
    root: toPitchClass(root) || root,
    shapeName: shape.name,
    startFret,
  };
}
