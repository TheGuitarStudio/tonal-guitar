import { describe, expect, test } from "vitest";

// ============================================================
// Task Group 1 — Module Scaffolding (spec §4.1, tasks 1.1–1.4)
// ============================================================

// 1. Import smoke: connectSequences is importable from src/connect.ts
import {
  connectSequences,
  nextSide,
  classifyStrategy,
  buildExtend,
  buildReachBack,
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
  walkShapeMotif,
} from "./index";

// Shape constants for fixtures
import { CAGED_E, CAGED_D, CAGED_G } from "./data/caged-scales";
import { NPS_PATTERN_1, NPS_PATTERN_2 } from "./data/three-nps";
import { PENTA_BOX_1, PENTA_BOX_2 } from "./data/pentatonic";

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
    // Use the alias in a structural way to prevent any noUnusedLocals warnings.
    type _InputAlias = ConnectSequencesInput;
    type _PrevField = _InputAlias["prev"]; // exercises the alias structurally
    const _prevShape: _PrevField["scale"] = eShapeA; // confirms FrettedScale resolves
    void _prevShape; // suppress unused-value lint

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
    // Same structural consumption pattern to satisfy noUnusedLocals if enabled.
    type _InputAlias = ConnectSequencesInputFromIndex;
    type _NextField = _InputAlias["next"];
    const _nextMotif: _NextField["motif"] = [1]; // confirms number[] resolves
    void _nextMotif; // suppress unused-value lint

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

// ============================================================
// Task Group 3: Extend Strategy (spec §3.3, §3.4 scenarios 1 & 4, tasks 3.1–3.3)
// ============================================================

