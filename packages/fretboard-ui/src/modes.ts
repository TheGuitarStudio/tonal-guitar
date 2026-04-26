/**
 * Mode definitions for relabeling a shape across modal contexts.
 *
 * The "parent" of a mode is the major scale (or minor pentatonic, for the
 * pentatonic family) that shares the same notes. To render e.g. "B Dorian
 * D Shape", build the D Shape at the parent major root (A in this case),
 * then re-label intervals from the modal root B. The physical shape on the
 * fretboard is identical to "A major D Shape" — only the colour/label
 * perspective changes.
 *
 * NOTE (research): different chord qualities in a key (I major, ii minor,
 * iii minor, IV major, etc.) actually map to different CAGED *shapes* in a
 * predictable family relationship. A future enhancement could compute that
 * mapping so e.g. picking "B minor" would automatically pick the right
 * shape from a parent A-major key set. Out of scope for now.
 */

import { transpose } from "@tonaljs/note";

export interface ModeDef {
  /** Stable id, e.g. "dorian". */
  id: string;
  /** User-facing label. */
  name: string;
  /** Family the mode belongs to. Used to pick the right shape registry. */
  family: "diatonic" | "pentatonic";
  /**
   * Interval (in tonal interval shorthand) from the modal root DOWN to the
   * parent root. e.g. Dorian = "2M" means the parent major root is a major
   * second BELOW the modal root: B Dorian -> A major.
   *
   * Empty string means the modal root IS the parent root.
   */
  parentInterval: string;
}

export const MODES: ModeDef[] = [
  { id: "ionian", name: "Major (Ionian)", family: "diatonic", parentInterval: "" },
  { id: "dorian", name: "Dorian", family: "diatonic", parentInterval: "2M" },
  { id: "phrygian", name: "Phrygian", family: "diatonic", parentInterval: "3M" },
  { id: "lydian", name: "Lydian", family: "diatonic", parentInterval: "4P" },
  { id: "mixolydian", name: "Mixolydian", family: "diatonic", parentInterval: "5P" },
  { id: "aeolian", name: "Minor (Aeolian)", family: "diatonic", parentInterval: "6M" },
  { id: "locrian", name: "Locrian", family: "diatonic", parentInterval: "7M" },
  { id: "minor-pent", name: "Minor Pentatonic", family: "pentatonic", parentInterval: "" },
  { id: "major-pent", name: "Major Pentatonic", family: "pentatonic", parentInterval: "3m" },
];

export function getMode(id: string): ModeDef | undefined {
  return MODES.find((m) => m.id === id);
}

/**
 * Compute the parent root (the root that the underlying shape data is
 * defined against) given a modal root.
 *
 * Examples (assuming the shape data is written for a "Major" / "Minor
 * Pentatonic" perspective):
 * - parentRoot("B", "dorian")     -> "A"   (A major's 2nd is B)
 * - parentRoot("E", "phrygian")   -> "C"   (C major's 3rd is E)
 * - parentRoot("C", "major-pent") -> "A"   (A minor pent rotated to C)
 * - parentRoot("A", "ionian")     -> "A"   (no shift)
 */
export function parentRoot(modalRoot: string, modeId: string): string | null {
  const mode = getMode(modeId);
  if (!mode) return null;
  if (!mode.parentInterval) return modalRoot;
  // Tonal "transpose down" by inverting the interval direction.
  const result = transpose(modalRoot, "-" + mode.parentInterval);
  if (!result) return null;
  // Strip octave digits — we only care about the pitch class.
  return result.replace(/[0-9-]+$/, "");
}
