/**
 * Experiment: Applying melodic patterns to scales on guitar
 *
 * Goal: Take a scale (A major), a shape (E CAGED), and a pattern
 * (ascending 3rds), and produce tab notation showing the notes
 * on the fretboard.
 *
 * Run: npm test -- packages/guitar/experiments/patterns.test.ts
 */
import { describe, expect, test } from "vitest";
import * as Scale from "@tonaljs/scale";
import Note from "@tonaljs/note";

// ============================================================
// Part 1: Tonal's Scale.degrees() — does it work for patterns?
// ============================================================

describe("Scale.degrees() for melodic patterns", () => {
  test("ascending A major scale in degrees", () => {
    const deg = Scale.degrees("A4 major");
    const ascending = [1, 2, 3, 4, 5, 6, 7, 8].map(deg);
    expect(ascending).toEqual([
      "A4",
      "B4",
      "C#5",
      "D5",
      "E5",
      "F#5",
      "G#5",
      "A5",
    ]);
  });

  test("ascending in 3rds: 1,3,2,4,3,5,4,6,5,7,6,8,7,9", () => {
    const deg = Scale.degrees("A4 major");
    const thirds = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9].map(deg);
    // degree 8 = octave (A5), degree 9 = B5
    expect(thirds[0]).toBe("A4"); // 1
    expect(thirds[1]).toBe("C#5"); // 3
    expect(thirds[2]).toBe("B4"); // 2
    expect(thirds[3]).toBe("D5"); // 4
    // Verify the 3rds pattern alternates up
    expect(thirds).toEqual([
      "A4",
      "C#5",
      "B4",
      "D5",
      "C#5",
      "E5",
      "D5",
      "F#5",
      "E5",
      "G#5",
      "F#5",
      "A5",
      "G#5",
      "B5",
    ]);
  });

  test("descending linearly from degree 8 to 1", () => {
    const deg = Scale.degrees("A4 major");
    const descending = [8, 7, 6, 5, 4, 3, 2, 1].map(deg);
    expect(descending).toEqual([
      "A5",
      "G#5",
      "F#5",
      "E5",
      "D5",
      "C#5",
      "B4",
      "A4",
    ]);
  });

  test("negative degrees for descending below the root", () => {
    const deg = Scale.degrees("A4 major");
    // Tonal: negative degrees go below root but within the same octave region
    // -1 = 7th degree below = G#4 (not G#3 — stays near root octave)
    const below = [-1, -2, -3].map(deg);
    expect(below[0]).toBe("G#4");
    expect(below[1]).toBe("F#4");
    expect(below[2]).toBe("E4");
    // To go an octave lower, use Scale.degrees("A3 major") instead
  });

  test("combined: ascending 3rds then descending linear", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = [
      // Ascending in 3rds
      1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8,
      // Descending linearly
      7, 6, 5, 4, 3, 2, 1,
    ];
    const notes = pattern.map(deg);
    expect(notes).toHaveLength(19);
    expect(notes[0]).toBe("A4");
    expect(notes[11]).toBe("A5"); // degree 8 = octave
    expect(notes[18]).toBe("A4"); // back to root
  });
});

// ============================================================
// Part 2: Pattern generators — create degree sequences
// ============================================================

/**
 * Generate a melodic pattern of "ascending in Nths" over a scale.
 * For 3rds: interval=2 → [1,3, 2,4, 3,5, 4,6, ...]
 * For 4ths: interval=3 → [1,4, 2,5, 3,6, 4,7, ...]
 * For 6ths: interval=5 → [1,6, 2,7, 3,8, ...]
 */
function ascendingIntervalPattern(
  scaleLength: number,
  interval: number,
  octaves: number = 1,
): number[] {
  const result: number[] = [];
  const totalDegrees = scaleLength * octaves + 1; // +1 to reach the octave
  for (let i = 1; i <= totalDegrees - interval; i++) {
    result.push(i, i + interval);
  }
  return result;
}

/**
 * Generate descending linear pattern
 */
function descendingLinear(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i >= to; i--) {
    result.push(i);
  }
  return result;
}

/**
 * Generate ascending linear pattern
 */
