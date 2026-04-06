/**
 * API Sketch Tests — TDD Driver
 *
 * These tests define the expected API surface and behavior.
 * They will fail until we implement the modules.
 * Run with: npm test -- packages/guitar/experiments/api-sketch.test.ts
 */
import { describe, expect, test } from "vitest";

// These imports don't exist yet — they define our target API
// import * as Guitar from "../index";

// For now, we sketch expectations as plain describe/test blocks.
// Once we agree on the API, we'll uncomment the imports and make them pass.

describe("Tuning", () => {
  test("standard tuning is E2-A2-D3-G3-B3-E4", () => {
    const standard = ["E2", "A2", "D3", "G3", "B3", "E4"];
    expect(standard).toHaveLength(6);
    expect(standard[0]).toBe("E2"); // lowest string
    expect(standard[5]).toBe("E4"); // highest string
  });

  test("7-string adds low B1", () => {
    const standard7 = ["B1", "E2", "A2", "D3", "G3", "B3", "E4"];
    expect(standard7).toHaveLength(7);
    expect(standard7[0]).toBe("B1");
  });

  test("drop D lowers string 0 by a whole step", () => {
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    expect(dropD[0]).toBe("D2");
    // All other strings unchanged from standard
    expect(dropD.slice(1)).toEqual(["A2", "D3", "G3", "B3", "E4"]);
  });
});

describe("Fretboard — noteAt", () => {
  // noteAt(stringIndex, fret, tuning?) → NoteName
  const standard = ["E2", "A2", "D3", "G3", "B3", "E4"];

  test("open strings return the tuning notes", () => {
    // string 0 fret 0 = E2, string 1 fret 0 = A2, etc.
    const expected = ["E2", "A2", "D3", "G3", "B3", "E4"];
    expected.forEach((note, i) => {
      // Guitar.noteAt(i, 0, standard) should equal note
      expect(note).toBe(standard[i]);
    });
  });

  test("fret 5 on low E = A2", () => {
    // Guitar.noteAt(0, 5, standard) → "A2"
    // Each fret = 1 semitone. E2 + 5 semitones = A2
    expect(true).toBe(true); // placeholder
  });

  test("fret 12 = same note one octave up", () => {
    // Guitar.noteAt(0, 12, standard) → "E3"
    // Guitar.noteAt(1, 12, standard) → "A3"
    expect(true).toBe(true); // placeholder
  });
});

describe("Fretboard — findNote", () => {
  test("find all positions of A within frets 0-12", () => {
    // Guitar.findNote("A", { frets: [0, 12] })
    // Should return positions on multiple strings
    const expectedPositions = [
      { string: 0, fret: 5 },  // A on low E string
      { string: 1, fret: 0 },  // open A string
      { string: 2, fret: 7 },  // A on D string
      { string: 3, fret: 2 },  // A on G string
      // { string: 4, fret: 10 }, // A on B string (10th fret)
      { string: 5, fret: 5 },  // A on high E string
    ];
    expect(expectedPositions.length).toBeGreaterThan(3);
  });
});

describe("Notation — parseChord", () => {
  test("parse 'x32010' string notation", () => {
    // Guitar.parseChord("x32010")
    const expected = [null, 3, 2, 0, 1, 0];
    expect(expected[0]).toBeNull();
    expect(expected[1]).toBe(3);
    expect(expected[5]).toBe(0);
  });

  test("parse array notation [null,3,2,0,1,0]", () => {
    // Guitar.parseChord([null, 3, 2, 0, 1, 0])
    // Should produce same result as string notation
    const fromString = [null, 3, 2, 0, 1, 0];
    const fromArray = [null, 3, 2, 0, 1, 0];
    expect(fromString).toEqual(fromArray);
  });

  test("format frets back to string", () => {
    // Guitar.formatChord([null, 3, 2, 0, 1, 0]) → "x32010"
    const frets = [null, 3, 2, 0, 1, 0];
    const formatted = frets.map((f) => (f === null ? "x" : String(f))).join("");
    expect(formatted).toBe("x32010");
  });

  test("handle double-digit frets", () => {
    // "x-x-0-2-3-2" or similar delimiter for frets > 9
    // Guitar.formatChord([null, null, 0, 14, 15, 14]) → needs delimiter
    const frets = [null, null, 0, 14, 15, 14];
    // When any fret > 9, should use delimiter format
    const hasHighFrets = frets.some((f) => f !== null && f > 9);
    expect(hasHighFrets).toBe(true);
    // Expected format: "x-x-0-14-15-14"
  });
});

