/**
 * Experiment: Shape schema and functional composition
 *
 * Goal: Define a shape schema, apply it to a key, get fretboard positions.
 * Start simple: "A major in E CAGED shape" before doing patterns.
 *
 * Run: npm test -- packages/guitar/experiments/shapes.test.ts
 */
import { describe, expect, test } from "vitest";
import * as Scale from "@tonaljs/scale";
import Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

// ============================================================
// Schema: How we describe a guitar tuning
// ============================================================

interface Tuning {
  name: string;
  notes: string[]; // low to high, with octave: ["E2", "A2", "D3", "G3", "B3", "E4"]
}

const STANDARD: Tuning = {
  name: "Standard",
  notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
};

// ============================================================
// Schema: How we describe a fretboard position (note at a fret)
// ============================================================

interface FretPosition {
  string: number; // 0-indexed from low
  fret: number;
  note: string; // "A4", "C#5", etc.
  interval: string; // "1P", "3M", etc. (relative to root)
  degree: number; // scale degree 1-7
}

// ============================================================
// Schema: How we describe a scale shape on the fretboard
// ============================================================

/**
 * A ScaleShape describes the GEOMETRY of a scale pattern on the fretboard.
 * It's key-independent — defined by intervals per string.
 *
 * Each string has an array of intervals from the scale root.
 * null means that string is not used.
 *
 * The intervals are scale intervals (1P, 2M, 3M, etc.), NOT
 * fret offsets. This makes them musically meaningful and
 * tuning-independent.
 */
interface ScaleShape {
  name: string;
  system: string; // "caged" | "3nps" | "pentatonic" | "custom"
  // Per-string intervals, ordered low string to high string
  // Each string has intervals ordered from low fret to high fret
  strings: (string[] | null)[];
  // Which string/interval is the root position for this shape
  rootString: number;
}

/**
 * A ChordShape is a subset of a ScaleShape — typically one note per string.
 * Same schema but with single-element arrays (or could be its own type).
 */
interface ChordShape {
  name: string;
  system: string;
  // Per-string: the interval played, or null if muted
  strings: (string | null)[];
  // Fingering info
  fingers: (number | null)[]; // 1=index, 2=middle, 3=ring, 4=pinky, null=open/muted
  barres: Barre[];
  rootString: number;
}

interface Barre {
  fret: number; // relative to position (0 = position start)
  fromString: number; // lowest string (0-indexed)
  toString: number; // highest string (0-indexed)
  finger: number; // which finger
}

// ============================================================
// Schema: Concrete fingering (shape applied to a key + tuning)
// ============================================================

interface Fingering {
  positions: FretPosition[];
  frets: (number | null)[]; // quick view: [5, 7, 7, 6, 5, 5]
  root: string;
  shapeName: string;
  startFret: number;
}

// ============================================================
// Core functions
// ============================================================

/**
 * Given a tuning, string index, and fret: what note is there?
 */
function noteAt(tuning: Tuning, stringIndex: number, fret: number): string {
  const openNote = tuning.notes[stringIndex];
  return Note.transpose(openNote, Interval.fromSemitones(fret));
}

/**
 * Given a tuning, string index, and target note: what fret?
 * Returns null if unreachable (negative fret).
 */
function fretFor(
  tuning: Tuning,
  stringIndex: number,
  targetNote: string,
): number | null {
  const openMidi = Note.midi(tuning.notes[stringIndex]);
  const targetMidi = Note.midi(targetNote);
  if (openMidi == null || targetMidi == null) return null;
  const fret = targetMidi - openMidi;
  return fret >= 0 ? fret : null;
}

/**
 * Apply a ScaleShape to a root note and tuning.
 * Returns concrete fret positions for every note in the shape.
 *
 * This is the key function: shape + root + tuning → fingering
 */
