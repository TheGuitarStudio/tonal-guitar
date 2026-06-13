/**
 * Tests for src/arpeggio.ts — Task Group 2 smoke tests.
 *
 * These tests verify:
 *   - All named exports resolve from both `src/arpeggio` and `src/index`
 *   - InferenceProbe and ScoreBreakdown compile as types
 *   - Stub filterChordTones throws "not implemented"
 *   - Stub scoreShapeMatch throws "not implemented"
 *
 * Later task groups (3, 4) will add the implementation tests.
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

  describe("stub filterChordTones throws 'not implemented'", () => {
    it("throws when called with a valid scale and interval array", () => {
      const scale: FrettedScale = { ...NoFrettedScale };
      expect(() => filterChordTones(scale, ["1P", "3M"])).toThrow(
        "not implemented",
      );
    });

    it("throws when called via index re-export", () => {
      const scale: FrettedScale = { ...NoFrettedScale };
      expect(() => filterChordTonesFromIndex(scale, ["1P"])).toThrow(
        "not implemented",
      );
    });
  });

  describe("stub scoreShapeMatch throws 'not implemented'", () => {
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
