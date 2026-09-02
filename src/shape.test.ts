/**
 * Tests for Task Group 1: VoicingFamily, VoicingPatternDictionary, and chordShapes.query
 * Also covers CR-038: registry hostile-key safety (Map-backed indices).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  chordShapes,
  get as getScale,
  add as addScale,
  all as allScales,
  names as namesScales,
  removeAll as removeAllScales,
  type VoicingFamily,
  type VoicingPatternDictionary,
  type ChordShape,
  type ScaleShape,
} from "./index";
// CagedPosition/ArpeggioShape/remove/arpeggioShapes are new in this task
// group and not yet wired through src/index.ts (that's a later group's
// §1.11 task) — import them directly from the source module.
import {
  remove as removeScale,
  arpeggioShapes,
  type CagedPosition,
  type ArpeggioShape,
} from "./shape";

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

// ============================================================
// Task Group 3.7: pre-existing registered shape names are unique.
// Placed early in the file, before any other describe block mutates the
// registries, so this observes the real seed data loaded by `import
// "./index"` above (later tests wipe the registries via removeAll()).
// ============================================================

describe("registered shape name uniqueness (Task Group 3.7)", () => {
  it("no two currently-registered scale shapes share a name", () => {
    expect(allScales().length).toBe(new Set(namesScales()).size);
  });

  it("no two currently-registered chord shapes share a name", () => {
    expect(chordShapes.all().length).toBe(new Set(chordShapes.names()).size);
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
      fingers: [[1], [], [2], [], [4], []],
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

// ============================================================
// Task Group 3: replace-on-same-name add(), remove(), arpeggioShapes
// ============================================================

describe("Scale shape registry — replace-on-add and remove (Task Group 3)", () => {
  afterEach(() => {
    removeAllScales();
  });

  it("add() with an already-registered name replaces the entry in place, preserving array position", () => {
    const first: ScaleShape = {
      name: "__test_replace_scale__",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
      quality: "v1",
    };
    const sibling: ScaleShape = {
      name: "__test_replace_scale_sibling__",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
    };
    addScale(first);
    addScale(sibling);
    const indexBefore = allScales().findIndex((s) => s.name === "__test_replace_scale__");

    const replacement: ScaleShape = {
      name: "__test_replace_scale__",
      system: "custom",
      strings: [["1P"], ["3M"]],
      rootString: 0,
      quality: "v2",
    };
    addScale(replacement);

    const after = allScales();
    // No duplicate/append: total count unchanged, same array slot.
    expect(after.filter((s) => s.name === "__test_replace_scale__")).toHaveLength(1);
    expect(after.findIndex((s) => s.name === "__test_replace_scale__")).toBe(indexBefore);
    expect(getScale("__test_replace_scale__")?.quality).toBe("v2");
    expect(getScale("__test_replace_scale__")).toEqual(replacement);
  });

  it("remove() deletes a registered scale shape and returns true", () => {
    const shape: ScaleShape = {
      name: "__test_remove_scale__",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
    };
    addScale(shape);
    expect(getScale("__test_remove_scale__")).toBeDefined();

    const removed = removeScale("__test_remove_scale__");

    expect(removed).toBe(true);
    expect(getScale("__test_remove_scale__")).toBeUndefined();
    expect(allScales().some((s) => s.name === "__test_remove_scale__")).toBe(false);
    expect(namesScales()).not.toContain("__test_remove_scale__");
  });

  it("remove() on a name that was never registered returns false and leaves the registry untouched", () => {
    const shape: ScaleShape = {
      name: "__test_remove_scale_untouched__",
      system: "custom",
      strings: [["1P"]],
      rootString: 0,
    };
    addScale(shape);
    const before = allScales().length;

    const removed = removeScale("__test_remove_scale_never_registered__");

    expect(removed).toBe(false);
    expect(allScales().length).toBe(before);
  });
});

describe("Chord shape registry — replace-on-add and remove (Task Group 3)", () => {
  afterEach(() => {
    chordShapes.removeAll();
  });

  const makeChord = (name: string, overrides: Partial<ChordShape> = {}): ChordShape => ({
    name,
    system: "custom",
    strings: ["1P", null, null, null, null, null],
    fingers: [1, null, null, null, null, null],
    barres: [],
    rootString: 0,
    ...overrides,
  });

  it("add() with an already-registered name replaces the entry in place, preserving array position", () => {
    const first = makeChord("__test_replace_chord__", { voicingFamily: "caged" });
    const sibling = makeChord("__test_replace_chord_sibling__");
    chordShapes.add(first);
    chordShapes.add(sibling);
    const indexBefore = chordShapes.all().findIndex((s) => s.name === "__test_replace_chord__");

    const replacement = makeChord("__test_replace_chord__", { voicingFamily: "shell", baseFret: 3 });
    chordShapes.add(replacement);

    const after = chordShapes.all();
    expect(after.filter((s) => s.name === "__test_replace_chord__")).toHaveLength(1);
    expect(after.findIndex((s) => s.name === "__test_replace_chord__")).toBe(indexBefore);
    expect(chordShapes.get("__test_replace_chord__")?.voicingFamily).toBe("shell");
    expect(chordShapes.get("__test_replace_chord__")).toEqual(replacement);
  });

  it("remove() deletes a registered chord shape and returns true", () => {
    const shape = makeChord("__test_remove_chord__");
    chordShapes.add(shape);
    expect(chordShapes.get("__test_remove_chord__")).toBeDefined();

    const removed = chordShapes.remove("__test_remove_chord__");

    expect(removed).toBe(true);
    expect(chordShapes.get("__test_remove_chord__")).toBeUndefined();
    expect(chordShapes.all().some((s) => s.name === "__test_remove_chord__")).toBe(false);
    expect(chordShapes.names()).not.toContain("__test_remove_chord__");
  });

  it("remove() on a name that was never registered returns false and leaves the registry untouched", () => {
    const shape = makeChord("__test_remove_chord_untouched__");
    chordShapes.add(shape);
    const before = chordShapes.all().length;

    const removed = chordShapes.remove("__test_remove_chord_never_registered__");

    expect(removed).toBe(false);
    expect(chordShapes.all().length).toBe(before);
  });
});

describe("arpeggioShapes registry — CRUD and query (Task Group 3)", () => {
  afterEach(() => {
    arpeggioShapes.removeAll();
  });

  const makeArpeggio = (name: string, overrides: Partial<ArpeggioShape> = {}): ArpeggioShape => ({
    name,
    system: "caged",
    strings: [["1P"], null, ["3m"], null, ["5P"], null],
    rootString: 0,
    chordType: "m7",
    ...overrides,
  });

  it("all() returns [] when nothing has been registered", () => {
    expect(arpeggioShapes.all()).toEqual([]);
  });

  it("add()/get()/names() round-trip a registered arpeggio shape", () => {
    const shape = makeArpeggio("__test_arp_roundtrip__", {
      cagedPosition: "E",
      chordShape: "E Shape m7",
      tags: ["core"],
    });
    arpeggioShapes.add(shape);

    expect(arpeggioShapes.get("__test_arp_roundtrip__")).toEqual(shape);
    expect(arpeggioShapes.all()).toContainEqual(shape);
    expect(arpeggioShapes.names()).toContain("__test_arp_roundtrip__");
  });

  it("add() with an already-registered name replaces in place, preserving array position", () => {
    const first = makeArpeggio("__test_arp_replace__");
    const sibling = makeArpeggio("__test_arp_replace_sibling__");
    arpeggioShapes.add(first);
    arpeggioShapes.add(sibling);
    const indexBefore = arpeggioShapes.all().findIndex((s) => s.name === "__test_arp_replace__");

    const replacement = makeArpeggio("__test_arp_replace__", { chordType: "7", tags: ["updated"] });
    arpeggioShapes.add(replacement);

    const after = arpeggioShapes.all();
    expect(after.filter((s) => s.name === "__test_arp_replace__")).toHaveLength(1);
    expect(after.findIndex((s) => s.name === "__test_arp_replace__")).toBe(indexBefore);
    expect(arpeggioShapes.get("__test_arp_replace__")?.chordType).toBe("7");
  });

  it("remove() deletes a registered arpeggio shape and returns true; unknown name returns false", () => {
    const shape = makeArpeggio("__test_arp_remove__");
    arpeggioShapes.add(shape);

    expect(arpeggioShapes.remove("__test_arp_remove__")).toBe(true);
    expect(arpeggioShapes.get("__test_arp_remove__")).toBeUndefined();
    expect(arpeggioShapes.all().some((s) => s.name === "__test_arp_remove__")).toBe(false);
    expect(arpeggioShapes.remove("__test_arp_never_registered__")).toBe(false);
  });

  it("removeAll() clears both the array and the index", () => {
    arpeggioShapes.add(makeArpeggio("__test_arp_wipe_a__"));
    arpeggioShapes.add(makeArpeggio("__test_arp_wipe_b__"));
    expect(arpeggioShapes.all().length).toBeGreaterThan(0);

    arpeggioShapes.removeAll();

    expect(arpeggioShapes.all()).toEqual([]);
    expect(arpeggioShapes.names()).toEqual([]);
    expect(arpeggioShapes.get("__test_arp_wipe_a__")).toBeUndefined();
  });

  it("query() exercises every filter key, including tag-superset matching", () => {
    const eShapeM7 = makeArpeggio("__test_arp_query_e_m7__", {
      chordType: "m7",
      system: "caged",
      cagedPosition: "E",
      chordShape: "E Shape m7",
      tags: ["core", "beginner"],
    });
    const aShapeM7 = makeArpeggio("__test_arp_query_a_m7__", {
      chordType: "m7",
      system: "caged",
      cagedPosition: "A",
      chordShape: "A Shape m7",
      tags: ["core"],
    });
    const eShape7Override = makeArpeggio("__test_arp_query_e_7_override__", {
      chordType: "7",
      system: "caged",
      cagedPosition: "E",
      chordShape: "E Shape 7",
      tags: ["teacher"],
      overrides: "__test_arp_query_e_7_core__",
    });
    const threeNpsM7 = makeArpeggio("__test_arp_query_3nps_m7__", {
      chordType: "m7",
      system: "3nps",
      tags: ["core", "advanced"],
    });
    arpeggioShapes.add(eShapeM7);
    arpeggioShapes.add(aShapeM7);
    arpeggioShapes.add(eShape7Override);
    arpeggioShapes.add(threeNpsM7);

    // chordType
    expect(arpeggioShapes.query({ chordType: "m7" }).map((s) => s.name).sort()).toEqual(
      [eShapeM7.name, aShapeM7.name, threeNpsM7.name].sort(),
    );

    // system
    expect(arpeggioShapes.query({ system: "3nps" })).toEqual([threeNpsM7]);

    // cagedPosition
    expect(arpeggioShapes.query({ cagedPosition: "E" }).map((s) => s.name).sort()).toEqual(
      [eShapeM7.name, eShape7Override.name].sort(),
    );

    // chordShape
    expect(arpeggioShapes.query({ chordShape: "A Shape m7" })).toEqual([aShapeM7]);

    // overrides
    expect(arpeggioShapes.query({ overrides: "__test_arp_query_e_7_core__" })).toEqual([eShape7Override]);

    // tags — superset match: shape must carry every requested tag.
    expect(arpeggioShapes.query({ tags: ["core"] }).map((s) => s.name).sort()).toEqual(
      [eShapeM7.name, aShapeM7.name, threeNpsM7.name].sort(),
    );
    expect(arpeggioShapes.query({ tags: ["core", "beginner"] })).toEqual([eShapeM7]);
    expect(arpeggioShapes.query({ tags: ["core", "expert-does-not-exist"] })).toEqual([]);

    // conjunctive across multiple keys
    expect(
      arpeggioShapes.query({ chordType: "m7", system: "caged", cagedPosition: "E" }),
    ).toEqual([eShapeM7]);

    // no matches
    expect(arpeggioShapes.query({ chordType: "dim7" })).toEqual([]);
  });
});

// ============================================================
// Task Group 5: Shape Identity & Geometry Helpers (spec §1.8, D-010)
//
// These helpers are not yet re-exported from ./index (that's Group 12's
// §1.11 task) — import them directly from ./shape, same convention as the
// CagedPosition/ArpeggioShape imports above.
// ============================================================
import {
  isMovable,
  playedStringSet,
  impliedStringSet,
  gripBaseFret,
  absoluteBarreFret,
  sourceGripBaseFret,
  exportIdentifierFor,
  type Barre,
} from "./shape";

describe("isMovable (spec §1.8): movable ?? canonicalRoot === undefined", () => {
  const canonicalRootShape: ChordShape = {
    name: "__test_canonical_root_shape__",
    system: "open",
    strings: [null, "1P", "3M", "5P", "1P", "3M"],
    fingers: [null, 3, 2, 0, 1, 0],
    barres: [],
    rootString: 1,
    canonicalRoot: "C",
  };

  const movableNoRootShape: ChordShape = {
    name: "__test_movable_no_root_shape__",
    system: "barre",
    strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
    rootString: 0,
  };

  it("defaults to false for a shape with a canonicalRoot", () => {
    expect(isMovable(canonicalRootShape)).toBe(false);
  });

  it("defaults to true for a shape with no canonicalRoot", () => {
    expect(isMovable(movableNoRootShape)).toBe(true);
  });

  it("explicit movable: true overrides a set canonicalRoot", () => {
    expect(isMovable({ ...canonicalRootShape, movable: true })).toBe(true);
  });

  it("explicit movable: false overrides the no-canonicalRoot default", () => {
    expect(isMovable({ ...movableNoRootShape, movable: false })).toBe(false);
  });
});

describe("playedStringSet / impliedStringSet (spec §1.8)", () => {
  const shapeWithExplicitStringSet: ChordShape = {
    name: "__test_explicit_stringset__",
    system: "open",
    strings: [null, "1P", "3M", "5P", "1P", "3M"],
    fingers: [null, 3, 2, 0, 1, 0],
    barres: [],
    rootString: 1,
    // Deliberately mismatched vs. the played indices [1,2,3,4,5], so the
    // test can tell impliedStringSet actually returns the explicit value
    // rather than silently recomputing it.
    stringSet: [1, 2, 3],
  };

  const shapeWithoutStringSet: ChordShape = {
    name: "__test_no_stringset__",
    system: "barre",
    strings: [null, null, "1P", "3M", "5P", null],
    fingers: [null, null, 1, 2, 3, null],
    barres: [],
    rootString: 2,
  };

  it("playedStringSet returns the indices where strings[i] != null", () => {
    expect(playedStringSet(shapeWithExplicitStringSet)).toEqual([1, 2, 3, 4, 5]);
    expect(playedStringSet(shapeWithoutStringSet)).toEqual([2, 3, 4]);
  });

  it("impliedStringSet returns shape.stringSet when present, even if it diverges from playedStringSet", () => {
    expect(impliedStringSet(shapeWithExplicitStringSet)).toEqual([1, 2, 3]);
  });

  it("impliedStringSet falls back to playedStringSet when stringSet is absent", () => {
    expect(impliedStringSet(shapeWithoutStringSet)).toEqual(
      playedStringSet(shapeWithoutStringSet),
    );
    expect(impliedStringSet(shapeWithoutStringSet)).toEqual([2, 3, 4]);
  });
});

describe("gripBaseFret (spec §1.8, D-010): min non-null, non-zero fret; 0 if none", () => {
  it("ignores open strings (0) and picks the lowest fretted fret", () => {
    // "A Major Open" (x02220): open strings at 0, fretted at 2.
    expect(gripBaseFret([null, 0, 2, 2, 2, 0])).toBe(2);
  });

  it("ignores muted strings (null)", () => {
    expect(gripBaseFret([null, null, 3, 5, 5, 4])).toBe(3);
  });

  it("returns 0 when every string is open or muted (no fretted strings)", () => {
    expect(gripBaseFret([null, 0, 0, 0, null, 0])).toBe(0);
  });

  it("returns 0 for an all-muted array", () => {
    expect(gripBaseFret([null, null, null, null, null, null])).toBe(0);
  });

  it("picks the minimum across multiple fretted strings", () => {
    expect(gripBaseFret([3, 5, 5, 4, 3, 3])).toBe(3);
  });
});

describe("absoluteBarreFret / sourceGripBaseFret (spec §1.8, D-010)", () => {
  const barre: Barre = { fret: 2, fromString: 1, toString: 4, finger: 1 };

  it("absoluteBarreFret adds the offset to the grip base", () => {
    expect(absoluteBarreFret(barre, 3)).toBe(5);
    expect(absoluteBarreFret({ ...barre, fret: 0 }, 1)).toBe(1);
  });

  it("sourceGripBaseFret mirrors gripBaseFret over a shape's source-diagram frets", () => {
    const shape: ChordShape = {
      name: "__test_source_grip_base__",
      system: "open",
      strings: [null, "1P", "3M", "5P", "1P", "3M"],
      fingers: [null, 3, 2, 0, 1, 0],
      barres: [],
      rootString: 1,
      canonicalRoot: "C",
      baseFret: 1,
    };
    // Source diagram for "C Major Open" (x32010): frets 3,2,0,1,0.
    const sourceFrets: (number | null)[] = [null, 3, 2, 0, 1, 0];
    expect(sourceGripBaseFret(shape, sourceFrets)).toBe(1);
    expect(sourceGripBaseFret(shape, sourceFrets)).toBe(gripBaseFret(sourceFrets));
  });

  it("composes end-to-end: absoluteBarreFret(barre, sourceGripBaseFret(...)) resolves a movable barre form", () => {
    // "E Form Major Barre": barre.fret is already an offset (0) from the
    // grip base — the D-010 trap a blanket `fret - baseFret` transform
    // would get wrong (see spec §4.1).
    const movableBarre: Barre = { fret: 0, fromString: 0, toString: 5, finger: 1 };
    const shape: ChordShape = {
      name: "__test_movable_barre_source__",
      system: "barre",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [movableBarre],
      rootString: 0,
      baseFret: 1,
    };
    const sourceFrets: (number | null)[] = [1, 3, 3, 2, 1, 1];
    const base = sourceGripBaseFret(shape, sourceFrets);
    expect(base).toBe(1);
    expect(absoluteBarreFret(movableBarre, base)).toBe(1);
  });
});

describe("exportIdentifierFor (spec §1.8): deterministic <KIND_PREFIX>_<NAME_UPPER_SNAKE>", () => {
  it("produces the CHORD_E_SHAPE_MINOR-style identifier, never the CAGED_CHORD_EM-style shorthand", () => {
    expect(exportIdentifierFor("chord", { name: "E Shape Minor" })).toBe(
      "CHORD_E_SHAPE_MINOR",
    );
  });

  it("prefixes by kind", () => {
    expect(exportIdentifierFor("scale", { name: "G Shape" })).toBe("SCALE_G_SHAPE");
    expect(exportIdentifierFor("arpeggio", { name: "E Shape m7" })).toBe(
      "ARPEGGIO_E_SHAPE_M7",
    );
  });

  it("collapses non-alphanumeric runs (spaces, punctuation) to single underscores", () => {
    expect(exportIdentifierFor("chord", { name: "C#/Db Sus2 (Open)" })).toBe(
      "CHORD_C_DB_SUS2_OPEN",
    );
  });

  it("is deterministic — same input always yields the same identifier", () => {
    const shape = { name: "A Form 7 Barre" };
    expect(exportIdentifierFor("chord", shape)).toBe(exportIdentifierFor("chord", shape));
  });

  it("never collides two distinct shape names it is exercised against here", () => {
    const names = [
      "E Shape Minor",
      "E Shape Major",
      "A Form 7 Barre",
      "A Form Major Barre",
      "C Major Open",
      "C Minor Open",
      "G Shape",
      "G Shape Minor",
      "Shell m7 E-root",
      "Shell m7 A-root",
    ];
    const identifiers = names.map((name) => exportIdentifierFor("chord", { name }));
    expect(new Set(identifiers).size).toBe(names.length);
  });
});

// ============================================================
// Task Group 4: Arpeggio Resolver Layer (spec §1.7, D-011)
//
// Not yet re-exported from ./index (Group 12's §1.11 task) — import
// directly from ./shape, same convention as the imports above.
// ============================================================
import {
  arpeggioSlotKey,
  slotForChordShape,
  resolveArpeggioForSlot,
  visibleArpeggios,
  type ArpeggioSlot,
} from "./shape";

describe("arpeggioSlotKey (Task Group 4)", () => {
  const baseSlot: ArpeggioSlot = {
    chordType: "m7",
    cagedPosition: "E",
    system: "caged",
    rootString: 0,
  };

  it("is deterministic for identical inputs", () => {
    expect(arpeggioSlotKey(baseSlot)).toBe(arpeggioSlotKey({ ...baseSlot }));
  });

  it("uses the exact `${system ?? \"*\"}|${chordType}|${cagedPosition ?? \"*\"}|${rootString}` format", () => {
    expect(arpeggioSlotKey(baseSlot)).toBe("caged|m7|E|0");
  });

  it("defaults an absent system to \"*\"", () => {
    expect(arpeggioSlotKey({ chordType: "m7", cagedPosition: "E", rootString: 0 })).toBe(
      "*|m7|E|0",
    );
  });

  it("defaults an absent cagedPosition to \"*\"", () => {
    expect(arpeggioSlotKey({ chordType: "m7", system: "caged", rootString: 0 })).toBe(
      "caged|m7|*|0",
    );
  });

  it("ignores chordShapeName — it is descriptive only, never part of the key", () => {
    expect(arpeggioSlotKey({ ...baseSlot, chordShapeName: "E Shape m7" })).toBe(
      arpeggioSlotKey(baseSlot),
    );
  });

  it("is distinct across chordType variations", () => {
    expect(arpeggioSlotKey({ ...baseSlot, chordType: "7" })).not.toBe(arpeggioSlotKey(baseSlot));
  });

  it("is distinct across cagedPosition variations", () => {
    expect(arpeggioSlotKey({ ...baseSlot, cagedPosition: "A" })).not.toBe(
      arpeggioSlotKey(baseSlot),
    );
  });

  it("is distinct across system variations", () => {
    expect(arpeggioSlotKey({ ...baseSlot, system: "3nps" })).not.toBe(arpeggioSlotKey(baseSlot));
  });

  it("is distinct across rootString variations", () => {
    expect(arpeggioSlotKey({ ...baseSlot, rootString: 1 })).not.toBe(arpeggioSlotKey(baseSlot));
  });
});

describe("slotForChordShape (Task Group 4)", () => {
  it("derives chordType, cagedPosition, system, rootString, and chordShapeName from the chord shape", () => {
    const chord: ChordShape = {
      name: "E Shape m7",
      system: "caged",
      strings: ["1P", "5P", null, "3m", "5P", "1P"],
      fingers: [null, null, null, 2, 3, 1],
      barres: [],
      rootString: 0,
      chordType: "m7",
      cagedPosition: "E",
    };
    expect(slotForChordShape(chord)).toEqual({
      chordType: "m7",
      cagedPosition: "E",
      system: "caged",
      rootString: 0,
      chordShapeName: "E Shape m7",
    });
  });

  it("defaults chordType to \"\" when the chord shape has none", () => {
    const chord: ChordShape = {
      name: "Untyped Shape",
      system: "caged",
      strings: ["1P"],
      fingers: [null],
      barres: [],
      rootString: 0,
    };
    expect(slotForChordShape(chord).chordType).toBe("");
  });
});

describe("resolveArpeggioForSlot (Task Group 4)", () => {
  afterEach(() => {
    arpeggioShapes.removeAll();
  });

  const makeArpeggio = (name: string, overrides: Partial<ArpeggioShape> = {}): ArpeggioShape => ({
    name,
    system: "caged",
    strings: [["1P"], null, ["3m"], null, ["5P"], null],
    rootString: 0,
    chordType: "m7",
    cagedPosition: "E",
    ...overrides,
  });

  const slot: ArpeggioSlot = {
    chordType: "m7",
    cagedPosition: "E",
    system: "caged",
    rootString: 0,
  };

  it("resolves to \"derived\" with no shape when nothing is registered for the slot", () => {
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("derived");
    expect(resolution.shape).toBeUndefined();
    expect(resolution.core).toBeUndefined();
    expect(resolution.alternatives).toEqual([]);
    expect(resolution.slotKey).toBe(arpeggioSlotKey(slot));
  });

  it("resolves to \"derived\" when a registered shape sits in a different slot", () => {
    arpeggioShapes.add(makeArpeggio("__tg4_other_slot__", { cagedPosition: "A" }));
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("derived");
    expect(resolution.shape).toBeUndefined();
  });

  it("resolves to \"core\" (first registered) when one plain candidate is registered", () => {
    const core = makeArpeggio("__tg4_core__");
    arpeggioShapes.add(core);
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("core");
    expect(resolution.shape).toEqual(core);
    expect(resolution.alternatives).toEqual([]);
  });

  it("prefers featured === true over first-registered among plain candidates", () => {
    const first = makeArpeggio("__tg4_core_first__");
    const featured = makeArpeggio("__tg4_core_featured__", { featured: true });
    arpeggioShapes.add(first);
    arpeggioShapes.add(featured);
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("core");
    expect(resolution.shape).toEqual(featured);
  });

  it("falls back to first-registered when no plain candidate is featured", () => {
    const first = makeArpeggio("__tg4_core_first2__");
    const second = makeArpeggio("__tg4_core_second2__");
    arpeggioShapes.add(first);
    arpeggioShapes.add(second);
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("core");
    expect(resolution.shape).toEqual(first);
  });

  it("resolves to \"override\" and exposes the reachable core when a single override targets the slot", () => {
    const core = makeArpeggio("__tg4_core_ov__");
    const override = makeArpeggio("__tg4_override__", { overrides: "__tg4_core_ov__" });
    arpeggioShapes.add(core);
    arpeggioShapes.add(override);
    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("override");
    expect(resolution.shape).toEqual(override);
    expect(resolution.core).toEqual(core);
    expect(resolution.alternatives).toEqual([]);
  });

  it("picks the last-registered override deterministically, with the rest in alternatives", () => {
    const core = makeArpeggio("__tg4_core_multi__");
    const overrideA = makeArpeggio("__tg4_override_a__", { overrides: "__tg4_core_multi__" });
    const overrideB = makeArpeggio("__tg4_override_b__", { overrides: "__tg4_core_multi__" });
    const overrideC = makeArpeggio("__tg4_override_c__", { overrides: "__tg4_core_multi__" });
    arpeggioShapes.add(core);
    arpeggioShapes.add(overrideA);
    arpeggioShapes.add(overrideB);
    arpeggioShapes.add(overrideC);

    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("override");
    expect(resolution.shape).toEqual(overrideC);
    expect(resolution.core).toEqual(core);
    expect(resolution.alternatives).toEqual([overrideA, overrideB]);
  });

  it("does not treat a shape as an override when its `overrides` target is in a different slot", () => {
    const outOfSlotCore = makeArpeggio("__tg4_wrong_slot_core__", { cagedPosition: "A" });
    const notReallyAnOverride = makeArpeggio("__tg4_not_override__", {
      overrides: "__tg4_wrong_slot_core__",
    });
    arpeggioShapes.add(outOfSlotCore);
    arpeggioShapes.add(notReallyAnOverride);

    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("core");
    expect(resolution.shape).toEqual(notReallyAnOverride);
  });

  it("does not treat a shape as an override when its `overrides` target is unregistered", () => {
    const dangling = makeArpeggio("__tg4_dangling_override__", { overrides: "__no_such_shape__" });
    arpeggioShapes.add(dangling);

    const resolution = resolveArpeggioForSlot(slot);
    expect(resolution.tier).toBe("core");
    expect(resolution.shape).toEqual(dangling);
  });
});

describe("visibleArpeggios (Task Group 4)", () => {
  afterEach(() => {
    arpeggioShapes.removeAll();
  });

  const makeArpeggio = (name: string, overrides: Partial<ArpeggioShape> = {}): ArpeggioShape => ({
    name,
    system: "caged",
    strings: [["1P"], null, ["3m"], null, ["5P"], null],
    rootString: 0,
    chordType: "m7",
    ...overrides,
  });

  it("excludes shapes that are the `overrides` target of another registered shape by default", () => {
    const core = makeArpeggio("__tg4_visible_core__");
    const override = makeArpeggio("__tg4_visible_override__", { overrides: "__tg4_visible_core__" });
    const untouched = makeArpeggio("__tg4_visible_untouched__");
    arpeggioShapes.add(core);
    arpeggioShapes.add(override);
    arpeggioShapes.add(untouched);

    const names = visibleArpeggios()
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(["__tg4_visible_override__", "__tg4_visible_untouched__"].sort());
  });

  it("includes overridden shapes when includeOverridden: true", () => {
    const core = makeArpeggio("__tg4_visible_core2__");
    const override = makeArpeggio("__tg4_visible_override2__", {
      overrides: "__tg4_visible_core2__",
    });
    arpeggioShapes.add(core);
    arpeggioShapes.add(override);

    const names = visibleArpeggios({ includeOverridden: true })
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(["__tg4_visible_core2__", "__tg4_visible_override2__"].sort());
  });

  it("returns [] when nothing is registered", () => {
    expect(visibleArpeggios()).toEqual([]);
  });
});
