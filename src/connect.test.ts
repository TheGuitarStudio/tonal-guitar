import { describe, expect, test } from "vitest";

// ============================================================
// Task Group 1 — Module Scaffolding (spec §4.1, tasks 1.1–1.4)
// ============================================================

// 1. Import smoke: connectSequences is importable from src/connect.ts
import {
  connectSequences,
  nextSide,
  classifyStrategy,
  type ChainDirection,
  type ConnectSequencesInput,
  type ConnectorOptions,
  type ConnectorStrategy,
  type ConnectSequencesResult,
} from "./connect";

// 2. Re-export smoke: all five types and connectSequences are re-exported from src/index.ts
import {
  connectSequences as connectSequencesFromIndex,
  type ChainDirection as ChainDirectionFromIndex,
  type ConnectSequencesInput as ConnectSequencesInputFromIndex,
  type ConnectorOptions as ConnectorOptionsFromIndex,
  type ConnectorStrategy as ConnectorStrategyFromIndex,
  type ConnectSequencesResult as ConnectSequencesResultFromIndex,
  buildFrettedScale,
  STANDARD,
  NoFrettedScale,
} from "./index";

// Shape constants for fixtures
import { CAGED_E, CAGED_D, CAGED_G } from "./data/caged-scales";

// ============================================================
// Fixtures for Task Group 2 (and future groups)
// ============================================================

// A major in standard tuning, all five CAGED shapes
const eShapeA = buildFrettedScale(CAGED_E, "A", STANDARD);
const dShapeA = buildFrettedScale(CAGED_D, "A", STANDARD);
const gShapeA = buildFrettedScale(CAGED_G, "A", STANDARD);

describe("Task Group 1: Module Scaffolding", () => {
  test("connectSequences is importable from src/connect.ts without throwing at import time", () => {
    // Verify the import resolved to a function value
    expect(typeof connectSequences).toBe("function");
  });

  test("all five types compile when imported from src/connect.ts", () => {
    // Type-only check: construct values that use the imported types.
    // If any type is missing the TypeScript compiler would reject this file.
    const _direction: ChainDirection = "ascending";
    const _strategy: ConnectorStrategy = "none";

    // Minimal objects that satisfy the interfaces — proves they compile
    const _opts: ConnectorOptions = { strategy: "auto", dedupSeam: true };
    const _result: ConnectSequencesResult = {
      connector: [],
      nextNotes: [],
      strategy: "none",
    };

    // We need ConnectSequencesInput to reference FrettedScale / FrettedNote,
    // so just verify the type can be named without error.
    type _InputAlias = ConnectSequencesInput;

    expect(_direction).toBe("ascending");
    expect(_strategy).toBe("none");
    expect(_opts.strategy).toBe("auto");
    expect(_result.strategy).toBe("none");
  });

  test("connectSequences is re-exported from src/index.ts", () => {
    expect(typeof connectSequencesFromIndex).toBe("function");
    // Verify they are the same function reference
    expect(connectSequencesFromIndex).toBe(connectSequences);
  });

  test("all five types are re-exported from src/index.ts", () => {
    // Type-level check mirrored from the connect.ts test above, but using
    // the index re-exports.  Compilation failure = missing re-export.
    const _direction: ChainDirectionFromIndex = "descending";
    const _strategy: ConnectorStrategyFromIndex = "extend";
    const _opts: ConnectorOptionsFromIndex = { dedupSeam: false };
    const _result: ConnectSequencesResultFromIndex = {
      connector: [],
      nextNotes: [],
      strategy: "reach-back",
    };
    type _InputAlias = ConnectSequencesInputFromIndex;

    expect(_direction).toBe("descending");
    expect(_strategy).toBe("extend");
    expect(_opts.dedupSeam).toBe(false);
    expect(_result.strategy).toBe("reach-back");
  });
});

// ============================================================
// Task Group 2 — Strategy Classifier (spec §3.1, §3.2, tasks 2.1–2.4)
// ============================================================