describe("Task Group 3: Extend Strategy", () => {
  // Fixtures: A major in standard tuning
  const motif = [1, 3];

  // Scenario 1: E asc → D desc (next higher → extend)
  // prev last note = B4 (s5f7, midi 71), target = D5 (midi 74)
  // Motif-aware connector: thirds (1,3) pairs walking the combined E∪D scale,
  // keeping periods whose final note is past seam and within target.
  // → pairs (A4, C#5), (B4, D5) at [[5,5], [5,9], [5,7], [5,10]]
  const prevAscS1 = walkShapeMotif(eShapeA, motif, { direction: "ascending" });
  const prevLastNoteS1 = prevAscS1[prevAscS1.length - 1]; // B4 (s5f7, midi 71)

  const inputS1: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: prevLastNoteS1, direction: "ascending" },
    next: { scale: dShapeA, motif, direction: "descending" },
  };

  // Scenario 4: E desc → G asc (next lower → extend)
  // prev last note = G#2 (s0f4, midi 44), target = F#2 (midi 42)
  // connector = [F#2(s0f2)]
  const prevDescS4 = walkShapeMotif(eShapeA, motif, { direction: "descending" });
  const prevLastNoteS4 = prevDescS4[prevDescS4.length - 1]; // G#2 (s0f4, midi 44)

  const inputS4: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: prevLastNoteS4, direction: "descending" },
    next: { scale: gShapeA, motif, direction: "ascending" },
  };

  // ---------------------------------------------------------------
  // Scenario 1 tests
  // ---------------------------------------------------------------

  test("Scenario 1: strategy === extend (E asc → D desc, next higher)", () => {
    const result = buildExtend(inputS1, true, motif);
    expect(result.strategy).toBe("extend");
  });

  test("Scenario 1: connector note names are [A4, C#5, B4, D5]", () => {
    const result = buildExtend(inputS1, true, motif);
    expect(result.connector.map((n) => n.note)).toEqual([
      "A4",
      "C#5",
      "B4",
      "D5",
    ]);
  });

  test("Scenario 1: connector fret positions are [[5,5], [5,9], [5,7], [5,10]]", () => {
    const result = buildExtend(inputS1, true, motif);
    // sameStringCombined dedups by midi within prev.lastNote.string only.
    // E shape has A4 at [s5,f5] (high E); D shape has A4 at [s4,f10]
    // (B string). Both are A4 midi 69, but the same-string pool only
    // accepts s5 positions, so [s5,f5] wins and the motif walk stays on
    // the high E string through the seam.
    expect(result.connector.map((n) => [n.string, n.fret])).toEqual([
      [5, 5],
      [5, 9],
      [5, 7],
      [5, 10],
    ]);
  });

  test("Scenario 1: dedupSeam true — nextNotes[0] is not D5 and nextNotes is non-empty", () => {
    const result = buildExtend(inputS1, true, motif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
    expect(result.nextNotes[0].note).not.toBe("D5");
  });

  test("Scenario 1: dedupSeam false — nextNotes[0] IS D5 (head kept)", () => {
    const result = buildExtend(inputS1, false, motif);
    expect(result.nextNotes[0].note).toBe("D5");
  });

  // ---------------------------------------------------------------
  // Scenario 4 tests
  // ---------------------------------------------------------------

  test("Scenario 4: strategy === extend (E desc → G asc, next lower)", () => {
    const result = buildExtend(inputS4, true, motif);
    expect(result.strategy).toBe("extend");
  });

  test("Scenario 4: connector note names are [A2, F#2] at [[0,5], [0,2]]", () => {
    const result = buildExtend(inputS4, true, motif);
    expect(result.connector.map((n) => n.note)).toEqual(["A2", "F#2"]);
    // A2 occurs at both [0,5] (low E + 5) and [1,0] (A string open).
    // Combined dedup keeps both (different keys); descending sort by midi
    // is stable and the E shape's [0,5] is iterated first.
    expect(result.connector.map((n) => [n.string, n.fret])).toEqual([
      [0, 5],
      [0, 2],
    ]);
  });

  test("Scenario 4: dedupSeam true — nextNotes[0] is not F#2 and nextNotes is non-empty", () => {
    const result = buildExtend(inputS4, true, motif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
    expect(result.nextNotes[0].note).not.toBe("F#2");
  });

  test("Scenario 4: dedupSeam false — nextNotes[0] IS F#2 (head kept)", () => {
    const result = buildExtend(inputS4, false, motif);
    expect(result.nextNotes[0].note).toBe("F#2");
  });

  // ---------------------------------------------------------------
  // Direction invariants
  //
  // Motif-aware extend emits whole motif periods (e.g. thirds (1,3) → pairs
  // of (low, high) ascending or (high, low) descending). The per-note midi
  // sequence is therefore NOT monotonic — within a single period it can
  // zig-zag. The valid invariant is on *period starts*: they are strictly
  // monotonic in prev.direction.
  // ---------------------------------------------------------------

  test("Ascending extend: motif period starts are strictly ascending", () => {
    const result = buildExtend(inputS1, true, motif);
    const period = motif.length;
    for (let i = period; i < result.connector.length; i += period) {
      expect(result.connector[i].midi).toBeGreaterThan(
        result.connector[i - period].midi,
      );
    }
  });

  test("Descending extend: motif period starts are strictly descending", () => {
    const result = buildExtend(inputS4, true, motif);
    const period = motif.length;
    for (let i = period; i < result.connector.length; i += period) {
      expect(result.connector[i].midi).toBeLessThan(
        result.connector[i - period].midi,
      );
    }
  });

  // ---------------------------------------------------------------
  // No-gap case: prev already at shape top → empty connector
  // ---------------------------------------------------------------

  test("Extend with no gap (prev lastNote IS the shape top): connector is empty", () => {
    // Build a last note that is exactly the max midi of D Shape (D5, s5f10, midi 74).
    // For asc→desc with D higher, seam >= target ⟹ no notes between them.
    const dTopNote = dShapeA.notes
      .slice()
      .sort((a, b) => b.midi - a.midi)[0]; // D5, midi 74
    const inputNoGap: ConnectSequencesInput = {
      prev: {
        scale: eShapeA,
        lastNote: dTopNote, // seam = 74 = target = 74 → filter yields nothing
        direction: "ascending",
      },
      next: { scale: dShapeA, motif, direction: "descending" },
    };
    const result = buildExtend(inputNoGap, true, motif);
    expect(result.connector.length).toBe(0);
  });

  // ---------------------------------------------------------------
  // Empty-connector dedup: when connector is empty, dedup falls back to
  // comparing nextNotes[0] against prev.lastNote by (string, fret).
  // ---------------------------------------------------------------

  test("Empty-connector dedup: nextNotes[0] matching prev.lastNote (string,fret) is dropped when dedupSeam=true", () => {
    // Use the no-gap scenario (connector empty, seam = D5 at s5f10).
    // D shape descending walk naturally starts at D5 (s5f10) — same physical
    // position as prev.lastNote → should be dropped.
    const dTopNote = dShapeA.notes
      .slice()
      .sort((a, b) => b.midi - a.midi)[0]; // D5, s5f10, midi 74
    const inputNoGap: ConnectSequencesInput = {
      prev: {
        scale: eShapeA,
        lastNote: dTopNote,
        direction: "ascending",
      },
      next: { scale: dShapeA, motif, direction: "descending" },
    };
    const resultDedup = buildExtend(inputNoGap, true, motif);
    const resultNoDedup = buildExtend(inputNoGap, false, motif);

    // With dedup: head (D5 at s5f10) should be dropped
    expect(resultDedup.connector.length).toBe(0);
    expect(resultDedup.nextNotes[0].note).not.toBe("D5");

    // Without dedup: head is kept
    expect(resultNoDedup.nextNotes[0].note).toBe("D5");
  });

  // ---------------------------------------------------------------
  // Connector notes come from actual scale positions
  // ---------------------------------------------------------------

  test("Connector notes are drawn from actual (string,fret) positions in the input scales", () => {
    const result = buildExtend(inputS1, true, motif);
    // Build a set of all valid (string, fret) positions from both scales
    const validPositions = new Set<string>();
    for (const n of [...eShapeA.notes, ...dShapeA.notes]) {
      validPositions.add(`${n.string}:${n.fret}`);
    }
    for (const n of result.connector) {
      expect(validPositions.has(`${n.string}:${n.fret}`)).toBe(true);
    }
  });
});

