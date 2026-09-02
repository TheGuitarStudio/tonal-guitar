import { describe, expect, it } from "vitest";
// @ts-expect-error -- untyped Vite `?raw` raw-source import (same pattern as audit-integration.test.ts)
import buildSource from "./build.ts?raw";
import { applyChordShape, autoFingering, buildFrettedScale } from "./build";
import { gripBaseFret, ChordShape } from "./shape";
import {
  CAGED_CHORD_E,
  CAGED_CHORD_A,
  CAGED_CHORD_D,
} from "./data/caged-chords";
import { OPEN_C_MAJOR } from "./data/open-chords";
import { STANDARD } from "./tuning";

// ============================================================
// Regression guard: additive-only change (spec §2.1, task 8.1)
// ============================================================
//
// Replicates the PRE-this-change `applyChordShape` body exactly (minus the
// new fingers/barres computation) so we can assert the untouched fields
// (positions/frets/root/shapeName/startFret) are byte-identical to what the
// function produced before fingers/barres were added — proving the new
// fields are purely additive and note placement/startFret logic is
// unchanged.
function legacyApplyChordShape(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
) {
  const asScaleShape = {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };
  const result = buildFrettedScale(asScaleShape, root, tuning);
  const frets: (number | null)[] = tuning.map(() => null);
  for (const p of result.notes) {
    frets[p.string] = p.fret;
  }
  const fretValues = result.notes.map((n) => n.fret);
  const startFret = fretValues.length > 0 ? Math.min(...fretValues) : 0;
  return {
    positions: result.notes,
    frets,
    root: result.root,
    shapeName: shape.name,
    startFret,
  };
}

describe("applyChordShape — regression guard (additive-only)", () => {
  const cases: Array<[ChordShape, string]> = [
    [CAGED_CHORD_E, "G"],
    [CAGED_CHORD_A, "D"],
    [CAGED_CHORD_D, "A"],
    [OPEN_C_MAJOR, "C"],
  ];

  it.each(cases)(
    "%s at %s: positions/frets/root/shapeName/startFret unchanged",
    (shape, root) => {
      const legacy = legacyApplyChordShape(shape, root, STANDARD);
      const current = applyChordShape(shape, root, STANDARD);

      expect(current.positions).toEqual(legacy.positions);
      expect(current.frets).toEqual(legacy.frets);
      expect(current.root).toEqual(legacy.root);
      expect(current.shapeName).toEqual(legacy.shapeName);
      expect(current.startFret).toEqual(legacy.startFret);
    },
  );

  it("E Shape Major at G: known-good fixture values", () => {
    const result = applyChordShape(CAGED_CHORD_E, "G", STANDARD);
    expect(result.frets).toEqual([3, 5, 5, 4, 3, 3]);
    expect(result.startFret).toBe(3);
    expect(result.root).toBe("G");
    expect(result.shapeName).toBe("E Shape Major");
  });

  it("A Shape Major at D: known-good fixture values", () => {
    const result = applyChordShape(CAGED_CHORD_A, "D", STANDARD);
    expect(result.frets).toEqual([null, 5, 7, 7, 7, 5]);
    expect(result.startFret).toBe(5);
  });
});

describe("applyChordShape — fingers", () => {
  it("is an exact copy of shape.fingers, same length as tuning.length", () => {
    const result = applyChordShape(CAGED_CHORD_E, "G", STANDARD);
    expect(result.fingers).toEqual(CAGED_CHORD_E.fingers);
    expect(result.fingers).toHaveLength(STANDARD.length);
  });

  it("is not the same array reference as shape.fingers", () => {
    const result = applyChordShape(CAGED_CHORD_A, "D", STANDARD);
    expect(result.fingers).not.toBe(CAGED_CHORD_A.fingers);
  });

  it("never mutates shape.fingers", () => {
    const before = [...CAGED_CHORD_D.fingers];
    const result = applyChordShape(CAGED_CHORD_D, "A", STANDARD);
    result.fingers[0] = 99; // mutate the returned array
    expect(CAGED_CHORD_D.fingers).toEqual(before);
  });

  it("passes through fingers unchanged for an open-position shape", () => {
    const result = applyChordShape(OPEN_C_MAJOR, "C", STANDARD);
    expect(result.fingers).toEqual([null, 3, 2, 0, 1, 0]);
  });
});