function applyScaleShape(
  shape: ScaleShape,
  root: string, // pitch class: "A", "C#", etc.
  tuning: Tuning = STANDARD,
): FretPosition[] {
  const positions: FretPosition[] = [];

  // Find where the root falls on the root string
  // We need to find the fret of the root on the designated root string
  const rootOnString = findNearestFret(tuning, shape.rootString, root);
  if (rootOnString == null) return positions;

  for (let s = 0; s < shape.strings.length; s++) {
    const stringIntervals = shape.strings[s];
    if (stringIntervals == null) continue;

    for (const ivl of stringIntervals) {
      // Transpose root by this interval to get the target pitch class
      // Note.transpose gives correct enharmonic spelling (C# not Db for A major)
      const targetPc = Note.transpose(root, ivl);
      if (!targetPc) continue;

      // Find what fret this pitch class is on this string, near the shape position
      const fret = findFretInPosition(tuning, s, targetPc, rootOnString);
      if (fret == null) continue;

      // Build the full note name with correct octave AND correct spelling
      // Don't use noteAt (fromSemitones gives wrong enharmonics)
      const openMidi = Note.midi(tuning.notes[s]);
      const targetMidi = openMidi != null ? openMidi + fret : null;
      const octave =
        targetMidi != null
          ? Math.floor((targetMidi - Note.chroma(targetPc)!) / 12) - 1
          : null;
      const actualNote = octave != null ? `${targetPc}${octave}` : targetPc;

      const degree = intervalToDegree(ivl);

      positions.push({
        string: s,
        fret,
        note: actualNote,
        interval: ivl,
        degree,
      });
    }
  }

  return positions;
}

/**
 * Apply a ChordShape to a root note and tuning.
 */
function applyChordShape(
  shape: ChordShape,
  root: string,
  tuning: Tuning = STANDARD,
): Fingering {
  // Convert ChordShape to ScaleShape format for reuse
  const asScaleShape: ScaleShape = {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };

  const positions = applyScaleShape(asScaleShape, root, tuning);
  const frets: (number | null)[] = tuning.notes.map(() => null);
  for (const p of positions) {
    frets[p.string] = p.fret;
  }

  return {
    positions,
    frets,
    root,
    shapeName: shape.name,
    startFret: Math.min(...positions.map((p) => p.fret)),
  };
}

// ============================================================
// Helpers
// ============================================================

function findNearestFret(
  tuning: Tuning,
  stringIndex: number,
  pitchClass: string,
): number | null {
  const openMidi = Note.midi(tuning.notes[stringIndex]);
  if (openMidi == null) return null;

  // Find the nearest occurrence of this pitch class on this string
  const chroma = Note.chroma(pitchClass);
  if (chroma == null) return null;

  const openChroma = Note.chroma(tuning.notes[stringIndex]);
  if (openChroma == null) return null;

  let fret = chroma - openChroma;
  if (fret < 0) fret += 12;
  return fret;
}

function findFretInPosition(
  tuning: Tuning,
  stringIndex: number,
  pitchClass: string,
  referenceFret: number,
): number | null {
  const openMidi = Note.midi(tuning.notes[stringIndex]);
  if (openMidi == null) return null;

  const chroma = Note.chroma(pitchClass);
  if (chroma == null) return null;

  const openChroma = Note.chroma(tuning.notes[stringIndex]);
  if (openChroma == null) return null;

  // Find the fret for this pitch class nearest to the reference position
  let fret = chroma - openChroma;
  if (fret < 0) fret += 12;

  // Adjust octave to be near the reference fret
  while (fret < referenceFret - 4) fret += 12;
  while (fret > referenceFret + 8) fret -= 12;

  return fret >= 0 ? fret : null;
}

