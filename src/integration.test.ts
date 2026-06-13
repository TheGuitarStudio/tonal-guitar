/**
 * Tests for arpeggioFromScale, arpeggioFromShape (TG5), and inferShapeContext (TG6).
 * Task Groups 5 & 6 — spec §A.2, §B, R-3.1, R-3.2
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chroma } from "@tonaljs/note";

import { CAGED_G, CAGED_E, CAGED_A, CAGED_C, CAGED_D } from "./data/caged-scales";
import { NPS_PATTERN_1, NPS_PATTERN_2, NPS_PATTERN_3, NPS_PATTERN_4, NPS_PATTERN_5, NPS_PATTERN_6, NPS_PATTERN_7 } from "./data/three-nps";
import { PENTA_BOX_1, PENTA_BOX_2, PENTA_BOX_3, PENTA_BOX_4, PENTA_BOX_5 } from "./data/pentatonic";
import { buildFrettedScale } from "./build";
import { NoFrettedScale, type ScaleShape, add, removeAll } from "./shape";
import { arpeggioFromScale, arpeggioFromShape, inferShapeContext } from "./integration";
import { walkShapeMotif } from "./walker";
import { STANDARD } from "./tuning";

// Side-effect imports to register shapes at module load time (used by TG5 tests)
import "./data/caged-scales";
import "./data/three-nps";

// ---------------------------------------------------------------------------
// Fixture (a): Am7 arpeggio from CAGED_G in C major
// arpeggioFromShape(CAGED_G, "Am7", "C") → 10 notes, all A/C/E/G chromas
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — Fixture (a): Am7 from CAGED_G (C major)", () => {
  let result: ReturnType<typeof arpeggioFromShape>;

  beforeAll(() => {
    result = arpeggioFromShape(CAGED_G, "Am7", "C");
  });

  it("returns exactly 10 notes", () => {
    expect(result.notes).toHaveLength(10);
  });

  it("every note chroma is in {9,0,4,7} (A,C,E,G)", () => {
    const allowed = new Set([9, 0, 4, 7]);
    for (const note of result.notes) {
      const c = chroma(note.pc);
      expect(c).not.toBeNull();
      expect(allowed.has(c!)).toBe(true);
    }
  });

  it("result.root === 'A'", () => {
    expect(result.root).toBe("A");
  });

  it("result.scaleType === 'minor seventh'", () => {
    expect(result.scaleType).toBe("minor seventh");
  });

  it("result.scaleName === 'A minor seventh'", () => {
    expect(result.scaleName).toBe("A minor seventh");
  });

  it("result.shapeName === 'G Shape'", () => {
    expect(result.shapeName).toBe("G Shape");
  });

  it("parent-frame interval is preserved on each retained note", () => {
    // Notes from C-major G-shape retain their parent intervals (6M=A, 1P=C, 3M=E, 5P=G)
    const parentFrameIntervals = new Set(["6M", "1P", "3M", "5P"]);
    for (const note of result.notes) {
      expect(parentFrameIntervals.has(note.interval)).toBe(true);
    }
  });

  it("parent-frame degree is preserved on each retained note (degree > 0)", () => {
    for (const note of result.notes) {
      expect(note.degree).toBeGreaterThan(0);
    }
  });

  it("result is not empty", () => {
    expect(result.empty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture (d): Gmaj7 arpeggio from CAGED_E (bare type "maj7", parent root G)
// arpeggioFromShape(CAGED_E, "maj7", "G") → 10 notes, intervals ∈ {1P,3M,5P,7M}
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — Fixture (d): Gmaj7 from CAGED_E (bare 'maj7', root G)", () => {
  let result: ReturnType<typeof arpeggioFromShape>;

  beforeAll(() => {
    result = arpeggioFromShape(CAGED_E, "maj7", "G");
  });

  it("returns exactly 10 notes", () => {
    expect(result.notes).toHaveLength(10);
  });

  it("every note interval is in {1P, 3M, 5P, 7M}", () => {
    const allowed = new Set(["1P", "3M", "5P", "7M"]);
    for (const note of result.notes) {
      expect(allowed.has(note.interval)).toBe(true);
    }
  });

  it("result.root === 'G'", () => {
    expect(result.root).toBe("G");
  });

  it("result.scaleType === 'major seventh'", () => {
    expect(result.scaleType).toBe("major seventh");
  });

  it("result.scaleName === 'G major seventh'", () => {
    expect(result.scaleName).toBe("G major seventh");
  });

  it("each note retains parent-frame degree (degree > 0)", () => {
    for (const note of result.notes) {
      expect(note.degree).toBeGreaterThan(0);
    }
  });

  it("result is not empty", () => {
    expect(result.empty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture (e): maj7 arpeggio from NPS_PATTERN_1 (Cmaj7)
// arpeggioFromShape(NPS_PATTERN_1, "maj7", "C") → 10 notes
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — Fixture (e): Cmaj7 from NPS_PATTERN_1", () => {
  let result: ReturnType<typeof arpeggioFromShape>;

  beforeAll(() => {
    result = arpeggioFromShape(NPS_PATTERN_1, "maj7", "C");
  });

  it("returns exactly 10 notes", () => {
    expect(result.notes).toHaveLength(10);
  });

  it("all notes have interval in {1P, 3M, 5P, 7M}", () => {
    const allowed = new Set(["1P", "3M", "5P", "7M"]);
    for (const note of result.notes) {
      expect(allowed.has(note.interval)).toBe(true);
    }
  });

  it("result.scaleType === 'major seventh'", () => {
    expect(result.scaleType).toBe("major seventh");
  });

  it("walkShapeMotif(result, [1,2,3,4]) runs without error", () => {
    expect(() => walkShapeMotif(result, [1, 2, 3, 4])).not.toThrow();
  });

  it("walkShapeMotif result is an array", () => {
    const walked = walkShapeMotif(result, [1, 2, 3, 4]);
    expect(Array.isArray(walked)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture (e) partial-filter sub-assertion: Cm7 from NPS_PATTERN_1
// arpeggioFromShape(NPS_PATTERN_1, "Cm7", "C") → non-empty; every chroma ∈ {0,7}
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — Fixture (e) partial filter: Cm7 from NPS_PATTERN_1", () => {
  let result: ReturnType<typeof arpeggioFromShape>;

  beforeAll(() => {
    result = arpeggioFromShape(NPS_PATTERN_1, "Cm7", "C");
  });

  it("result is non-empty", () => {
    expect(result.empty).toBe(false);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("every note chroma is in {0, 7} (C and G only — Eb/Bb absent from C major)", () => {
    const allowed = new Set([0, 7]);
    for (const note of result.notes) {
      const c = chroma(note.pc);
      expect(c).not.toBeNull();
      expect(allowed.has(c!)).toBe(true);
    }
  });

  it("result.scaleType === 'minor seventh'", () => {
    expect(result.scaleType).toBe("minor seventh");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: empty / NoFrettedScale parent
// ---------------------------------------------------------------------------

describe("arpeggioFromScale — empty parent → NoFrettedScale", () => {
  it("returns NoFrettedScale for the canonical empty sentinel", () => {
    const result = arpeggioFromScale({ ...NoFrettedScale }, "Am7");
    expect(result.empty).toBe(true);
    expect(result.notes).toHaveLength(0);
  });

  it("returns NoFrettedScale for an empty FrettedScale constructed explicitly", () => {
    const empty = buildFrettedScale(
      { name: "x", system: "custom", strings: [], rootString: 0 },
      "C",
    );
    const result = arpeggioFromScale(empty, "Am7");
    expect(result.empty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: unknown chord name → NoFrettedScale
// ---------------------------------------------------------------------------

describe("arpeggioFromScale — unknown chord name → NoFrettedScale", () => {
  it("returns NoFrettedScale for an unrecognised chord symbol", () => {
    const parent = buildFrettedScale(CAGED_G, "C");
    const result = arpeggioFromScale(parent, "Qxyz7");
    expect(result.empty).toBe(true);
    expect(result.notes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: bare chord type (no tonic) → tonic falls back to parent root
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — bare chord type 'm7' falls back to parent root", () => {
  it("result.root equals parent root pitch class when chord type is bare", () => {
    // Bare "m7" has no tonic → tonic falls back to parentRoot "A"
    const result = arpeggioFromShape(CAGED_A_FIXTURE(), "m7", "A");
    // root should be "A" (parent root fallback)
    expect(result.root).toBe("A");
  });

  it("result is non-empty for bare m7 over A parent", () => {
    const result = arpeggioFromShape(CAGED_A_FIXTURE(), "m7", "A");
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

// Helper — CAGED_A is imported at the top of this file
function CAGED_A_FIXTURE(): ScaleShape {
  return CAGED_A;
}

// ---------------------------------------------------------------------------
// Edge cases: chord tones ALL absent from parent → empty sentinel (R-2.3)
// ---------------------------------------------------------------------------

describe("arpeggioFromScale — all chord tones absent → empty sentinel preserving metadata", () => {
  it("returns empty: true, notes: [] when no chord tone intersects parent shape", () => {
    // Build a 2-string shape containing only C and D
    const narrowShape: ScaleShape = {
      name: "Narrow CD",
      system: "custom",
      strings: [["1P", "2M"], null, null, null, null, null],
      rootString: 0,
    };
    const parent = buildFrettedScale(narrowShape, "C");
    // B augmented has B D# Fx — none of those are in {C, D}
    const result = arpeggioFromScale(parent, "Baug");
    expect(result.empty).toBe(true);
    expect(result.notes).toHaveLength(0);
  });

  it("preserves shapeName on the all-absent sentinel", () => {
    const narrowShape: ScaleShape = {
      name: "Narrow CD",
      system: "custom",
      strings: [["1P", "2M"], null, null, null, null, null],
      rootString: 0,
    };
    const parent = buildFrettedScale(narrowShape, "C");
    const result = arpeggioFromScale(parent, "Baug");
    expect(result.shapeName).toBe("Narrow CD");
  });

  it("preserves tuning on the all-absent sentinel", () => {
    const narrowShape: ScaleShape = {
      name: "Narrow CD",
      system: "custom",
      strings: [["1P", "2M"], null, null, null, null, null],
      rootString: 0,
    };
    const parent = buildFrettedScale(narrowShape, "C");
    const result = arpeggioFromScale(parent, "Baug");
    expect(result.tuning).toEqual(STANDARD);
  });
});

// ---------------------------------------------------------------------------
// Non-major parent: arpeggioFromScale works with a minor/custom parent
// ---------------------------------------------------------------------------

describe("arpeggioFromScale — non-major parent (custom minor shape)", () => {
  // A natural minor: intervals 1P 2M 3m 4P 5P 6m — 2-string custom shape
  const aMinorShape: ScaleShape = {
    name: "Custom A Minor",
    system: "custom",
    strings: [["1P", "2M", "3m"], ["4P", "5P", "6m"], null, null, null, null],
    rootString: 0,
  };

  it("correctly filters chord tones from a minor parent", () => {
    const parent = buildFrettedScale(aMinorShape, "A");
    // Am7 chord tones: A C E G (chromas 9,0,4,7)
    const result = arpeggioFromScale(parent, "Am7");
    // Parent has A(1P) C(3m) E(5P) — G absent from this short shape
    expect(result.empty).toBe(false);
    expect(result.notes.length).toBeGreaterThan(0);
    // All kept notes must have chromas in Am7's set
    const allowed = new Set([9, 0, 4, 7]);
    for (const note of result.notes) {
      const c = chroma(note.pc);
      expect(c).not.toBeNull();
      expect(allowed.has(c!)).toBe(true);
    }
  });

  it("preserves parent-frame intervals (3m for C in A minor, not 3M)", () => {
    const parent = buildFrettedScale(aMinorShape, "A");
    const result = arpeggioFromScale(parent, "Am7");
    const cNote = result.notes.find((n) => n.pc === "C");
    expect(cNote).toBeDefined();
    // In A minor context C is interval 3m (not 3M as it would be in A major)
    expect(cNote!.interval).toBe("3m");
  });

  it("result.root is the chord tonic pc", () => {
    const parent = buildFrettedScale(aMinorShape, "A");
    const result = arpeggioFromScale(parent, "Am7");
    expect(result.root).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// Enharmonic: Bbm7 over a Bb-rooted parent — chroma membership, not spelling
// ---------------------------------------------------------------------------

describe("arpeggioFromShape — enharmonic Bbm7 over Bb parent", () => {
  it("correctly identifies Bb notes by chroma (10), not spelling", () => {
    const result = arpeggioFromShape(CAGED_G, "Bbm7", "Bb");
    // Bbm7 chromas: Bb=10, Db=1, F=5, Ab=8
    // Bb major G-shape has Bb, C, D, Eb, F, G, A notes
    // Intersection: Bb(10) and F(5) → result is non-empty
    expect(result.empty).toBe(false);
    expect(result.notes.length).toBeGreaterThan(0);

    const allowed = new Set([10, 1, 5, 8]); // Bbm7 chromas
    for (const note of result.notes) {
      const c = chroma(note.pc);
      expect(c).not.toBeNull();
      expect(allowed.has(c!)).toBe(true);
    }
  });

  it("result.root === 'Bb' (chord tonic)", () => {
    const result = arpeggioFromShape(CAGED_G, "Bbm7", "Bb");
    expect(result.root).toBe("Bb");
  });
});

// ---------------------------------------------------------------------------
// No mutation: input FrettedScale and its notes array are not mutated
// ---------------------------------------------------------------------------

describe("arpeggioFromScale — no mutation of parent", () => {
  it("does not mutate the parent notes array", () => {
    const parent = buildFrettedScale(CAGED_G, "C");
    const originalLength = parent.notes.length;
    const originalNotes = [...parent.notes];
    arpeggioFromScale(parent, "Am7");
    expect(parent.notes).toHaveLength(originalLength);
    expect(parent.notes).toEqual(originalNotes);
  });

  it("does not mutate the parent FrettedScale root", () => {
    const parent = buildFrettedScale(CAGED_G, "C");
    arpeggioFromScale(parent, "Am7");
    expect(parent.root).toBe("C");
  });
});

// ===========================================================================
// Task Group 6: inferShapeContext tests
// Registry isolation: each inference test block uses beforeEach/afterEach
// to pin the registry to exactly the built-in CAGED/3NPS/pentatonic sets.
// N-19 / spec §B — tasks.md TG6.1
// ===========================================================================

/**
 * Re-register all built-in shapes explicitly (no side-effect import reliance).
 * Called in beforeEach for all inference test suites.
 */