describe("applyChordShape — barres", () => {
  it("resolves a single full barre offset to an absolute fret", () => {
    // CAGED_CHORD_E: barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }]
    const result = applyChordShape(CAGED_CHORD_E, "G", STANDARD);
    const gripBase = gripBaseFret(result.frets);
    expect(gripBase).toBe(3);
    expect(result.barres).toEqual([
      { fret: gripBase + 0, fromString: 0, toString: 5, finger: 1 },
    ]);
    expect(result.barres).toEqual([
      { fret: 3, fromString: 0, toString: 5, finger: 1 },
    ]);
  });

  it("resolves multiple barres independently and preserves fromString/toString/finger", () => {
    // CAGED_CHORD_A: barres: [
    //   { fret: 0, fromString: 1, toString: 5, finger: 1 },
    //   { fret: 2, fromString: 2, toString: 4, finger: 3 },
    // ]
    const result = applyChordShape(CAGED_CHORD_A, "D", STANDARD);
    const gripBase = gripBaseFret(result.frets);
    expect(gripBase).toBe(5);
    expect(result.barres).toEqual([
      { fret: gripBase + 0, fromString: 1, toString: 5, finger: 1 },
      { fret: gripBase + 2, fromString: 2, toString: 4, finger: 3 },
    ]);
  });

  it("returns an empty array when shape.barres is empty", () => {
    const result = applyChordShape(CAGED_CHORD_D, "A", STANDARD);
    expect(result.barres).toEqual([]);
  });

  it("does not mutate the original shape.barres entries", () => {
    const originalBarres = JSON.parse(JSON.stringify(CAGED_CHORD_E.barres));
    applyChordShape(CAGED_CHORD_E, "G", STANDARD);
    expect(CAGED_CHORD_E.barres).toEqual(originalBarres);
  });
});

// ============================================================
// autoFingering (spec §2.2, task 8.4)
// ============================================================

describe("autoFingering", () => {
  it("is deterministic across repeated calls with identical inputs", () => {
    const shape = {
      name: "C Major Open",
      system: "open",
      strings: [null, "1P", "3M", "5P", "1P", "3M"] as (string | null)[],
      rootString: 1,
    };
    const first = autoFingering(shape, "C", STANDARD);
    const second = autoFingering(shape, "C", STANDARD);
    expect(second).toEqual(first);
  });

  it("assigns finger 0 to open strings, null to muted, ascending fingers to fretted strings", () => {
    // Built C Major Open frets: [null, 3, 2, 0, 1, 0]
    const shape = {
      name: "C Major Open",
      system: "open",
      strings: [null, "1P", "3M", "5P", "1P", "3M"] as (string | null)[],
      rootString: 1,
    };
    const result = autoFingering(shape, "C", STANDARD);
    // Distinct fretted values ascending: 1 -> finger 1, 2 -> finger 2, 3 -> finger 3.
    expect(result.fingers).toEqual([null, 3, 2, 0, 1, 0]);
    expect(result.barres).toEqual([]);
  });

  it("collapses equal frets on adjacent strings into a shared-finger Barre", () => {
    // E Shape Major intervals at root E build to frets [0, 2, 2, 1, 0, 0]:
    // strings 1 and 2 both land on fret 2 (adjacent) -> a Barre.
    const shape = {
      name: "E Shape Major",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"] as (string | null)[],
      rootString: 0,
    };
    const result = autoFingering(shape, "E", STANDARD);
    expect(result.fingers).toEqual([0, 2, 2, 1, 0, 0]);
    expect(result.barres).toEqual([
      { fret: 1, fromString: 1, toString: 2, finger: 2 },
    ]);
  });

  it("caps fingers at 4 when more than 4 distinct fretted values are present", () => {
    const shape = {
      name: "wide span",
      system: "custom",
      strings: ["1P", "2M", "3M", "5P", "6M", "7M"] as (string | null)[],
      rootString: 0,
    };
    const result = autoFingering(shape, "C", STANDARD);
    // Built frets: [8, 5, 14, 12, 10, 7] (6 distinct values).
    // Ranks: 5->1, 7->2, 8->3, 10->4, 12->4, 14->4 (capped).
    expect(result.fingers).toEqual([3, 1, 4, 4, 4, 2]);
    expect(Math.max(...result.fingers.filter((f): f is number => f != null))).toBe(4);
    expect(result.barres).toEqual([]);
  });

  it("returns finger arrays that are never all-null/all-zero garbage for muted strings", () => {
    const shape = {
      name: "A Shape Major",
      system: "caged",
      strings: [null, "1P", "5P", "1P", "3M", "5P"] as (string | null)[],
      rootString: 1,
    };
    const result = autoFingering(shape, "D", STANDARD);
    expect(result.fingers[0]).toBeNull();
  });
});

// ============================================================
// Dependency-tier boundary (CLAUDE.md, spec §9 edge case 6): src/build.ts
// stays required-peer — it may use @tonaljs/note and @tonaljs/interval, but
// must never reach the optional tier (@tonaljs/scale, @tonaljs/chord,
// @tonaljs/key, or ./integration / ./audit-integration).
// ============================================================

describe("dependency tier boundary: src/build.ts stays required-peer", () => {
  it("has no optional-peer @tonaljs/* import", () => {
    expect(buildSource).not.toMatch(/["']@tonaljs\/(scale|chord|key)["']/);
  });

  it("does not import ./integration or ./audit-integration", () => {
    const importLines = buildSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/["']\.\/(integration|audit-integration)["']/);
    }
  });
});