function ascendingLinear(from: number, to: number): number[] {
  const result: number[] = [];
  for (let i = from; i <= to; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Descending interval pattern: [8,6, 7,5, 6,4, 5,3, ...]
 */
function descendingIntervalPattern(
  scaleLength: number,
  interval: number,
  startDegree?: number,
): number[] {
  const result: number[] = [];
  const start = startDegree ?? scaleLength + 1; // octave
  for (let i = start; i >= 1 + interval; i--) {
    result.push(i, i - interval);
  }
  return result;
}

describe("Pattern generators", () => {
  test("ascending in 3rds (interval=2) over 7-note scale", () => {
    const pattern = ascendingIntervalPattern(7, 2);
    expect(pattern).toEqual([
      1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8,
    ]);
  });

  test("ascending in 4ths (interval=3)", () => {
    const pattern = ascendingIntervalPattern(7, 3);
    expect(pattern).toEqual([
      1, 4, 2, 5, 3, 6, 4, 7, 5, 8,
    ]);
  });

  test("ascending in 6ths (interval=5)", () => {
    const pattern = ascendingIntervalPattern(7, 5);
    expect(pattern).toEqual([
      1, 6, 2, 7, 3, 8,
    ]);
  });

  test("descending linear 8 to 1", () => {
    expect(descendingLinear(8, 1)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  test("descending in 3rds from octave", () => {
    const pattern = descendingIntervalPattern(7, 2);
    expect(pattern).toEqual([
      8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3, 1,
    ]);
  });

  test("full exercise: ascending 3rds + descending linear", () => {
    const pattern = [
      ...ascendingIntervalPattern(7, 2),
      ...descendingLinear(7, 1), // don't repeat the 8 (already ended on it)
    ];
    expect(pattern[0]).toBe(1);
    expect(pattern[pattern.length - 1]).toBe(1);
  });
});

// ============================================================
// Part 3: Apply pattern to notes, then map to fretboard
// ============================================================

/**
 * Given a tuning and a note, find the fret on a specific string
 */
function fretForNote(
  stringNote: string,
  targetNote: string,
): number | null {
  const stringMidi = Note.midi(stringNote);
  const targetMidi = Note.midi(targetNote);
  if (stringMidi == null || targetMidi == null) return null;
  const fret = targetMidi - stringMidi;
  return fret >= 0 ? fret : null;
}

/**
 * Simple fretboard mapping: given a note, find the best string/fret
 * within a position (fret range).
 */
function noteToFretboard(
  note: string,
  tuning: string[],
  positionStart: number,
  positionEnd: number,
): { string: number; fret: number } | null {
  const targetMidi = Note.midi(note);
  if (targetMidi == null) return null;

  for (let s = tuning.length - 1; s >= 0; s--) {
    const openMidi = Note.midi(tuning[s]);
    if (openMidi == null) continue;
    const fret = targetMidi - openMidi;
    if (fret >= positionStart && fret <= positionEnd) {
      return { string: s, fret };
    }
  }
  // Fallback: find nearest valid position
  for (let s = tuning.length - 1; s >= 0; s--) {
    const openMidi = Note.midi(tuning[s]);
    if (openMidi == null) continue;
    const fret = targetMidi - openMidi;
    if (fret >= 0 && fret <= 24) {
      return { string: s, fret };
    }
  }
  return null;
}

/**
 * Format fretboard positions as ASCII tab
 */
function toTab(
  positions: { string: number; fret: number }[],
  stringCount: number = 6,
  stringNames: string[] = ["e", "B", "G", "D", "A", "E"],
): string {
  // Build tab lines (high string first in display)
  const lines: string[][] = [];
  for (let s = 0; s < stringCount; s++) {
    lines[s] = [];
  }

  for (const pos of positions) {
    for (let s = 0; s < stringCount; s++) {
      const displayString = stringCount - 1 - s; // reverse for display
      if (displayString === pos.string) {
        const fretStr = String(pos.fret);
        lines[s].push(fretStr);
      } else {
        // Pad with dashes matching the width of the fret number
        const width = String(pos.fret).length;
        lines[s].push("-".repeat(width));
      }
    }
  }

  return lines
    .map((line, i) => `${stringNames[i]}|${line.join("-")}-|`)
    .join("\n");
}

describe("Fretboard mapping", () => {
  const standard = ["E2", "A2", "D3", "G3", "B3", "E4"];

  test("A4 on high E string = fret 5", () => {
    expect(fretForNote("E4", "A4")).toBe(5);
  });

  test("A2 on low E string = fret 5", () => {
    expect(fretForNote("E2", "A2")).toBe(5);
  });

  test("map note to fretboard within a position", () => {
    // A4 within position 4-9 should land on high E string fret 5
    const pos = noteToFretboard("A4", standard, 4, 9);
    expect(pos).toEqual({ string: 5, fret: 5 });
  });

  test("map A major scale notes to E-shape position (frets 4-9)", () => {
    const deg = Scale.degrees("A4 major");
    const scaleNotes = [1, 2, 3, 4, 5, 6, 7, 8].map(deg);
    const positions = scaleNotes.map((n) =>
      noteToFretboard(n, standard, 4, 9),
    );

    // Every position should be valid
    positions.forEach((p) => expect(p).not.toBeNull());

    // LEARNING: naive fretboard mapping can't stay within a position range
    // because it doesn't know about the shape. G#5 (degree 7) lands at
    // fret 10 on B string since no string can reach it in 4-9.
    // This proves we need SHAPE-AWARE note placement, not just
    // "find nearest fret in range." The shape defines which string
    // each degree lives on.
    const frets = positions.map((p) => p!.fret);
    // Naive mapping: only 3 of 8 notes land in 4-9 range because
    // noteToFretboard picks the first string that works (high to low)
    // and puts most notes on the high E string with high frets.
    // This proves: we MUST use shape-defined string assignments,
    // not a generic "find any string" approach.
    expect(frets.filter((f) => f >= 4 && f <= 9).length).toBe(3);
  });
});

describe("Full exercise: A major ascending 3rds, E-shape, then descending", () => {
  const standard = ["E2", "A2", "D3", "G3", "B3", "E4"];

  test("generate notes for ascending 3rds pattern", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = ascendingIntervalPattern(7, 2);
    const notes = pattern.map(deg);

    expect(notes[0]).toBe("A4"); // degree 1
    expect(notes[1]).toBe("C#5"); // degree 3
    expect(notes[2]).toBe("B4"); // degree 2
    expect(notes[3]).toBe("D5"); // degree 4
  });

  test("map pattern notes to E-shape fretboard position", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = [
      ...ascendingIntervalPattern(7, 2),
      ...descendingLinear(7, 1),
    ];
    const notes = pattern.map(deg);
    const positions = notes.map((n) =>
      noteToFretboard(n, standard, 4, 9),
    );

    // All should resolve to valid positions
    positions.forEach((p, i) => {
      expect(p).not.toBeNull();
    });

    // Generate tab output
    const validPositions = positions.filter(
      (p): p is { string: number; fret: number } => p !== null,
    );
    const tab = toTab(validPositions);

    // Tab should have 6 lines
    expect(tab.split("\n")).toHaveLength(6);

    // Log for visual inspection
    console.log("\nA Major - Ascending 3rds (E-shape pos 4-9):");
    console.log("Pattern: " + pattern.join(","));
    console.log("Notes: " + notes.join(" "));
    console.log("\n" + tab);
  });

  test("multi-octave: ascending 3rds across 2 octaves", () => {
    // Start from A3 to get a wider range
    const deg = Scale.degrees("A3 major");
    const pattern = ascendingIntervalPattern(7, 2, 2);
    const notes = pattern.map(deg);

    expect(notes[0]).toBe("A3");
    // Degree 8 = A4, degree 9 = B4, ..., degree 15 = A5
    expect(notes.length).toBeGreaterThan(14);

    console.log("\nA Major - Ascending 3rds (2 octaves):");
    console.log("Notes: " + notes.join(" "));
  });
});

describe("Other pattern exercises", () => {
  test("ascending in 4ths", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = ascendingIntervalPattern(7, 3);
    const notes = pattern.map(deg);

    console.log("\nA Major - Ascending 4ths:");
    console.log("Pattern degrees: " + pattern.join(","));
    console.log("Notes: " + notes.join(" "));

    expect(notes[0]).toBe("A4");
    expect(notes[1]).toBe("D5"); // 4th degree
  });

  test("ascending in 6ths", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = ascendingIntervalPattern(7, 5);
    const notes = pattern.map(deg);

    console.log("\nA Major - Ascending 6ths:");
    console.log("Pattern degrees: " + pattern.join(","));
    console.log("Notes: " + notes.join(" "));

    expect(notes[0]).toBe("A4");
    expect(notes[1]).toBe("F#5"); // 6th degree
  });

  test("descending in 3rds", () => {
    const deg = Scale.degrees("A4 major");
    const pattern = descendingIntervalPattern(7, 2);
    const notes = pattern.map(deg);

    console.log("\nA Major - Descending 3rds:");
    console.log("Pattern degrees: " + pattern.join(","));
    console.log("Notes: " + notes.join(" "));

    expect(notes[0]).toBe("A5"); // start at octave
    expect(notes[1]).toBe("F#5"); // down a 3rd
  });

  test("1-2-3-1, 2-3-4-2, 3-4-5-3 grouping pattern", () => {
    const deg = Scale.degrees("A4 major");
    // Common practice pattern: groups of 4 ascending
    const pattern: number[] = [];
    for (let i = 1; i <= 5; i++) {
      pattern.push(i, i + 1, i + 2, i);
    }
    const notes = pattern.map(deg);

    console.log("\nA Major - 1-2-3-1 Grouping:");
    console.log("Pattern degrees: " + pattern.join(","));
    console.log("Notes: " + notes.join(" "));

    expect(notes[0]).toBe("A4");
    expect(notes[3]).toBe("A4"); // returns to 1
    expect(notes[4]).toBe("B4"); // starts group on 2
  });
});
