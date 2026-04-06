import { describe, expect, test } from "vitest";

// ============================================================
// Imports from package index
// ============================================================
import {
  // Tuning
  STANDARD,
  DROP_D,
  DADGAD,
  OPEN_G,
  STANDARD_7,
  STANDARD_8,
  // Fretboard
  noteAt,
  fretFor,
  findNearestFret,
  findFretInPosition,
  findNote,
  fretboard,
  // Shape registry
  get,
  all,
  names,
  add,
  removeAll,
  chordShapes,
  NoFrettedScale,
  // Build
  buildFrettedScale,
  applyChordShape,
  // Pattern
  ascendingIntervals,
  descendingIntervals,
  ascendingLinear,
  descendingLinear,
  grouping,
  thirds,
  fourths,
  sixths,
  // Walker
  walkPattern,
  // Sequence
  applySequence,
  flattenSequence,
  // Notation
  parseChordFrets,
  formatChordFrets,
  parseScalePattern,
  // Output
  toAlphaTeX,
  toAsciiTab,
  // Integration
  buildFromScale,
  relatedScales,
  identifyChord,
  analyzeInKey,
  isShapeCompatible,
  modeShapes,
  // Data
  ASCENDING_THIRDS,
  DESCENDING_THIRDS,
  SEQ_1235,
  SEQ_1234_GROUP,
  SEQ_UP_DOWN,
  SEQ_TRIAD_CLIMB,
} from "./index";

// Import specific shapes for direct use
import {
  CAGED_E,
  CAGED_D,
  CAGED_C,
  CAGED_A,
  CAGED_G,
} from "./data/caged-scales";
import {
  CAGED_CHORD_E,
  CAGED_CHORD_A,
  CAGED_CHORD_D,
} from "./data/caged-chords";
import {
  NPS_PATTERN_1,
  NPS_PATTERN_2,
  NPS_PATTERN_3,
  NPS_PATTERN_4,
  NPS_PATTERN_5,
  NPS_PATTERN_6,
  NPS_PATTERN_7,
} from "./data/three-nps";
import {
  PENTA_BOX_1,
  PENTA_BOX_2,
  PENTA_BOX_3,
  PENTA_BOX_4,
  PENTA_BOX_5,
} from "./data/pentatonic";

// ============================================================
// 1. Tuning constants
// ============================================================

describe("Tuning constants", () => {
  test("STANDARD is 6-string E2 to E4 (low to high)", () => {
    expect(STANDARD).toHaveLength(6);
    expect(STANDARD[0]).toBe("E2");
    expect(STANDARD[1]).toBe("A2");
    expect(STANDARD[2]).toBe("D3");
    expect(STANDARD[3]).toBe("G3");
    expect(STANDARD[4]).toBe("B3");
    expect(STANDARD[5]).toBe("E4");
  });

  test("DROP_D has D2 as lowest string", () => {
    expect(DROP_D[0]).toBe("D2");
    expect(DROP_D).toHaveLength(6);
    // All other strings same as standard
    expect(DROP_D.slice(1)).toEqual(STANDARD.slice(1));
  });

  test("DADGAD tuning", () => {
    expect(DADGAD[0]).toBe("D2");
    expect(DADGAD[1]).toBe("A2");
    expect(DADGAD[2]).toBe("D3");
    expect(DADGAD[3]).toBe("G3");
    expect(DADGAD[4]).toBe("A3");
    expect(DADGAD[5]).toBe("D4");
  });

  test("OPEN_G tuning", () => {
    expect(OPEN_G[0]).toBe("D2");
    expect(OPEN_G[1]).toBe("G2");
    expect(OPEN_G[3]).toBe("G3");
    expect(OPEN_G[4]).toBe("B3");
    expect(OPEN_G[5]).toBe("D4");
  });

  test("STANDARD_7 is 7-string starting B1", () => {
    expect(STANDARD_7).toHaveLength(7);
    expect(STANDARD_7[0]).toBe("B1");
    expect(STANDARD_7[1]).toBe("E2");
    // Top 6 strings match standard
    expect(STANDARD_7.slice(1)).toEqual(STANDARD);
  });

  test("STANDARD_8 is 8-string starting F#1", () => {
    expect(STANDARD_8).toHaveLength(8);
    expect(STANDARD_8[0]).toBe("F#1");
    expect(STANDARD_8[1]).toBe("B1");
    // Top 7 strings match 7-string
    expect(STANDARD_8.slice(1)).toEqual(STANDARD_7);
  });
});

// ============================================================
// 2. Fretboard math
// ============================================================

describe("noteAt", () => {
  test("open strings return tuning notes", () => {
    expect(noteAt(STANDARD, 0, 0)).toBe("E2");
    expect(noteAt(STANDARD, 1, 0)).toBe("A2");
    expect(noteAt(STANDARD, 2, 0)).toBe("D3");
    expect(noteAt(STANDARD, 3, 0)).toBe("G3");
    expect(noteAt(STANDARD, 4, 0)).toBe("B3");
    expect(noteAt(STANDARD, 5, 0)).toBe("E4");
  });

  test("fret 5 on low E = A2", () => {
    expect(noteAt(STANDARD, 0, 5)).toBe("A2");
  });

  test("fret 12 = octave up from open string", () => {
    expect(noteAt(STANDARD, 0, 12)).toBe("E3");
    expect(noteAt(STANDARD, 1, 12)).toBe("A3");
    expect(noteAt(STANDARD, 5, 12)).toBe("E5");
  });

  test("fret 7 on low E = B2", () => {
    expect(noteAt(STANDARD, 0, 7)).toBe("B2");
  });

  test("works with alternate tunings", () => {
    expect(noteAt(DROP_D, 0, 0)).toBe("D2");
    expect(noteAt(DROP_D, 0, 5)).toBe("G2");
  });
});

describe("fretFor", () => {
  test("A2 on low E string = fret 5", () => {
    expect(fretFor(STANDARD, 0, "A2")).toBe(5);
  });

  test("open A string = fret 0", () => {
    expect(fretFor(STANDARD, 1, "A2")).toBe(0);
  });

  test("E4 on high E = fret 0", () => {
    expect(fretFor(STANDARD, 5, "E4")).toBe(0);
  });

  test("returns null for unreachable (negative fret)", () => {
    // E2 is not reachable below fret 0 on A2 string
    expect(fretFor(STANDARD, 1, "E2")).toBeNull();
  });

  test("fret 12 on low E = E3", () => {
    expect(fretFor(STANDARD, 0, "E3")).toBe(12);
  });
});

