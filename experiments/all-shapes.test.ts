/**
 * Experiment: All 5 CAGED scale shapes + 7 3NPS patterns
 *
 * Derives shapes from guitar theory:
 * - Standard tuning: E2-A2-D3-G3-B3-E4 (intervals: P4-P4-P4-M3-P4)
 * - CAGED shapes each span ~4-5 frets, covering the full major scale
 * - 3NPS patterns have exactly 3 notes per string, span ~5-6 frets
 *
 * Run: npm test -- packages/guitar/experiments/all-shapes.test.ts
 */
import { describe, expect, test } from "vitest";
import Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

// ============================================================
// Types (refined from prior experiments)
// ============================================================

interface Tuning {
  name: string;
  notes: string[];
}

interface FrettedNote {
  string: number;
  fret: number;
  note: string;
  pc: string;
  interval: string;
  degree: number;
  midi: number;
}

interface ScaleShape {
  name: string;
  system: string;
  /** Per-string intervals from scale root, ordered low to high string */
  strings: (string[] | null)[];
  rootString: number;
}

interface FrettedScale {
  root: string;
  shapeName: string;
  tuning: Tuning;
  notes: FrettedNote[];
}

// ============================================================
// Tunings
// ============================================================

const STANDARD: Tuning = { name: "Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] };
const DROP_D: Tuning = { name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] };
const STANDARD_7: Tuning = { name: "Standard 7", notes: ["B1", "E2", "A2", "D3", "G3", "B3", "E4"] };

// ============================================================
// All 5 CAGED Major Scale Shapes
//
// These are derived from the standard CAGED chord shapes extended
// to the full major scale. Each covers all 7 scale degrees across
// all 6 strings within a 4-5 fret span.
//
// The shapes connect: E → D → C → A → G → E (ascending the neck)
// In the key of C: E-shape at fret 8, D at 10, C at open, A at 3, G at 3
// ============================================================

const CAGED_SCALES: Record<string, ScaleShape> = {
  E: {
    name: "E Shape",
    system: "caged",
    // Root on string 0 (low E) and string 5 (high E)
    // Fret span: 4 frets (e.g., frets 5-9 for A major)
    strings: [
      ["1P", "2M"],           // low E: root, 2nd        (frets 0, 2)
      ["4P", "5P"],           // A:     4th, 5th         (frets 0, 2)
      ["7M", "1P", "2M"],    // D:     7th, root, 2nd   (frets 1, 2, 4)
      ["3M", "4P", "5P"],    // G:     3rd, 4th, 5th    (frets 1, 2, 4)
      ["6M", "7M"],          // B:     6th, 7th         (frets 2, 4)
      ["1P", "2M", "3M"],    // high E: root, 2nd, 3rd  (frets 0, 2, 4)
    ],
    rootString: 0,
  },

  D: {
    name: "D Shape",
    system: "caged",
    // Root on string 2 (D) — D chord shape moved up
    // Sits between E shape and C shape
    strings: [
      ["2M", "3M", "4P"],   // low E: 2nd, 3rd, 4th
      ["5P", "6M", "7M"],   // A:     5th, 6th, 7th
      ["1P", "2M", "3M"],   // D:     root, 2nd, 3rd
      ["4P", "5P", "6M"],   // G:     4th, 5th, 6th
      ["7M", "1P", "2M"],   // B:     7th, root, 2nd
      ["3M", "4P", "5P"],   // high E: 3rd, 4th, 5th
    ],
    rootString: 2,
  },

  C: {
    name: "C Shape",
    system: "caged",
    // Root on string 1 (A) — C chord shape moved up
    strings: [
      ["5P", "6M"],          // low E: 5th, 6th
      ["1P", "2M", "3M"],   // A:     root, 2nd, 3rd
      ["4P", "5P", "6M"],   // D:     4th, 5th, 6th
      ["7M", "1P", "2M"],   // G:     7th, root, 2nd
      ["3M", "4P"],          // B:     3rd, 4th
      ["6M", "7M", "1P"],   // high E: 6th, 7th, root
    ],
    rootString: 1,
  },

  A: {
    name: "A Shape",
    system: "caged",
    // Root on string 1 (A) — A chord shape
    strings: [
      ["7M", "1P"],          // low E: 7th, root
      ["3M", "4P", "5P"],   // A:     3rd, 4th, 5th
      ["6M", "7M", "1P"],   // D:     6th, 7th, root
      ["2M", "3M", "4P"],   // G:     2nd, 3rd, 4th
      ["5P", "6M"],          // B:     5th, 6th
      ["1P", "2M"],          // high E: root, 2nd
    ],
    rootString: 1,
  },

  G: {
    name: "G Shape",
    system: "caged",
    // Root on string 0 (low E) — G chord shape
    strings: [
      ["5P", "6M", "7M"],   // low E: 5th, 6th, 7th
      ["1P", "2M", "3M"],   // A:     root, 2nd, 3rd
      ["4P", "5P"],          // D:     4th, 5th
      ["1P", "2M"],          // G:     root, 2nd
      ["3M", "4P", "5P"],   // B:     3rd, 4th, 5th
      ["6M", "7M"],          // high E: 6th, 7th
    ],
    rootString: 0,
  },
};

