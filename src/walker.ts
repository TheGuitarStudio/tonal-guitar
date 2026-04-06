import { FrettedNote, FrettedScale } from "./shape";

export interface WalkOptions {
  direction?: "auto" | "up" | "down" | "nearest"; // default: "auto"
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
