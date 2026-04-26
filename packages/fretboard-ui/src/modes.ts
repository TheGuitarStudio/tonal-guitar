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
  /**
   * Which pentatonic family this mode shares notes with, when applying a
   * pentatonic shape:
   * - Ionian / Lydian / Mixolydian have a natural 3rd → major pentatonic
   *   (1, 2, 3, 5, 6) is a clean subset
   * - Dorian / Phrygian / Aeolian have a minor 3rd → minor pentatonic
   *   (1, b3, 4, 5, b7) is a clean subset
   * - Locrian has a diminished 5th, so neither standard pentatonic fits
   *   without including a tritone — null means "no pent equivalent"
   * - The two pent modes map to themselves
   */
  pentatonicEquivalent: "major-pent" | "minor-pent" | null;
}

export const MODES: ModeDef[] = [
  {
    id: "ionian",
    name: "Major (Ionian)",
    family: "diatonic",
    parentInterval: "",
    pentatonicEquivalent: "major-pent",
  },
  {
    id: "dorian",
    name: "Dorian",
    family: "diatonic",
    parentInterval: "2M",
    pentatonicEquivalent: "minor-pent",
  },
  {
    id: "phrygian",
    name: "Phrygian",
    family: "diatonic",
    parentInterval: "3M",
    pentatonicEquivalent: "minor-pent",
  },
  {
    id: "lydian",
    name: "Lydian",
    family: "diatonic",
    parentInterval: "4P",
    pentatonicEquivalent: "major-pent",
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    family: "diatonic",
    parentInterval: "5P",
    pentatonicEquivalent: "major-pent",
  },
  {
    id: "aeolian",
    name: "Minor (Aeolian)",
    family: "diatonic",
    parentInterval: "6M",
    pentatonicEquivalent: "minor-pent",
  },
  {
    id: "locrian",
    name: "Locrian",
    family: "diatonic",
    parentInterval: "7M",
    pentatonicEquivalent: null,
  },
  // Pentatonic shapes in src/data/pentatonic.ts are defined as MAJOR
  // pentatonic, so major-pent has no parent shift; minor-pent's parent
  // major-pent root is a major 6th below the modal root (e.g. A minor pent
  // -> C major pent: transpose("A", "-6M") = "C").
  {
    id: "major-pent",
    name: "Major Pentatonic",
    family: "pentatonic",
    parentInterval: "",
    pentatonicEquivalent: "major-pent",
  },
  {
    id: "minor-pent",
    name: "Minor Pentatonic",
    family: "pentatonic",
    parentInterval: "6M",
    pentatonicEquivalent: "minor-pent",
  },
];

export function getMode(id: string): ModeDef | undefined {
  return MODES.find((m) => m.id === id);
}

/**
 * For a mode + shape system, return the mode that should actually drive
 * parent-root computation. Pentatonic shapes only fit major or minor pent
 * directly, so any diatonic mode picked alongside a pentatonic shape gets
 * mapped to the pent equivalent (Dorian/Phrygian/Aeolian -> minor pent;
 * Ionian/Lydian/Mixolydian -> major pent). Locrian has no clean pent and
 * returns null so callers can disable / warn.
 */
export function effectiveModeForSystem(
  modeId: string,
  shapeSystem: string,
): string | null {
  const mode = getMode(modeId);
  if (!mode) return null;
  if (shapeSystem === "pentatonic") {
    return mode.pentatonicEquivalent;
  }
  return mode.id;
}

/**
 * Whether (mode, system) is a sensible pairing. False for pentatonic
 * shapes paired with Locrian (which has no clean pentatonic match).
 */
export function isModeCompatibleWithSystem(
  modeId: string,
  shapeSystem: string,
): boolean {
  return effectiveModeForSystem(modeId, shapeSystem) != null;
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