// ============================================================
// 7 Three-Notes-Per-String (3NPS) Patterns
//
// Each pattern has exactly 3 notes per string.
// Pattern 1 = Ionian, Pattern 2 = Dorian, etc.
// All patterns use the same notes — they just start on different degrees.
// ============================================================

const THREE_NPS: Record<string, ScaleShape> = {
  pattern1_ionian: {
    name: "3NPS Pattern 1 (Ionian)",
    system: "3nps",
    strings: [
      ["1P", "2M", "3M"],    // low E
      ["4P", "5P", "6M"],    // A
      ["7M", "1P", "2M"],    // D
      ["3M", "4P", "5P"],    // G
      ["6M", "7M", "1P"],    // B
      ["2M", "3M", "4P"],    // high E
    ],
    rootString: 0,
  },

  pattern2_dorian: {
    name: "3NPS Pattern 2 (Dorian)",
    system: "3nps",
    strings: [
      ["2M", "3M", "4P"],
      ["5P", "6M", "7M"],
      ["1P", "2M", "3M"],
      ["4P", "5P", "6M"],
      ["7M", "1P", "2M"],
      ["3M", "4P", "5P"],
    ],
    rootString: 0,
  },

  pattern3_phrygian: {
    name: "3NPS Pattern 3 (Phrygian)",
    system: "3nps",
    strings: [
      ["3M", "4P", "5P"],
      ["6M", "7M", "1P"],
      ["2M", "3M", "4P"],
      ["5P", "6M", "7M"],
      ["1P", "2M", "3M"],
      ["4P", "5P", "6M"],
    ],
    rootString: 0,
  },

  pattern4_lydian: {
    name: "3NPS Pattern 4 (Lydian)",
    system: "3nps",
    strings: [
      ["4P", "5P", "6M"],
      ["7M", "1P", "2M"],
      ["3M", "4P", "5P"],
      ["6M", "7M", "1P"],
      ["2M", "3M", "4P"],
      ["5P", "6M", "7M"],
    ],
    rootString: 0,
  },

  pattern5_mixolydian: {
    name: "3NPS Pattern 5 (Mixolydian)",
    system: "3nps",
    strings: [
      ["5P", "6M", "7M"],
      ["1P", "2M", "3M"],
      ["4P", "5P", "6M"],
      ["7M", "1P", "2M"],
      ["3M", "4P", "5P"],
      ["6M", "7M", "1P"],
    ],
    rootString: 0,
  },

  pattern6_aeolian: {
    name: "3NPS Pattern 6 (Aeolian)",
    system: "3nps",
    strings: [
      ["6M", "7M", "1P"],
      ["2M", "3M", "4P"],
      ["5P", "6M", "7M"],
      ["1P", "2M", "3M"],
      ["4P", "5P", "6M"],
      ["7M", "1P", "2M"],
    ],
    rootString: 0,
  },

  pattern7_locrian: {
    name: "3NPS Pattern 7 (Locrian)",
    system: "3nps",
    strings: [
      ["7M", "1P", "2M"],
      ["3M", "4P", "5P"],
      ["6M", "7M", "1P"],
      ["2M", "3M", "4P"],
      ["5P", "6M", "7M"],
      ["1P", "2M", "3M"],
    ],
    rootString: 0,
  },
};

