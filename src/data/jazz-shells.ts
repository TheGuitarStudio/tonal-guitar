/**
 * Jazz shell voicings for maj7, m7, 7 (dominant), and m7b5.
 *
 * Shell voicings are 3-note grips (root + 3rd + 7th) that omit the 5th.
 * They are the two traditional Freddie-Green-style shells, each pairing
 * exactly one voice ordering with the string set it's actually played on:
 *   - E-root shell: root on string 6 (low E), 7th on string 4 (D), 3rd on
 *     string 3 (G) — string set [0,2,3], skipping the A string. Uses the
 *     R-7-3 ordering (7th voiced simply, 3rd voiced a compound 10th up).
 *   - A-root shell: root on string 5 (A), 3rd on string 4 (D), 7th on
 *     string 3 (G) — string set [1,2,3], adjacent strings. Uses the
 *     R-3-7 ordering (3rd and 7th both voiced simply).
 *
 * The SHELL_DICTIONARY uses the @tonaljs/voicing-dictionary format:
 * keyed by Tonal chord-type alias, values = space-joined interval patterns
 * ordered low voice to high voice. Both orderings are retained in the
 * dictionary (index 0 = R-3-7, index 1 = R-7-3) as public API even though
 * each generated shape only uses one of them for its paired string set:
 *   - R-3-7: root, then 3rd (or flat 3rd), then 7th (simple interval)
 *   - R-7-3: root, then 7th, then 3rd voiced an octave up (compound interval)
 *
 * Each generated ChordShape has:
 *   - voicingFamily: "shell"
 *   - system: "shell"
 *   - stringSet: the played string indices
 *   - omittedIntervals: intervals missing from the full chord quality
 *   - rootString: the string carrying "1P"
 *   - inversion: 0 (root position)
 *
 * Shapes are registered into the chord shape registry at import time.
 */

import { chordShapes, ChordShape, VoicingPatternDictionary } from "../shape";

// ============================================================
// Shell dictionary (adopted @tonaljs/voicing-dictionary format)
// ============================================================

/**
 * Voicing pattern dictionary for jazz shell grips.
 * Keys: Tonal chord-type aliases ("maj7", "m7", "7", "m7b5").
 * Values: space-joined interval patterns, low→high voice.
 *   Pattern 0 = R-3-7 ordering  (3rd or b3rd voiced simply)
 *   Pattern 1 = R-7-3 ordering  (7th voiced simply, 3rd voiced compound: 10M/10m)
 */
export const SHELL_DICTIONARY: VoicingPatternDictionary = {
  maj7: ["1P 3M 7M", "1P 7M 10M"],
  m7: ["1P 3m 7m", "1P 7m 10m"],
  "7": ["1P 3M 7m", "1P 7m 10M"],
  // m7b5 shares the same 3rd/7th voicing as m7 (shells omit the 5th, so only the omitted interval differs — 5d vs 5P)
  m7b5: ["1P 3m 7m", "1P 7m 10m"],
};

// ============================================================
// omittedIntervals per chord type
// ============================================================

const OMITTED: Record<string, string[]> = {
  maj7: ["5P"],
  m7: ["5P"],
  "7": ["5P"],
  m7b5: ["5d"],
};

// ============================================================
// Root/string-set pairings (D-012: one string set per ordering)
// ============================================================

// String set indices (0-based, low E = 0).
type ShellRootLabel = "E-root" | "A-root";

interface ShellPairing {
  rootLabel: ShellRootLabel;
  stringSet: number[];
  // Index into a SHELL_DICTIONARY pattern array: 0 = R-3-7, 1 = R-7-3.
  patternIndex: 0 | 1;
}

const SHELL_PAIRINGS: ShellPairing[] = [
  // E-root: root on string 6 (low E), 7th on string 4 (D), 3rd on string 3
  // (G) — skips the A string. Uses the R-7-3 (compound) ordering.
  { rootLabel: "E-root", stringSet: [0, 2, 3], patternIndex: 1 },
  // A-root: root on string 5 (A), 3rd on string 4 (D), 7th on string 3 (G)
  // — adjacent strings. Uses the R-3-7 (simple) ordering.
  { rootLabel: "A-root", stringSet: [1, 2, 3], patternIndex: 0 },
];

// ============================================================
// Shape generation helpers
// ============================================================

/**
 * Parse a compound interval string to its simple form for the strings array.
 * The build engine (applyChordShape → buildFrettedScale) uses simple intervals
 * in the pitch-order convention. Compound intervals like "10M" and "10m" are
 * expressed as simple interval + octave: 10M = 3M (a 10th = a 3rd + octave).
 *
 * However, for the shell voicing data we store the simple interval that names
 * the pitch class correctly: 10M → "3M", 10m → "3m".
 * The build engine will naturally place the note in the correct octave within
 * the fret window.
 */
function toSimpleInterval(ivl: string): string {
  // Compound intervals (compound = simple + 7 semitones — octave displacement)
  // 10M = major 3rd up an octave; 10m = minor 3rd up an octave
  const compoundMap: Record<string, string> = {
    "10M": "3M",
    "10m": "3m",
    "9M": "2M",
    "9m": "2m",
    "11P": "4P",
    "12P": "5P",
    "14M": "7M",
    "14m": "7m",
  };
  return compoundMap[ivl] ?? ivl;
}

/**
 * Determine the root string index within a string set given a pattern.
 * The root is the string carrying "1P".
 */
function findRootString(pattern: string[], stringSet: number[]): number {
  const idx = pattern.indexOf("1P");
  // Rootless voicings (no 1P) fall back to the lowest string of the set — never throw at import.
  return idx === -1 ? stringSet[0] : stringSet[idx];
}

/**
 * Build a ChordShape from a pattern and string set.
 */
function buildShellShape(
  chordType: string,
  patternStr: string,
  stringSet: number[],
  rootLabel: ShellRootLabel,
): ChordShape {
  const pattern = patternStr.split(" ");
  const name = `Shell ${chordType} ${rootLabel}`;

  // Build the full 6-string array (null for strings not in the set)
  const strings: (string | null)[] = [null, null, null, null, null, null];
  const fingers: (number | null)[] = [null, null, null, null, null, null];

  pattern.forEach((ivl, i) => {
    const stringIdx = stringSet[i];
    strings[stringIdx] = toSimpleInterval(ivl);
    fingers[stringIdx] = i + 1; // fingers 1, 2, 3
  });

  const rootString = findRootString(pattern, stringSet);

  return {
    name,
    system: "shell",
    strings,
    fingers,
    barres: [],
    rootString,
    chordType,
    voicingFamily: "shell",
    stringSet: [...stringSet],
    omittedIntervals: OMITTED[chordType] ?? [],
    inversion: 0,
  };
}

// ============================================================
// Generate all shell shapes
// ============================================================

const shellShapes: ChordShape[] = [];

for (const [chordType, patterns] of Object.entries(SHELL_DICTIONARY)) {
  for (const { rootLabel, stringSet, patternIndex } of SHELL_PAIRINGS) {
    shellShapes.push(
      buildShellShape(chordType, patterns[patternIndex], stringSet, rootLabel),
    );
  }
}

// Register all jazz shell shapes
shellShapes.forEach(chordShapes.add.bind(chordShapes));

// Export individual shapes for direct reference in tests
export const SHELL_SHAPES = shellShapes;
