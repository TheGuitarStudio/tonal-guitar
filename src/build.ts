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
  chroma as toChroma,
} from "@tonaljs/note";
import {
  num as intervalNum,
  semitones as intervalSemitones,
} from "@tonaljs/interval";
import { findNearestFret } from "./fretboard";
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
 * How many frets a shape may extend BELOW its anchor fret. Notes lower than
 * `anchor - LOOKBACK` get pushed up by an octave so the shape stays
 * cohesive instead of wrapping around the open strings.
 */
const LOOKBACK = 4;
/**
 * How many frets a shape may extend ABOVE its root fret. LOOKBACK + LOOKAHEAD
 * must equal 12 so every pitch class lands in exactly one fret of the window.
 */
const LOOKAHEAD = 8;

/**
 * Find the fret on `string` where `targetPc` lies, within the window
 * [rootFret - LOOKBACK, rootFret + LOOKAHEAD] and >= `minFret`.
 * Returns null if no fret in that window meets the constraint.
 */
function fretInWindow(
  tuning: string[],
  string: number,
  targetPc: string,
  rootFret: number,
  minFret: number,
): number | null {
  const openChr = toChroma(tuning[string]);
  const targetChr = toChroma(targetPc);
  if (
    openChr == null ||
    targetChr == null ||
    isNaN(openChr) ||
    isNaN(targetChr)
  ) {
    return null;
  }
  const base = (((targetChr - openChr) % 12) + 12) % 12;
  const lower = rootFret - LOOKBACK;
  const upper = rootFret + LOOKAHEAD;
  let f = base;
  while (f < lower) f += 12;
  if (f > upper) return null;
  return f >= minFret ? f : null;
}

/**
 * Check whether every (string, interval) pair in `shape` placed against
 * `anchor` lands on a fret inside the window and >= `minFret`.
 */
function shapeFitsAtAnchor(
  tuning: string[],
  shape: ScaleShape,
  pc: string,
  anchor: number,
  minFret: number,
): boolean {
  for (let s = 0; s < shape.strings.length && s < tuning.length; s++) {
    const intervals = shape.strings[s];
    if (!intervals) continue;
    for (const ivl of intervals) {
      const targetPc = transpose(pc, ivl);
      if (!targetPc) continue;
      const fret = fretInWindow(tuning, s, targetPc, anchor, minFret);
      if (fret == null) return false;
    }
  }
  return true;
}

/**
 * Pick the anchor fret for a shape. By convention each string's interval
 * array is listed in pitch order (low to high), so the FIRST interval on
 * the rootString is the lowest-pitched note on that string. We anchor the
 * shape at that interval's natural fret on the rootString.
 *
 * (Sorting chromatically would mis-place shapes like CAGED C applied to A,
 * whose A string holds [6M, 7M, 1P]: the "1P" there sits an octave above
 * the 6M, so anchoring on it as if it were the lowest snaps the whole
 * shape to the open position.)
 *
 * If the shape doesn't fully fit at the natural anchor (e.g. Pentatonic
 * Box 5 applied to A, where the lowest box would need notes below the
 * open strings), shift the anchor up by 12 and retry.
 */
const MAX_FRET = 24;
function findShapeAnchorFret(
  tuning: string[],
  shape: ScaleShape,
  pc: string,
  minFret: number,
): number | null {
  const intervals = shape.strings[shape.rootString];
  let baseAnchor: number | null;
  if (!intervals || intervals.length === 0) {
    baseAnchor = findNearestFret(tuning, shape.rootString, pc);
  } else {
    const firstPc = transpose(pc, intervals[0]);
    if (!firstPc) return null;
    baseAnchor = findNearestFret(tuning, shape.rootString, firstPc);
  }
  if (baseAnchor == null) return null;
  // If the natural anchor would force notes below minFret, jump up an octave.
  while (baseAnchor + LOOKAHEAD < minFret && baseAnchor + 12 <= MAX_FRET) {
    baseAnchor += 12;
  }

  for (
    let anchor = baseAnchor;
    anchor <= MAX_FRET;
    anchor += 12
  ) {
    if (shapeFitsAtAnchor(tuning, shape, pc, anchor, minFret)) return anchor;
  }
  // Fall back to the natural anchor even if some notes won't fit — the
  // build loop will just drop them rather than return an empty result.
  return baseAnchor;
}

export interface BuildOptions {
  /**
   * If false, never produce notes at fret 0. The shape is shifted up by
   * an octave (or more) until no note in the layout would land on an
   * open string. Default: true.
   */
  allowOpenStrings?: boolean;
}

/**
 * Apply a ScaleShape to a root note and tuning, returning all fretted positions.
 */
export function buildFrettedScale(
  shape: ScaleShape,
  root: string,
  tuning: string[] = STANDARD,
  options: BuildOptions = {},
): FrettedScale {
  // FIX #6: Strip octave from root
  const pc = toPitchClass(root);
  if (!pc) return { ...NoFrettedScale };

  const minFret = options.allowOpenStrings === false ? 1 : 0;
  const rootFret = findShapeAnchorFret(tuning, shape, pc, minFret);
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

      const fret = fretInWindow(tuning, s, targetPc, rootFret, minFret);
      if (fret == null || fret < minFret) continue;

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
  options: BuildOptions = {},
): Fingering {
  const asScaleShape: ScaleShape = {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };

  const result = buildFrettedScale(asScaleShape, root, tuning, options);
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