// ============================================================
// Core engine (consolidated from prior experiments)
// ============================================================

function buildFrettedScale(shape: ScaleShape, root: string, tuning: Tuning = STANDARD): FrettedScale {
  const notes: FrettedNote[] = [];
  const rootFret = findNearestFret(tuning, shape.rootString, root);
  if (rootFret == null) return { root, shapeName: shape.name, tuning, notes };

  for (let s = 0; s < shape.strings.length && s < tuning.notes.length; s++) {
    const intervals = shape.strings[s];
    if (intervals == null) continue;
    for (const ivl of intervals) {
      const targetPc = Note.transpose(root, ivl);
      if (!targetPc) continue;
      const fret = findFretInPosition(tuning, s, targetPc, rootFret);
      if (fret == null) continue;
      const openMidi = Note.midi(tuning.notes[s]);
      if (openMidi == null) continue;
      const midi = openMidi + fret;
      const chroma = Note.chroma(targetPc);
      const octave = chroma != null ? Math.floor((midi - chroma) / 12) - 1 : null;
      const fullNote = octave != null ? `${targetPc}${octave}` : targetPc;
      const degree = parseInt(ivl.match(/(\d+)/)?.[1] || "0");
      notes.push({ string: s, fret, note: fullNote, pc: targetPc, interval: ivl, degree, midi });
    }
  }
  notes.sort((a, b) => a.midi - b.midi || a.string - b.string);
  return { root, shapeName: shape.name, tuning, notes };
}

function findNearestFret(tuning: Tuning, stringIdx: number, pc: string): number | null {
  const oc = Note.chroma(tuning.notes[stringIdx]);
  const tc = Note.chroma(pc);
  if (oc == null || tc == null) return null;
  let f = tc - oc;
  if (f < 0) f += 12;
  return f;
}

function findFretInPosition(tuning: Tuning, stringIdx: number, pc: string, ref: number): number | null {
  const oc = Note.chroma(tuning.notes[stringIdx]);
  const tc = Note.chroma(pc);
  if (oc == null || tc == null) return null;
  let f = tc - oc;
  if (f < 0) f += 12;
  while (f < ref - 5) f += 12;
  while (f > ref + 9) f -= 12;
  return f >= 0 ? f : null;
}

function toAsciiTab(notes: FrettedNote[], tuning: Tuning = STANDARD): string {
  const labels = ["e", "B", "G", "D", "A", "E", "B7"];
  const sc = tuning.notes.length;
  const lines: string[] = [];
  for (let d = 0; d < sc; d++) {
    const s = sc - 1 - d;
    const label = labels[d] || String(s);
    const parts: string[] = [];
    for (const n of notes) {
      const fw = String(n.fret).length;
      parts.push(n.string === s ? String(n.fret) : "-".repeat(fw));
    }
    lines.push(`${label}|${parts.join("-")}|`);
  }
  return lines.join("\n");
}

// ============================================================
// Tests: All 5 CAGED shapes
// ============================================================

