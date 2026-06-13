/**
 * Jazz shell voicings for maj7, m7, 7 (dominant), and m7b5.
 *
 * Shell voicings are 3-note grips (root + 3rd + 7th) that omit the 5th.
 * They are the building blocks of jazz comping and outline the harmony
 * efficiently on two adjacent string sets:
 *   - String set "654" = [0,1,2]  (low E, A, D strings)
 *   - String set "543" = [1,2,3]  (A, D, G strings)
 *
 * The SHELL_DICTIONARY uses the @tonaljs/voicing-dictionary format:
 * keyed by Tonal chord-type alias, values = space-joined interval patterns
 * ordered low voice to high voice. Two orderings exist per chord type:
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
// String sets
// ============================================================

// String set indices (0-based, low E = 0)
const STRING_SETS: number[][] = [
  [0, 1, 2], // "654" strings: low-E, A, D
  [1, 2, 3], // "543" strings: A, D, G
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
  return stringSet[idx];
}

/**
 * Build a ChordShape from a pattern and string set.
 */
function buildShellShape(
  chordType: string,
  patternStr: string,
  stringSet: number[],
  patternIndex: number,
): ChordShape {
  const pattern = patternStr.split(" ");
  const ordering = patternIndex === 0 ? "R37" : "R73";
  const name = `Shell ${chordType} ${ordering} ${stringSet.join("")}`;

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
  for (const stringSet of STRING_SETS) {
    for (let pi = 0; pi < patterns.length; pi++) {
      shellShapes.push(buildShellShape(chordType, patterns[pi], stringSet, pi));
    }
  }
}

// Register all jazz shell shapes
shellShapes.forEach(chordShapes.add.bind(chordShapes));

// Export individual shapes for direct reference in tests
export const SHELL_SHAPES = shellShapes;
