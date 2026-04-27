import { FrettedNote, FrettedScale } from "./shape";

export interface WalkOptions {
  direction?: "auto" | "up" | "down" | "nearest"; // default: "auto"
}

export interface WalkShapeOptions {
  /** "ascending" walks low → high; "descending" walks high → low. Default: "ascending". */
  direction?: "ascending" | "descending";
}

/**
 * Walk every note in a fretted shape in pitch order, low-to-high
 * (or high-to-low when descending).
 *
 * Use this when you want a melodic exercise that visits every position
 * in the shape exactly once and ends on the highest (or lowest) note.
 * Unlike walkPattern, this doesn't go through degrees — it visits the
 * shape's actual notes, so you don't have to know which degree happens
 * to be the lowest one in your chosen position.
 */
export function walkShape(
  scale: FrettedScale,
  options: WalkShapeOptions = {},
): FrettedNote[] {
  const sorted = [...scale.notes].sort((a, b) => a.midi - b.midi);
  return options.direction === "descending" ? sorted.reverse() : sorted;
}

/**
 * Walk a SCALE-DEGREE motif across the shape, starting from each pitch
 * position in turn. The motif is expressed as scale degrees ([1,3] =
 * thirds, [1,3,5] = triads, [1,2,3,5] = "1235", [1,2,3,4,3,2] = up-down,
 * etc.) and each emission walks those degrees in pitch order across the
 * shape — so every position is covered and the run ends on the shape's
 * highest reachable note.
 *
 * This unifies what used to be expressed two ways:
 * - "Patterns" (e.g. thirds(7) = [1,3, 2,4, 3,5, ...]) — pre-expanded
 *   degree arrays meant to be passed to walkPattern.
 * - "Sequences" (e.g. SEQ_1235 = [1,2,3,5]) — short motifs meant to be
 *   applied incrementally through the scale via applySequence.
 *
 * walkShapeMotif treats both as the same thing: a small base motif applied
 * at every starting position of the shape, in pitch order.
 *
 * Example: walkShapeMotif(cagedE_AMajor, [1, 3]) on the 17-note CAGED E
 * A major shape yields 30 notes — 15 third-pairs covering every note
 * pair in the shape, ending on G#4-B4.
 */
export function walkShapeMotif(
  scale: FrettedScale,
  motif: number[],
  options: WalkShapeOptions = {},
): FrettedNote[] {
  if (motif.length === 0) return [];
  const sorted = walkShape(scale, options);
  // Convert degrees to pitch-order offsets from the first degree.
  // (Scale degrees and pitch-order indices coincide for a sorted single-
  // octave-or-multi-octave shape, since notes are emitted in scale order
  // when sorted by midi.)
  const offsets = motif.map((d) => d - motif[0]);
  const lo = Math.min(...offsets);
  const hi = Math.max(...offsets);
  const result: FrettedNote[] = [];
  // i is the pitch-order index of the FIRST note of each emission;
  // i + lo and i + hi must both be valid indices into `sorted`.
  for (let i = -lo; i + hi < sorted.length; i++) {
    for (const off of offsets) {
      result.push(sorted[i + off]);
    }
  }
  return result;
}

/**
 * Convenience wrapper: walk every-Nth-note pairs across the shape.
 * Equivalent to walkShapeMotif(scale, [1, 1 + intervalSize]).
 *
 * intervalSize = 2 → thirds, 3 → fourths, 5 → sixths.
 */
export function walkShapeIntervals(
  scale: FrettedScale,
  intervalSize: number,
  options: WalkShapeOptions = {},
): FrettedNote[] {
  return walkShapeMotif(scale, [1, 1 + intervalSize], options);
}