function intervalToDegree(interval: string): number {
  const match = interval.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Format positions as a simple fret string like "x32010" or "577655"
 */
function formatFrets(frets: (number | null)[]): string {
  const hasHighFrets = frets.some((f) => f !== null && f > 9);
  if (hasHighFrets) {
    return frets.map((f) => (f == null ? "x" : String(f))).join("-");
  }
  return frets.map((f) => (f == null ? "x" : String(f))).join("");
}

/**
 * Format positions as tab notation
 */
function toTab(
  positions: FretPosition[],
  tuning: Tuning = STANDARD,
): string {
  const stringNames = ["e", "B", "G", "D", "A", "E"];
  const stringCount = tuning.notes.length;

  // Group positions by string, sorted by fret
  const byString: Map<number, FretPosition[]> = new Map();
  for (const p of positions) {
    if (!byString.has(p.string)) byString.set(p.string, []);
    byString.get(p.string)!.push(p);
  }

  // For scales, we show each note. For chords, typically one note per string.
  const lines: string[] = [];
  for (let display = 0; display < stringCount; display++) {
    const s = stringCount - 1 - display; // reverse for tab display
    const label = stringNames[display] || String(s);
    const notes = byString.get(s) || [];
    const fretStr = notes
      .sort((a, b) => a.fret - b.fret)
      .map((n) => String(n.fret))
      .join("-");
    lines.push(`${label}|${fretStr || "---"}|`);
  }
  return lines.join("\n");
}

// ============================================================
// Shape Definitions — CAGED chord shapes
// ============================================================

const CAGED_CHORDS: Record<string, Record<string, ChordShape>> = {
  major: {
    E: {
      name: "E Shape Major",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
      rootString: 0,
    },
    A: {
      name: "A Shape Major",
      system: "caged",
      strings: [null, "1P", "5P", "1P", "3M", "5P"],
      fingers: [null, 1, 3, 3, 3, 1],
      barres: [],
      rootString: 1,
    },
    D: {
      name: "D Shape Major",
      system: "caged",
      strings: [null, null, "1P", "5P", "1P", "3M"],
      fingers: [null, null, 1, 2, 3, 4],
      barres: [],
      rootString: 2,
    },
    C: {
      name: "C Shape Major",
      system: "caged",
      strings: [null, "3M", "1P", "5P", "1P", "3M"],
      fingers: [null, 3, 2, 0, 1, 0],
      barres: [],
      rootString: 1, // root on A string (conceptually)
    },
    G: {
      name: "G Shape Major",
      system: "caged",
      strings: ["1P", "3M", "5P", "1P", "3M", "5P"],
      fingers: [2, 1, 0, 0, 0, 3],
      barres: [],
      rootString: 0,
    },
  },
};

// ============================================================
// Scale Shape Definitions — E CAGED scale shapes
// ============================================================

const CAGED_SCALES: Record<string, Record<string, ScaleShape>> = {
  major: {
    E: {
      name: "E Shape Major Scale",
      system: "caged",
      strings: [
        ["1P", "2M"],
        ["4P", "5P"],
        ["7M", "1P", "2M"],
        ["3M", "4P", "5P"],
        ["6M", "7M"],
        ["1P", "2M", "3M"],
      ],
      rootString: 0,
    },
  },
};

// ============================================================
// Tests
// ============================================================

describe("noteAt — basic fretboard math", () => {
  test("open strings", () => {
    expect(noteAt(STANDARD, 0, 0)).toBe("E2");
    expect(noteAt(STANDARD, 1, 0)).toBe("A2");
    expect(noteAt(STANDARD, 5, 0)).toBe("E4");
  });

  test("fret 5 on low E = A2", () => {
    expect(noteAt(STANDARD, 0, 5)).toBe("A2");
  });

  test("fret 12 = octave up", () => {
    expect(noteAt(STANDARD, 0, 12)).toBe("E3");
    expect(noteAt(STANDARD, 1, 12)).toBe("A3");
  });
});

describe("fretFor — reverse lookup", () => {
  test("A2 on low E = fret 5", () => {
    expect(fretFor(STANDARD, 0, "A2")).toBe(5);
  });

  test("open A string", () => {
    expect(fretFor(STANDARD, 1, "A2")).toBe(0);
  });
});

describe("ChordShape — E Shape Major", () => {
  const eShape = CAGED_CHORDS.major.E;

  test("A major in E shape = 577655", () => {
    const result = applyChordShape(eShape, "A");
    expect(result.frets).toEqual([5, 7, 7, 6, 5, 5]);
    expect(formatFrets(result.frets)).toBe("577655");
    expect(result.startFret).toBe(5);

    console.log("\nA Major (E shape):");
    console.log("Frets:", formatFrets(result.frets));
    console.log(
      "Notes:",
      result.positions.map((p) => p.note).join(" "),
    );
    console.log(
      "Intervals:",
      result.positions.map((p) => p.interval).join(" "),
    );
  });

  test("G major in E shape = 355433", () => {
    const result = applyChordShape(eShape, "G");
    expect(result.frets).toEqual([3, 5, 5, 4, 3, 3]);
    expect(formatFrets(result.frets)).toBe("355433");
  });

  test("C major in E shape = 8-10-10-9-8-8", () => {
    const result = applyChordShape(eShape, "C");
    expect(result.frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(formatFrets(result.frets)).toBe("8-10-10-9-8-8");
  });

  test("F major in E shape = 133211", () => {
    const result = applyChordShape(eShape, "F");
    expect(result.frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(formatFrets(result.frets)).toBe("133211");
  });

  test("notes are correct for A major", () => {
    const result = applyChordShape(eShape, "A");
    const notes = result.positions.map((p) => Note.pitchClass(p.note));
    // A major = A, C#, E
    expect(notes).toContain("A");
    expect(notes).toContain("C#");
    expect(notes).toContain("E");
    // All notes should be only A, C#, or E
    notes.forEach((n) => expect(["A", "C#", "E"]).toContain(n));
  });

  test("intervals are correct for E shape", () => {
    const result = applyChordShape(eShape, "A");
    const intervals = result.positions.map((p) => p.interval);
    expect(intervals).toEqual(["1P", "5P", "1P", "3M", "5P", "1P"]);
  });
});

describe("ChordShape — A Shape Major", () => {
  const aShape = CAGED_CHORDS.major.A;

  test("D major in A shape = x57775", () => {
    const result = applyChordShape(aShape, "D");
    expect(result.frets).toEqual([null, 5, 7, 7, 7, 5]);
    expect(formatFrets(result.frets)).toBe("x57775");
  });

  test("C major in A shape = x35553", () => {
    const result = applyChordShape(aShape, "C");
    expect(result.frets).toEqual([null, 3, 5, 5, 5, 3]);
    expect(formatFrets(result.frets)).toBe("x35553");
  });
});

describe("ChordShape — D Shape Major", () => {
  const dShape = CAGED_CHORDS.major.D;

  test("D major open = xx0232", () => {
    const result = applyChordShape(dShape, "D");
    expect(result.frets).toEqual([null, null, 0, 2, 3, 2]);
    expect(formatFrets(result.frets)).toBe("xx0232");
  });

  test("E major in D shape = xx2454", () => {
    const result = applyChordShape(dShape, "E");
    expect(result.frets).toEqual([null, null, 2, 4, 5, 4]);
    expect(formatFrets(result.frets)).toBe("xx2454");
  });
});

describe("ScaleShape — E Shape Major Scale", () => {
  const eScale = CAGED_SCALES.major.E;

  test("A major scale in E shape around fret 5", () => {
    const positions = applyScaleShape(eScale, "A");

    console.log("\nA Major Scale (E shape):");
    console.log(toTab(positions));
    console.log(
      "\nPositions:",
      positions.map((p) => `s${p.string}f${p.fret}:${p.note}(${p.interval})`).join("  "),
    );

    // Should have notes on all 6 strings
    const stringsUsed = new Set(positions.map((p) => p.string));
    expect(stringsUsed.size).toBe(6);

    // All frets should be in the E-shape position (roughly frets 4-9)
    positions.forEach((p) => {
      expect(p.fret).toBeGreaterThanOrEqual(4);
      expect(p.fret).toBeLessThanOrEqual(9);
    });

    // Check total notes: 2+2+3+3+2+3 = 15 notes
    expect(positions).toHaveLength(15);
  });

  test("notes are all from A major scale", () => {
    const positions = applyScaleShape(eScale, "A");
    const aMajorNotes = ["A", "B", "C#", "D", "E", "F#", "G#"];
    positions.forEach((p) => {
      const pc = Note.pitchClass(p.note);
      expect(aMajorNotes).toContain(pc);
    });
  });
});

describe("Functional composition — chaining scale + shape + pattern", () => {
  test("scale degrees mapped through shape positions", () => {
    // The vision: [1,3,2,4,...].map(Scale.degrees("A4 major"))
    // gives us notes, but we need those notes ON the fretboard in a shape.
    //
    // Approach: First compute the shape's note map (which note lives where),
    // then walk the pattern through the shape.

    const eScale = CAGED_SCALES.major.E;
    const positions = applyScaleShape(eScale, "A");

    // Build a lookup: degree → positions on fretboard
    const degreeMap = new Map<number, FretPosition[]>();
    for (const p of positions) {
      if (!degreeMap.has(p.degree)) degreeMap.set(p.degree, []);
      degreeMap.get(p.degree)!.push(p);
    }

    // Now we can walk a pattern through the shape
    // ascending in 3rds: 1,3,2,4,3,5,4,6,5,7
    const pattern = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7];

    // For each degree in the pattern, pick a position from the shape
    // For ascending, we want to go from low to high
    const allPositionsSorted = [...positions].sort(
      (a, b) => a.string - b.string || a.fret - b.fret,
    );

    // Simple approach: walk through sorted positions matching degrees
    const result: FretPosition[] = [];
    let lastMidi = 0;

    for (const deg of pattern) {
      const adjDeg = ((deg - 1) % 7) + 1; // wrap to 1-7
      const candidates = degreeMap.get(adjDeg) || [];
      // Pick the candidate with the lowest midi that's >= lastMidi
      const sorted = candidates
        .map((c) => ({ ...c, midi: Note.midi(c.note)! }))
        .sort((a, b) => a.midi - b.midi);

      const next =
        sorted.find((c) => c.midi >= lastMidi) || sorted[sorted.length - 1];
      if (next) {
        result.push(next);
        lastMidi = next.midi;
      }
    }

    console.log("\nA Major ascending 3rds in E shape:");
    console.log(
      result
        .map((p) => `${p.note}(${p.interval}) s${p.string}f${p.fret}`)
        .join(" → "),
    );
    console.log(toTab(result));

    expect(result).toHaveLength(10);
    // First note should be the lowest available root
    expect(result[0].interval).toBe("1P");
  });

  test("descending linear through shape", () => {
    const eScale = CAGED_SCALES.major.E;
    const positions = applyScaleShape(eScale, "A");

    // Sort all positions by pitch, high to low
    const sorted = [...positions]
      .map((p) => ({ ...p, midi: Note.midi(p.note)! }))
      .sort((a, b) => b.midi - a.midi);

    console.log("\nA Major descending linear in E shape:");
    console.log(
      sorted.map((p) => `${p.note}(${p.interval}) s${p.string}f${p.fret}`).join(" → "),
    );
    console.log(toTab(sorted));

    expect(sorted[0].midi).toBeGreaterThan(sorted[sorted.length - 1].midi);
  });
});

describe("ChordShape formatting", () => {
  test("format with note names", () => {
    const result = applyChordShape(CAGED_CHORDS.major.E, "A");
    const display = result.positions
      .map((p) => `${p.note}(${p.interval})`)
      .join(" ");
    console.log("\nA Major chord: " + display);
    expect(display).toContain("A");
    expect(display).toContain("C#");
    expect(display).toContain("E");
  });

  test("tab output for chord", () => {
    const result = applyChordShape(CAGED_CHORDS.major.E, "A");
    const tab = toTab(result.positions);
    console.log("\nA Major (E shape) tab:");
    console.log(tab);
    expect(tab.split("\n")).toHaveLength(6);
  });
});