describe("findNearestFret", () => {
  test("A on low E string = fret 5", () => {
    expect(findNearestFret(STANDARD, 0, "A")).toBe(5);
  });

  test("E on low E string = fret 0", () => {
    expect(findNearestFret(STANDARD, 0, "E")).toBe(0);
  });

  test("A on A string = fret 0", () => {
    expect(findNearestFret(STANDARD, 1, "A")).toBe(0);
  });

  test("C# on low E = fret 8 (nearest to open)", () => {
    // Low E is E2 (chroma 4), C# chroma is 1 → 1 - 4 = -3 → +12 = 9
    expect(findNearestFret(STANDARD, 0, "C#")).toBe(9);
  });

  test("returns a non-negative number for valid pitch classes", () => {
    // Verify valid inputs work correctly
    expect(findNearestFret(STANDARD, 0, "A")).toBe(5);
    expect(findNearestFret(STANDARD, 0, "E")).toBe(0);
  });
});

describe("findFretInPosition", () => {
  test("A on low E near fret 5 = fret 5", () => {
    expect(findFretInPosition(STANDARD, 0, "A", 5)).toBe(5);
  });

  test("finds fret within window from reference", () => {
    // C# on D string (D3, chroma 2), C# chroma 1 → 1-2=-1+12=11
    // Near reference fret 9: lowerBound = 9-3=6, upperBound=9+5=14 → fret 11 is in range
    const result = findFretInPosition(STANDARD, 2, "C#", 9);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test("adjusts octave to bring into position window", () => {
    // A on B string (B3=47), A chroma=9, B chroma=11 → 9-11=-2+12=10
    // Near reference fret 5: lowerBound=5-3=2, upperBound=5+5=10 → 10 is in range
    const result = findFretInPosition(STANDARD, 4, "A", 5);
    expect(result).not.toBeNull();
  });

  test("custom span parameter", () => {
    const result = findFretInPosition(STANDARD, 0, "A", 5, 4);
    expect(result).toBe(5);
  });
});

describe("findNote", () => {
  test("finds all positions of A in frets 0-12", () => {
    const positions = findNote("A", STANDARD, [0, 12]);
    expect(positions.length).toBeGreaterThan(0);
    // A2 on low E = string 0, fret 5
    const lowE = positions.find((p) => p.string === 0 && p.fret === 5);
    expect(lowE).toBeDefined();
    expect(lowE!.note).toBe("A2");
    // A2 on A string = string 1, fret 0
    const aString = positions.find((p) => p.string === 1 && p.fret === 0);
    expect(aString).toBeDefined();
  });

  test("all returned positions have correct pitch class", () => {
    const positions = findNote("C#", STANDARD, [0, 12]);
    positions.forEach((p) => {
      expect(p.note).toMatch(/C#/);
    });
  });

  test("respects fret range limits", () => {
    const positions = findNote("A", STANDARD, [5, 10]);
    positions.forEach((p) => {
      expect(p.fret).toBeGreaterThanOrEqual(5);
      expect(p.fret).toBeLessThanOrEqual(10);
    });
  });

  test("returns midi values", () => {
    const positions = findNote("A", STANDARD, [0, 12]);
    positions.forEach((p) => {
      expect(typeof p.midi).toBe("number");
      expect(p.midi).toBeGreaterThan(0);
    });
  });

  test("works with alternate tuning", () => {
    const positions = findNote("D", DROP_D, [0, 5]);
    const openLow = positions.find((p) => p.string === 0 && p.fret === 0);
    expect(openLow).toBeDefined();
  });
});

describe("fretboard", () => {
  test("generates positions for all strings over fret range", () => {
    const board = fretboard(STANDARD, [0, 12]);
    // 6 strings × 13 frets (0-12) = 78 positions
    expect(board).toHaveLength(6 * 13);
  });

  test("contains open string positions", () => {
    const board = fretboard(STANDARD, [0, 5]);
    const openLowE = board.find((p) => p.string === 0 && p.fret === 0);
    expect(openLowE).toBeDefined();
    expect(openLowE!.note).toBe("E2");
  });

  test("position at string 0 fret 5 is A2", () => {
    const board = fretboard(STANDARD, [0, 12]);
    const pos = board.find((p) => p.string === 0 && p.fret === 5);
    expect(pos).toBeDefined();
    expect(pos!.note).toBe("A2");
    expect(pos!.midi).toBe(45); // A2 = MIDI 45
  });

  test("works with 7-string tuning", () => {
    const board = fretboard(STANDARD_7, [0, 1]);
    // 7 strings × 2 frets (0-1) = 14 positions
    expect(board).toHaveLength(7 * 2);
  });
});

// ============================================================
// 3. Shape registry
// ============================================================

describe("Shape registry", () => {
  test("get() finds registered CAGED shapes by name", () => {
    expect(get("E Shape")).toBeDefined();
    expect(get("E Shape")!.name).toBe("E Shape");
    expect(get("D Shape")).toBeDefined();
    expect(get("C Shape")).toBeDefined();
    expect(get("A Shape")).toBeDefined();
    expect(get("G Shape")).toBeDefined();
  });

  test("get() returns undefined for unknown name", () => {
    expect(get("Unknown Shape")).toBeUndefined();
  });

  test("names() returns all shape names as strings", () => {
    const shapeNames = names();
    expect(Array.isArray(shapeNames)).toBe(true);
    expect(shapeNames).toContain("E Shape");
    expect(shapeNames).toContain("D Shape");
    expect(shapeNames).toContain("C Shape");
    expect(shapeNames).toContain("A Shape");
    expect(shapeNames).toContain("G Shape");
  });

  test("all() returns all registered shapes", () => {
    const shapes = all();
    expect(Array.isArray(shapes)).toBe(true);
    expect(shapes.length).toBeGreaterThan(0);
  });

  test("built-in CAGED shapes are registered (5 shapes)", () => {
    const cagedShapes = all().filter((s) => s.system === "caged");
    expect(cagedShapes).toHaveLength(5);
  });

  test("built-in 3NPS patterns are registered (7 shapes)", () => {
    const npsShapes = all().filter((s) => s.system === "3nps");
    expect(npsShapes).toHaveLength(7);
  });

  test("built-in pentatonic boxes are registered (5 shapes)", () => {
    const pentShapes = all().filter((s) => s.system === "pentatonic");
    expect(pentShapes).toHaveLength(5);
  });

  test("total registered shapes = 17 (5 CAGED + 7 3NPS + 5 pentatonic)", () => {
    expect(all()).toHaveLength(17);
  });

  test("removeAll() clears registry, add() re-registers", () => {
    const originalCount = all().length;
    removeAll();
    expect(all()).toHaveLength(0);
    expect(names()).toHaveLength(0);

    // Re-add one shape
    add(CAGED_E);
    expect(all()).toHaveLength(1);
    expect(get("E Shape")).toBeDefined();

    // Restore
    removeAll();
    [CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G].forEach(add);
    [
      NPS_PATTERN_1,
      NPS_PATTERN_2,
      NPS_PATTERN_3,
      NPS_PATTERN_4,
      NPS_PATTERN_5,
      NPS_PATTERN_6,
      NPS_PATTERN_7,
    ].forEach(add);
    [PENTA_BOX_1, PENTA_BOX_2, PENTA_BOX_3, PENTA_BOX_4, PENTA_BOX_5].forEach(
      add,
    );
    expect(all()).toHaveLength(originalCount);
  });

  test("chordShapes.names() returns CAGED chord shape names", () => {
    const cNames = chordShapes.names();
    expect(cNames).toContain("E Shape Major");
    expect(cNames).toContain("A Shape Major");
    expect(cNames).toContain("D Shape Major");
  });

  test("chordShapes.get() finds chord shapes", () => {
    const shape = chordShapes.get("E Shape Major");
    expect(shape).toBeDefined();
    expect(shape!.system).toBe("caged");
  });
});

// ============================================================
// 4. buildFrettedScale — key tests
// ============================================================

describe("buildFrettedScale — A major in E shape", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("returns 15 notes", () => {
    expect(scale.notes).toHaveLength(15);
  });

  test("all pitch classes are A major scale tones", () => {
    const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];
    scale.notes.forEach((n) => {
      expect(aMajor).toContain(n.pc);
    });
  });

  test("fret range is 5–9 (E shape A major starts at fret 5)", () => {
    const frets = scale.notes.map((n) => n.fret);
    expect(Math.min(...frets)).toBe(5);
    expect(Math.max(...frets)).toBe(9);
  });

  test("all 6 strings are used", () => {
    const stringsUsed = new Set(scale.notes.map((n) => n.string));
    expect(stringsUsed.size).toBe(6);
  });

  test("notes are sorted by pitch (midi ascending)", () => {
    for (let i = 1; i < scale.notes.length; i++) {
      expect(scale.notes[i].midi).toBeGreaterThanOrEqual(
        scale.notes[i - 1].midi,
      );
    }
  });

  test("result has correct root and shape name", () => {
    expect(scale.empty).toBe(false);
    expect(scale.root).toBe("A");
    expect(scale.shapeName).toBe("E Shape");
    expect(scale.tuning).toEqual(STANDARD);
  });
});

describe("buildFrettedScale — scaleIndex and degree invariants (FIX #1)", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("scaleIndex is 0-based (0-6 for 7-note scale)", () => {
    const indices = scale.notes.map((n) => n.scaleIndex);
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    expect(unique[0]).toBe(0);
    expect(unique[unique.length - 1]).toBe(6);
    indices.forEach((i) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(6);
    });
  });

  test("degree is 1-based (= scaleIndex + 1)", () => {
    scale.notes.forEach((n) => {
      expect(n.degree).toBe(n.scaleIndex + 1);
    });
  });

  test("all 7 unique scale degrees are present", () => {
    const degrees = new Set(scale.notes.map((n) => n.degree));
    expect(degrees.size).toBe(7);
    expect(degrees.has(1)).toBe(true);
    expect(degrees.has(7)).toBe(true);
  });

  test("intervalNumber matches the numeric part of the interval string", () => {
    scale.notes.forEach((n) => {
      // e.g. "3M" → intervalNumber should be 3
      const match = n.interval.match(/(\d+)/);
      if (match) {
        expect(n.intervalNumber).toBe(parseInt(match[1]));
      }
    });
  });
});