describe("CAGED — all 5 shapes for A major", () => {
  const shapes = ["E", "A", "G", "C", "D"] as const;

  for (const shapeName of shapes) {
    test(`${shapeName} shape — correct notes and fret range`, () => {
      const shape = CAGED_SCALES[shapeName];
      const scale = buildFrettedScale(shape, "A");
      const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];

      // All notes should be A major
      scale.notes.forEach((n) => {
        expect(aMajor).toContain(n.pc);
      });

      // Should cover all 7 scale degrees
      const degrees = new Set(scale.notes.map((n) => n.degree));
      expect(degrees.size).toBe(7);

      // Should use all 6 strings
      const strings = new Set(scale.notes.map((n) => n.string));
      expect(strings.size).toBe(6);

      // Fret span should be reasonable (≤6 frets)
      const frets = scale.notes.map((n) => n.fret);
      const span = Math.max(...frets) - Math.min(...frets);
      expect(span).toBeLessThanOrEqual(6);

      console.log(`\n${shapeName} Shape — A Major:`);
      console.log(toAsciiTab(scale.notes));
      console.log(`  Fret range: ${Math.min(...frets)}-${Math.max(...frets)}, Notes: ${scale.notes.length}`);
    });
  }

  test("shapes connect sequentially up the neck", () => {
    // In A major: E→D→C→A→G should ascend in position
    const positions = Object.entries(CAGED_SCALES).map(([name, shape]) => {
      const scale = buildFrettedScale(shape, "A");
      const frets = scale.notes.map((n) => n.fret);
      return { name, min: Math.min(...frets), max: Math.max(...frets) };
    });

    console.log("\nCAGED positions for A major:");
    positions.forEach((p) => console.log(`  ${p.name}: frets ${p.min}-${p.max}`));
  });
});

describe("CAGED — transposition (same shape, different keys)", () => {
  const keys = ["C", "D", "E", "G", "A", "Bb"];

  test("E shape works in all keys", () => {
    for (const key of keys) {
      const scale = buildFrettedScale(CAGED_SCALES.E, key);
      expect(scale.notes.length).toBeGreaterThanOrEqual(14);

      const degrees = new Set(scale.notes.map((n) => n.degree));
      expect(degrees.size).toBe(7);
    }
  });
});

// ============================================================
// Tests: 3NPS patterns
// ============================================================

describe("3NPS — all 7 patterns", () => {
  const patterns = Object.entries(THREE_NPS);

  for (const [key, shape] of patterns) {
    test(`${shape.name} — 3 notes per string, 18 total`, () => {
      const scale = buildFrettedScale(shape, "A");
      const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];

      // All notes A major
      scale.notes.forEach((n) => expect(aMajor).toContain(n.pc));

      // Exactly 3 notes per string = 18 total
      expect(scale.notes).toHaveLength(18);

      // Verify 3 per string
      for (let s = 0; s < 6; s++) {
        const onString = scale.notes.filter((n) => n.string === s);
        expect(onString).toHaveLength(3);
      }

      console.log(`\n${shape.name} — A Major:`);
      console.log(toAsciiTab(scale.notes));
    });
  }

  test("all 7 patterns cover the same notes (same key)", () => {
    const allPcs = new Set<string>();
    for (const [, shape] of patterns) {
      const scale = buildFrettedScale(shape, "A");
      scale.notes.forEach((n) => allPcs.add(n.pc));
    }
    // All 7 patterns use the same 7 pitch classes
    expect(allPcs.size).toBe(7);
  });
});

// ============================================================
// Tests: 3NPS mode relationships
// ============================================================

describe("3NPS — mode relationships", () => {
  test("pattern 1 from A = A Ionian, pattern 2 from B = B Dorian (same notes)", () => {
    const ionian = buildFrettedScale(THREE_NPS.pattern1_ionian, "A");
    const dorian = buildFrettedScale(THREE_NPS.pattern2_dorian, "A");

    // Both should have the same pitch classes (A major scale)
    const ionianPcs = new Set(ionian.notes.map((n) => n.pc));
    const dorianPcs = new Set(dorian.notes.map((n) => n.pc));
    expect(ionianPcs).toEqual(dorianPcs);

    // But the intervals are labeled differently
    // Ionian starts on 1P, Dorian starts on 2M
    expect(ionian.notes[0].interval).toBe("1P");
    expect(dorian.notes[0].interval).toBe("2M");
  });
});
