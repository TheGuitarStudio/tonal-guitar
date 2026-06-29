/**
 * Tests for src/arpeggio.ts — Task Group 2 smoke tests + Task Group 3 filterChordTones.
 *
 * These tests verify:
 *   - All named exports resolve from both `src/arpeggio` and `src/index`
 *   - InferenceProbe and ScoreBreakdown compile as types
 *   - Stub filterChordTones throws "not implemented" (TG2)
 *   - Stub scoreShapeMatch throws "not implemented" (TG2)
 *   - filterChordTones implementation (TG3)
 */

import { describe, expect, it } from "vitest";

// Import directly from the module under test
import {
  filterChordTones,
  scoreShapeMatch,
} from "./arpeggio";
import type { InferenceProbe, ScoreBreakdown } from "./arpeggio";
import { STANDARD } from "./tuning";

// Import via the public index to verify re-exports (Task 2.3)
import {
  filterChordTones as filterChordTonesFromIndex,
  scoreShapeMatch as scoreShapeMatchFromIndex,
} from "./index";
import type {
  InferenceProbe as InferenceProbeFromIndex,
  ScoreBreakdown as ScoreBreakdownFromIndex,
} from "./index";

// Minimal shape-type imports used to construct test arguments
import type { FrettedScale, ScaleShape } from "./shape";
import { NoFrettedScale } from "./shape";

// TG3 imports
import { buildFrettedScale } from "./build";
import { CAGED_G, CAGED_E, CAGED_A } from "./data/caged-scales";