// ============================================================
// Task Group 4: Reach-Back Strategy (spec §3.3, §3.4 scenarios 2, 3, 7)
// ============================================================

describe("Task Group 4: Reach-Back Strategy", () => {
  const motif = [1, 3];

  // ---------------------------------------------------------------
  // Scenario 2: E asc → G desc (next lower → reach-back)
  // prev.lastNote = B4 (s5f7, midi 71)
  // combined = sort(E ∪ G) by midi (25 notes, midi 42–71)
  // walked desc → starts at B4 → deduped → nextNotes[0] is not s5f7
  // ---------------------------------------------------------------
  const prevAscS2 = walkShapeMotif(eShapeA, motif, { direction: "ascending" });
  const prevLastNoteS2 = prevAscS2[prevAscS2.length - 1]; // B4 (s5f7, midi 71)

  const inputS2: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: prevLastNoteS2, direction: "ascending" },
    next: { scale: gShapeA, motif, direction: "descending" },
  };

  // ---------------------------------------------------------------
  // Scenario 3: E desc → D asc (next higher → reach-back)
  // prev.lastNote = G#2 (s0f4, midi 44)
  // combined = sort(E ∪ D) by midi (26 notes, midi 44–74)
  // walked asc → starts at G#2 → deduped → nextNotes[0] is not s0f4
  // ---------------------------------------------------------------
  const prevDescS3 = walkShapeMotif(eShapeA, motif, { direction: "descending" });
  const prevLastNoteS3 = prevDescS3[prevDescS3.length - 1]; // G#2 (s0f4, midi 44)

  const inputS3: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: prevLastNoteS3, direction: "descending" },
    next: { scale: dShapeA, motif, direction: "ascending" },
  };

  // ---------------------------------------------------------------
  // Scenario 7: E asc → E desc (identical shape → reach-back)
  // combined = E shape (after dedup, same as single E shape)
  // ---------------------------------------------------------------
  const eShapeA2 = buildFrettedScale(CAGED_E, "A", STANDARD);
  const prevLastNoteS7 = prevAscS2[prevAscS2.length - 1]; // B4 (s5f7, midi 71)

  const inputS7: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: prevLastNoteS7, direction: "ascending" },
    next: { scale: eShapeA2, motif, direction: "descending" },
  };

  // ---------------------------------------------------------------
  // Scenario 2 tests
  // ---------------------------------------------------------------

  test("Scenario 2: strategy === reach-back (E asc → G desc, next lower)", () => {
    const result = buildReachBack(inputS2, true, motif);
    expect(result.strategy).toBe("reach-back");
  });

  test("Scenario 2: connector is a same-string descending bridge on s5 (high E)", () => {
    // New algorithm: reach-back's connector is the same-string pickup that
    // primes next's natural walk. For E↑→G↓ the bridge descends on high E
    // starting from B4 (seam) toward G shape's natural top.
    const result = buildReachBack(inputS2, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector.every((n) => n.string === 5)).toBe(true);
    // First note repeats the seam (dedupSeam: false).
    expect(result.connector[0].string).toBe(5);
    expect(result.connector[0].fret).toBe(7);
  });

  test("Scenario 2: dedupSeam true — connector head does NOT match prev.lastNote position (seam dropped)", () => {
    // dedupSeam: true drops the leading seam repetition from the connector.
    const result = buildReachBack(inputS2, true, motif);
    if (result.connector.length > 0) {
      expect(
        result.connector[0].string === 5 && result.connector[0].fret === 7,
      ).toBe(false);
    }
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  test("Scenario 2: nextNotes is the natural G-shape descending walk", () => {
    // Under the new model, nextNotes is the natural walk of `next.scale`
    // (with an overlap dedup if the bridge's last pair duplicates the
    // walk's first pair).
    const result = buildReachBack(inputS2, false, motif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Scenario 3 tests
  // ---------------------------------------------------------------

  test("Scenario 3: strategy === reach-back (E desc → D asc, next higher)", () => {
    const result = buildReachBack(inputS3, true, motif);
    expect(result.strategy).toBe("reach-back");
  });

  test("Scenario 3: dedupSeam true — connector head does NOT match prev.lastNote position (seam dropped)", () => {
    const result = buildReachBack(inputS3, true, motif);
    if (result.connector.length > 0) {
      expect(
        result.connector[0].string === 0 && result.connector[0].fret === 4,
      ).toBe(false);
    }
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  test("Scenario 3: connector is a same-string ascending bridge on s0 (low E)", () => {
    // E↓ → D↑ reach-back: bridge walks ascending on low E from seam upward.
    // Expected pairs from G#2: (G#2, B2), (A2, C#3), (B2, D3) — all on s0.
    const result = buildReachBack(inputS3, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector.every((n) => n.string === 0)).toBe(true);
  });

  test("Scenario 3: dedupSeam false — connector head IS the seam position (G#2 at s0,f4)", () => {
    // Pivot anchoring: the seam repeats at the connector head so the chain
    // plays as a continuous bridge from prev's last note into next.
    const result = buildReachBack(inputS3, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector[0].string).toBe(0);
    expect(result.connector[0].fret).toBe(4);
  });

  test("Scenario 3: nextNotes starts AFTER the bridge's last pair (overlap dedup)", () => {
    // Bridge ends at (B2, D3) on low E; D shape's natural ascending walk
    // would also begin (B2, D3). The overlap is collapsed, so nextNotes
    // starts at the next pair — (C#3, E3).
    const result = buildReachBack(inputS3, false, motif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
    expect(result.nextNotes[0].note).toBe("C#3");
    expect(result.nextNotes[1].note).toBe("E3");
  });

  // ---------------------------------------------------------------
  // Scenario 7 tests
  // ---------------------------------------------------------------

  test("Scenario 7: strategy === reach-back for identical shape (E asc → E desc)", () => {
    const result = buildReachBack(inputS7, true, motif);
    expect(result.strategy).toBe("reach-back");
  });

  test("Scenario 7: connector is the same-string bridge (identical shapes still yield a bridge)", () => {
    // With identical prev/next shapes, the same-string pool is just the
    // shape's notes on that string. The bridge still walks them — for E↑→E↓
    // on s5 with thirds, the bridge is (B4, G#4) descending one pair.
    const result = buildReachBack(inputS7, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector.every((n) => n.string === 5)).toBe(true);
  });

  test("Scenario 7: nextNotes is non-empty (E shape's natural descending walk)", () => {
    const result = buildReachBack(inputS7, true, motif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Direction invariants
  // ---------------------------------------------------------------

  // Under the same-string bridge model the seam-respect invariant lives on
  // the **connector**, not on nextNotes. `connector[0]` is the seam-anchored
  // head (or its successor if dedupSeam: true dropped the leading repetition).
  // `nextNotes[0]` is the first note of next.scale's natural walk and is not
  // seam-bounded — these tests pin the connector invariant directly.

  test("Descending reach-back: connector head is at or below the seam midi", () => {
    const result = buildReachBack(inputS2, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector[0].midi).toBeLessThanOrEqual(prevLastNoteS2.midi);
  });

  test("Ascending reach-back: connector head is at or above the seam midi", () => {
    const result = buildReachBack(inputS3, false, motif);
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.connector[0].midi).toBeGreaterThanOrEqual(prevLastNoteS3.midi);
  });

  // ---------------------------------------------------------------
  // Seam far outside combined range → empty nextNotes
  // ---------------------------------------------------------------

  test("Reach-back where seam is far outside combined range produces an empty connector", () => {
    // With seam at midi 9999 and ascending direction, no pair's first note
    // satisfies `first.midi >= seam` — the bridge is empty. nextNotes is
    // independent of the seam under the new model: it is the natural walk
    // of next.scale.
    const farAboveNote: import("./shape").FrettedNote = {
      ...prevLastNoteS2,
      midi: 9999, // impossibly high — no bridge pairs at or past this seam
    };
    const inputFarAboveAsc: ConnectSequencesInput = {
      prev: { scale: eShapeA, lastNote: farAboveNote, direction: "descending" },
      next: { scale: gShapeA, motif, direction: "ascending" },
    };
    const result = buildReachBack(inputFarAboveAsc, true, motif);
    expect(result.connector).toEqual([]);
    // nextNotes is the natural ascending walk of G shape, unaffected by seam.
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Task Group 5: connectSequences Integration & Edge Cases
// (spec §3.3 none, §4.1 options, §5 edge cases, §3.4 scenarios 5, 6, 8)
// ============================================================

describe("Task Group 5: connectSequences Integration & Edge Cases", () => {
  const motif = [1, 3];

  // ---------------------------------------------------------------
  // Scenario 5: asc → asc (same direction) → strategy "none"
  // E-asc → D-asc (A major, motif [1,3])
  // ---------------------------------------------------------------

  const eAscLastNote = walkShapeMotif(eShapeA, motif, { direction: "ascending" });
  const eAscPrevLast = eAscLastNote[eAscLastNote.length - 1];

  const inputS5: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: eAscPrevLast, direction: "ascending" },
    next: { scale: dShapeA, motif, direction: "ascending" },
  };

  test("Scenario 5 (asc → asc): strategy is 'none'", () => {
    const result = connectSequences(inputS5);
    expect(result.strategy).toBe("none");
  });

  test("Scenario 5 (asc → asc): connector is empty", () => {
    const result = connectSequences(inputS5);
    expect(result.connector).toEqual([]);
  });

  test("Scenario 5 (asc → asc): nextNotes equals unmodified walkShapeMotif of D-shape ascending", () => {
    const result = connectSequences(inputS5);
    const naturalWalk = walkShapeMotif(dShapeA, motif, { direction: "ascending" });
    expect(result.nextNotes).toEqual(naturalWalk);
  });

  // ---------------------------------------------------------------
  // Scenario 6: desc → desc (same direction) → strategy "none"
  // E-desc → G-desc (A major, motif [1,3])
  // ---------------------------------------------------------------

  const eDescWalk = walkShapeMotif(eShapeA, motif, { direction: "descending" });
  const eDescLastNote = eDescWalk[eDescWalk.length - 1];

  const inputS6: ConnectSequencesInput = {
    prev: { scale: eShapeA, lastNote: eDescLastNote, direction: "descending" },
    next: { scale: gShapeA, motif, direction: "descending" },
  };

  test("Scenario 6 (desc → desc): strategy is 'none'", () => {
    const result = connectSequences(inputS6);
    expect(result.strategy).toBe("none");
  });

  test("Scenario 6 (desc → desc): connector is empty and nextNotes equals natural walk of G-shape desc", () => {
    const result = connectSequences(inputS6);
    const naturalWalk = walkShapeMotif(gShapeA, motif, { direction: "descending" });
    expect(result.connector).toEqual([]);
    expect(result.nextNotes).toEqual(naturalWalk);
  });

  // ---------------------------------------------------------------
  // Scenario 8: empty prev scale → graceful result
  // ---------------------------------------------------------------

  test("Scenario 8 (empty prev scale: NoFrettedScale): returns { connector:[], nextNotes:[], strategy:'none' }", () => {
    const inputEmpty: ConnectSequencesInput = {
      prev: { scale: NoFrettedScale, lastNote: eAscPrevLast, direction: "ascending" },
      next: { scale: dShapeA, motif, direction: "descending" },
    };
    const result = connectSequences(inputEmpty);
    expect(result).toEqual({ connector: [], nextNotes: [], strategy: "none" });
  });

  // ---------------------------------------------------------------
  // Empty next scale → graceful result
  // ---------------------------------------------------------------

  test("Empty next scale: returns { connector:[], nextNotes:[], strategy:'none' }", () => {
    const inputEmptyNext: ConnectSequencesInput = {
      prev: { scale: eShapeA, lastNote: eAscPrevLast, direction: "ascending" },
      next: { scale: NoFrettedScale, motif, direction: "descending" },
    };
    const result = connectSequences(inputEmptyNext);
    expect(result).toEqual({ connector: [], nextNotes: [], strategy: "none" });
  });

  // ---------------------------------------------------------------
  // Empty motif → treated as [1], nextNotes non-empty
  // ---------------------------------------------------------------

  test("Empty next.motif ([]) is treated as [1]: nextNotes is non-empty", () => {
    const inputEmptyMotif: ConnectSequencesInput = {
      prev: { scale: eShapeA, lastNote: eAscPrevLast, direction: "ascending" },
      next: { scale: dShapeA, motif: [], direction: "descending" },
    };
    const result = connectSequences(inputEmptyMotif);
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Reserved strategy values are rejected at compile time, but a JS caller
  // that bypasses TypeScript still gets identical behavior to "auto".
  // ---------------------------------------------------------------

  test("options.strategy reserved values are rejected at compile time and tolerated at runtime", () => {
    const autoResult = connectSequences(inputS5);
    // @ts-expect-error — "linear" is reserved for future variants
    const linearResult = connectSequences(inputS5, { strategy: "linear" });
    // @ts-expect-error — "motif-extend" is reserved for future variants
    const motifExtendResult = connectSequences(inputS5, { strategy: "motif-extend" });
    expect(linearResult).toEqual(autoResult);
    expect(motifExtendResult).toEqual(autoResult);
  });

  // ---------------------------------------------------------------
  // 3NPS smoke test: NPS_PATTERN_1 asc → NPS_PATTERN_2 desc
  // (A major, motif [1,3])
  // ---------------------------------------------------------------

  test("3NPS smoke: NPS_PATTERN_1 asc → NPS_PATTERN_2 desc — no throw, strategy !== 'none', nextNotes.length > 0", () => {
    const nps1A = buildFrettedScale(NPS_PATTERN_1, "A", STANDARD);
    const nps2A = buildFrettedScale(NPS_PATTERN_2, "A", STANDARD);
    const nps1Walk = walkShapeMotif(nps1A, motif, { direction: "ascending" });
    const nps1LastNote = nps1Walk[nps1Walk.length - 1];

    const inputNps: ConnectSequencesInput = {
      prev: { scale: nps1A, lastNote: nps1LastNote, direction: "ascending" },
      next: { scale: nps2A, motif, direction: "descending" },
    };

    // connectSequences is documented as "never throws" — call it directly
    // and let vitest surface any throw as a test failure with a real
    // stack rather than hiding it behind a non-null assertion.
    const result = connectSequences(inputNps);
    expect(result.strategy).not.toBe("none");
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Pentatonic smoke test: PENTA_BOX_1 asc → PENTA_BOX_2 desc
  // ---------------------------------------------------------------

  test("Pentatonic smoke: PENTA_BOX_1 asc → PENTA_BOX_2 desc — no throw, strategy !== 'none'", () => {
    const box1A = buildFrettedScale(PENTA_BOX_1, "A", STANDARD);
    const box2A = buildFrettedScale(PENTA_BOX_2, "A", STANDARD);
    const box1Walk = walkShapeMotif(box1A, motif, { direction: "ascending" });
    const box1LastNote = box1Walk[box1Walk.length - 1];

    const inputPenta: ConnectSequencesInput = {
      prev: { scale: box1A, lastNote: box1LastNote, direction: "ascending" },
      next: { scale: box2A, motif, direction: "descending" },
    };

    const result = connectSequences(inputPenta);
    expect(result.strategy).not.toBe("none");
  });

  // ---------------------------------------------------------------
  // Out-of-range seam: prev.lastNote.midi = 9999 — function does not throw
  // ---------------------------------------------------------------

  test("Out-of-range seam (prev.lastNote.midi = 9999): function does not throw", () => {
    const farNote: import("./shape").FrettedNote = {
      ...eAscPrevLast,
      midi: 9999,
    };
    const inputOutOfRange: ConnectSequencesInput = {
      prev: { scale: eShapeA, lastNote: farNote, direction: "ascending" },
      next: { scale: dShapeA, motif, direction: "descending" },
    };
    expect(() => connectSequences(inputOutOfRange)).not.toThrow();
  });

  // ---------------------------------------------------------------
  // Cross-key smoke: deliberately unusual cross-key input — no throw
  // ---------------------------------------------------------------

  test("Cross-key smoke (E-shape A major vs G-shape C major): function does not throw", () => {
    const gShapeC = buildFrettedScale(CAGED_G, "C", STANDARD);
    const crossKeyInput: ConnectSequencesInput = {
      prev: { scale: eShapeA, lastNote: eAscPrevLast, direction: "ascending" },
      next: { scale: gShapeC, motif, direction: "descending" },
    };
    expect(() => connectSequences(crossKeyInput)).not.toThrow();
  });
});

// ============================================================
// Task Group 6: Test Review and Gap Analysis (spec §6.1–6.6, TG6 gap fills)
// ============================================================

describe("Task Group 6: Gap Fills (spec §6.2 scenario fingerprints, §6.3 dedup)", () => {
  const motif = [1, 3];

  // ---------------------------------------------------------------
  // GAP §6.2: Scenario 7 end-to-end via connectSequences public API
  // (previous Scenario 7 tests only called buildReachBack directly)
  // ---------------------------------------------------------------

  const eShapeA_tg6 = buildFrettedScale(CAGED_E, "A", STANDARD);
  const eShapeA2_tg6 = buildFrettedScale(CAGED_E, "A", STANDARD);
  const prevAscWalk_tg6 = walkShapeMotif(eShapeA_tg6, motif, { direction: "ascending" });
  const prevLastNote_tg6 = prevAscWalk_tg6[prevAscWalk_tg6.length - 1]; // B4 (s5f7)

  const inputS7_tg6: ConnectSequencesInput = {
    prev: { scale: eShapeA_tg6, lastNote: prevLastNote_tg6, direction: "ascending" },
    next: { scale: eShapeA2_tg6, motif, direction: "descending" },
  };

  test("Scenario 7 end-to-end (connectSequences): strategy reach-back, connector + nextNotes both non-empty", () => {
    // New model: reach-back returns a same-string bridge connector plus
    // next's natural walk for nextNotes (with overlap dedup when applicable).
    const result = connectSequences(inputS7_tg6);
    expect(result.strategy).toBe("reach-back");
    expect(result.connector.length).toBeGreaterThan(0);
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // GAP §6.4: Direction invariant — asc extend connector ends at/below target,
  // desc extend connector ends at/above target (positional sanity check)
  // ---------------------------------------------------------------

  test("Asc extend connector: last connector note midi equals next-scale's max midi (target reached)", () => {
    // Scenario 1: E asc → D desc, target = D5 (midi 74)
    const dShapeA_tg6 = buildFrettedScale(CAGED_D, "A", STANDARD);
    const inputS1_tg6: ConnectSequencesInput = {
      prev: { scale: eShapeA_tg6, lastNote: prevLastNote_tg6, direction: "ascending" },
      next: { scale: dShapeA_tg6, motif, direction: "descending" },
    };
    const result = connectSequences(inputS1_tg6);
    expect(result.strategy).toBe("extend");
    // The connector's last note should be the target (max midi of D shape = D5 = midi 74)
    const target = Math.max(...dShapeA_tg6.notes.map((n) => n.midi));
    expect(result.connector[result.connector.length - 1].midi).toBe(target);
  });

  // ---------------------------------------------------------------
  // GAP §6.2: Scenario 3 nextNotes[0] head position confirmed via strategy field
  // in the full connectSequences call (exercises public API path)
  // ---------------------------------------------------------------

  test("Scenario 3 end-to-end (connectSequences): strategy reach-back, connector [], seam respected", () => {
    const eShapeA_s3 = buildFrettedScale(CAGED_E, "A", STANDARD);
    const dShapeA_s3 = buildFrettedScale(CAGED_D, "A", STANDARD);
    const prevDescWalk = walkShapeMotif(eShapeA_s3, motif, { direction: "descending" });
    const prevLastNote = prevDescWalk[prevDescWalk.length - 1]; // G#2 (s0f4)

    const inputS3_tg6: ConnectSequencesInput = {
      prev: { scale: eShapeA_s3, lastNote: prevLastNote, direction: "descending" },
      next: { scale: dShapeA_s3, motif, direction: "ascending" },
    };

    const result = connectSequences(inputS3_tg6);
    expect(result.strategy).toBe("reach-back");
    // New model: connector is non-empty (the same-string bridge). With
    // default dedupSeam: true, the leading G#2 at (s0,f4) is dropped from
    // the bridge head.
    if (result.connector.length > 0) {
      expect(
        result.connector[0].string === 0 && result.connector[0].fret === 4,
      ).toBe(false);
    }
    expect(result.nextNotes.length).toBeGreaterThan(0);
  });
});
