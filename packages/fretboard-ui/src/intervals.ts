import { chroma } from "@tonaljs/note";

/**
 * Major-scale chromatic interval map: index = semitones from root.
 * Used for spelling-agnostic interval naming — the chromatic distance
 * always maps to the same shorthand regardless of how a note is spelled.
 */
const SEMI_TO_INTERVAL = [
  "1P",
  "2m",
  "2M",
  "3m",
  "3M",
  "4P",
  "5d",
  "5P",
  "6m",
  "6M",
  "7m",
  "7M",
];

/**
 * Interval from `rootPc` to `otherPc`, computed via chroma so spelling
 * never affects the result.
 */
export function intervalFromTo(
  rootPc: string,
  otherPc: string,
): string {
  const r = chroma(rootPc);
  const o = chroma(otherPc);
  if (r == null || o == null || isNaN(r) || isNaN(o)) return "";
  const semis = (((o - r) % 12) + 12) % 12;
  return SEMI_TO_INTERVAL[semis];
}

/**
 * Major-scale degree number (1..7) for a chromatic interval shorthand.
 * 1P->1, 2m/2M->2, 3m/3M->3, 4P/4A->4, 5d/5P/5A->5, 6m/6M->6, 7m/7M->7.
 * Returns undefined for empty/invalid inputs.
 */
export function intervalToDegreeNumber(
  interval: string,
): number | undefined {
  if (!interval) return undefined;
  const match = interval.match(/(\d+)/);
  if (!match) return undefined;
  let n = parseInt(match[1], 10);
  while (n > 7) n -= 7;
  return n;
}
