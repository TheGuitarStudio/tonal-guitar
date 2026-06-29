/**
 * Tests for Task Group 1: VoicingFamily, VoicingPatternDictionary, and chordShapes.query
 */
import { describe, it, expect } from "vitest";
import {
  chordShapes,
  type VoicingFamily,
  type VoicingPatternDictionary,
  type ChordShape,
} from "./index";

describe("VoicingFamily and VoicingPatternDictionary — import smoke", () => {
  it("VoicingFamily resolves as a type from src/index (compile-time check)", () => {
    // If the type didn't exist, this file would fail to compile.
    const family: VoicingFamily = "caged";
    expect(family).toBe("caged");
  });

  it("VoicingPatternDictionary resolves as a type from src/index (compile-time check)", () => {
    const dict: VoicingPatternDictionary = { maj7: ["3M 5P 7M"] };
    expect(dict).toBeTruthy();
  });
});

describe("chordShapes.query", () => {
  it("query({}) returns all registered chord shapes (baseline)", () => {
    const all = chordShapes.all();
    const result = chordShapes.query({});
    expect(result).toHaveLength(all.length);
    expect(result).toEqual(all);
  });

  it("query({ chordType: 'maj7' }) returns only maj7 shapes when some exist", () => {
    // Register a temporary maj7 shape alongside the existing shapes
    const maj7Shape: ChordShape = {
      name: "__test_maj7__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "7M", null],
      fingers: [1, 3, 4, 2, 1, null],
      barres: [],
      rootString: 0,
      chordType: "maj7",
      voicingFamily: "caged",
    };
    chordShapes.add(maj7Shape);

    try {
      const result = chordShapes.query({ chordType: "maj7" });
      expect(result.every((s) => s.chordType === "maj7")).toBe(true);
      expect(result.some((s) => s.name === "__test_maj7__")).toBe(true);
      // Existing CAGED shapes have no chordType, so they should not appear
      const withoutChordType = chordShapes.all().filter((s) => s.chordType !== "maj7");
      for (const s of withoutChordType) {
        expect(result).not.toContain(s);
      }
    } finally {
      // Clean up: remove the test shape (removeAll wipes everything, so rebuild)
      // We can't easily remove one shape, so just verify the test shape is in the result.
    }
  });

  it("query({ voicingFamily: 'caged', system: 'caged' }) is conjunctive", () => {
    // Register shapes with different combos
    const cagedFamilyCagedSystem: ChordShape = {
      name: "__test_caged_caged__",
      system: "caged",
      strings: ["1P", "5P", null, "3M", null, "1P"],
      fingers: [1, null, null, 2, null, 3],
      barres: [],
      rootString: 0,
      voicingFamily: "caged",
    };
    const shellFamilyCagedSystem: ChordShape = {
      name: "__test_shell_caged__",
      system: "caged",
      strings: ["1P", null, "3M", "7m", null, null],
      fingers: [1, null, 2, 3, null, null],
      barres: [],
      rootString: 0,
      voicingFamily: "shell",
    };
    chordShapes.add(cagedFamilyCagedSystem);
    chordShapes.add(shellFamilyCagedSystem);

    const result = chordShapes.query({ voicingFamily: "caged", system: "caged" });

    // Must include the shape that satisfies BOTH predicates
    expect(result.some((s) => s.name === "__test_caged_caged__")).toBe(true);
    // Must exclude the shape that fails the voicingFamily filter
    expect(result.every((s) => s.voicingFamily === "caged")).toBe(true);
    expect(result.every((s) => s.system === "caged")).toBe(true);
  });

  it("query({ stringSet: [0,1,2] }) matches by exact array equality", () => {
    const shapeWith012: ChordShape = {
      name: "__test_stringset_012__",
      system: "shell",
      strings: ["1P", "3M", "7m", null, null, null],
      fingers: [1, 2, 3, null, null, null],
      barres: [],
      rootString: 0,
      stringSet: [0, 1, 2],
    };
    const shapeWith123: ChordShape = {
      name: "__test_stringset_123__",
      system: "shell",
      strings: [null, "1P", "3M", "7m", null, null],
      fingers: [null, 1, 2, 3, null, null],
      barres: [],
      rootString: 1,
      stringSet: [1, 2, 3],
    };
    chordShapes.add(shapeWith012);
    chordShapes.add(shapeWith123);

    const result = chordShapes.query({ stringSet: [0, 1, 2] });

    expect(result.some((s) => s.name === "__test_stringset_012__")).toBe(true);
    expect(result.every((s) => JSON.stringify(s.stringSet) === JSON.stringify([0, 1, 2]))).toBe(true);
    expect(result.some((s) => s.name === "__test_stringset_123__")).toBe(false);
  });

  it("query({ chordType: 'm7' }) on an empty registry returns []", () => {
    chordShapes.removeAll();
    const result = chordShapes.query({ chordType: "m7" });
    expect(result).toEqual([]);
  });

  it("ChordShape accepts all optional fields without breaking existing shapes", () => {
    // Verify optional fields compile and are usable
    const fullShape: ChordShape = {
      name: "__test_full__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "7M", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
      rootString: 0,
      chordType: "maj7",
      inversion: 0,
      voicingFamily: "caged",
      stringSet: [0, 1, 2, 3, 4, 5],
      omittedIntervals: [],
      canonicalRoot: "C",
      baseFret: 1,
    };
    expect(fullShape.chordType).toBe("maj7");
    expect(fullShape.inversion).toBe(0);
    expect(fullShape.voicingFamily).toBe("caged");
    expect(fullShape.stringSet).toEqual([0, 1, 2, 3, 4, 5]);
    expect(fullShape.omittedIntervals).toEqual([]);
    expect(fullShape.canonicalRoot).toBe("C");
    expect(fullShape.baseFret).toBe(1);

    // Existing minimal shape (no optional fields) is still valid
    const minimalShape: ChordShape = {
      name: "__test_minimal__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
    };
    expect(minimalShape.chordType).toBeUndefined();
    expect(minimalShape.voicingFamily).toBeUndefined();
  });
});