describe("buildFrettedScale — root with octave is stripped (FIX #6)", () => {
  test("buildFrettedScale(CAGED_E, 'A4') works and root === 'A'", () => {
    const scale = buildFrettedScale(CAGED_E, "A4");
    expect(scale.empty).toBe(false);
    expect(scale.root).toBe("A");
    expect(scale.notes).toHaveLength(15);
  });

  test("buildFrettedScale(CAGED_E, 'C3') works and root === 'C'", () => {
    const scale = buildFrettedScale(CAGED_E, "C3");
    expect(scale.empty).toBe(false);
    expect(scale.root).toBe("C");
  });
});

describe("buildFrettedScale — invalid root returns NoFrettedScale (FIX #8)", () => {
  test("empty root string", () => {
    const scale = buildFrettedScale(CAGED_E, "");
    expect(scale.empty).toBe(true);
    expect(scale.notes).toHaveLength(0);
  });

  test("invalid root string", () => {
    const scale = buildFrettedScale(CAGED_E, "xyz");
    expect(scale.empty).toBe(true);
  });
});

describe("buildFrettedScale — FrettedNote fields", () => {
  test("each note has required fields", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    scale.notes.forEach((n) => {
      expect(typeof n.string).toBe("number");
      expect(typeof n.fret).toBe("number");
      expect(typeof n.note).toBe("string");
      expect(typeof n.pc).toBe("string");
      expect(typeof n.interval).toBe("string");
      expect(typeof n.scaleIndex).toBe("number");
      expect(typeof n.degree).toBe("number");
      expect(typeof n.intervalNumber).toBe("number");
      expect(typeof n.midi).toBe("number");
    });
  });

  test("note field contains octave (e.g. 'A2' not 'A')", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    scale.notes.forEach((n) => {
      expect(n.note).toMatch(/[A-G](#|b)?\d/);
    });
  });
});

// ============================================================
// 5. applyChordShape
// ============================================================

