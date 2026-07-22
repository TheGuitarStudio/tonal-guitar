/**
 * Open-position and standard barre chord shapes.
 *
 * Source: tombatossals/chords-db (MIT License)
 * https://github.com/tombatossals/chords-db
 * Data extracted from lib/guitar.json — one-time manual extraction.
 * The JSON blob is NOT committed; only the curated subset below is included.
 * Attribution: chords-db © tombatossals, MIT License.
 *
 * Coverage: core types — M, m, 7, maj7, m7, dim, aug, sus2, sus4, m7b5.
 * Open-position shapes for the C/A/G/E/D family (canonical fretboard keys).
 * Standard barre shapes: E-form and A-form per type (movable).
 *
 * Field conventions:
 *   - strings[i]: interval relative to chord root for string i (0=low E), or null (muted)
 *     Intervals are derived from the fret positions using chroma arithmetic at authoring time.
 *   - canonicalRoot: documented key for open shapes (informational — applying to another root
 *     yields the transposed, non-open fingering; canonicalRoot does not restrict use)
 *   - baseFret: lowest fretted fret in the source diagram (informational)
 *   - voicingFamily: "open" for open-position shapes, "barre" for movable barre shapes
 *   - system: "open" or "barre"
 *
 * Standard tuning open-string chromas (0-based): E=4 A=9 D=2 G=7 B=11 E=4
 *
 * baseFret handling (from chords-db spec):
 *   absFret = baseFret === 1 ? frets[i] : frets[i] + (baseFret - 1)
 *
 * Shapes are registered into the chord shape registry at import time.
 */

import { chordShapes, ChordShape } from "../shape";

// ============================================================
// C family — open position
// ============================================================

/**
 * C major open (x32010)
 * Notes: C E G C E → intervals: 1P 3M 5P 1P 3M
 */
export const OPEN_C_MAJOR: ChordShape = {
  name: "C Major Open",
  system: "open",
  strings: [null, "1P", "3M", "5P", "1P", "3M"],
  fingers: [null, 3, 2, 0, 1, 0],
  barres: [],
  rootString: 1,
  chordType: "M",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C minor (x35543 barre at fret 3) — CR-009: this is a barre grip (baseFret
 * 3, no open strings, a full barre across strings 1-5), not an open-position
 * chord, so it is tagged `voicingFamily`/`system: "barre"` like the G
 * dim/m7b5 barre grips (see CR-003 precedent in git history).
 * Notes: C G C Eb G → intervals: 1P 5P 1P 3m 5P
 */
export const OPEN_C_MINOR: ChordShape = {
  name: "C Minor Open",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "3m", "5P"],
  fingers: [null, 1, 3, 4, 2, 1],
  barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 3,
};

/**
 * C dominant 7 open (x32310)
 * Notes: C E Bb C E → intervals: 1P 3M 7m 1P 3M
 */
