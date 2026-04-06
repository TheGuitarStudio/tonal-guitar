/**
 * Notation parsing and formatting for guitar.
 *
 * Pure functions for converting between string shorthand and structured
 * representations of chord fret positions and scale patterns.
 */

/**
 * Parse chord fret notation into a structured array.
 *
 * Accepts:
 *   - Compact string: "x32010"  → [null, 3, 2, 0, 1, 0]
 *   - Delimited string: "x-3-2-0-1-0" → [null, 3, 2, 0, 1, 0]
 *   - High-fret delimited: "8-10-10-9-8-8" → [8, 10, 10, 9, 8, 8]
 *   - Array passthrough: validates and normalises sentinel values
 *
 * "x" or "X" represents a muted/unplayed string (null).
 * -1 or undefined in array input is normalised to null.
 *
 * @param input - chord fret string or pre-parsed array
 */
export function parseChordFrets(
  input: string | (number | null)[],
): (number | null)[] {
  if (Array.isArray(input)) {
    return input.map((v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number" && v < 0) return null;
      return v;
    });
  }

  if (typeof input !== "string" || input.length === 0) {
    return [];
  }

  const str = input.trim();

  if (str.includes("-")) {
    return str.split("-").map((token) => {
      const t = token.trim();
      if (t === "x" || t === "X" || t === "") return null;
      const n = parseInt(t, 10);
      return isNaN(n) ? null : n;
    });
  }

  // Compact format — split into individual characters
  return str.split("").map((ch) => {
    if (ch === "x" || ch === "X") return null;
    const n = parseInt(ch, 10);
    return isNaN(n) ? null : n;
  });
}

/**
 * Format a fret array back to a chord notation string.
 *
 * Uses compact format when all frets are single digits:
 *   [null, 3, 2, 0, 1, 0] → "x32010"
 *
 * Uses delimited format when any fret value exceeds 9:
 *   [8, 10, 10, 9, 8, 8] → "8-10-10-9-8-8"
 *
 * @param frets - array of fret numbers or null for muted strings
 */
export function formatChordFrets(frets: (number | null)[]): string {
  if (frets.length === 0) return "";

  const needsDelimiter = frets.some((f) => f !== null && f > 9);

  if (needsDelimiter) {
    return frets.map((f) => (f === null ? "x" : String(f))).join("-");
  }

  return frets.map((f) => (f === null ? "x" : String(f))).join("");
}

/**
 * Parse a scale pattern shorthand string into a 2D array of fret groups.
 *
 * Each comma-separated group represents a string's frets.
 * Each dash-separated value within a group is a fret number.
 *
 * Example:
 *   "5-8,5-7,5-7,5-7,5-8,5-8"
 *   → [[5,8],[5,7],[5,7],[5,7],[5,8],[5,8]]
 *
 * @param input - comma-separated groups of dash-separated fret numbers
 */
export function parseScalePattern(input: string): number[][] {
  if (typeof input !== "string" || input.trim().length === 0) {
    return [];
  }

  return input
    .trim()
    .split(",")
    .map((group) =>
      group
        .trim()
        .split("-")
        .map((token) => parseInt(token.trim(), 10))
        .filter((n) => !isNaN(n)),
    );
}