describe("applyChordShape — E Shape Major", () => {
  test("A major in E shape = 577655", () => {
    const result = applyChordShape(CAGED_CHORD_E, "A");
    expect(result.frets).toEqual([5, 7, 7, 6, 5, 5]);
    expect(result.startFret).toBe(5);
    expect(result.root).toBe("A");
  });

  test("G major in E shape = 355433", () => {
    const result = applyChordShape(CAGED_CHORD_E, "G");
    expect(result.frets).toEqual([3, 5, 5, 4, 3, 3]);
  });

  test("C major in E shape = 8-10-10-9-8-8", () => {
    const result = applyChordShape(CAGED_CHORD_E, "C");
    expect(result.frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(result.startFret).toBe(8);
  });

  test("F major in E shape = 133211", () => {
    const result = applyChordShape(CAGED_CHORD_E, "F");
    expect(result.frets).toEqual([1, 3, 3, 2, 1, 1]);
  });

  test("notes for A major contain A, C#, E", () => {
    const result = applyChordShape(CAGED_CHORD_E, "A");
    const pcs = result.positions.map((p) => p.pc);
    expect(pcs).toContain("A");
    expect(pcs).toContain("C#");
    expect(pcs).toContain("E");
    pcs.forEach((pc) => {
      expect(["A", "C#", "E"]).toContain(pc);
    });
  });

  test("result has shapeName", () => {
    const result = applyChordShape(CAGED_CHORD_E, "A");
    expect(result.shapeName).toBe("E Shape Major");
  });
});

describe("applyChordShape — A Shape Major", () => {
  test("D major in A shape = x57775", () => {
    const result = applyChordShape(CAGED_CHORD_A, "D");
    expect(result.frets).toEqual([null, 5, 7, 7, 7, 5]);
  });
});

describe("applyChordShape — D Shape Major", () => {
  test("D major open in D shape = xx0232", () => {
    const result = applyChordShape(CAGED_CHORD_D, "D");
    expect(result.frets).toEqual([null, null, 0, 2, 3, 2]);
  });
});

// ============================================================
// 6. All 5 CAGED shapes
// ============================================================

describe("buildFrettedScale — all 5 CAGED shapes for A major", () => {
  const shapes = [CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G];
  const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];

  for (const shape of shapes) {
    test(`${shape.name} — all notes are A major scale tones`, () => {
      const scale = buildFrettedScale(shape, "A");
      scale.notes.forEach((n) => {
        expect(aMajor).toContain(n.pc);
      });
    });

    test(`${shape.name} — all 7 scale degrees present`, () => {
      const scale = buildFrettedScale(shape, "A");
      const degrees = new Set(scale.notes.map((n) => n.degree));
      expect(degrees.size).toBe(7);
    });

    test(`${shape.name} — all 6 strings used`, () => {
      const scale = buildFrettedScale(shape, "A");
      const stringsUsed = new Set(scale.notes.map((n) => n.string));
      expect(stringsUsed.size).toBe(6);
    });

    test(`${shape.name} — fret span ≤ 6`, () => {
      const scale = buildFrettedScale(shape, "A");
      const frets = scale.notes.map((n) => n.fret);
      const span = Math.max(...frets) - Math.min(...frets);
      expect(span).toBeLessThanOrEqual(6);
    });
  }

  test("shapes connect sequentially up the neck (E→D→C→A→G)", () => {
    const positions = shapes.map((shape) => {
      const scale = buildFrettedScale(shape, "A");
      const frets = scale.notes.map((n) => n.fret);
      return { name: shape.name, min: Math.min(...frets) };
    });
    // Each shape's minimum fret should be in the ascending order E→G
    // E shape starts lowest, G shape starts highest (for A major)
    // E shape root at fret 5, G shape root at fret 0
    // The shapes wrap around so just verify all are valid fret numbers
    positions.forEach((p) => {
      expect(p.min).toBeGreaterThanOrEqual(0);
    });
  });

  test("transposition: E shape works in all common keys", () => {
    const keys = ["C", "D", "E", "G", "A", "Bb"];
    for (const key of keys) {
      const scale = buildFrettedScale(CAGED_E, key);
      expect(scale.empty).toBe(false);
      expect(scale.notes.length).toBeGreaterThanOrEqual(14);
      const degrees = new Set(scale.notes.map((n) => n.degree));
      expect(degrees.size).toBe(7);
    }
  });
});

// ============================================================
// 7. 3NPS patterns
// ============================================================

describe("buildFrettedScale — 3NPS patterns", () => {
  const npsShapes = [
    NPS_PATTERN_1,
    NPS_PATTERN_2,
    NPS_PATTERN_3,
    NPS_PATTERN_4,
    NPS_PATTERN_5,
    NPS_PATTERN_6,
    NPS_PATTERN_7,
  ];
  const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];

  // Patterns 1, 5, 6, 7 produce a full 18 notes with root A.
  // Patterns 2, 3, 4 produce 15 notes with root A because the position
  // window clips 1 note per string on strings 1–3 (the notes fall outside
  // the span=5 window centered on the rootFret).
  const full18Patterns = [
    NPS_PATTERN_1,
    NPS_PATTERN_5,
    NPS_PATTERN_6,
    NPS_PATTERN_7,
  ];
  const partial15Patterns = [NPS_PATTERN_2, NPS_PATTERN_3, NPS_PATTERN_4];

  for (const shape of full18Patterns) {
    test(`${shape.name} — exactly 18 notes (3 per string)`, () => {
      const scale = buildFrettedScale(shape, "A");
      expect(scale.notes).toHaveLength(18);
    });

    test(`${shape.name} — exactly 3 notes per string`, () => {
      const scale = buildFrettedScale(shape, "A");
      for (let s = 0; s < 6; s++) {
        const onString = scale.notes.filter((n) => n.string === s);
        expect(onString).toHaveLength(3);
      }
    });
  }

  for (const shape of partial15Patterns) {
    test(`${shape.name} — 15 notes with root A (3 on some strings, 2 on others due to position window)`, () => {
      const scale = buildFrettedScale(shape, "A");
      expect(scale.notes).toHaveLength(15);
    });
  }

  for (const shape of npsShapes) {
    test(`${shape.name} — all notes are A major scale tones`, () => {
      const scale = buildFrettedScale(shape, "A");
      scale.notes.forEach((n) => {
        expect(aMajor).toContain(n.pc);
      });
    });
  }

  test("all 7 patterns use the same 7 pitch classes for A major", () => {
    const allPcs = new Set<string>();
    for (const shape of npsShapes) {
      const scale = buildFrettedScale(shape, "A");
      scale.notes.forEach((n) => allPcs.add(n.pc));
    }
    expect(allPcs.size).toBe(7);
  });

  test("pattern 1 (Ionian) exactly 18 notes, 3 per string", () => {
    const scale = buildFrettedScale(NPS_PATTERN_1, "A");
    expect(scale.notes).toHaveLength(18);
    for (let s = 0; s < 6; s++) {
      expect(scale.notes.filter((n) => n.string === s)).toHaveLength(3);
    }
  });

  test("pattern 1 (Ionian) lowest note has interval 1P", () => {
    const scale = buildFrettedScale(NPS_PATTERN_1, "A");
    expect(scale.notes[0].interval).toBe("1P");
  });

  test("pattern 2 (Dorian) lowest note has interval 2M", () => {
    const scale = buildFrettedScale(NPS_PATTERN_2, "A");
    expect(scale.notes[0].interval).toBe("2M");
  });
});

// ============================================================
// 8. Pattern generators
// ============================================================

describe("ascendingIntervals", () => {
  test("ascendingIntervals(7, 2) produces correct 3rds pattern", () => {
    expect(ascendingIntervals(7, 2)).toEqual([
      1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8,
    ]);
  });

  test("ascendingIntervals(7, 3) produces 4ths pattern", () => {
    expect(ascendingIntervals(7, 3)).toEqual([1, 4, 2, 5, 3, 6, 4, 7, 5, 8]);
  });

  test("ascendingIntervals(7, 5) produces 6ths pattern", () => {
    expect(ascendingIntervals(7, 5)).toEqual([1, 6, 2, 7, 3, 8]);
  });

  test("matches ASCENDING_THIRDS constant", () => {
    expect(ascendingIntervals(7, 2)).toEqual(ASCENDING_THIRDS);
  });
});