export const OPEN_C_DOM7: ChordShape = {
  name: "C Dominant 7 Open",
  system: "open",
  strings: [null, "1P", "3M", "7m", "1P", "3M"],
  fingers: [null, 3, 2, 4, 1, 0],
  barres: [],
  rootString: 1,
  chordType: "7",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  omittedIntervals: ["5P"],
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C major 7 open (x32000)
 * Notes: C E G B E → intervals: 1P 3M 5P 7M 3M
 */
export const OPEN_C_MAJ7: ChordShape = {
  name: "C Major 7 Open",
  system: "open",
  strings: [null, "1P", "3M", "5P", "7M", "3M"],
  fingers: [null, 3, 2, 0, 0, 0],
  barres: [],
  rootString: 1,
  chordType: "maj7",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C minor 7 (x35343 barre at fret 3) — CR-009: same class as OPEN_C_MINOR
 * above — a barre grip (baseFret 3, no open strings), not an open-position
 * chord.
 * Notes: C G Bb Eb G → intervals: 1P 5P 7m 3m 5P
 */
export const OPEN_C_M7: ChordShape = {
  name: "C Minor 7 Open",
  system: "barre",
  strings: [null, "1P", "5P", "7m", "3m", "5P"],
  fingers: [null, 1, 3, 4, 2, 1],
  barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m7",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 3,
};

/**
 * C diminished (x3454x = x,3,4,5,4,x)
 * Notes: C Gb C Eb → intervals: 1P 5d 1P 3m
 */
export const OPEN_C_DIM: ChordShape = {
  name: "C Diminished Open",
  system: "open",
  strings: [null, "1P", "5d", "1P", "3m", null],
  fingers: [null, 1, 2, 3, 4, null],
  barres: [],
  rootString: 1,
  chordType: "dim",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C augmented (x3211x = x,3,2,1,1,x)
 * Notes: C E Ab C → intervals: 1P 3M 5A 1P
 * Note: 6m semitones = augmented 5th (5A = 8 semitones from root)
 */
export const OPEN_C_AUG: ChordShape = {
  name: "C Augmented Open",
  system: "open",
  strings: [null, "1P", "3M", "5A", "1P", null],
  fingers: [null, 3, 2, 1, 1, null],
  barres: [{ fret: 1, fromString: 3, toString: 4, finger: 1 }],
  rootString: 1,
  chordType: "aug",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C sus2 (x30033 = x,3,0,0,3,3)
 * Notes: C D G D G → intervals: 1P 2M 5P 2M 5P
 */
export const OPEN_C_SUS2: ChordShape = {
  name: "C Sus2 Open",
  system: "open",
  strings: [null, "1P", "2M", "5P", "2M", "5P"],
  // Strings 4-5 land on the same fret as string 1, but the open strings 2-3
  // ring between them, blocking one continuous barre — string 1 keeps its
  // own finger and strings 4-5 form their own two-string mini-barre.
  fingers: [null, 4, 0, 0, 3, 3],
  barres: [{ fret: 3, fromString: 4, toString: 5, finger: 3 }],
  rootString: 1,
  chordType: "sus2",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C sus4 (x33011 = x,3,3,0,1,1)
 * Notes: C F G C F → intervals: 1P 4P 5P 1P 4P
 */
export const OPEN_C_SUS4: ChordShape = {
  name: "C Sus4 Open",
  system: "open",
  strings: [null, "1P", "4P", "5P", "1P", "4P"],
  fingers: [null, 3, 4, 0, 1, 1],
  barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "sus4",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

/**
 * C half-diminished (m7b5) (x34343)
 * Notes: C Gb Bb Eb → intervals: 1P 5d 7m 3m
 */
export const OPEN_C_M7B5: ChordShape = {
  name: "C m7b5 Open",
  system: "open",
  strings: [null, "1P", "5d", "7m", "3m", null],
  fingers: [null, 1, 2, 3, 4, null],
  barres: [],
  rootString: 1,
  chordType: "m7b5",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4],
  inversion: 0,
  canonicalRoot: "C",
  baseFret: 1,
};

// ============================================================
// A family — open position
// ============================================================

/**
 * A major open (x02220)
 * Notes: A E A C# E → intervals: 1P 5P 1P 3M 5P
 */
export const OPEN_A_MAJOR: ChordShape = {
  name: "A Major Open",
  system: "open",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 0, 2, 2, 2, 0],
  barres: [{ fret: 2, fromString: 2, toString: 4, finger: 2 }],
  rootString: 1,
  chordType: "M",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A minor open (x02210)
 * Notes: A E A C E → intervals: 1P 5P 1P 3m 5P
 */
export const OPEN_A_MINOR: ChordShape = {
  name: "A Minor Open",
  system: "open",
  strings: [null, "1P", "5P", "1P", "3m", "5P"],
  fingers: [null, 0, 2, 2, 1, 0],
  barres: [{ fret: 2, fromString: 2, toString: 3, finger: 2 }],
  rootString: 1,
  chordType: "m",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A dominant 7 open (x02020)
 * Notes: A E G C# E → intervals: 1P 5P 7m 3M 5P
 */
export const OPEN_A_DOM7: ChordShape = {
  name: "A Dominant 7 Open",
  system: "open",
  strings: [null, "1P", "5P", "7m", "3M", "5P"],
  // Strings 2 and 4 land on the same fret, but the open string 3 rings
  // between them, so they can't share a barre — distinct fingers instead.
  fingers: [null, 0, 2, 0, 3, 0],
  barres: [],
  rootString: 1,
  chordType: "7",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A major 7 open (x02120)
 * Notes: A E G# C# E → intervals: 1P 5P 7M 3M 5P
 */
export const OPEN_A_MAJ7: ChordShape = {
  name: "A Major 7 Open",
  system: "open",
  strings: [null, "1P", "5P", "7M", "3M", "5P"],
  // Strings 2 and 4 land on the same fret, but string 3 (a fret lower)
  // rings between them, so they can't share a barre — distinct fingers.
  fingers: [null, 0, 2, 1, 3, 0],
  barres: [],
  rootString: 1,
  chordType: "maj7",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A minor 7 open (x02010)
 * Notes: A E G C E → intervals: 1P 5P 7m 3m 5P
 */
export const OPEN_A_M7: ChordShape = {
  name: "A Minor 7 Open",
  system: "open",
  strings: [null, "1P", "5P", "7m", "3m", "5P"],
  fingers: [null, 0, 2, 0, 1, 0],
  barres: [],
  rootString: 1,
  chordType: "m7",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A diminished (x0121x = x,0,1,2,1,x)
 * Notes: A Eb A C → intervals: 1P 5d 1P 3m
 */
export const OPEN_A_DIM: ChordShape = {
  name: "A Diminished Open",
  system: "open",
  strings: [null, "1P", "5d", "1P", "3m", null],
  fingers: [null, 0, 1, 2, 3, null],
  barres: [],
  rootString: 1,
  chordType: "dim",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A augmented (x03221 = x,0,3,2,2,1)
 * A E A C# F → 1P 5P 1P 3M 5A
 * Note: 5A of A = E# = F
 */
export const OPEN_A_AUG: ChordShape = {
  name: "A Augmented Open",
  system: "open",
  strings: [null, "1P", "5P", "1P", "3M", "5A"],
  fingers: [null, 0, 3, 2, 2, 1],
  barres: [{ fret: 2, fromString: 3, toString: 4, finger: 2 }],
  rootString: 1,
  chordType: "aug",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A sus2 (x02200)
 * Notes: A E A B E → intervals: 1P 5P 1P 2M 5P
 */
export const OPEN_A_SUS2: ChordShape = {
  name: "A Sus2 Open",
  system: "open",
  strings: [null, "1P", "5P", "1P", "2M", "5P"],
  fingers: [null, 0, 2, 2, 0, 0],
  barres: [{ fret: 2, fromString: 2, toString: 3, finger: 2 }],
  rootString: 1,
  chordType: "sus2",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A sus4 (x02230)
 * Notes: A E A D E → intervals: 1P 5P 1P 4P 5P
 */
export const OPEN_A_SUS4: ChordShape = {
  name: "A Sus4 Open",
  system: "open",
  strings: [null, "1P", "5P", "1P", "4P", "5P"],
  fingers: [null, 0, 2, 2, 3, 0],
  barres: [{ fret: 2, fromString: 2, toString: 3, finger: 2 }],
  rootString: 1,
  chordType: "sus4",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

/**
 * A half-diminished (m7b5) (x01213)
 * Notes: A Eb A C G → intervals: 1P 5d 1P 3m 7m
 */
export const OPEN_A_M7B5: ChordShape = {
  name: "A m7b5 Open",
  system: "open",
  strings: [null, "1P", "5d", "1P", "3m", "7m"],
  fingers: [null, 0, 1, 2, 1, 3],
  barres: [{ fret: 1, fromString: 2, toString: 4, finger: 1 }],
  rootString: 1,
  chordType: "m7b5",
  voicingFamily: "open",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "A",
  baseFret: 1,
};

// ============================================================
// G family — open position
// ============================================================

/**
 * G major open (320003)
 * Notes: G B D G B G → intervals: 1P 3M 5P 1P 3M 1P
 */
export const OPEN_G_MAJOR: ChordShape = {
  name: "G Major Open",
  system: "open",
  strings: ["1P", "3M", "5P", "1P", "3M", "1P"],
  fingers: [2, 1, 0, 0, 0, 3],
  barres: [],
  rootString: 0,
  chordType: "M",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G minor (310033 = 3,1,0,0,3,3)
 * Notes: G Bb D G D G → intervals: 1P 3m 5P 1P 5P 1P
 */
export const OPEN_G_MINOR: ChordShape = {
  name: "G Minor Open",
  system: "open",
  strings: ["1P", "3m", "5P", "1P", "5P", "1P"],
  // String 4 lands on the same fret as string 0, but strings 1-3 (lower
  // frets) sit between them, so they can't share a barre — distinct fingers.
  fingers: [3, 1, 0, 0, 2, 4],
  barres: [],
  rootString: 0,
  chordType: "m",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G dominant 7 open (320001)
 * Notes: G B D G B F → intervals: 1P 3M 5P 1P 3M 7m
 */
export const OPEN_G_DOM7: ChordShape = {
  name: "G Dominant 7 Open",
  system: "open",
  strings: ["1P", "3M", "5P", "1P", "3M", "7m"],
  fingers: [2, 1, 0, 0, 0, 3],
  barres: [],
  rootString: 0,
  chordType: "7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G major 7 open (320002)
 * Notes: G B D G B F# → intervals: 1P 3M 5P 1P 3M 7M
 */
export const OPEN_G_MAJ7: ChordShape = {
  name: "G Major 7 Open",
  system: "open",
  strings: ["1P", "3M", "5P", "1P", "3M", "7M"],
  fingers: [2, 1, 0, 0, 0, 3],
  barres: [],
  rootString: 0,
  chordType: "maj7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G minor 7 (313033 = 3,1,3,0,3,3)
 * Notes: G Bb F G D G → intervals: 1P 3m 7m 1P 5P 1P
 */
export const OPEN_G_M7: ChordShape = {
  name: "G Minor 7 Open",
  system: "open",
  strings: ["1P", "3m", "7m", "1P", "5P", "1P"],
  // Strings 4-5 land on the same fret as string 0 and are adjacent to each
  // other, so they share a two-string mini-barre; string 2 (the other
  // finger-3 note) is a lower fret with string 3 (open) between it and the
  // barre, so it keeps its own distinct finger.
  fingers: [2, 1, 3, 0, 4, 4],
  barres: [{ fret: 3, fromString: 4, toString: 5, finger: 4 }],
  rootString: 0,
  chordType: "m7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G diminished movable grip (xx5656 at fret 5)
 * Notes: G Db G Bb → intervals: 1P 5d 1P 3m
 * baseFret=5 means frets[i]+4 for non-zero
 */
export const OPEN_G_DIM: ChordShape = {
  name: "G Diminished Open",
  system: "barre",
  strings: [null, null, "1P", "5d", "1P", "3m"],
  fingers: [null, null, 1, 2, 3, 4],
  barres: [],
  rootString: 2,
  chordType: "dim",
  voicingFamily: "barre",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  baseFret: 5,
};

/**
 * G augmented (3x2113)
 * Notes: G D# G B D# G → intervals: 1P 5A 1P 3M 5A 1P (strings 0,2,3,4,5)
 */
export const OPEN_G_AUG: ChordShape = {
  name: "G Augmented Open",
  system: "open",
  strings: ["1P", null, "5A", "1P", "3M", "5A"],
  fingers: [2, null, 3, 1, 1, 4],
  barres: [{ fret: 1, fromString: 3, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "aug",
  voicingFamily: "open",
  stringSet: [0, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G sus2 (300033 = 3,0,0,0,3,3)
 * Notes: G D G A D G → intervals: 1P 5P 1P 2M 5P 1P
 */
export const OPEN_G_SUS2: ChordShape = {
  name: "G Sus2 Open",
  system: "open",
  strings: ["1P", "5P", "1P", "2M", "5P", "1P"],
  fingers: [2, 1, 0, 0, 3, 4],
  barres: [],
  rootString: 0,
  chordType: "sus2",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G sus4 (330013 = 3,3,0,0,1,3)
 * Notes: G C D G C G → intervals: 1P 4P 5P 1P 4P 1P
 */
export const OPEN_G_SUS4: ChordShape = {
  name: "G Sus4 Open",
  system: "open",
  strings: ["1P", "4P", "5P", "1P", "4P", "1P"],
  fingers: [2, 3, 0, 0, 1, 4],
  barres: [],
  rootString: 0,
  chordType: "sus4",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "G",
  baseFret: 1,
};

/**
 * G half-diminished (m7b5) movable grip at fret 5 (xx5678)
 * Notes: G Db Bb F → intervals: 1P 5d 3m 7m; omits 3m on lower strings but all four tones present.
 */
export const OPEN_G_M7B5: ChordShape = {
  name: "G m7b5 Open",
  system: "barre",
  strings: [null, null, "1P", "5d", "3m", "7m"],
  fingers: [null, null, 1, 2, 3, 4],
  barres: [],
  rootString: 2,
  chordType: "m7b5",
  voicingFamily: "barre",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  baseFret: 5,
};

// ============================================================
// E family — open position
// ============================================================

/**
 * E major open (022100)
 * Notes: E B E G# B E → intervals: 1P 5P 1P 3M 5P 1P
 */
export const OPEN_E_MAJOR: ChordShape = {
  name: "E Major Open",
  system: "open",
  strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
  fingers: [0, 2, 2, 1, 0, 0],
  barres: [{ fret: 2, fromString: 1, toString: 2, finger: 2 }],
  rootString: 0,
  chordType: "M",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E minor open (022000)
 * Notes: E B E G B E → intervals: 1P 5P 1P 3m 5P 1P
 */
export const OPEN_E_MINOR: ChordShape = {
  name: "E Minor Open",
  system: "open",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [0, 2, 2, 0, 0, 0],
  barres: [{ fret: 2, fromString: 1, toString: 2, finger: 2 }],
  rootString: 0,
  chordType: "m",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E dominant 7 open (020100)
 * Notes: E B D G# B E → intervals: 1P 5P 7m 3M 5P 1P
 */
export const OPEN_E_DOM7: ChordShape = {
  name: "E Dominant 7 Open",
  system: "open",
  strings: ["1P", "5P", "7m", "3M", "5P", "1P"],
  fingers: [0, 2, 0, 1, 0, 0],
  barres: [],
  rootString: 0,
  chordType: "7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E major 7 open (021100)
 * Notes: E B D# G# B E → intervals: 1P 5P 7M 3M 5P 1P
 */
export const OPEN_E_MAJ7: ChordShape = {
  name: "E Major 7 Open",
  system: "open",
  strings: ["1P", "5P", "7M", "3M", "5P", "1P"],
  fingers: [0, 2, 1, 1, 0, 0],
  barres: [{ fret: 1, fromString: 2, toString: 3, finger: 1 }],
  rootString: 0,
  chordType: "maj7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E minor 7 open (020000)
 * Notes: E B D G B E → intervals: 1P 5P 7m 3m 5P 1P
 */
export const OPEN_E_M7: ChordShape = {
  name: "E Minor 7 Open",
  system: "open",
  strings: ["1P", "5P", "7m", "3m", "5P", "1P"],
  fingers: [0, 2, 0, 0, 0, 0],
  barres: [],
  rootString: 0,
  chordType: "m7",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E diminished open (0120xx = 0,1,2,0,x,x)
 * Notes: E Bb E G → intervals: 1P 5d 1P 3m
 */
export const OPEN_E_DIM: ChordShape = {
  name: "E Diminished Open",
  system: "open",
  strings: ["1P", "5d", "1P", "3m", null, null],
  fingers: [0, 1, 2, 0, null, null],
  barres: [],
  rootString: 0,
  chordType: "dim",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E augmented open (032110)
 * Notes: E C E G# C E → intervals: 1P 5A 1P 3M 5A 1P
 * C is enharmonic to B# (aug 5th of E); stored as "5A" per Tonal convention.
 */
export const OPEN_E_AUG: ChordShape = {
  name: "E Augmented Open",
  system: "open",
  strings: ["1P", "5A", "1P", "3M", "5A", "1P"],
  fingers: [0, 3, 2, 1, 1, 0],
  barres: [{ fret: 1, fromString: 3, toString: 4, finger: 1 }],
  rootString: 0,
  chordType: "aug",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E sus2 open (024400)
 * Notes: E B F# B B E → intervals: 1P 5P 2M 5P 5P 1P
 */
export const OPEN_E_SUS2: ChordShape = {
  name: "E Sus2 Open",
  system: "open",
  strings: ["1P", "5P", "2M", "5P", "5P", "1P"],
  fingers: [0, 2, 3, 4, 0, 0],
  barres: [],
  rootString: 0,
  chordType: "sus2",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E sus4 open (022200)
 * Notes: E B E A B E → intervals: 1P 5P 1P 4P 5P 1P
 */
export const OPEN_E_SUS4: ChordShape = {
  name: "E Sus4 Open",
  system: "open",
  strings: ["1P", "5P", "1P", "4P", "5P", "1P"],
  fingers: [0, 2, 2, 2, 0, 0],
  barres: [{ fret: 2, fromString: 1, toString: 3, finger: 2 }],
  rootString: 0,
  chordType: "sus4",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

/**
 * E half-diminished (m7b5) open (0120xx = 0,1,2,0,x,x)
 * Notes: E Bb D G → intervals: 1P 5d 7m 3m
 * Same voicing as Edim but with m7b5 chordType — this shape is Em7b5's root voicing.
 * Note: Edim uses the same frets but with "dim" chordType (a diminished triad: 1P 3m 5d — no 7th).
 * Em7b5 = E,G,Bb,D and this voicing has E,Bb,D,G all four tones.
 */
export const OPEN_E_M7B5: ChordShape = {
  name: "E m7b5 Open",
  system: "open",
  strings: ["1P", "5d", "7m", "3m", null, null],
  fingers: [0, 1, 2, 0, null, null],
  barres: [],
  rootString: 0,
  chordType: "m7b5",
  voicingFamily: "open",
  stringSet: [0, 1, 2, 3],
  inversion: 0,
  canonicalRoot: "E",
  baseFret: 1,
};

// ============================================================
// D family — open position
// ============================================================

/**
 * D major open (xx0232)
 * Notes: D A D F# → intervals: 1P 5P 1P 3M
 */
export const OPEN_D_MAJOR: ChordShape = {
  name: "D Major Open",
  system: "open",
  strings: [null, null, "1P", "5P", "1P", "3M"],
  fingers: [null, null, 0, 2, 3, 2],
  barres: [{ fret: 2, fromString: 3, toString: 5, finger: 2 }],
  rootString: 2,
  chordType: "M",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D minor open (xx0231)
 * Notes: D A D F → intervals: 1P 5P 1P 3m
 */
export const OPEN_D_MINOR: ChordShape = {
  name: "D Minor Open",
  system: "open",
  strings: [null, null, "1P", "5P", "1P", "3m"],
  fingers: [null, null, 0, 2, 3, 1],
  barres: [],
  rootString: 2,
  chordType: "m",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D dominant 7 open (xx0212)
 * Notes: D A C F# → intervals: 1P 5P 7m 3M
 */
export const OPEN_D_DOM7: ChordShape = {
  name: "D Dominant 7 Open",
  system: "open",
  strings: [null, null, "1P", "5P", "7m", "3M"],
  // Strings 3 and 5 land on the same fret, but string 4 (a fret lower)
  // rings between them, so they can't share a barre — distinct fingers.
  fingers: [null, null, 0, 2, 1, 3],
  barres: [],
  rootString: 2,
  chordType: "7",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D major 7 open (xx0222)
 * Notes: D A C# F# → intervals: 1P 5P 7M 3M
 */
export const OPEN_D_MAJ7: ChordShape = {
  name: "D Major 7 Open",
  system: "open",
  strings: [null, null, "1P", "5P", "7M", "3M"],
  // Strings 3-5 are a genuine three-string mini-barre (CR-006: three
  // identical fingers now backed by an explicit barre entry).
  fingers: [null, null, 0, 2, 2, 2],
  barres: [{ fret: 2, fromString: 3, toString: 5, finger: 2 }],
  rootString: 2,
  chordType: "maj7",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D minor 7 open (xx0211)
 * Notes: D A C F → intervals: 1P 5P 7m 3m
 */
export const OPEN_D_M7: ChordShape = {
  name: "D Minor 7 Open",
  system: "open",
  strings: [null, null, "1P", "5P", "7m", "3m"],
  fingers: [null, null, 0, 2, 1, 1],
  barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
  rootString: 2,
  chordType: "m7",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D diminished (xx0131 = xx,0,1,3,1)
 * Notes: D Ab D F → intervals: 1P 5d 1P 3m
 */
export const OPEN_D_DIM: ChordShape = {
  name: "D Diminished Open",
  system: "open",
  strings: [null, null, "1P", "5d", "1P", "3m"],
  fingers: [null, null, 0, 1, 3, 1],
  barres: [{ fret: 1, fromString: 3, toString: 5, finger: 1 }],
  rootString: 2,
  chordType: "dim",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D augmented (xx0332)
 * Notes: D A# D F# → intervals: 1P 5A 1P 3M
 * A# = Bb = augmented 5th of D (D to A# = 8 semitones = 5A)
 */
export const OPEN_D_AUG: ChordShape = {
  name: "D Augmented Open",
  system: "open",
  strings: [null, null, "1P", "5A", "1P", "3M"],
  fingers: [null, null, 0, 3, 1, 2],
  barres: [],
  rootString: 2,
  chordType: "aug",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D sus2 open (xx0230)
 * Notes: D A D E → intervals: 1P 5P 1P 2M
 */
export const OPEN_D_SUS2: ChordShape = {
  name: "D Sus2 Open",
  system: "open",
  strings: [null, null, "1P", "5P", "1P", "2M"],
  fingers: [null, null, 0, 2, 3, 0],
  barres: [],
  rootString: 2,
  chordType: "sus2",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D sus4 open (xx0233)
 * Notes: D A D G → intervals: 1P 5P 1P 4P
 */
export const OPEN_D_SUS4: ChordShape = {
  name: "D Sus4 Open",
  system: "open",
  strings: [null, null, "1P", "5P", "1P", "4P"],
  fingers: [null, null, 0, 2, 3, 3],
  barres: [{ fret: 3, fromString: 4, toString: 5, finger: 3 }],
  rootString: 2,
  chordType: "sus4",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

/**
 * D half-diminished (m7b5) open (xx0121)
 * Notes: D Ab C F → intervals: 1P 5d 7m 3m
 * xx,0,1,2,1: D str=D=1P, G str+1=Ab=5d, B str+2=C=7m, E str+1=F=3m
 */
export const OPEN_D_M7B5: ChordShape = {
  name: "D m7b5 Open",
  system: "open",
  strings: [null, null, "1P", "5d", "7m", "3m"],
  // Interval math shows strings 3-5 all land on the same fret (a genuine
  // three-string mini-barre), not the two-fret spread the older fret-diagram
  // comment above suggests.
  fingers: [null, null, 0, 1, 1, 1],
  barres: [{ fret: 1, fromString: 3, toString: 5, finger: 1 }],
  rootString: 2,
  chordType: "m7b5",
  voicingFamily: "open",
  stringSet: [2, 3, 4, 5],
  inversion: 0,
  canonicalRoot: "D",
  baseFret: 1,
};

// ============================================================
// Standard E-form barre shapes (movable — no canonicalRoot)
// ============================================================

/** E-form major barre (mirrors E major open shape) */
export const BARRE_E_MAJOR: ChordShape = {
  name: "E Form Major Barre",
  system: "barre",
  strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "M",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form minor barre (mirrors E minor open shape) */
export const BARRE_E_MINOR: ChordShape = {
  name: "E Form Minor Barre",
  system: "barre",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form dominant 7 barre (mirrors E7 open shape) */
export const BARRE_E_DOM7: ChordShape = {
  name: "E Form 7 Barre",
  system: "barre",
  strings: ["1P", "5P", "7m", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "7",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form major 7 barre (mirrors Emaj7 open shape) */
export const BARRE_E_MAJ7: ChordShape = {
  name: "E Form maj7 Barre",
  system: "barre",
  strings: ["1P", "5P", "7M", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "maj7",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form minor 7 barre (mirrors Em7 open shape) */
export const BARRE_E_M7: ChordShape = {
  name: "E Form m7 Barre",
  system: "barre",
  strings: ["1P", "5P", "7m", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m7",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form diminished barre (mirrors Edim open 4-string shape — true dim triad: 1P 5d 1P 3m) */
export const BARRE_E_DIM: ChordShape = {
  name: "E Form dim Barre",
  system: "barre",
  strings: ["1P", "5d", "1P", "3m", null, null],
  fingers: [1, 2, 3, 1, null, null],
  barres: [{ fret: 0, fromString: 0, toString: 3, finger: 1 }],
  rootString: 0,
  chordType: "dim",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3],
  inversion: 0,
  baseFret: 1,
};

/**
 * E-form augmented barre (movable 032110 grip): full index barre at the
 * base fret (strings 0/5 sound it), middle-finger mini-barre one fret
 * above on strings 3-4, ring two above, pinky three above — mirroring
 * OPEN_E_AUG's corrected 1P 5A 1P 3M 5A 1P interval layout.
 */
export const BARRE_E_AUG: ChordShape = {
  name: "E Form aug Barre",
  system: "barre",
  strings: ["1P", "5A", "1P", "3M", "5A", "1P"],
  fingers: [1, 4, 3, 2, 2, 1],
  barres: [
    { fret: 0, fromString: 0, toString: 5, finger: 1 },
    { fret: 1, fromString: 3, toString: 4, finger: 2 },
  ],
  rootString: 0,
  chordType: "aug",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/**
 * E-form sus2 barre. Interval math: strings 2-3 share a fret one fret
 * above the base — string 3 was incorrectly grouped into the base barre
 * (finger 1) instead of joining string 2 (fixed here with its own barre).
 */
export const BARRE_E_SUS2: ChordShape = {
  name: "E Form sus2 Barre",
  system: "barre",
  strings: ["1P", "5P", "2M", "5P", "5P", "1P"],
  fingers: [1, 3, 2, 2, 1, 1],
  barres: [
    { fret: 0, fromString: 0, toString: 5, finger: 1 },
    { fret: 4, fromString: 2, toString: 3, finger: 2 },
  ],
  rootString: 0,
  chordType: "sus2",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form sus4 barre */
export const BARRE_E_SUS4: ChordShape = {
  name: "E Form sus4 Barre",
  system: "barre",
  strings: ["1P", "5P", "1P", "4P", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "sus4",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** E-form m7b5 barre (mirrors Em7b5 open 4-string shape) */
export const BARRE_E_M7B5: ChordShape = {
  name: "E Form m7b5 Barre",
  system: "barre",
  strings: ["1P", "5d", "7m", "3m", null, null],
  fingers: [1, 2, 3, 4, null, null],
  barres: [],
  rootString: 0,
  chordType: "m7b5",
  voicingFamily: "barre",
  stringSet: [0, 1, 2, 3],
  inversion: 0,
  baseFret: 1,
};

// ============================================================
// Standard A-form barre shapes (movable — no canonicalRoot)
// ============================================================

/** A-form major barre (mirrors A major open shape) */
export const BARRE_A_MAJOR: ChordShape = {
  name: "A Form Major Barre",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 1, 3, 3, 3, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 4, finger: 3 },
  ],
  rootString: 1,
  chordType: "M",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form minor barre (mirrors A minor open shape) */
export const BARRE_A_MINOR: ChordShape = {
  name: "A Form Minor Barre",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "3m", "5P"],
  fingers: [null, 1, 3, 3, 2, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 3, finger: 3 },
  ],
  rootString: 1,
  chordType: "m",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form dominant 7 barre (mirrors A7 open shape) */
export const BARRE_A_DOM7: ChordShape = {
  name: "A Form 7 Barre",
  system: "barre",
  strings: [null, "1P", "5P", "7m", "3M", "5P"],
  fingers: [null, 1, 3, 2, 4, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "7",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form major 7 barre (mirrors Amaj7 open shape) */
export const BARRE_A_MAJ7: ChordShape = {
  name: "A Form maj7 Barre",
  system: "barre",
  strings: [null, "1P", "5P", "7M", "3M", "5P"],
  fingers: [null, 1, 3, 2, 4, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "maj7",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form minor 7 barre (mirrors Am7 open shape) */
/**
 * A-form m7 barre. Interval math: string 3 (the 7m) lands on the base fret,
 * not the same fret as string 4 (the 3m) — the original data incorrectly
 * grouped them together under finger 2. String 3 joins the base barre
 * (finger 1) instead.
 */
export const BARRE_A_M7: ChordShape = {
  name: "A Form m7 Barre",
  system: "barre",
  strings: [null, "1P", "5P", "7m", "3m", "5P"],
  fingers: [null, 1, 3, 1, 2, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m7",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form diminished barre (mirrors Adim 4-string shape) */
export const BARRE_A_DIM: ChordShape = {
  name: "A Form dim Barre",
  system: "barre",
  strings: [null, "1P", "5d", "1P", "3m", null],
  fingers: [null, 1, 2, 3, 4, null],
  barres: [],
  rootString: 1,
  chordType: "dim",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4],
  inversion: 0,
  baseFret: 1,
};

/** A-form augmented barre (mirrors Aaug shape) */
export const BARRE_A_AUG: ChordShape = {
  name: "A Form aug Barre",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "3M", "5A"],
  fingers: [null, 1, 3, 2, 2, 4],
  barres: [{ fret: 2, fromString: 3, toString: 4, finger: 2 }],
  rootString: 1,
  chordType: "aug",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form sus2 barre (mirrors Asus2 open shape) */
export const BARRE_A_SUS2: ChordShape = {
  name: "A Form sus2 Barre",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "2M", "5P"],
  fingers: [null, 1, 3, 3, 2, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 3, finger: 3 },
  ],
  rootString: 1,
  chordType: "sus2",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/** A-form sus4 barre (mirrors Asus4 open shape) */
export const BARRE_A_SUS4: ChordShape = {
  name: "A Form sus4 Barre",
  system: "barre",
  strings: [null, "1P", "5P", "1P", "4P", "5P"],
  fingers: [null, 1, 3, 3, 4, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 3, finger: 3 },
  ],
  rootString: 1,
  chordType: "sus4",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

/**
 * A-form m7b5 barre (mirrors Am7b5 open shape). Interval math: strings 2
 * and 4 share a fret, while strings 1/3/5 each sit on their own distinct
 * fret — the original data incorrectly grouped string 5 with string 1
 * under finger 1, though they are 3 frets apart. Strings 2 and 4 form a
 * genuine (non-adjacent but blocker-free) two-string barre instead.
 */
export const BARRE_A_M7B5: ChordShape = {
  name: "A Form m7b5 Barre",
  system: "barre",
  strings: [null, "1P", "5d", "1P", "3m", "7m"],
  fingers: [null, 1, 2, 3, 2, 4],
  barres: [{ fret: 1, fromString: 2, toString: 4, finger: 2 }],
  rootString: 1,
  chordType: "m7b5",
  voicingFamily: "barre",
  stringSet: [1, 2, 3, 4, 5],
  inversion: 0,
  baseFret: 1,
};

// ============================================================
// Registration
// ============================================================

const openChordShapes: ChordShape[] = [
  // C family open
  OPEN_C_MAJOR,
  OPEN_C_MINOR,
  OPEN_C_DOM7,
  OPEN_C_MAJ7,
  OPEN_C_M7,
  OPEN_C_DIM,
  OPEN_C_AUG,
  OPEN_C_SUS2,
  OPEN_C_SUS4,
  OPEN_C_M7B5,
  // A family open
  OPEN_A_MAJOR,
  OPEN_A_MINOR,
  OPEN_A_DOM7,
  OPEN_A_MAJ7,
  OPEN_A_M7,
  OPEN_A_DIM,
  OPEN_A_AUG,
  OPEN_A_SUS2,
  OPEN_A_SUS4,
  OPEN_A_M7B5,
  // G family open
  OPEN_G_MAJOR,
  OPEN_G_MINOR,
  OPEN_G_DOM7,
  OPEN_G_MAJ7,
  OPEN_G_M7,
  OPEN_G_DIM,
  OPEN_G_AUG,
  OPEN_G_SUS2,
  OPEN_G_SUS4,
  OPEN_G_M7B5,
  // E family open
  OPEN_E_MAJOR,
  OPEN_E_MINOR,
  OPEN_E_DOM7,
  OPEN_E_MAJ7,
  OPEN_E_M7,
  OPEN_E_DIM,
  OPEN_E_AUG,
  OPEN_E_SUS2,
  OPEN_E_SUS4,
  OPEN_E_M7B5,
  // D family open
  OPEN_D_MAJOR,
  OPEN_D_MINOR,
  OPEN_D_DOM7,
  OPEN_D_MAJ7,
  OPEN_D_M7,
  OPEN_D_DIM,
  OPEN_D_AUG,
  OPEN_D_SUS2,
  OPEN_D_SUS4,
  OPEN_D_M7B5,
  // E-form barre
  BARRE_E_MAJOR,
  BARRE_E_MINOR,
  BARRE_E_DOM7,
  BARRE_E_MAJ7,
  BARRE_E_M7,
  BARRE_E_DIM,
  BARRE_E_AUG,
  BARRE_E_SUS2,
  BARRE_E_SUS4,
  BARRE_E_M7B5,
  // A-form barre
  BARRE_A_MAJOR,
  BARRE_A_MINOR,
  BARRE_A_DOM7,
  BARRE_A_MAJ7,
  BARRE_A_M7,
  BARRE_A_DIM,
  BARRE_A_AUG,
  BARRE_A_SUS2,
  BARRE_A_SUS4,
  BARRE_A_M7B5,
];

openChordShapes.forEach(chordShapes.add.bind(chordShapes));