function registerBuiltins(): void {
  // CAGED (5 shapes)
  add(CAGED_E);
  add(CAGED_D);
  add(CAGED_C);
  add(CAGED_A);
  add(CAGED_G);
  // 3NPS (7 patterns)
  add(NPS_PATTERN_1);
  add(NPS_PATTERN_2);
  add(NPS_PATTERN_3);
  add(NPS_PATTERN_4);
  add(NPS_PATTERN_5);
  add(NPS_PATTERN_6);
  add(NPS_PATTERN_7);
  // Pentatonic (5 boxes)
  add(PENTA_BOX_1);
  add(PENTA_BOX_2);
  add(PENTA_BOX_3);
  add(PENTA_BOX_4);
  add(PENTA_BOX_5);
}

// ---------------------------------------------------------------------------
// Fixture (a): inferShapeContext(arpeggioFromShape(CAGED_G, "Am7", "C"), { system:"caged" })
// Probe-confirmed: top = G Shape of C, anchorFret=5, rootFret=8
// matchedIntervals=[6M,1P,3M,5P], positionAgreement=1
// spec §B / tasks.md TG6.1 Fixture (a)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (a): Am7 arpeggio in G-shape of C", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  let result: ReturnType<typeof inferShapeContext>;

  beforeAll(() => {
    removeAll();
    registerBuiltins();
    const arp = arpeggioFromShape(CAGED_G, "Am7", "C");
    result = inferShapeContext(arp, { system: "caged" });
  });

  it("returns at least one candidate", () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it("top candidate is G Shape of C", () => {
    expect(result[0].shape.name).toBe("G Shape");
    expect(result[0].shapeRoot).toBe("C");
  });

  it("top candidate anchorFret === 5", () => {
    expect(result[0].anchorFret).toBe(5);
  });

  it("top candidate rootFret === 8", () => {
    expect(result[0].rootFret).toBe(8);
  });

  it("top candidate positionAgreement === 1", () => {
    expect(result[0].breakdown.positionAgreement).toBe(1);
  });

  it("matchedIntervals contains [6M,1P,3M,5P] in built-note order", () => {
    expect(result[0].matchedIntervals).toEqual(["6M", "1P", "3M", "5P"]);
  });

  it("other C-rooted CAGED shapes are also present (ambiguity)", () => {
    const cRooted = result.filter((c) => c.shapeRoot === "C");
    expect(cRooted.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Fixture (b): inferShapeContext("x32010", { system: "caged" })
// Probe-confirmed: top = C Shape of C, anchorFret=0, rootFret=3, anchorHit=true
// Second = A Shape of C (lower score)
// spec §B / tasks.md TG6.1 Fixture (b)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (b): 'x32010' C major open grip", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  let result: ReturnType<typeof inferShapeContext>;

  beforeAll(() => {
    removeAll();
    registerBuiltins();
    result = inferShapeContext("x32010", { system: "caged" });
  });

  it("returns at least two candidates", () => {
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("top candidate is C Shape of C", () => {
    expect(result[0].shape.name).toBe("C Shape");
    expect(result[0].shapeRoot).toBe("C");
  });

  it("top candidate anchorFret === 0", () => {
    expect(result[0].anchorFret).toBe(0);
  });

  it("top candidate rootFret === 3", () => {
    expect(result[0].rootFret).toBe(3);
  });

  it("top candidate anchorHit === true", () => {
    expect(result[0].breakdown.anchorHit).toBe(true);
  });

  it("second candidate is A Shape of C with lower score", () => {
    expect(result[1].shape.name).toBe("A Shape");
    expect(result[1].shapeRoot).toBe("C");
    expect(result[1].score).toBeLessThan(result[0].score);
  });
});

// ---------------------------------------------------------------------------
// Fixture (c): inferShapeContext("133211", { system: "caged" }) — F major barre
// Probe-confirmed: top = E Shape of F, anchorFret=0, rootFret=1, anchorHit=true
// spec §B / tasks.md TG6.1 Fixture (c)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (c): '133211' F major E-shape barre", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  let result: ReturnType<typeof inferShapeContext>;

  beforeAll(() => {
    removeAll();
    registerBuiltins();
    result = inferShapeContext("133211", { system: "caged" });
  });

  it("top candidate is E Shape of F", () => {
    expect(result[0].shape.name).toBe("E Shape");
    expect(result[0].shapeRoot).toBe("F");
  });

  it("top candidate anchorFret === 0", () => {
    expect(result[0].anchorFret).toBe(0);
  });

  it("top candidate rootFret === 1", () => {
    expect(result[0].rootFret).toBe(1);
  });

  it("top candidate anchorHit === true", () => {
    expect(result[0].breakdown.anchorHit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture (f): custom system inference
// Register a custom ScaleShape with system:"myteacher"; verify it appears with
// that system filter and does NOT include CAGED; without filter, both appear.
// spec §B / tasks.md TG6.1 Fixture (f)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (f): custom system isolation", () => {
  // Minor-pentatonic-like shape: 1P 3m 4P 5P 7m on two strings (root on string 0)
  const myTeacherShape: ScaleShape = {
    name: "MyTeacher Box A",
    system: "myteacher",
    strings: [
      ["1P", "3m"],   // low E: root and minor 3rd
      ["4P", "5P"],   // A: 4th and 5th
      ["7m", "1P"],   // D: 7th and root
      null, null, null,
    ],
    rootString: 0,
  };

  beforeEach(() => {
    removeAll();
    registerBuiltins();
    add(myTeacherShape);
  });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("with system:'myteacher', only the custom shape appears (not CAGED)", () => {
    // A minor pentatonic notes: A C D E G (frets on low E: A=5, C=8)
    // Build grip from the custom shape rooted at A on standard tuning
    const built = buildFrettedScale(myTeacherShape, "A");
    const result = inferShapeContext(built, { system: "myteacher" });
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.shape.system).toBe("myteacher");
      expect(c.shape.system).not.toBe("caged");
    }
  });

  it("without system filter, both myteacher and covering CAGED shapes appear", () => {
    const built = buildFrettedScale(myTeacherShape, "A");
    const result = inferShapeContext(built);
    const systems = new Set(result.map((c) => c.shape.system));
    expect(systems.has("myteacher")).toBe(true);
    // At minimum one caged shape covers these 5 pitch classes
    expect(systems.has("caged")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture (g): inferShapeContext("x02220", { system: "caged" }) — A major open
// Probe-confirmed: top = A Shape of A (anchorFret=11, circular distance=1)
// 2nd = C Shape of A; both A-rooted CAGED shapes; determinism verified
// spec §B / tasks.md TG6.1 Fixture (g)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (g): 'x02220' A major open (anchor-octave artifact)", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  let result: ReturnType<typeof inferShapeContext>;
  let result2: ReturnType<typeof inferShapeContext>;

  beforeAll(() => {
    removeAll();
    registerBuiltins();
    result = inferShapeContext("x02220", { system: "caged" });
    result2 = inferShapeContext("x02220", { system: "caged" });
  });

  it("top candidate is A Shape of A", () => {
    expect(result[0].shape.name).toBe("A Shape");
    expect(result[0].shapeRoot).toBe("A");
  });

  it("second candidate is C Shape of A", () => {
    expect(result[1].shape.name).toBe("C Shape");
    expect(result[1].shapeRoot).toBe("A");
  });

  it("A Shape scores higher than C Shape", () => {
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("all five A-rooted CAGED shapes are present", () => {
    const aRooted = result.filter((c) => c.shapeRoot === "A");
    expect(aRooted.length).toBe(5);
  });

  it("two consecutive calls return identically ordered results (determinism)", () => {
    const order1 = result.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`);
    const order2 = result2.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`);
    expect(order1).toEqual(order2);
  });
});

// ---------------------------------------------------------------------------
// Fixture (h): no-match and edge cases
// All-muted, high-fret (no coverage), min-evidence gate, includeWeak
// spec §B / tasks.md TG6.1 Fixture (h)
// ---------------------------------------------------------------------------

describe("inferShapeContext — Fixture (h): no-match and edge cases", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("array with no played notes → []", () => {
    expect(inferShapeContext([null, 13, 14, 13, null, null])).toEqual([]);
  });

  it("all-muted string 'xxxxxx' → []", () => {
    expect(inferShapeContext("xxxxxx")).toEqual([]);
  });

  it("two-PC grip 'x00xxx' → [] by min-evidence gate (A and D — only 2 distinct PCs)", () => {
    // x00xxx: A-string fret 0 = A, D-string fret 0 = D — only 2 distinct PCs
    expect(inferShapeContext("x00xxx")).toEqual([]);
  });

  it("same two-PC grip with includeWeak:true → non-empty (bypasses gate)", () => {
    // With includeWeak, the gate is bypassed; many shapes cover {A,D}
    const result = inferShapeContext("x00xxx", { includeWeak: true });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Min-evidence gate: 1 PC → [], 2 PC → [], 3 PC → candidates
// spec §B.1 / tasks.md TG6.1
// ---------------------------------------------------------------------------

describe("inferShapeContext — min-evidence gate", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("1 distinct PC → []", () => {
    // "0-0-0-0-0-0" (all open strings) normalised: E2 B2 G3 D4 A4 E5 → 3 PCs (E,B,G)
    // Use a single-string, single-note grip: string 0 fret 0 = E — 1 PC
    // We can't do that with parseChordFrets easily on standard tuning,
    // so use array form: [0,null,null,null,null,null] = E on low string only → 1 PC
    expect(inferShapeContext([0, null, null, null, null, null])).toEqual([]);
  });

  it("2 distinct PCs → []", () => {
    // 2 PCs: fret 0 and fret 7 on same string = E and B (strings 0 and 4)
    expect(inferShapeContext([0, null, null, null, 0, null])).toEqual([]);
  });

  it("3 distinct PCs with some coverage → non-empty (CAGED covers them)", () => {
    // x02220 has 3 distinct PCs (A, C#, E) and is covered by CAGED A shapes
    const result = inferShapeContext("x02220", { system: "caged" });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// system filter and limit options
// spec §B.4 / tasks.md TG6.1
// ---------------------------------------------------------------------------

describe("inferShapeContext — options.system filter", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("system:'caged' returns only caged shapes", () => {
    const result = inferShapeContext("x32010", { system: "caged" });
    for (const c of result) {
      expect(c.shape.system).toBe("caged");
    }
  });

  it("non-matching system → []", () => {
    const result = inferShapeContext("x32010", { system: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("inferShapeContext — options.limit normalization", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("limit=2 caps output at 2", () => {
    const full = inferShapeContext("x32010", { system: "caged" });
    const limited = inferShapeContext("x32010", { system: "caged", limit: 2 });
    expect(limited.length).toBe(2);
    expect(limited[0].shape.name).toBe(full[0].shape.name);
    expect(limited[1].shape.name).toBe(full[1].shape.name);
  });

  it("limit=0 → no limit (all candidates)", () => {
    const full = inferShapeContext("x32010", { system: "caged" });
    const result = inferShapeContext("x32010", { system: "caged", limit: 0 });
    expect(result.length).toBe(full.length);
  });

  it("limit=NaN → no limit", () => {
    const full = inferShapeContext("x32010", { system: "caged" });
    const result = inferShapeContext("x32010", { system: "caged", limit: NaN });
    expect(result.length).toBe(full.length);
  });

  it("limit=1.7 → floor to 1 (returns 1 candidate)", () => {
    const result = inferShapeContext("x32010", { system: "caged", limit: 1.7 });
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Determinism: two identical calls → byte-identical ordered results
// spec §B.4 / tasks.md TG6.1
// ---------------------------------------------------------------------------

describe("inferShapeContext — determinism", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("identical input produces identical ordered output (grip form)", () => {
    const r1 = inferShapeContext("x32010", { system: "caged" });
    const r2 = inferShapeContext("x32010", { system: "caged" });
    expect(r1.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`)).toEqual(
      r2.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`)
    );
  });

  it("identical input produces identical ordered output (FrettedScale form)", () => {
    const arp = arpeggioFromShape(CAGED_G, "Am7", "C");
    const r1 = inferShapeContext(arp, { system: "caged" });
    const r2 = inferShapeContext(arp, { system: "caged" });
    expect(r1.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`)).toEqual(
      r2.map((c) => `${c.shape.name}|${c.shapeRoot}|${c.score}`)
    );
  });
});

// ---------------------------------------------------------------------------
// FrettedScale input form works for all fixtures
// spec §B.1 / tasks.md TG6.1
// ---------------------------------------------------------------------------

describe("inferShapeContext — FrettedScale input form", () => {
  beforeEach(() => { removeAll(); registerBuiltins(); });
  afterEach(() => { removeAll(); registerBuiltins(); });

  it("FrettedScale input detects shape (Fixture a via arpeggio)", () => {
    const arp = arpeggioFromShape(CAGED_G, "Am7", "C");
    const result = inferShapeContext(arp, { system: "caged" });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].shape.name).toBe("G Shape");
  });

  it("empty FrettedScale → []", () => {
    expect(inferShapeContext({ ...NoFrettedScale })).toEqual([]);
  });

  it("FrettedScale with notes → candidates found", () => {
    const built = buildFrettedScale(CAGED_G, "C");
    const result = inferShapeContext(built, { system: "caged" });
    expect(result.length).toBeGreaterThan(0);
  });
});
