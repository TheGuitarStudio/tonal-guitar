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
import { CAGED_G, CAGED_E } from "./data/caged-scales";

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

  describe("stub scoreShapeMatch throws 'not implemented' (TG4 will replace)", () => {
    it("throws when called with minimal valid arguments", () => {
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
      expect(() => scoreShapeMatch(probe, shape, root, built)).toThrow(
        "not implemented",
      );
    });

    it("throws when called via index re-export", () => {
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
        }),
      ).toThrow("not implemented");
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
