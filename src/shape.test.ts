/**
 * Tests for Task Group 1: VoicingFamily, VoicingPatternDictionary, and chordShapes.query
 * Also covers CR-038: registry hostile-key safety (Map-backed indices).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  chordShapes,
  get as getScale,
  add as addScale,
  removeAll as removeAllScales,
  type VoicingFamily,
  type VoicingPatternDictionary,
  type ChordShape,
  type ScaleShape,
} from "./index";
// CagedPosition/ArpeggioShape are new in this task group and not yet wired
// through src/index.ts (that's a later group's §1.11 task) — import them
// directly from the source module.
import type { CagedPosition, ArpeggioShape } from "./shape";

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

// ============================================================
// `featured` metadata field (shape-detail-panel Task Group 1)
// ============================================================

describe("featured metadata field", () => {
  afterEach(() => {
    removeAllScales();
    chordShapes.removeAll();
  });

  it("chordShapes.add()/get() round-trip a featured: true entry unchanged", () => {
    const shape: ChordShape = {
      name: "__test_featured_chord__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
      featured: true,
    };
    chordShapes.add(shape);
    const retrieved = chordShapes.get("__test_featured_chord__");
    expect(retrieved?.featured).toBe(true);
    expect(retrieved).toEqual(shape);
  });

  it("chordShapes.add()/get() round-trip a shape with featured omitted as undefined", () => {
    const shape: ChordShape = {
      name: "__test_unfeatured_chord__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
    };
    chordShapes.add(shape);
    expect(chordShapes.get("__test_unfeatured_chord__")?.featured).toBeUndefined();
  });

  it("add()/get() round-trip a featured: true scale shape unchanged", () => {
    const shape: ScaleShape = {
      name: "__test_featured_scale__",
      system: "caged",
      strings: [["1P"], ["3M"], null, null, null, null],
      rootString: 0,
      featured: true,
    };
    addScale(shape);
    const retrieved = getScale("__test_featured_scale__");
    expect(retrieved?.featured).toBe(true);
    expect(retrieved).toEqual(shape);
  });

  it("add()/get() round-trip a scale shape with featured omitted as undefined", () => {
    const shape: ScaleShape = {
      name: "__test_unfeatured_scale__",
      system: "caged",
      strings: [["1P"], ["3M"], null, null, null, null],
      rootString: 0,
    };
    addScale(shape);
    expect(getScale("__test_unfeatured_scale__")?.featured).toBeUndefined();
  });
});

// ============================================================
// CR-038: Registry hostile-key safety (Map-backed indices)
// ============================================================

describe("Scale shape registry — hostile key safety (CR-038)", () => {
  const hostileNames = ["__proto__", "constructor", "hasOwnProperty", "toString"];

  afterEach(() => {
    removeAllScales();
  });

  for (const hostileName of hostileNames) {
    it(`add/get round-trips correctly for hostile name "${hostileName}"`, () => {
      const shape: ScaleShape = {
        name: hostileName,
        system: "custom",
        strings: [["1P"]],
        rootString: 0,
      };
      addScale(shape);
      const retrieved = getScale(hostileName);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(hostileName);
    });
  }

  it("normal names still work alongside hostile names", () => {
    const hostile: ScaleShape = {
      name: "__proto__",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
    };
    const normal: ScaleShape = {
      name: "test-normal-shape",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
    };
    addScale(hostile);
    addScale(normal);
    expect(getScale("__proto__")?.name).toBe("__proto__");
    expect(getScale("test-normal-shape")?.name).toBe("test-normal-shape");
  });
});

describe("Chord shape registry — hostile key safety (CR-038)", () => {
  const makeChord = (name: string): ChordShape => ({
    name,
    system: "custom",
    strings: ["1P", null, null, null, null, null],
    fingers: [1, null, null, null, null, null],
    barres: [],
    rootString: 0,
  });

  afterEach(() => {
    chordShapes.removeAll();
  });

  it('add/get round-trips for hostile name "__proto__"', () => {
    const shape = makeChord("__proto__");
    chordShapes.add(shape);
    const retrieved = chordShapes.get("__proto__");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("__proto__");
  });

  it('add/get round-trips for hostile name "constructor"', () => {
    const shape = makeChord("constructor");
    chordShapes.add(shape);
    const retrieved = chordShapes.get("constructor");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("constructor");
  });
});

// ============================================================
// shape-workbench Task Group 2: additive data-model fields
// ============================================================

describe("shape-workbench additive fields (Task Group 2)", () => {
  afterEach(() => {
    removeAllScales();
    chordShapes.removeAll();
  });

  it("VoicingFamily accepts 'triad' (compile-time check)", () => {
    const family: VoicingFamily = "triad";
    expect(family).toBe("triad");
  });

  it("CagedPosition accepts each of the five letters (compile-time check)", () => {
    const positions: CagedPosition[] = ["C", "A", "G", "E", "D"];
    expect(positions).toHaveLength(5);
  });

  it("ChordShape accepts and round-trips all shape-workbench optional fields", () => {
    // Compile-time check: every new field is assignable on the object literal.
    const shape: ChordShape = {
      name: "__test_workbench_chord__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
      cagedPosition: "E",
      movable: true,
      parentShape: "E Shape Major",
      tags: ["core", "beginner"],
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      overrides: "E Shape Minor (legacy)",
      notes: "Standard E-shape minor barre grip.",
    };
    chordShapes.add(shape);
    const retrieved = chordShapes.get("__test_workbench_chord__");
    expect(retrieved).toEqual(shape);
    expect(retrieved?.cagedPosition).toBe("E");
    expect(retrieved?.movable).toBe(true);
    expect(retrieved?.parentShape).toBe("E Shape Major");
    expect(retrieved?.tags).toEqual(["core", "beginner"]);
    expect(retrieved?.tuning).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
    expect(retrieved?.overrides).toBe("E Shape Minor (legacy)");
    expect(retrieved?.notes).toBe("Standard E-shape minor barre grip.");
  });

  it("ChordShape still accepts a minimal literal with none of the new fields set (additive-only)", () => {
    const shape: ChordShape = {
      name: "__test_minimal_workbench_chord__",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
    };
    expect(shape.cagedPosition).toBeUndefined();
    expect(shape.movable).toBeUndefined();
    expect(shape.tags).toBeUndefined();
    expect(shape.tuning).toBeUndefined();
    expect(shape.overrides).toBeUndefined();
    expect(shape.notes).toBeUndefined();
  });

  it("ScaleShape accepts and round-trips all shape-workbench optional fields", () => {
    const shape: ScaleShape = {
      name: "__test_workbench_scale__",
      system: "caged",
      strings: [["1P"], ["3M"], null, null, null, null],
      rootString: 0,
      cagedPosition: "G",
      chordType: "maj7",
      tags: ["core", "jazz"],
      tuning: ["D2", "A2", "D3", "G3", "B3", "D4"],
      overrides: "G Shape Major7 (legacy)",
      notes: "Extended G-shape box.",
    };
    addScale(shape);
    const retrieved = getScale("__test_workbench_scale__");
    expect(retrieved).toEqual(shape);
    expect(retrieved?.cagedPosition).toBe("G");
    expect(retrieved?.chordType).toBe("maj7");
    expect(retrieved?.tags).toEqual(["core", "jazz"]);
    expect(retrieved?.tuning).toEqual(["D2", "A2", "D3", "G3", "B3", "D4"]);
    expect(retrieved?.overrides).toBe("G Shape Major7 (legacy)");
    expect(retrieved?.notes).toBe("Extended G-shape box.");
  });

  it("ScaleShape still accepts a minimal literal with none of the new fields set (additive-only)", () => {
    const shape: ScaleShape = {
      name: "__test_minimal_workbench_scale__",
      system: "caged",
      strings: [["1P"], ["3M"], null, null, null, null],
      rootString: 0,
    };
    expect(shape.cagedPosition).toBeUndefined();
    expect(shape.chordType).toBeUndefined();
    expect(shape.tags).toBeUndefined();
    expect(shape.tuning).toBeUndefined();
    expect(shape.overrides).toBeUndefined();
    expect(shape.notes).toBeUndefined();
  });

  it("ArpeggioShape requires chordType and structurally satisfies ScaleShape (compile-time check)", () => {
    const arpeggio = {
      name: "__test_arpeggio__",
      system: "caged",
      strings: [["1P"], null, ["3m"], null, ["5P"], null],
      rootString: 0,
      chordType: "m7",
      fingers: [[1], null, [2], null, [4], null],
      chordShape: "E Shape m7",
      cagedPosition: "E",
      overrides: "E Shape m7 Arpeggio (legacy)",
    } satisfies ArpeggioShape;

    // An ArpeggioShape is structurally a ScaleShape — this assignment must
    // type-check with no cast.
    const asScaleShape: ScaleShape = arpeggio;

    expect(arpeggio.chordType).toBe("m7");
    expect(asScaleShape.name).toBe("__test_arpeggio__");
  });
});
