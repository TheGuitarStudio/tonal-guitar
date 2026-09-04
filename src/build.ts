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
  Barre,
  gripBaseFret,
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
  if (isNaN(openChr) || isNaN(targetChr)) {
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
 * Compute how many strings to shift shape string indices when the tuning is
 * longer than the shape (e.g. 7-string tuning with a 6-string shape).
 *
 * Convention: string index 0 is the LOWEST string. A 6-string shape on a
 * 7-string tuning should map shape string 0 → tuning string 1 (the low-E
 * equivalent), not tuning string 0 (the added low-B). When the tuning is
 * shorter than the shape, no offset is applied and the build loop's existing
 * `s < tuning.length` guard truncates the extra shape strings.
 */
function stringOffset(tuning: string[], shape: ScaleShape): number {
  return Math.max(0, tuning.length - shape.strings.length);
}

/**
 * Check whether every (string, interval) pair in `shape` placed against
 * `anchor` lands on a fret inside the window and >= `minFret`.
 *
 * String indices are shifted by `strOffset` so a 6-string shape placed on a
 * 7/8-string tuning is evaluated against the correct (high-side) strings.
 */
function shapeFitsAtAnchor(
  tuning: string[],
  shape: ScaleShape,
  pc: string,
  anchor: number,
  minFret: number,
): boolean {
  const strOffset = stringOffset(tuning, shape);
  for (let s = 0; s < shape.strings.length && s + strOffset < tuning.length; s++) {
    const intervals = shape.strings[s];
    if (!intervals) continue;
    for (const ivl of intervals) {
      const targetPc = transpose(pc, ivl);
      if (!targetPc) continue;
      const fret = fretInWindow(tuning, s + strOffset, targetPc, anchor, minFret);
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
 *
 * When the tuning is longer than the shape (e.g. 7/8-string tuning with a
 * 6-string shape), all shape string indices are shifted by
 * `tuning.length - shape.strings.length` so the shape maps to the
 * standard-equivalent high-side strings rather than the added low strings.
 */
const MAX_FRET = 24;
export function findShapeAnchorFret(
  tuning: string[],
  shape: ScaleShape,
  pc: string,
  minFret: number,
): number | null {
  const strOffset = stringOffset(tuning, shape);
  const adjustedRootString = shape.rootString + strOffset;
  const intervals = shape.strings[shape.rootString];
  let baseAnchor: number | null;
  if (!intervals || intervals.length === 0) {
    baseAnchor = findNearestFret(tuning, adjustedRootString, pc);
  } else {
    const firstPc = transpose(pc, intervals[0]);
    if (!firstPc) return null;
    baseAnchor = findNearestFret(tuning, adjustedRootString, firstPc);
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

  // When the tuning is longer than the shape (e.g. 7/8-string tuning with a
  // 6-string shape), shift all shape-string indices up by the difference so
  // the shape maps onto the standard-equivalent high-side strings.
  // When the tuning is shorter than the shape, strOffset is 0 and the loop's
  // `s + strOffset < tuning.length` guard naturally truncates extra shape
  // strings (deliberate no-op for truncated tunings).
  const strOffset = stringOffset(tuning, shape);

  for (let s = 0; s < shape.strings.length && s + strOffset < tuning.length; s++) {
    const intervals = shape.strings[s];
    if (!intervals) continue;

    for (const ivl of intervals) {
      const targetPc = transpose(pc, ivl);
      if (!targetPc) continue;

      const tuningString = s + strOffset;
      const fret = fretInWindow(tuning, tuningString, targetPc, rootFret, minFret);
      if (fret == null || fret < minFret) continue;

      const openMidi = toMidi(tuning[tuningString]);
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
        string: tuningString,
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
    anchorFret: rootFret,
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
  // Copy of shape.fingers, remapped onto tuning-string indices the same way
  // `frets` is (via the shape→tuning string offset for tunings longer than
  // the shape). Never the same array reference as shape.fingers, and never
  // mutated. (shape-workbench spec §2.1)
  fingers: (number | null)[];
  // shape.barres, with each entry's fret resolved from the D-010 grip-base
  // offset to an absolute fret for this build:
  // `gripBaseFret(frets) + shape.barres[i].fret`. `fromString`/`toString` are
  // remapped onto tuning-string indices the same way `fingers` is above
  // (clamped to the tuning's last valid index). `finger` is passed through
  // unchanged. (shape-workbench spec §2.1, CR-003)
  barres: Barre[];
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

  // shape-workbench §2.1: remap shape.fingers onto tuning-string indices the
  // same way `frets` is (via the shape→tuning string offset), never mutating
  // shape.fingers and never sharing its array reference. Reduces to a plain
  // copy when tuning.length === shape.strings.length (the common case).
  const strOffset = stringOffset(tuning, asScaleShape);
  const fingers: (number | null)[] = tuning.map(() => null);
  for (let s = 0; s < shape.fingers.length && s + strOffset < tuning.length; s++) {
    fingers[s + strOffset] = shape.fingers[s];
  }

  // shape-workbench §2.1: resolve each barre's grip-base-relative offset
  // (D-010) to an absolute fret for this build. `fromString`/`toString` are
  // shape-indexed on `shape.barres` (like `shape.fingers`), so they're
  // remapped onto tuning-string indices via `strOffset` the same way
  // `fingers` is above — clamped to the last valid tuning index so a barre
  // referencing a string beyond a truncated tuning never points out of
  // bounds (CR-003). `finger` passes through unchanged.
  const gripBase = gripBaseFret(frets);
  const lastTuningIndex = tuning.length - 1;
  const barres: Barre[] = shape.barres.map((b) => ({
    ...b,
    fret: gripBase + b.fret,
    fromString: Math.min(b.fromString + strOffset, lastTuningIndex),
    toString: Math.min(b.toString + strOffset, lastTuningIndex),
  }));

  return {
    positions: result.notes,
    frets,
    root: toPitchClass(root) || root,
    shapeName: shape.name,
    startFret,
    fingers,
    barres,
  };
}

/**
 * Deterministic starting-point fingering for a chord shape that hasn't been
 * authored with `fingers`/`barres` yet (shape-workbench §2.2 — the editor
 * seeds from this and the author may override).
 *
 * Rule, applied to the built (absolute) frets:
 *   - muted string → `null`
 *   - open string (fret 0) → finger `0`
 *   - fretted strings: distinct fret values, sorted ascending, get fingers
 *     1, 2, 3, ... capped at 4 (the lowest fretted fret gets finger 1)
 *   - a run of ≥2 adjacent strings sharing the same fretted fret collapses
 *     into a single `Barre` at that fret's shared finger, spanning
 *     `fromString`..`toString` (each string in the run also gets that
 *     finger in the returned `fingers` array)
 *
 * `Barre.fret` in the result follows the D-010 offset convention (relative
 * to `gripBaseFret` of the built frets), matching how `ChordShape.barres`
 * is authored.
 *
 * The returned `fingers`/`barres` are SHAPE-indexed (length
 * `shape.strings.length`, matching `ChordShape.fingers`/`ChordShape.barres`)
 * rather than tuning-indexed — they seed those shape-indexed fields (CR-003),
 * so a 7/8-string `tuning` must not leak tuning-length arrays or
 * `strOffset`-shifted string indices back into shape-relative output.
 */
export function autoFingering(
  shape: Omit<ChordShape, "fingers" | "barres">,
  root: string,
  tuning: string[] = STANDARD,
): { fingers: (number | null)[]; barres: Barre[] } {
  const asScaleShape: ScaleShape = {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };

  const result = buildFrettedScale(asScaleShape, root, tuning);
  const strOffset = stringOffset(tuning, asScaleShape);
  // Shape-indexed frets, inverse-mapped from the tuning-indexed build via
  // strOffset (the mirror of the shift applyChordShape's `fingers`/`barres`
  // apply going the other direction).
  const frets: (number | null)[] = shape.strings.map(() => null);
  for (const p of result.notes) {
    const shapeString = p.string - strOffset;
    if (shapeString >= 0 && shapeString < frets.length) {
      frets[shapeString] = p.fret;
    }
  }

  const gripBase = gripBaseFret(frets);

  // Distinct fretted (non-null, non-zero) fret values, low to high.
  const distinctFrets = Array.from(
    new Set(frets.filter((f): f is number => f != null && f !== 0)),
  ).sort((a, b) => a - b);
  const fingerForFret = new Map<number, number>();
  distinctFrets.forEach((fret, i) => {
    fingerForFret.set(fret, Math.min(i + 1, 4));
  });

  const fingers: (number | null)[] = frets.map((f) => {
    if (f == null) return null;
    if (f === 0) return 0;
    return fingerForFret.get(f) ?? 4;
  });

  const barres: Barre[] = [];
  let i = 0;
  while (i < frets.length) {
    const f = frets[i];
    if (f != null && f !== 0) {
      let j = i;
      while (j + 1 < frets.length && frets[j + 1] === f) {
        j++;
      }
      if (j > i) {
        barres.push({
          fret: f - gripBase,
          fromString: i,
          toString: j,
          finger: fingerForFret.get(f) ?? 4,
        });
      }
      i = j + 1;
    } else {
      i++;
    }
  }

  return { fingers, barres };
}