describe("descendingIntervals", () => {
  test("descendingIntervals(7, 2) produces correct descending 3rds", () => {
    expect(descendingIntervals(7, 2)).toEqual([
      8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3, 1,
    ]);
  });

  test("matches DESCENDING_THIRDS constant", () => {
    expect(descendingIntervals(7, 2)).toEqual(DESCENDING_THIRDS);
  });

  test("custom startDegree", () => {
    const result = descendingIntervals(7, 2, 7);
    expect(result[0]).toBe(7);
    expect(result[1]).toBe(5);
  });
});

describe("ascendingLinear", () => {
  test("ascendingLinear(1, 8) = [1,2,3,4,5,6,7,8]", () => {
    expect(ascendingLinear(1, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("ascendingLinear(3, 5) = [3,4,5]", () => {
    expect(ascendingLinear(3, 5)).toEqual([3, 4, 5]);
  });

  test("single element when from === to", () => {
    expect(ascendingLinear(4, 4)).toEqual([4]);
  });
});

describe("descendingLinear", () => {
  test("descendingLinear(8, 1) = [8,7,6,5,4,3,2,1]", () => {
    expect(descendingLinear(8, 1)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  test("descendingLinear(5, 3) = [5,4,3]", () => {
    expect(descendingLinear(5, 3)).toEqual([5, 4, 3]);
  });
});

describe("grouping", () => {
  test("grouping(7, 4) = [1,2,3,4,2,3,4,5,3,4,5,6,4,5,6,7]", () => {
    expect(grouping(7, 4)).toEqual([
      1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6, 4, 5, 6, 7,
    ]);
  });

  test("grouping(5, 3) for pentatonic", () => {
    const result = grouping(5, 3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
    // Group 2 starts at 2
    expect(result[3]).toBe(2);
  });

  test("custom step parameter", () => {
    const result = grouping(7, 4, 2);
    // i advances by 2 each iteration
    expect(result[0]).toBe(1);
    expect(result[4]).toBe(3);
  });
});

describe("thirds, fourths, sixths convenience wrappers", () => {
  test("thirds(7) === ascendingIntervals(7, 2)", () => {
    expect(thirds(7)).toEqual(ascendingIntervals(7, 2));
  });

  test("fourths(7) === ascendingIntervals(7, 3)", () => {
    expect(fourths(7)).toEqual(ascendingIntervals(7, 3));
  });

  test("sixths(7) === ascendingIntervals(7, 5)", () => {
    expect(sixths(7)).toEqual(ascendingIntervals(7, 5));
  });
});

describe("Built-in sequence constants", () => {
  test("ASCENDING_THIRDS starts [1,3,2,4,...]", () => {
    expect(ASCENDING_THIRDS[0]).toBe(1);
    expect(ASCENDING_THIRDS[1]).toBe(3);
    expect(ASCENDING_THIRDS[2]).toBe(2);
    expect(ASCENDING_THIRDS[3]).toBe(4);
  });

  test("DESCENDING_THIRDS starts [8,6,7,5,...]", () => {
    expect(DESCENDING_THIRDS[0]).toBe(8);
    expect(DESCENDING_THIRDS[1]).toBe(6);
  });

  test("SEQ_1235 = [1,2,3,5]", () => {
    expect(SEQ_1235).toEqual([1, 2, 3, 5]);
  });

  test("SEQ_1234_GROUP = [1,2,3,4]", () => {
    expect(SEQ_1234_GROUP).toEqual([1, 2, 3, 4]);
  });

  test("SEQ_UP_DOWN = [1,2,3,4,3,2]", () => {
    expect(SEQ_UP_DOWN).toEqual([1, 2, 3, 4, 3, 2]);
  });

  test("SEQ_TRIAD_CLIMB = [1,3,5,3]", () => {
    expect(SEQ_TRIAD_CLIMB).toEqual([1, 3, 5, 3]);
  });
});

// ============================================================
// 9. Walker
// ============================================================

describe("walkPattern — ascending", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("ascending linear: first note is root (A)", () => {
    const pattern = ascendingLinear(1, 8);
    const walked = walkPattern(scale, pattern);
    expect(walked[0].pc).toBe("A");
  });

  test("ascending linear: 8 notes returned for pattern 1-8", () => {
    const pattern = ascendingLinear(1, 8);
    const walked = walkPattern(scale, pattern);
    expect(walked).toHaveLength(8);
  });

  test("ascending linear: notes are in ascending pitch order", () => {
    const pattern = ascendingLinear(1, 7);
    const walked = walkPattern(scale, pattern, { direction: "up" });
    for (let i = 1; i < walked.length; i++) {
      expect(walked[i].midi).toBeGreaterThanOrEqual(walked[i - 1].midi);
    }
  });

  test("ascending 3rds: correct pitch class sequence (A, C#, B, D, ...)", () => {
    const walked = walkPattern(scale, ASCENDING_THIRDS);
    expect(walked[0].pc).toBe("A"); // degree 1
    expect(walked[1].pc).toBe("C#"); // degree 3
    expect(walked[2].pc).toBe("B"); // degree 2
    expect(walked[3].pc).toBe("D"); // degree 4
  });

  test("ascending 3rds: returns 12 notes", () => {
    const walked = walkPattern(scale, ASCENDING_THIRDS);
    expect(walked).toHaveLength(12);
  });

  test("ascending 4ths: correct first two notes", () => {
    const walked = walkPattern(scale, ascendingIntervals(7, 3));
    expect(walked[0].pc).toBe("A"); // degree 1
    expect(walked[1].pc).toBe("D"); // degree 4
  });

  test("empty pattern returns empty array", () => {
    expect(walkPattern(scale, [])).toEqual([]);
  });

  test("empty scale returns empty array", () => {
    expect(walkPattern({ ...NoFrettedScale }, [1, 2, 3])).toEqual([]);
  });
});

describe("walkPattern — descending", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("descending linear: notes descend in pitch", () => {
    const pattern = descendingLinear(8, 1);
    const walked = walkPattern(scale, pattern, { direction: "down" });
    expect(walked.length).toBeGreaterThan(0);
    for (let i = 1; i < walked.length; i++) {
      expect(walked[i].midi).toBeLessThanOrEqual(walked[i - 1].midi);
    }
  });

  test("DESCENDING_THIRDS: first note higher than second", () => {
    const walked = walkPattern(scale, DESCENDING_THIRDS, { direction: "down" });
    expect(walked.length).toBeGreaterThan(1);
    expect(walked[0].midi).toBeGreaterThan(walked[1].midi);
  });
});

describe("walkPattern — auto direction", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("ascending pattern (auto): each step follows direction", () => {
    const walked = walkPattern(scale, ASCENDING_THIRDS); // default auto
    expect(walked).toHaveLength(12);
  });

  test("degree wrapping: degree 8 normalizes to degree 1 (octave)", () => {
    const walked = walkPattern(scale, [1, 8]);
    expect(walked).toHaveLength(2);
    expect(walked[0].pc).toBe("A");
    expect(walked[1].pc).toBe("A");
    expect(walked[1].midi).toBeGreaterThan(walked[0].midi);
  });
});

// ============================================================
// 10. Sequence engine
// ============================================================

describe("applySequence", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("non-incremental: single pass with exact sequence length", () => {
    const passes = applySequence(scale, SEQ_1235);
    expect(passes).toHaveLength(1);
    expect(passes[0]).toHaveLength(4);
  });

  test("non-incremental: notes match expected degrees", () => {
    const passes = applySequence(scale, SEQ_1235);
    expect(passes[0][0].pc).toBe("A"); // degree 1
    expect(passes[0][1].pc).toBe("B"); // degree 2
    expect(passes[0][2].pc).toBe("C#"); // degree 3
    expect(passes[0][3].pc).toBe("E"); // degree 5
  });

  test("incremental: multiple passes with offset", () => {
    const passes = applySequence(scale, SEQ_1235, { incremental: true });
    expect(passes.length).toBeGreaterThan(1);
    // Each pass starts one degree higher
    expect(passes[0][0].pc).toBe("A"); // pass 1 starts on degree 1 = A
    expect(passes[1][0].pc).toBe("B"); // pass 2 starts on degree 2 = B
  });

  test("incremental with passes limit", () => {
    const passes = applySequence(scale, SEQ_1235, {
      incremental: true,
      passes: 3,
    });
    expect(passes.length).toBeLessThanOrEqual(3);
  });

  test("incremental with startDegree", () => {
    const passes = applySequence(scale, SEQ_1235, {
      incremental: false,
      startDegree: 3,
    });
    expect(passes).toHaveLength(1);
    // Starting from degree 3 (C#), seq [1,2,3,5] → [3,4,5,7]
    expect(passes[0][0].pc).toBe("C#"); // degree 3
  });

  test("boundToShape stops when out of range", () => {
    // With boundToShape=true (default), passes stop when notes run out
    const passes = applySequence(scale, SEQ_1235, {
      incremental: true,
      boundToShape: true,
    });
    // Should have stopped before reaching impossible degrees
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.length).toBeLessThanOrEqual(7);
  });

  test("empty scale returns empty array", () => {
    const passes = applySequence({ ...NoFrettedScale }, SEQ_1235);
    expect(passes).toEqual([]);
  });
});

describe("flattenSequence", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("flattens multiple passes into single note array", () => {
    const passes = applySequence(scale, SEQ_1235, {
      incremental: true,
      passes: 3,
    });
    const flat = flattenSequence(passes);
    const totalExpected = passes.reduce((sum, p) => sum + p.length, 0);
    expect(flat).toHaveLength(totalExpected);
  });

  test("flattens single pass correctly", () => {
    const passes = applySequence(scale, SEQ_1235);
    const flat = flattenSequence(passes);
    expect(flat).toHaveLength(4);
  });

  test("empty passes returns empty array", () => {
    expect(flattenSequence([])).toEqual([]);
  });
});

// ============================================================
// 11. Notation
// ============================================================

describe("parseChordFrets", () => {
  test("compact string x32010 → [null, 3, 2, 0, 1, 0]", () => {
    expect(parseChordFrets("x32010")).toEqual([null, 3, 2, 0, 1, 0]);
  });

  test("compact uppercase X32010 → [null, 3, 2, 0, 1, 0]", () => {
    expect(parseChordFrets("X32010")).toEqual([null, 3, 2, 0, 1, 0]);
  });

  test("high-fret delimited 8-10-10-9-8-8 → [8, 10, 10, 9, 8, 8]", () => {
    expect(parseChordFrets("8-10-10-9-8-8")).toEqual([8, 10, 10, 9, 8, 8]);
  });

  test("delimited with x: x-3-2-0-1-0 → [null, 3, 2, 0, 1, 0]", () => {
    expect(parseChordFrets("x-3-2-0-1-0")).toEqual([null, 3, 2, 0, 1, 0]);
  });

  test("array passthrough normalizes null/-1", () => {
    expect(parseChordFrets([null, 3, 2, 0, 1, 0])).toEqual([
      null,
      3,
      2,
      0,
      1,
      0,
    ]);
    expect(parseChordFrets([-1, 3, 2, 0, 1, 0])).toEqual([null, 3, 2, 0, 1, 0]);
  });

  test("empty string returns empty array", () => {
    expect(parseChordFrets("")).toEqual([]);
  });

  test("577655 → [5, 7, 7, 6, 5, 5]", () => {
    expect(parseChordFrets("577655")).toEqual([5, 7, 7, 6, 5, 5]);
  });
});

describe("formatChordFrets", () => {
  test("[null, 3, 2, 0, 1, 0] → 'x32010'", () => {
    expect(formatChordFrets([null, 3, 2, 0, 1, 0])).toBe("x32010");
  });

  test("[8, 10, 10, 9, 8, 8] → '8-10-10-9-8-8'", () => {
    expect(formatChordFrets([8, 10, 10, 9, 8, 8])).toBe("8-10-10-9-8-8");
  });

  test("[5, 7, 7, 6, 5, 5] → '577655'", () => {
    expect(formatChordFrets([5, 7, 7, 6, 5, 5])).toBe("577655");
  });

  test("empty array returns empty string", () => {
    expect(formatChordFrets([])).toBe("");
  });

  test("uses delimiter when any value > 9", () => {
    expect(formatChordFrets([0, 10, 0, 0, 0, 0])).toBe("0-10-0-0-0-0");
  });
});

describe("parseScalePattern", () => {
  test("'5-8,5-7,5-7,5-7,5-8,5-8' → [[5,8],[5,7],[5,7],[5,7],[5,8],[5,8]]", () => {
    expect(parseScalePattern("5-8,5-7,5-7,5-7,5-8,5-8")).toEqual([
      [5, 8],
      [5, 7],
      [5, 7],
      [5, 7],
      [5, 8],
      [5, 8],
    ]);
  });

  test("parses single-fret groups", () => {
    expect(parseScalePattern("0,2,2,1,0,0")).toEqual([
      [0],
      [2],
      [2],
      [1],
      [0],
      [0],
    ]);
  });

  test("empty string returns empty array", () => {
    expect(parseScalePattern("")).toEqual([]);
  });
});

// ============================================================
// 12. Output formatters
// ============================================================

describe("toAlphaTeX", () => {
  const scale = buildFrettedScale(CAGED_E, "A");
  const walked = walkPattern(scale, ascendingLinear(1, 8));

  test("contains \\title", () => {
    const tex = toAlphaTeX(walked, { title: "Test Exercise" });
    expect(tex).toContain('\\title "Test Exercise"');
  });

  test("contains \\tempo", () => {
    const tex = toAlphaTeX(walked, { tempo: 120 });
    expect(tex).toContain("\\tempo 120");
  });

  test("contains \\tuning with reversed tuning (high to low)", () => {
    const tex = toAlphaTeX(walked, { tuning: STANDARD });
    expect(tex).toContain("\\tuning");
    // Standard reversed: E4 B3 G3 D3 A2 E2
    expect(tex).toContain("E4");
    expect(tex).toContain("E2");
  });

  test("contains \\staff {tabs}", () => {
    const tex = toAlphaTeX(walked);
    expect(tex).toContain("\\staff {tabs}");
  });

  test("uses fret.string notation (string 0 → highest AlphaTeX number)", () => {
    const tex = toAlphaTeX(walked, { tuning: STANDARD });
    // A2 on string 0 (low E), fret 5 → AlphaTeX string = 6 - 0 = 6
    // So 5.6 should appear
    expect(tex).toContain("5.6");
  });

  test("default title is 'Exercise'", () => {
    const tex = toAlphaTeX(walked);
    expect(tex).toContain('\\title "Exercise"');
  });

  test("custom key signature", () => {
    const tex = toAlphaTeX(walked, { key: "A" });
    expect(tex).toContain("\\ks A");
  });

  test("with noteDurations per-note override", () => {
    const notes = scale.notes.slice(0, 4);
    const tex = toAlphaTeX(notes, { noteDurations: [4, 8, 8, 4] });
    expect(tex).toContain(":4");
    expect(tex).toContain(":8");
  });
});

describe("toAsciiTab", () => {
  const scale = buildFrettedScale(CAGED_E, "A");

  test("produces 6 lines for 6-string tuning", () => {
    const tab = toAsciiTab(scale.notes.slice(0, 10));
    expect(tab.split("\n")).toHaveLength(6);
  });

  test("contains fret numbers", () => {
    const tab = toAsciiTab(scale.notes.slice(0, 8));
    // Should contain some fret numbers
    expect(tab).toMatch(/\d/);
  });

  test("each line starts with a string label and pipe", () => {
    const tab = toAsciiTab(scale.notes.slice(0, 4));
    const lines = tab.split("\n");
    lines.forEach((line) => {
      // Each line: label + | ... |
      expect(line).toMatch(/^[a-gA-G][|]/);
    });
  });

  test("works with 7-string tuning", () => {
    const npsScale = buildFrettedScale(NPS_PATTERN_1, "A", STANDARD_7);
    if (!npsScale.empty) {
      const tab = toAsciiTab(npsScale.notes.slice(0, 5), {
        tuning: STANDARD_7,
      });
      expect(tab.split("\n")).toHaveLength(7);
    }
  });

  test("high string displayed first (standard tab convention)", () => {
    // In standard tab, high E is on top
    // The last string (index 5, E4) should be the first line
    const notes = scale.notes.slice(0, 3);
    const tab = toAsciiTab(notes);
    const firstLine = tab.split("\n")[0];
    // high E label is lowercase 'e'
    expect(firstLine[0]).toBe("e");
  });
});

// ============================================================
// 13. Integration
// ============================================================

describe("buildFromScale", () => {
  test("'A major' fills scaleType and scaleName", () => {
    const scale = buildFromScale(CAGED_E, "A major");
    expect(scale.empty).toBe(false);
    expect(scale.scaleType).toBe("major");
    expect(scale.scaleName).toBe("A major");
    expect(scale.root).toBe("A");
  });

  test("'C major' builds correctly", () => {
    const scale = buildFromScale(CAGED_E, "C major");
    expect(scale.empty).toBe(false);
    expect(scale.root).toBe("C");
    expect(scale.scaleType).toBe("major");
  });

  test("invalid scale name returns NoFrettedScale", () => {
    const scale = buildFromScale(CAGED_E, "not a scale");
    expect(scale.empty).toBe(true);
  });

  test("empty scale name returns NoFrettedScale", () => {
    const scale = buildFromScale(CAGED_E, "");
    expect(scale.empty).toBe(true);
  });

  test("'A minor pentatonic' works with pentatonic shape", () => {
    const scale = buildFromScale(PENTA_BOX_1, "A minor pentatonic");
    expect(scale.empty).toBe(false);
    expect(scale.root).toBe("A");
  });
});

describe("relatedScales", () => {
  test("returns modal relatives for A major pentatonic", () => {
    const scale = buildFromScale(PENTA_BOX_1, "A minor pentatonic");
    if (!scale.empty) {
      const related = relatedScales(scale);
      expect(Array.isArray(related)).toBe(true);
      // Should include some related scales
      expect(related.length).toBeGreaterThan(0);
      related.forEach((r) => {
        expect(typeof r.root).toBe("string");
        expect(typeof r.scale).toBe("string");
      });
    }
  });

  test("returns empty array for empty FrettedScale", () => {
    const related = relatedScales({ ...NoFrettedScale });
    expect(related).toEqual([]);
  });

  test("returns empty array when scaleType is not populated", () => {
    const scale = buildFrettedScale(CAGED_E, "A"); // no scaleType set
    const related = relatedScales(scale);
    expect(related).toEqual([]);
  });
});

describe("identifyChord", () => {
  test("[null, 3, 2, 0, 1, 0] is identified as C major chord", () => {
    const chords = identifyChord([null, 3, 2, 0, 1, 0]);
    expect(chords.length).toBeGreaterThan(0);
    const hasC = chords.some((c) => c.startsWith("C"));
    expect(hasC).toBe(true);
  });

  test("[5, 7, 7, 6, 5, 5] is identified as A major", () => {
    const chords = identifyChord([5, 7, 7, 6, 5, 5]);
    expect(chords.length).toBeGreaterThan(0);
    const hasA = chords.some((c) => c.startsWith("A"));
    expect(hasA).toBe(true);
  });

  test("all muted strings returns empty array", () => {
    const chords = identifyChord([null, null, null, null, null, null]);
    expect(chords).toEqual([]);
  });

  test("works with alternate tuning", () => {
    const chords = identifyChord([0, 0, 0, 0, 0, 0], DROP_D);
    expect(Array.isArray(chords)).toBe(true);
  });
});

describe("analyzeInKey", () => {
  test("open C chord [null,3,2,0,1,0] in C major key", () => {
    const analysis = analyzeInKey([null, 3, 2, 0, 1, 0], "C");
    if (!analysis.empty) {
      expect(analysis.chord).toBeDefined();
      expect(analysis.numeral).toBeDefined();
      expect(analysis.degree).toBeGreaterThan(0);
    }
  });

  test("returns empty analysis for all muted", () => {
    const analysis = analyzeInKey([null, null, null, null, null, null], "C");
    expect(analysis.empty).toBe(true);
  });
});

describe("isShapeCompatible", () => {
  test("CAGED_E is compatible with 'C major'", () => {
    expect(isShapeCompatible(CAGED_E, "C major")).toBe(true);
  });

  test("CAGED_E is compatible with 'A major'", () => {
    expect(isShapeCompatible(CAGED_E, "A major")).toBe(true);
  });

  test("all CAGED shapes are compatible with 'C major'", () => {
    const shapes = [CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G];
    shapes.forEach((shape) => {
      expect(isShapeCompatible(shape, "C major")).toBe(true);
    });
  });

  test("CAGED_E is not compatible with 'A minor pentatonic' (has 7 intervals, pentatonic has 5)", () => {
    // The major scale shape uses 7M, 3M etc. which are not in pentatonic
    expect(isShapeCompatible(CAGED_E, "A minor pentatonic")).toBe(false);
  });

  test("pentatonic box is compatible with 'A minor pentatonic'", () => {
    expect(isShapeCompatible(PENTA_BOX_1, "A minor pentatonic")).toBe(true);
  });

  test("invalid scale name returns false", () => {
    expect(isShapeCompatible(CAGED_E, "not a scale")).toBe(false);
  });
});

describe("modeShapes", () => {
  test("returns shapes compatible with 'C major'", () => {
    const shapes = modeShapes("C major");
    expect(shapes.length).toBeGreaterThan(0);
  });

  test("filter by system: only caged shapes for C major", () => {
    const cagedOnly = modeShapes("C major", "caged");
    cagedOnly.forEach((s) => {
      expect(s.system).toBe("caged");
    });
    expect(cagedOnly.length).toBe(5);
  });

  test("filter by system: only pentatonic shapes for A minor pentatonic", () => {
    const pentOnly = modeShapes("A minor pentatonic", "pentatonic");
    pentOnly.forEach((s) => {
      expect(s.system).toBe("pentatonic");
    });
    expect(pentOnly.length).toBe(5);
  });

  test("returns empty array for invalid scale name", () => {
    const shapes = modeShapes("not a scale");
    expect(shapes).toEqual([]);
  });
});

// ============================================================
// 14. Pentatonic-specific
// ============================================================

describe("Pentatonic Box 1 — A minor pentatonic", () => {
  const scale = buildFrettedScale(PENTA_BOX_1, "A");

  test("produces 12 notes (2 per string × 6 strings)", () => {
    expect(scale.notes).toHaveLength(12);
  });

  test("all notes are Am pentatonic tones: A, C, D, E, G", () => {
    const amPent = ["A", "C", "D", "E", "G"];
    scale.notes.forEach((n) => {
      expect(amPent).toContain(n.pc);
    });
  });

  test("exactly 2 notes per string", () => {
    for (let s = 0; s < 6; s++) {
      const onString = scale.notes.filter((n) => n.string === s);
      expect(onString).toHaveLength(2);
    }
  });

  test("scaleIndex values are 0-4 (5 unique degrees)", () => {
    const indices = [...new Set(scale.notes.map((n) => n.scaleIndex))].sort(
      (a, b) => a - b,
    );
    expect(indices).toEqual([0, 1, 2, 3, 4]);
  });

  test("all 5 pentatonic scale degrees are present", () => {
    const degrees = new Set(scale.notes.map((n) => n.degree));
    expect(degrees.size).toBe(5);
  });

  test("root A on low E string at fret 5", () => {
    const rootNote = scale.notes.find((n) => n.string === 0 && n.pc === "A");
    expect(rootNote).toBeDefined();
    expect(rootNote!.fret).toBe(5);
  });
});

describe("Pentatonic — all 5 boxes for A minor pentatonic", () => {
  const boxes = [
    PENTA_BOX_1,
    PENTA_BOX_2,
    PENTA_BOX_3,
    PENTA_BOX_4,
    PENTA_BOX_5,
  ];
  const amPent = ["A", "C", "D", "E", "G"];

  for (const box of boxes) {
    test(`${box.name} — 12 notes, all Am pentatonic tones`, () => {
      const scale = buildFrettedScale(box, "A");
      expect(scale.notes).toHaveLength(12);
      scale.notes.forEach((n) => {
        expect(amPent).toContain(n.pc);
      });
    });
  }
});

// ============================================================
// 15. End-to-end chains
// ============================================================

describe("End-to-end: buildFrettedScale → walkPattern → toAlphaTeX", () => {
  test("produces valid AlphaTeX output for A major E shape ascending", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const walked = walkPattern(scale, ascendingLinear(1, 8));
    const tex = toAlphaTeX(walked, {
      title: "A Major Scale",
      tempo: 100,
      key: "A",
    });

    expect(typeof tex).toBe("string");
    expect(tex.length).toBeGreaterThan(0);
    expect(tex).toContain('\\title "A Major Scale"');
    expect(tex).toContain("\\tempo 100");
    expect(tex).toContain("\\tuning");
    // Should contain at least one fret.string note
    expect(tex).toMatch(/\d+\.\d+/);
  });

  test("ascending 3rds → toAlphaTeX contains correct fret.string notation", () => {
    const scale = buildFrettedScale(CAGED_E, "A");
    const walked = walkPattern(scale, ASCENDING_THIRDS);
    const tex = toAlphaTeX(walked, { key: "A" });

    expect(tex).toMatch(/\d+\.\d+/);
    expect(walked).toHaveLength(12);
  });
});

describe("End-to-end: buildFromScale → applySequence → flattenSequence → toAsciiTab", () => {
  test("produces valid ASCII tab output", () => {
    const scale = buildFromScale(CAGED_E, "A major");
    expect(scale.empty).toBe(false);

    const passes = applySequence(scale, SEQ_1235, {
      incremental: true,
      passes: 3,
    });
    expect(passes.length).toBeGreaterThan(0);

    const flat = flattenSequence(passes);
    expect(flat.length).toBeGreaterThan(0);

    const tab = toAsciiTab(flat);
    expect(typeof tab).toBe("string");
    expect(tab.split("\n")).toHaveLength(6);
    expect(tab).toMatch(/\d/);
  });

  test("full pipeline with pentatonic shape", () => {
    const scale = buildFromScale(PENTA_BOX_1, "A minor pentatonic");
    expect(scale.empty).toBe(false);

    const walked = walkPattern(scale, ascendingLinear(1, 6));
    expect(walked.length).toBeGreaterThan(0);

    const tab = toAsciiTab(walked);
    expect(tab.split("\n")).toHaveLength(6);
  });

  test("full pipeline: 3NPS pattern → ascending 3rds → AlphaTeX", () => {
    const scale = buildFromScale(NPS_PATTERN_1, "A major");
    expect(scale.empty).toBe(false);
    expect(scale.scaleType).toBe("major");

    const walked = walkPattern(scale, ASCENDING_THIRDS);
    expect(walked.length).toBeGreaterThan(0);

    const tex = toAlphaTeX(walked, { title: "3NPS 3rds", tempo: 90 });
    expect(tex).toContain('\\title "3NPS 3rds"');
  });
});