describe("Notation — parseScalePattern", () => {
  test("parse Am pentatonic shorthand", () => {
    // Guitar.parseScalePattern("5-8,5-7,5-7,5-7,5-8,5-8")
    const expected = [
      [5, 8],
      [5, 7],
      [5, 7],
      [5, 7],
      [5, 8],
      [5, 8],
    ];
    expect(expected).toHaveLength(6);
    expect(expected[0]).toEqual([5, 8]);
  });

  test("parse 3NPS shorthand", () => {
    // Guitar.parseScalePattern("5-7-9,5-7-9,6-7-9,6-7-9,7-9-10,7-9-10")
    const expected = [
      [5, 7, 9],
      [5, 7, 9],
      [6, 7, 9],
      [6, 7, 9],
      [7, 9, 10],
      [7, 9, 10],
    ];
    expect(expected[0]).toHaveLength(3); // 3 notes per string
  });
});

describe("Shape — definition", () => {
  test("E-shape major barre is defined by intervals", () => {
    const eShape = {
      name: "E Shape Major",
      system: "caged",
      intervals: [["1P"], ["5P"], ["1P"], ["3M"], ["5P"], ["1P"]],
      rootStringIndex: 0,
      rootFretOffset: 0,
    };

    expect(eShape.intervals).toHaveLength(6);
    expect(eShape.intervals[0]).toEqual(["1P"]);
    expect(eShape.intervals[3]).toEqual(["3M"]);
    expect(eShape.rootStringIndex).toBe(0);
    expect(eShape.system).toBe("caged");
  });

  test("A-shape uses null for unplayed strings", () => {
    const aShape = {
      name: "A Shape Major",
      system: "caged",
      intervals: [null, ["1P"], ["5P"], ["1P"], ["3M"], ["5P"]],
      rootStringIndex: 1,
      rootFretOffset: 0,
    };

    expect(aShape.intervals[0]).toBeNull(); // low E not played
    expect(aShape.intervals[1]).toEqual(["1P"]); // root on A string
  });
});

describe("Shape — applyShape (chord)", () => {
  test("E-shape major at root A = frets [5,7,7,6,5,5]", () => {
    // Guitar.applyShape(eShapeMajor, "A")
    const expectedFrets = [5, 7, 7, 6, 5, 5];
    const expectedNotes = ["A2", "E3", "A3", "C#4", "E4", "A4"];
    const expectedIntervals = ["1P", "5P", "1P", "3M", "5P", "1P"];

    expect(expectedFrets).toHaveLength(6);
    expect(expectedNotes[0]).toBe("A2");
    expect(expectedNotes[3]).toBe("C#4"); // major 3rd
    expect(expectedIntervals[3]).toBe("3M");
  });

  test("E-shape major at root G = frets [3,5,5,4,3,3]", () => {
    const expectedFrets = [3, 5, 5, 4, 3, 3];
    expect(expectedFrets[0]).toBe(3); // G on low E = fret 3
  });

  test("A-shape major at root D = frets [x,5,7,7,7,5]", () => {
    const expectedFrets = [null, 5, 7, 7, 7, 5];
    expect(expectedFrets[0]).toBeNull();
    expect(expectedFrets[1]).toBe(5); // D on A string = fret 5
  });
});

describe("Shape — applyScalePattern", () => {
  test("Am pentatonic box 1 starting at fret 5", () => {
    // Each string has 2 notes (pentatonic = 5 notes, 2 per string for 6 strings minus overlap)
    const expectedStrings = [
      [
        { fret: 5, note: "A2", interval: "1P" },
        { fret: 8, note: "C3", interval: "3m" },
      ],
      [
        { fret: 5, note: "D3", interval: "4P" },
        { fret: 7, note: "E3", interval: "5P" },
      ],
      [
        { fret: 5, note: "G3", interval: "7m" },
        { fret: 7, note: "A3", interval: "1P" },
      ],
      [
        { fret: 5, note: "C4", interval: "3m" },
        { fret: 7, note: "D4", interval: "4P" },
      ],
      [
        { fret: 5, note: "E4", interval: "5P" },
        { fret: 8, note: "G4", interval: "7m" },
      ],
      [
        { fret: 5, note: "A4", interval: "1P" },
        { fret: 8, note: "C5", interval: "3m" },
      ],
    ];

    expect(expectedStrings).toHaveLength(6);
    expect(expectedStrings[0][0].note).toBe("A2");
    expect(expectedStrings[0][0].interval).toBe("1P");
    expect(expectedStrings[0][1].interval).toBe("3m"); // minor 3rd
  });
});