describe("arpeggio module — TG2 import smoke tests", () => {
  describe("named exports resolve from src/arpeggio", () => {
    it("filterChordTones is a function", () => {
      expect(typeof filterChordTones).toBe("function");
    });

    it("scoreShapeMatch is a function", () => {
      expect(typeof scoreShapeMatch).toBe("function");
    });
  });

  describe("named exports resolve from src/index", () => {
    it("filterChordTones is a function (via index)", () => {
      expect(typeof filterChordTonesFromIndex).toBe("function");
    });

    it("scoreShapeMatch is a function (via index)", () => {
      expect(typeof scoreShapeMatchFromIndex).toBe("function");
    });
  });

  describe("types compile (InferenceProbe, ScoreBreakdown)", () => {
    it("InferenceProbe type is assignable to an object literal", () => {
      // This test is a compile-time check; if the type is wrong it won't
      // compile.  At runtime we just assert the object has the right shape.
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      expect(probe.pitchClasses).toEqual([0, 4, 7]);
      expect(probe.rootCandidates[0].pc).toBe("C");
      expect(probe.anchorFret).toBe(0);
      expect(probe.anchorString).toBe(0);
    });

    it("ScoreBreakdown type is assignable to an object literal", () => {
      const bd: ScoreBreakdown = {
        tightness: 0.5,
        anchorHit: true,
        rootOnAnchorString: false,
        positionAgreement: 1,
        rootPreference: 1,
      };
      expect(bd.tightness).toBe(0.5);
      expect(bd.anchorHit).toBe(true);
    });

    it("InferenceProbe type resolves from src/index", () => {
      const probe: InferenceProbeFromIndex = {
        pitchClasses: [9, 0, 4, 7],
        rootCandidates: [{ pc: "A", chroma: 9 }],
        anchorFret: 5,
        anchorString: 0,
      };
      expect(probe.pitchClasses).toHaveLength(4);
    });

    it("ScoreBreakdown type resolves from src/index", () => {
      const bd: ScoreBreakdownFromIndex = {
        tightness: 1,
        anchorHit: false,
        rootOnAnchorString: true,
        positionAgreement: 0.917,
        rootPreference: 0.5,
      };
      expect(bd.rootPreference).toBe(0.5);
    });
  });

  describe("filterChordTones is callable and returns NoFrettedScale for empty scale", () => {
    it("returns NoFrettedScale when called with an empty (sentinel) scale", () => {
      const scale: FrettedScale = { ...NoFrettedScale };
      const result = filterChordTones(scale, ["1P", "3M"]);
      expect(result.empty).toBe(true);
    });

    it("is callable via index re-export without throwing", () => {
      const scale: FrettedScale = { ...NoFrettedScale };
      const result = filterChordTonesFromIndex(scale, ["1P"]);
      expect(result.empty).toBe(true);
    });
  });

  describe("scoreShapeMatch is callable (TG4 implemented — no longer throws)", () => {
    it("does not throw when called with minimal valid arguments and builtAnchorFret", () => {
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const shape: ScaleShape = {
        name: "test",
        system: "test",
        strings: [["1P", "2M"], ["3M", "4P"]],
        rootString: 0,
      };
      const root = { pc: "C", chroma: 0 };
      const built: FrettedScale = { ...NoFrettedScale };
      // With an empty built scale, coverage will be 0 — just checks no throw
      expect(() => scoreShapeMatch(probe, shape, root, built, 0)).not.toThrow();
    });

    it("is callable via index re-export without throwing", () => {
      const probe: InferenceProbe = {
        pitchClasses: [0],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const shape: ScaleShape = {
        name: "t",
        system: "t",
        strings: [["1P"]],
        rootString: 0,
      };
      expect(() =>
        scoreShapeMatchFromIndex(probe, shape, { pc: "C", chroma: 0 }, {
          ...NoFrettedScale,
        }, 0),
      ).not.toThrow();
    });
  });
});

// ============================================================
// Task Group 3: filterChordTones implementation tests
// ============================================================

describe("filterChordTones — TG3 implementation", () => {
  /**
   * Fixture (a) low-level path:
   * filterChordTones(buildFrettedScale(CAGED_G, "C"), ["6M","1P","3M","5P"])
   * retains exactly 10 notes with intervals only in {"6M","1P","3M","5P"}
   * and none with "7M", "2M", "4P"
   */
  describe("Fixture (a) — CAGED_G C-major, Am7 parent-frame intervals", () => {
    const parentScale = buildFrettedScale(CAGED_G, "C");
    const intervals = ["6M", "1P", "3M", "5P"];
    const result = filterChordTones(parentScale, intervals);

    it("retains exactly 10 notes", () => {
      expect(result.notes).toHaveLength(10);
    });

    it("every retained note has interval in the wanted set", () => {
      const wanted = new Set(intervals);
      for (const n of result.notes) {
        expect(wanted.has(n.interval)).toBe(true);
      }
    });

    it("no retained note has interval '7M', '2M', or '4P'", () => {
      const dropped = new Set(["7M", "2M", "4P"]);
      for (const n of result.notes) {
        expect(dropped.has(n.interval)).toBe(false);
      }
    });

    it("result is not empty", () => {
      expect(result.empty).toBe(false);
    });
  });

  /**
   * Fixture (d) low-level path:
   * filterChordTones(buildFrettedScale(CAGED_E, "G"), ["1P","3M","5P","7M"])
   * retains exactly 10 notes; every note has interval in {"1P","3M","5P","7M"};
   * parent-scale degree field is preserved on each retained note.
   */
  describe("Fixture (d) — CAGED_E G-major, Gmaj7 parent-frame intervals", () => {
    const parentScale = buildFrettedScale(CAGED_E, "G");
    const intervals = ["1P", "3M", "5P", "7M"];
    const result = filterChordTones(parentScale, intervals);

    it("retains exactly 10 notes", () => {
      expect(result.notes).toHaveLength(10);
    });

    it("every retained note has interval in {'1P','3M','5P','7M'}", () => {
      const wanted = new Set(intervals);
      for (const n of result.notes) {
        expect(wanted.has(n.interval)).toBe(true);
      }
    });

    it("parent-scale degree field is preserved on each retained note", () => {
      for (const n of result.notes) {
        expect(typeof n.degree).toBe("number");
        expect(n.degree).toBeGreaterThanOrEqual(1);
      }
    });

    it("result is not empty", () => {
      expect(result.empty).toBe(false);
    });
  });

  /**
   * Empty scale input → NoFrettedScale (R-2.3)
   */
  describe("empty scale input", () => {
    it("returns NoFrettedScale when scale.empty is true", () => {
      const result = filterChordTones({ ...NoFrettedScale }, ["1P", "3M"]);
      expect(result.empty).toBe(true);
      expect(result.notes).toHaveLength(0);
      expect(result.root).toBe("");
      expect(result.tuning).toEqual([]);
    });
  });

  /**
   * Filter that removes every note → empty sentinel with empty: true, notes: [],
   * root/tuning/shapeName preserved, scaleType: "", scaleName: "" (R-2.3)
   */
  describe("filter that removes every note", () => {
    const parentScale = buildFrettedScale(CAGED_G, "C");

    it("returns sentinel with empty:true and notes:[] when no notes match", () => {
      // "8P" is not an interval in any standard scale shape
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.empty).toBe(true);
      expect(result.notes).toHaveLength(0);
    });

    it("preserves root from original scale in empty sentinel", () => {
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.root).toBe(parentScale.root);
    });

    it("preserves tuning from original scale in empty sentinel", () => {
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.tuning).toEqual(parentScale.tuning);
    });

    it("preserves shapeName from original scale in empty sentinel", () => {
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.shapeName).toBe(parentScale.shapeName);
    });

    it("sets scaleType to '' in empty sentinel", () => {
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.scaleType).toBe("");
    });

    it("sets scaleName to '' in empty sentinel", () => {
      const result = filterChordTones(parentScale, ["8P"]);
      expect(result.scaleName).toBe("");
    });
  });

  /**
   * Non-empty filter → new FrettedScale object; input scale NOT mutated;
   * input notes array NOT mutated (R-2.2)
   */
  describe("non-empty filter — immutability (R-2.2)", () => {
    const parentScale = buildFrettedScale(CAGED_G, "C");
    const originalNoteCount = parentScale.notes.length;
    const originalFirstNote = parentScale.notes[0];
    const result = filterChordTones(parentScale, ["1P", "3M"]);

    it("returns a different object reference than the input", () => {
      expect(result).not.toBe(parentScale);
    });

    it("returns a fresh notes array (not the same reference)", () => {
      expect(result.notes).not.toBe(parentScale.notes);
    });

    it("input scale notes array is not mutated", () => {
      expect(parentScale.notes).toHaveLength(originalNoteCount);
      expect(parentScale.notes[0]).toBe(originalFirstNote);
    });

    it("input scale is not mutated", () => {
      expect(parentScale.empty).toBe(false);
    });
  });

  /**
   * Order-preserving: retained notes appear in the same relative order
   * as in scale.notes
   */
  describe("order-preserving", () => {
    it("retained notes appear in the same relative order as in scale.notes", () => {
      const parentScale = buildFrettedScale(CAGED_G, "C");
      const intervals = ["1P", "3M"];
      const result = filterChordTones(parentScale, intervals);

      // Extract positions of retained notes in the original array
      const retainedIndices = parentScale.notes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => intervals.includes(n.interval))
        .map(({ i }) => i);

      // Verify the retained notes in the result are in order
      expect(result.notes).toHaveLength(retainedIndices.length);
      for (let j = 0; j < result.notes.length; j++) {
        expect(result.notes[j]).toBe(parentScale.notes[retainedIndices[j]]);
      }
    });
  });

  /**
   * [] interval set → empty sentinel (not a throw) (R-2.2, R-2.3)
   */
  describe("empty interval set", () => {
    it("returns empty sentinel without throwing when intervals is []", () => {
      const parentScale = buildFrettedScale(CAGED_G, "C");
      const result = filterChordTones(parentScale, []);
      expect(result.empty).toBe(true);
      expect(result.notes).toHaveLength(0);
      expect(result.root).toBe(parentScale.root);
      expect(result.shapeName).toBe(parentScale.shapeName);
    });
  });
});