describe("Task Group 2: Strategy Classifier", () => {
  // ----------------------------------------------------------
  // nextSide — 5 cases (spec §3.2)
  // ----------------------------------------------------------

  describe("nextSide", () => {
    test('returns "higher" when nextTop > prevTop AND nextBottom > prevBottom (strict)', () => {
      // E Shape A major vs D Shape A major — D shape sits higher on the neck
      const side = nextSide(eShapeA, dShapeA);
      expect(side).toBe("higher");
    });

    test('returns "lower" when nextTop < prevTop AND nextBottom < prevBottom (strict)', () => {
      // D Shape A major vs E Shape A major — E shape sits lower
      const side = nextSide(dShapeA, eShapeA);
      expect(side).toBe("lower");
    });

    test('returns "same" when nextTop > prevTop but nextBottom === prevBottom (conjunction fails)', () => {
      // Build two synthetic scales where only the top differs but bottoms are equal
      const prevScale = {
        ...NoFrettedScale,
        empty: false,
        notes: [
          { string: 0, fret: 2, note: "F#2", pc: "F#", interval: "6M", scaleIndex: 0, degree: 1, intervalNumber: 6, midi: 42 },
          { string: 0, fret: 5, note: "A2",  pc: "A",  interval: "1P", scaleIndex: 0, degree: 1, intervalNumber: 1, midi: 45 },
        ],
      };
      const nextScale = {
        ...NoFrettedScale,
        empty: false,
        notes: [
          { string: 0, fret: 2, note: "F#2", pc: "F#", interval: "6M", scaleIndex: 0, degree: 1, intervalNumber: 6, midi: 42 },
          { string: 0, fret: 7, note: "B2",  pc: "B",  interval: "2M", scaleIndex: 0, degree: 2, intervalNumber: 2, midi: 47 },
        ],
      };
      // nextTop (47) > prevTop (45), nextBottom (42) === prevBottom (42) → "same"
      expect(nextSide(prevScale, nextScale)).toBe("same");
    });

    test('returns "same" when nextBottom < prevBottom but nextTop === prevTop (conjunction fails)', () => {
      const prevScale = {
        ...NoFrettedScale,
        empty: false,
        notes: [
          { string: 0, fret: 4, note: "G#2", pc: "G#", interval: "7M", scaleIndex: 0, degree: 1, intervalNumber: 7, midi: 44 },
          { string: 0, fret: 7, note: "B2",  pc: "B",  interval: "2M", scaleIndex: 0, degree: 2, intervalNumber: 2, midi: 47 },
        ],
      };
      const nextScale = {
        ...NoFrettedScale,
        empty: false,
        notes: [
          { string: 0, fret: 2, note: "F#2", pc: "F#", interval: "6M", scaleIndex: 0, degree: 1, intervalNumber: 6, midi: 42 },
          { string: 0, fret: 7, note: "B2",  pc: "B",  interval: "2M", scaleIndex: 0, degree: 2, intervalNumber: 2, midi: 47 },
        ],
      };
      // nextBottom (42) < prevBottom (44), nextTop (47) === prevTop (47) → "same"
      expect(nextSide(prevScale, nextScale)).toBe("same");
    });

    test('returns "same" for identical shape scales (E Shape A → E Shape A)', () => {
      // Both built from the same shape + root → exact same note set → "same"
      const eShapeA2 = buildFrettedScale(CAGED_E, "A", STANDARD);
      expect(nextSide(eShapeA, eShapeA2)).toBe("same");
    });
  });

  // ----------------------------------------------------------
  // classifyStrategy — 8 cases (full §3.1 truth table)
  // ----------------------------------------------------------

  describe("classifyStrategy", () => {
    // asc → desc
    test('(asc → desc, higher) → "extend" (spec §3.1 V1)', () => {
      expect(classifyStrategy("ascending", "descending", "higher")).toBe("extend");
    });

    test('(asc → desc, lower) → "reach-back" (spec §3.1 V2)', () => {
      expect(classifyStrategy("ascending", "descending", "lower")).toBe("reach-back");
    });

    test('(asc → desc, same) → "reach-back"', () => {
      expect(classifyStrategy("ascending", "descending", "same")).toBe("reach-back");
    });

    // desc → asc
    test('(desc → asc, higher) → "reach-back" (spec §3.1 V3)', () => {
      expect(classifyStrategy("descending", "ascending", "higher")).toBe("reach-back");
    });

    test('(desc → asc, lower) → "extend" (spec §3.1 V4)', () => {
      expect(classifyStrategy("descending", "ascending", "lower")).toBe("extend");
    });

    test('(desc → asc, same) → "reach-back"', () => {
      expect(classifyStrategy("descending", "ascending", "same")).toBe("reach-back");
    });

    // Same-direction — always "none" regardless of side
    test('(asc → asc, any side) → "none"', () => {
      expect(classifyStrategy("ascending", "ascending", "higher")).toBe("none");
      expect(classifyStrategy("ascending", "ascending", "lower")).toBe("none");
      expect(classifyStrategy("ascending", "ascending", "same")).toBe("none");
    });

    test('(desc → desc, any side) → "none"', () => {
      expect(classifyStrategy("descending", "descending", "higher")).toBe("none");
      expect(classifyStrategy("descending", "descending", "lower")).toBe("none");
      expect(classifyStrategy("descending", "descending", "same")).toBe("none");
    });
  });

  // ----------------------------------------------------------
  // Integration: nextSide + classifyStrategy on real scales
  // ----------------------------------------------------------

  describe("nextSide + classifyStrategy integration", () => {
    test("E Shape A asc → D Shape A: nextSide=higher → strategy=extend", () => {
      const side = nextSide(eShapeA, dShapeA);
      const strategy = classifyStrategy("ascending", "descending", side);
      expect(side).toBe("higher");
      expect(strategy).toBe("extend");
    });

    test("E Shape A asc → G Shape A: nextSide=lower → strategy=reach-back", () => {
      const side = nextSide(eShapeA, gShapeA);
      const strategy = classifyStrategy("ascending", "descending", side);
      expect(side).toBe("lower");
      expect(strategy).toBe("reach-back");
    });

    test("E Shape A asc → E Shape A (identical): nextSide=same → strategy=reach-back", () => {
      const eShapeA2 = buildFrettedScale(CAGED_E, "A", STANDARD);
      const side = nextSide(eShapeA, eShapeA2);
      const strategy = classifyStrategy("ascending", "descending", side);
      expect(side).toBe("same");
      expect(strategy).toBe("reach-back");
    });
  });
});