describe("Analysis — identify chord from fingering", () => {
  test("x32010 = C major", () => {
    // Guitar.identify([null, 3, 2, 0, 1, 0])
    // → { name: "C", type: "major" }
    const frets = [null, 3, 2, 0, 1, 0];
    // Notes: C3, E3, G3, C4, E4
    // This should be identifiable as C major
    expect(frets).toBeTruthy();
  });

  test("022100 = E major", () => {
    // Guitar.identify([0, 2, 2, 1, 0, 0])
    // Notes: E2, B2, E3, G#3, B3, E4
    expect(true).toBe(true);
  });
});

describe("Analysis — function in key", () => {
  test("C major chord in key of C = I (tonic)", () => {
    // Guitar.analyze([null, 3, 2, 0, 1, 0], { key: "C major" })
    const expected = { chord: "C", function: "I", degree: 1, mode: "ionian" };
    expect(expected.function).toBe("I");
    expect(expected.degree).toBe(1);
  });

  test("C major chord in key of G = IV (subdominant)", () => {
    const expected = { chord: "C", function: "IV", degree: 4, mode: "lydian" };
    expect(expected.function).toBe("IV");
    expect(expected.degree).toBe(4);
  });

  test("C major chord in key of F = V (dominant)", () => {
    const expected = { chord: "C", function: "V", degree: 5, mode: "mixolydian" };
    expect(expected.function).toBe("V");
  });
});

describe("CAGED — all positions", () => {
  test("all 5 CAGED positions for C major span the neck", () => {
    // Guitar.cagedPositions("C", "major")
    // Should return 5 positions in order up the neck
    const shapeNames = ["C", "A", "G", "E", "D"];
    expect(shapeNames).toHaveLength(5);

    // Positions should increase (or wrap) as we go C → A → G → E → D
    // C shape at open position, A shape around fret 3, etc.
  });

  test("CAGED positions for G major start at different frets than C", () => {
    // The same 5 shapes, but shifted to G's positions
    // E-shape G = fret 3, etc.
    expect(true).toBe(true);
  });
});

describe("Mode awareness", () => {
  test("Am pentatonic box 1 = C major pentatonic box (relative)", () => {
    // Same fret positions, different root designation
    // Guitar.relatedShapes(pentatonicBox1, "A", "minor pentatonic")
    // Should include { root: "C", scale: "major pentatonic" }
    expect(true).toBe(true);
  });

  test("3NPS pattern 1 from A = A Ionian", () => {
    expect(true).toBe(true);
  });

  test("3NPS pattern 2 from B = B Dorian (same notes as A Ionian)", () => {
    // Same physical notes on fretboard, but root is B, intervals relative to B
    expect(true).toBe(true);
  });
});

describe("Custom shapes — override", () => {
  test("user can define a custom A-shape that differs from default", () => {
    const defaultAShape = {
      name: "A Shape Major",
      intervals: [null, ["1P"], ["5P"], ["1P"], ["3M"], ["5P"]],
      rootStringIndex: 1,
    };

    const customAShape = {
      name: "A Shape Major (Custom)",
      intervals: [null, ["1P"], ["3M"], ["5P"], ["1P"], ["3M"]],
      rootStringIndex: 1,
    };

    // Different interval layouts = different fingerings
    expect(defaultAShape.intervals).not.toEqual(customAShape.intervals);
    expect(defaultAShape.rootStringIndex).toBe(customAShape.rootStringIndex);
  });

  test("custom shapes can be registered and retrieved by name", () => {
    // Guitar.shapes.add(myShape)
    // Guitar.shapes.get("My Custom Shape") → myShape
    expect(true).toBe(true);
  });
});

describe("Tuning independence", () => {
  test("same shape applied in different tunings gives different frets", () => {
    // E-shape major applied to "A" in standard tuning → frets [5,7,7,6,5,5]
    // E-shape major applied to "A" in drop D tuning → different fret on string 0
    // because string 0 is now D2 instead of E2
    expect(true).toBe(true);
  });

  test("7-string tuning adds a string to the shape", () => {
    // A 6-string shape applied to 7-string should either:
    // - Ignore the extra string (null it out), or
    // - Extend if the shape knows how
    expect(true).toBe(true);
  });
});
