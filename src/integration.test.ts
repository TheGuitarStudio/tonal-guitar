/**
 * Tests for arpeggioFromScale and arpeggioFromShape (chroma-based builders).
 * Task Group 5 — spec §A.2, R-3.1
 */

import { describe, it, expect, beforeAll } from "vitest";
import { chroma } from "@tonaljs/note";

import { CAGED_G, CAGED_E } from "./data/caged-scales";
import { NPS_PATTERN_1 } from "./data/three-nps";
import { buildFrettedScale } from "./build";
import { NoFrettedScale, type ScaleShape } from "./shape";
import { arpeggioFromScale, arpeggioFromShape } from "./integration";
import { walkShapeMotif } from "./walker";
import { STANDARD } from "./tuning";

// Side-effect imports to register shapes (mirroring index.ts)
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

// Helper — import CAGED_A from data
import { CAGED_A } from "./data/caged-scales";
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