/**
 * Walk a degree pattern through a fretted scale, picking notes from the
 * scale's fretted positions.
 *
 * Auto direction: compares consecutive degrees in the pattern.
 *   current > prev → pick ascending
 *   current < prev → pick descending
 *   current == prev → repeat same note
 *   First step: ascending unless first degree > second degree
 *
 * Negative degrees: normalize via ((deg % len) + len) % len
 * Scale length: derived from unique scaleIndex values in the scale
 */
export function walkPattern(
  scale: FrettedScale,
  pattern: number[],
  options?: WalkOptions,
): FrettedNote[] {
  const { direction = "auto" } = options ?? {};

  if (pattern.length === 0 || scale.notes.length === 0) return [];

  // Build degree lookup: group notes by their 1-based degree field
  const byDegree = new Map<number, FrettedNote[]>();
  for (const n of scale.notes) {
    const deg = n.degree;
    if (!byDegree.has(deg)) byDegree.set(deg, []);
    byDegree.get(deg)!.push(n);
  }

  // Determine scale length from unique scaleIndex values
  const scaleLen = new Set(scale.notes.map((n) => n.scaleIndex)).size;
  if (scaleLen === 0) return [];

  const result: FrettedNote[] = [];

  // Determine initial direction for "auto" mode
  // First step: ascending unless first degree > second degree
  const autoDir: "up" | "down" =
    pattern.length >= 2 && pattern[0] > pattern[1] ? "down" : "up";

  let lastMidi =
    direction === "down" || (direction === "auto" && autoDir === "down")
      ? Infinity
      : -Infinity;

  for (let i = 0; i < pattern.length; i++) {
    const deg = pattern[i];

    // Normalize degree: handles negatives and values outside [1..scaleLen]
    const baseDeg = ((((deg - 1) % scaleLen) + scaleLen) % scaleLen) + 1;

    const candidates = byDegree.get(baseDeg);
    if (!candidates || candidates.length === 0) continue;

    // Determine effective direction for this step
    let effectiveDir: "up" | "down" | "nearest" | "same";
    if (direction === "auto") {
      if (i === 0) {
        effectiveDir = autoDir;
      } else {
        const prev = pattern[i - 1];
        if (deg > prev) {
          effectiveDir = "up";
        } else if (deg < prev) {
          effectiveDir = "down";
        } else {
          effectiveDir = "same";
        }
      }
    } else if (direction === "up") {
      effectiveDir = "up";
    } else if (direction === "down") {
      effectiveDir = "down";
    } else {
      effectiveDir = "nearest";
    }

    let best: FrettedNote | null = null;

    if (effectiveDir === "same") {
      // Repeat the last note if it matches degree, else pick closest to lastMidi
      const exact = candidates.find((c) => c.midi === lastMidi) ?? null;
      if (exact) {
        best = exact;
      } else {
        // Fall through to nearest logic
        best = candidates.reduce((prev, cur) =>
          Math.abs(cur.midi - lastMidi) < Math.abs(prev.midi - lastMidi)
            ? cur
            : prev,
        );
      }
    } else if (effectiveDir === "up") {
      // Find lowest candidate with midi > lastMidi
      for (const c of candidates) {
        if (c.midi > lastMidi) {
          if (best === null || c.midi < best.midi) {
            best = c;
          }
        }
      }
      // Fallback: highest available
      if (best === null) {
        best = candidates[candidates.length - 1];
      }
    } else if (effectiveDir === "down") {
      // Find highest candidate with midi < lastMidi
      for (let j = candidates.length - 1; j >= 0; j--) {
        if (candidates[j].midi < lastMidi) {
          best = candidates[j];
          break;
        }
      }
      // Fallback: lowest available
      if (best === null) {
        best = candidates[0];
      }
    } else {
      // nearest: pick closest midi to lastMidi
      best = candidates.reduce((prev, cur) =>
        Math.abs(cur.midi - lastMidi) < Math.abs(prev.midi - lastMidi)
          ? cur
          : prev,
      );
    }

    if (best !== null) {
      result.push(best);
      lastMidi = best.midi;
    }
  }

  return result;
}