// ============================================================
// Task Group 4: pcChroma helper and scoreShapeMatch scoring core
// ============================================================

/**
 * pcChroma is not exported from arpeggio.ts or index.ts (internal helper).
 * We test it indirectly through scoreShapeMatch behaviour and via a
 * thin test shim that exercises the chroma arithmetic we need to validate.
 *
 * Instead of exporting pcChroma, we test its effects by constructing
 * FrettedNote objects with known pc values and verifying scoreShapeMatch
 * uses the correct chroma arithmetic.
 *
 * For direct pcChroma testing we call scoreShapeMatch with a built scale
 * containing exactly the notes of interest and probe with the expected chroma.
 */

describe("Task Group 4 — pcChroma (via scoreShapeMatch) and scoreShapeMatch", () => {
  // ---------------------------------------------------------------------------
  // Helper: build a minimal FrettedNote
  // ---------------------------------------------------------------------------
  function makeFrettedNote(
    string: number,
    fret: number,
    pc: string,
    interval: string,
    midi: number,
  ): import("./shape").FrettedNote {
    return { string, fret, note: `${pc}4`, pc, interval, scaleIndex: 0, degree: 1, intervalNumber: 1, midi };
  }

  // ---------------------------------------------------------------------------
  // Helper: build a minimal FrettedScale from an array of FrettedNote
  // ---------------------------------------------------------------------------
  function makeBuiltScale(notes: import("./shape").FrettedNote[]): import("./shape").FrettedScale {
    return {
      empty: false,
      root: notes[0]?.pc ?? "",
      scaleType: "major",
      scaleName: "test",
      shapeName: "test",
      tuning: STANDARD,
      notes,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: minimal ScaleShape
  // ---------------------------------------------------------------------------
  const minimalShape: ScaleShape = {
    name: "test-shape",
    system: "test",
    strings: [["1P", "3M", "5P"]],
    rootString: 0,
  };

  // ---------------------------------------------------------------------------
  // pcChroma — tested via scoreShapeMatch coverage behaviour
  //
  // We verify chroma arithmetic by building known pc-named notes and checking
  // that coverage counts correctly (enharmonic equality, standard notes).
  // ---------------------------------------------------------------------------

  describe("pcChroma arithmetic (tested via scoreShapeMatch coverage)", () => {
    it("C has chroma 0 — coverage=1 when probe has chroma 0 and built has C note", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 0, "C", "1P", 60)]);
      const probe: InferenceProbe = {
        pitchClasses: [0], // chroma of C
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.coverage).toBe(1.0);
    });

    it("Bb has chroma 10 — coverage=1 when probe has chroma 10 and built has Bb note", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 1, "Bb", "7m", 70)]);
      const probe: InferenceProbe = {
        pitchClasses: [10], // chroma of Bb
        rootCandidates: [{ pc: "Bb", chroma: 10 }],
        anchorFret: 1,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "Bb", chroma: 10 }, built, 1);
      expect(result.coverage).toBe(1.0);
    });

    it("A# has chroma 10 — enharmonic with Bb: coverage=1 when probe has chroma 10 and built has A# note", () => {
      // A# and Bb are enharmonic; both should map to chroma 10
      const built = makeBuiltScale([makeFrettedNote(0, 1, "A#", "7m", 70)]);
      const probe: InferenceProbe = {
        pitchClasses: [10], // chroma 10 = A# = Bb
        rootCandidates: [{ pc: "A#", chroma: 10 }],
        anchorFret: 1,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "A#", chroma: 10 }, built, 1);
      expect(result.coverage).toBe(1.0);
    });

    it("F# has chroma 6 — coverage=1 when probe has chroma 6 and built has F# note", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 2, "F#", "7M", 66)]);
      const probe: InferenceProbe = {
        pitchClasses: [6],
        rootCandidates: [{ pc: "F#", chroma: 6 }],
        anchorFret: 2,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "F#", chroma: 6 }, built, 2);
      expect(result.coverage).toBe(1.0);
    });

    it("Gb has chroma 6 — enharmonic with F#: coverage=1 when probe has chroma 6 and built has Gb note", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 2, "Gb", "7M", 66)]);
      const probe: InferenceProbe = {
        pitchClasses: [6],
        rootCandidates: [{ pc: "Gb", chroma: 6 }],
        anchorFret: 2,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "Gb", chroma: 6 }, built, 2);
      expect(result.coverage).toBe(1.0);
    });

    it("empty string pc returns sentinel — coverage=0 when probe has chroma 0 and built has empty-pc note", () => {
      // A note with empty pc should yield chroma -1 (sentinel); probe chroma 0 won't match
      const note = makeFrettedNote(0, 0, "", "1P", 60);
      const built = makeBuiltScale([note]);
      const probe: InferenceProbe = {
        pitchClasses: [0],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      // Built has only an invalid-chroma note; probe chroma 0 is not in built chromas
      expect(result.coverage).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // coverage
  // ---------------------------------------------------------------------------

  describe("coverage", () => {
    it("is 1.0 when all probe chromas are present in built chromas", () => {
      // Built scale has C(0), E(4), G(7)
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60),
        makeFrettedNote(1, 0, "E", "3M", 64),
        makeFrettedNote(2, 0, "G", "5P", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.coverage).toBe(1.0);
    });

    it("is < 1.0 when some probe chromas are absent", () => {
      // Built has only C(0); probe has C(0) and E(4)
      const built = makeBuiltScale([makeFrettedNote(0, 0, "C", "1P", 60)]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.coverage).toBe(0.5);
    });
  });

  // ---------------------------------------------------------------------------
  // tightness
  // ---------------------------------------------------------------------------

  describe("tightness", () => {
    it("equals probe.pitchClasses.length / distinctChromas(built), value in (0, 1]", () => {
      // Built scale has 7 distinct chromas (C major: C D E F G A B)
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60),
        makeFrettedNote(0, 2, "D", "2M", 62),
        makeFrettedNote(0, 4, "E", "3M", 64),
        makeFrettedNote(0, 5, "F", "4P", 65),
        makeFrettedNote(0, 7, "G", "5P", 67),
        makeFrettedNote(0, 9, "A", "6M", 69),
        makeFrettedNote(0, 11, "B", "7M", 71),
      ]);
      // Probe has 3 chromas (C, E, G)
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      // tightness = 3 / 7 ≈ 0.4286
      expect(result.breakdown.tightness).toBeCloseTo(3 / 7, 10);
      expect(result.breakdown.tightness).toBeGreaterThan(0);
      expect(result.breakdown.tightness).toBeLessThanOrEqual(1);
    });

    it("is 1.0 when probe has exactly the same chromas as built", () => {
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60),
        makeFrettedNote(1, 0, "E", "3M", 64),
        makeFrettedNote(2, 0, "G", "5P", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.breakdown.tightness).toBe(1.0);
    });
  });

  // ---------------------------------------------------------------------------
  // anchorHit
  // ---------------------------------------------------------------------------

  describe("anchorHit", () => {
    it("is true when a '1P' built note is on probe.anchorString at probe rootCandidates[0].chroma", () => {
      // Built has C(0) as "1P" on string 0; probe anchorString=0, rootCandidates[0].chroma=0
      const built = makeBuiltScale([
        makeFrettedNote(0, 3, "C", "1P", 60), // string 0, chroma 0
        makeFrettedNote(1, 2, "E", "3M", 64),
        makeFrettedNote(2, 0, "G", "5P", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0, // looking for "1P" on string 0
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.breakdown.anchorHit).toBe(true);
    });

    it("is false when no '1P' note is on probe.anchorString at probe rootCandidates[0].chroma", () => {
      // Built has E(4) as "1P" on string 0 (wrong chroma for probe which expects C=0)
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "E", "1P", 64), // string 0 but wrong chroma
        makeFrettedNote(1, 2, "G", "3M", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }], // looking for C chroma at string 0
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.breakdown.anchorHit).toBe(false);
    });

    it("is false when the '1P' note is on the wrong string", () => {
      // Built has C(0) as "1P" on string 1; probe anchorString=0
      const built = makeBuiltScale([
        makeFrettedNote(1, 3, "C", "1P", 60), // string 1, not string 0
        makeFrettedNote(0, 0, "E", "3M", 64),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.breakdown.anchorHit).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // rootOnAnchorString
  // ---------------------------------------------------------------------------

  describe("rootOnAnchorString", () => {
    it("is true when any '1P' built note is on probe.anchorString", () => {
      // Built has C(0) as "1P" on string 0; probe rootCandidates[0].chroma=9 (A) but rootOnAnchorString just checks string
      const built = makeBuiltScale([
        makeFrettedNote(0, 3, "C", "1P", 60), // string 0
        makeFrettedNote(1, 0, "E", "3M", 64),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "A", chroma: 9 }], // different from built "1P" chroma
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "A", chroma: 9 }, built, 0);
      // rootOnAnchorString = true because there IS a "1P" on string 0
      // anchorHit = false because chroma doesn't match
      expect(result.breakdown.rootOnAnchorString).toBe(true);
      expect(result.breakdown.anchorHit).toBe(false);
    });

    it("is false when no '1P' note is on probe.anchorString", () => {
      // Built has "1P" only on string 1; probe anchorString=0
      const built = makeBuiltScale([
        makeFrettedNote(1, 3, "C", "1P", 60), // string 1
        makeFrettedNote(0, 0, "E", "3M", 64), // string 0, not "1P"
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.breakdown.rootOnAnchorString).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // positionAgreement — circular mod-12 (Fixture g cross-check)
  // ---------------------------------------------------------------------------

  describe("positionAgreement — circular fret distance", () => {
    it("is 1.0 when builtAnchorFret equals probe.anchorFret (exact match)", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 5, "A", "1P", 69)]);
      const probe: InferenceProbe = {
        pitchClasses: [9],
        rootCandidates: [{ pc: "A", chroma: 9 }],
        anchorFret: 5,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "A", chroma: 9 }, built, 5);
      expect(result.breakdown.positionAgreement).toBe(1.0);
    });

    it("circular: |builtAnchorFret 11 - probeAnchorFret 0| → circularDelta 1 → positionAgreement 1 - 1/12", () => {
      // Fixture g cross-check: CAGED_A of A anchors at fret 11; probe anchor is 0
      // Linear: |11 - 0| = 11 → 11 % 12 = 11 → min(11, 1) = 1 → positionAgreement = 1 - 1/12
      const built = makeBuiltScale([makeFrettedNote(1, 12, "A", "1P", 69)]);
      const probe: InferenceProbe = {
        pitchClasses: [9],
        rootCandidates: [{ pc: "A", chroma: 9 }],
        anchorFret: 0,
        anchorString: 1,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "A", chroma: 9 }, built, 11);
      // d = |11 - 0| % 12 = 11; circularDelta = min(11, 12 - 11) = min(11, 1) = 1
      // positionAgreement = 1 - 1/12
      expect(result.breakdown.positionAgreement).toBeCloseTo(1 - 1 / 12, 10);
    });

    it("worst case: 6-fret circular distance → positionAgreement = 0.5", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 6, "F#", "1P", 66)]);
      const probe: InferenceProbe = {
        pitchClasses: [6],
        rootCandidates: [{ pc: "F#", chroma: 6 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "F#", chroma: 6 }, built, 6);
      // d = |6 - 0| % 12 = 6; circularDelta = min(6, 12 - 6) = 6; positionAgreement = 1 - 6/12 = 0.5
      expect(result.breakdown.positionAgreement).toBe(0.5);
    });
  });

  // ---------------------------------------------------------------------------
  // rootPreference
  // ---------------------------------------------------------------------------

  describe("rootPreference", () => {
    it("rank 0 → rootPreference 1.0", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 0, "C", "1P", 60)]);
      const root = { pc: "C", chroma: 0 };
      const probe: InferenceProbe = {
        pitchClasses: [0],
        rootCandidates: [{ pc: "C", chroma: 0 }], // root at index 0
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, root, built, 0);
      expect(result.breakdown.rootPreference).toBe(1.0);
    });

    it("rank 1 → rootPreference 0.5", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 0, "C", "1P", 60)]);
      const root = { pc: "C", chroma: 0 };
      const probe: InferenceProbe = {
        pitchClasses: [0],
        rootCandidates: [
          { pc: "E", chroma: 4 }, // rank 0
          { pc: "C", chroma: 0 }, // rank 1
        ],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, root, built, 0);
      expect(result.breakdown.rootPreference).toBe(0.5);
    });

    it("rank 2 → rootPreference 1/3", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 0, "C", "1P", 60)]);
      const root = { pc: "C", chroma: 0 };
      const probe: InferenceProbe = {
        pitchClasses: [0],
        rootCandidates: [
          { pc: "G", chroma: 7 }, // rank 0
          { pc: "E", chroma: 4 }, // rank 1
          { pc: "C", chroma: 0 }, // rank 2
        ],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, root, built, 0);
      expect(result.breakdown.rootPreference).toBeCloseTo(1 / 3, 10);
    });
  });

  // ---------------------------------------------------------------------------
  // matchedIntervals — first-match-in-built-note-order, deduped by chroma (review S-8)
  // ---------------------------------------------------------------------------

  describe("matchedIntervals — first-match semantics", () => {
    it("is in built-note order, deduped by chroma", () => {
      // Built: C(1P), E(3M), G(5P) — all in probe
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60),
        makeFrettedNote(0, 4, "E", "3M", 64),
        makeFrettedNote(0, 7, "G", "5P", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.matchedIntervals).toEqual(["1P", "3M", "5P"]);
    });

    it("chroma collision: two built notes share a chroma → first-match wins, no duplication", () => {
      // Two notes both with chroma 0 (C): first has interval "1P", second has interval "8P"
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60), // chroma 0, interval "1P" — first
        makeFrettedNote(1, 0, "C", "8P", 72), // chroma 0, interval "8P" — second (same chroma)
        makeFrettedNote(2, 4, "E", "3M", 64),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      // "1P" wins for chroma 0 (first match); "3M" for chroma 4; no duplication
      expect(result.matchedIntervals).toEqual(["1P", "3M"]);
      expect(result.matchedIntervals).toHaveLength(2);
    });

    it("empty when no built notes match probe chromas", () => {
      const built = makeBuiltScale([makeFrettedNote(0, 0, "D", "2M", 62)]);
      const probe: InferenceProbe = {
        pitchClasses: [0], // C, not D
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.matchedIntervals).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // matchedNotes — concrete FrettedNote objects whose chroma is in probe set
  // ---------------------------------------------------------------------------

  describe("matchedNotes", () => {
    it("contains all built FrettedNotes whose chroma is in the probe set", () => {
      const noteC = makeFrettedNote(0, 0, "C", "1P", 60);
      const noteE = makeFrettedNote(1, 4, "E", "3M", 64);
      const noteG = makeFrettedNote(2, 7, "G", "5P", 67);
      const noteD = makeFrettedNote(3, 2, "D", "2M", 62); // not in probe
      const built = makeBuiltScale([noteC, noteE, noteG, noteD]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7], // C, E, G
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.matchedNotes).toHaveLength(3);
      expect(result.matchedNotes).toContain(noteC);
      expect(result.matchedNotes).toContain(noteE);
      expect(result.matchedNotes).toContain(noteG);
      expect(result.matchedNotes).not.toContain(noteD);
    });

    it("includes ALL built notes with matching chroma (including chroma-collision duplicates)", () => {
      // Two C notes (both chroma 0); both should be in matchedNotes
      const noteC1 = makeFrettedNote(0, 0, "C", "1P", 60);
      const noteC2 = makeFrettedNote(5, 8, "C", "1P", 72);
      const noteE = makeFrettedNote(1, 4, "E", "3M", 64);
      const built = makeBuiltScale([noteC1, noteE, noteC2]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      // matchedNotes includes all built notes whose chroma is in probe — both C notes
      expect(result.matchedNotes).toHaveLength(3);
      expect(result.matchedNotes).toContain(noteC1);
      expect(result.matchedNotes).toContain(noteC2);
      expect(result.matchedNotes).toContain(noteE);
    });
  });

  // ---------------------------------------------------------------------------
  // Total score formula
  // ---------------------------------------------------------------------------

  describe("total score formula", () => {
    it("total = 100*coverage + 40*tightness + 30*anchorHit + 10*rootOnAnchorString + 20*positionAgreement + 15*rootPreference", () => {
      // Construct a scenario where we can compute expected total manually
      // Built: C(1P on string 0), E(3M on string 1), G(5P on string 2) — 3 distinct chromas
      // Probe: chromas [0,4,7], rootCandidates[0] = C(0), anchorString=0, anchorFret=0
      // builtAnchorFret=0, root={pc:"C", chroma:0}
      //
      // coverage = 3/3 = 1.0
      // tightness = 3/3 = 1.0
      // anchorHit = true (C is "1P" on string 0, chroma matches rootCandidates[0].chroma=0)
      // rootOnAnchorString = true
      // positionAgreement = 1.0 (builtAnchorFret=0 == probe.anchorFret=0)
      // rootPreference = 1.0 (root is at rank 0)
      // total = 100*1 + 40*1 + 30*1 + 10*1 + 20*1 + 15*1 = 215
      const built = makeBuiltScale([
        makeFrettedNote(0, 0, "C", "1P", 60),
        makeFrettedNote(1, 4, "E", "3M", 64),
        makeFrettedNote(2, 7, "G", "5P", 67),
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0,
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      expect(result.total).toBeCloseTo(215, 5);
      expect(result.coverage).toBe(1.0);
      expect(result.breakdown.tightness).toBe(1.0);
      expect(result.breakdown.anchorHit).toBe(true);
      expect(result.breakdown.rootOnAnchorString).toBe(true);
      expect(result.breakdown.positionAgreement).toBe(1.0);
      expect(result.breakdown.rootPreference).toBe(1.0);
    });

    it("total is correct for a partial-match scenario", () => {
      // Built: 7 distinct chromas (C major); probe: 3 chromas [0,4,7]
      // root=C at rank 0; anchorFret=0 == builtAnchorFret=0
      // "1P" (C) on string 2, not anchorString=0 → anchorHit=false, rootOnAnchorString=false
      const built = makeBuiltScale([
        makeFrettedNote(0, 2, "D", "2M", 62),
        makeFrettedNote(0, 4, "E", "3M", 64),
        makeFrettedNote(0, 5, "F", "4P", 65),
        makeFrettedNote(0, 7, "G", "5P", 67),
        makeFrettedNote(0, 9, "A", "6M", 69),
        makeFrettedNote(0, 11, "B", "7M", 71),
        makeFrettedNote(2, 0, "C", "1P", 60), // "1P" on string 2
      ]);
      const probe: InferenceProbe = {
        pitchClasses: [0, 4, 7],
        rootCandidates: [{ pc: "C", chroma: 0 }],
        anchorFret: 0,
        anchorString: 0, // looking for "1P" on string 0
      };
      const result = scoreShapeMatch(probe, minimalShape, { pc: "C", chroma: 0 }, built, 0);
      // coverage = 3/3 = 1.0
      // tightness = 3/7
      // anchorHit = false (no "1P" on string 0)
      // rootOnAnchorString = false
      // positionAgreement = 1.0
      // rootPreference = 1.0
      // total = 100 + 40*(3/7) + 0 + 0 + 20 + 15 = 135 + 40*(3/7)
      const expected = 100 * 1.0 + 40 * (3 / 7) + 30 * 0 + 10 * 0 + 20 * 1.0 + 15 * 1.0;
      expect(result.total).toBeCloseTo(expected, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration-level: scoreShapeMatch with real built scales
  // ---------------------------------------------------------------------------

  describe("scoreShapeMatch with real buildFrettedScale output", () => {
    it("Fixture (g) cross-check: CAGED_A of A built at anchorFret 11 vs probe anchorFret 0", () => {
      // CAGED_A of A: first interval on rootString(1) is "7M" = G#/Ab at A-string → fret 11
      // This exercises the circular fret distance logic
      const builtScale = buildFrettedScale(CAGED_A, "A");
      expect(builtScale.empty).toBe(false);

      // Probe: open A major (anchorFret=0)
      const probe: InferenceProbe = {
        pitchClasses: [9, 1, 4], // A(9), C#(1), E(4)
        rootCandidates: [
          { pc: "A", chroma: 9 },
          { pc: "E", chroma: 4 },
          { pc: "C#", chroma: 1 },
        ],
        anchorFret: 0,
        anchorString: 1,
      };
      const root = { pc: "A", chroma: 9 };

      // builtAnchorFret for CAGED_A of A = 11 (first interval "7M" of A = G# on A-string)
      const result = scoreShapeMatch(probe, CAGED_A, root, builtScale, 11);

      // coverage should be 1.0 (A major shape contains A, C#, E)
      expect(result.coverage).toBe(1.0);

      // positionAgreement: d = |11 - 0| % 12 = 11; circularDelta = min(11, 1) = 1
      // positionAgreement = 1 - 1/12 ≈ 0.9167
      expect(result.breakdown.positionAgreement).toBeCloseTo(1 - 1 / 12, 10);

      // total should be computed correctly
      expect(result.total).toBeGreaterThan(0);
    });

    it("C major G-shape: coverage 1.0 for probe chromas {9,0,4,7} (Am7 in C major)", () => {
      // buildFrettedScale(CAGED_G, "C") contains A(9), C(0), E(4), G(7)
      const builtScale = buildFrettedScale(CAGED_G, "C");
      expect(builtScale.empty).toBe(false);

      const probe: InferenceProbe = {
        pitchClasses: [9, 0, 4, 7], // A, C, E, G
        rootCandidates: [{ pc: "A", chroma: 9 }],
        anchorFret: 5,
        anchorString: 0,
      };
      // G-Shape of C anchors at fret 5 (first interval "6M" of C = A at low-E fret 5)
      const result = scoreShapeMatch(probe, CAGED_G, { pc: "C", chroma: 0 }, builtScale, 5);

      expect(result.coverage).toBe(1.0);
      expect(result.breakdown.positionAgreement).toBe(1.0); // anchorFret 5 == probe.anchorFret 5
      expect(result.matchedIntervals).toHaveLength(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Import the CAGED_A shape for the fixture-g test
  // ---------------------------------------------------------------------------
});
