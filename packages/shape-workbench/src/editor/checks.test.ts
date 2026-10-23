import { describe, expect, it } from "vitest";
import {
  arpeggioShapes,
  auditArpeggioShape,
  auditArpeggioShapeIntegration,
  auditChordShape,
  auditChordShapeIntegration,
  STANDARD,
} from "tonal-guitar";
import type { ArpeggioShape, ChordShape } from "tonal-guitar";
import {
  ARPEGGIO_CHECK_IDS,
  CHORD_CHECK_IDS,
  arpeggioCheckRows,
  chordCheckRows,
  runArpeggioChecks,
  runChordChecks,
} from "./checks";

const VALID_SHAPE: ChordShape = {
  name: "E Shape Minor",
  system: "caged",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 1, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m",
  cagedPosition: "E",
  voicingFamily: "caged",
};

describe("CHORD_CHECK_IDS", () => {
  it("is exhaustive: auditChordShape + auditChordShapeIntegration never produce an id outside this roster", () => {
    // Sweep a variety of shapes (valid, empty, malformed) so every check
    // function actually fires at least once across the sweep, then assert
    // every id it ever returns is one of CHORD_CHECK_IDS — the 1:1 mapping
    // spec §3.3 requires, verified structurally rather than by a fixed list
    // of expected ids (which could silently drift from the real functions).
    const fixtures: ChordShape[] = [
      VALID_SHAPE,
      { ...VALID_SHAPE, name: "E Shape Minor" }, // name collides with itself by value
      {
        name: "",
        system: "caged",
        strings: [null, null, null, null, null, null],
        fingers: [null, null, null, null, null, null],
        barres: [],
        rootString: 0,
      },
      { ...VALID_SHAPE, chordType: "bogus-type-xyz" },
      { ...VALID_SHAPE, barres: [{ fret: -1, fromString: 0, toString: 1, finger: 1 }] },
      { ...VALID_SHAPE, stringSet: [0, 1] },
      { ...VALID_SHAPE, tuning: ["D2", "A2", "D3", "G3", "B3", "E4"] },
      { ...VALID_SHAPE, fingers: [0, 0, 0, 0, 0, 0] },
    ];

    const seenIds = new Set<string>();
    for (const shape of fixtures) {
      for (const issue of [...auditChordShape(shape), ...auditChordShapeIntegration(shape)]) {
        seenIds.add(issue.id);
      }
    }

    expect(seenIds.size).toBeGreaterThan(0);
    for (const id of seenIds) {
      expect(CHORD_CHECK_IDS).toContain(id);
    }
  });
});

describe("runChordChecks", () => {
  it("is the exact concatenation of auditChordShape + auditChordShapeIntegration for the same (shape, root, tuning)", () => {
    const expected = [
      ...auditChordShape(VALID_SHAPE, { root: "A", tuning: STANDARD }),
      ...auditChordShapeIntegration(VALID_SHAPE, { root: "A", tuning: STANDARD }),
    ];
    expect(runChordChecks(VALID_SHAPE, "A", STANDARD)).toEqual(expected);
  });
});

describe("chordCheckRows", () => {
  it("renders exactly one row per CHORD_CHECK_IDS entry, in that order", () => {
    const rows = chordCheckRows(runChordChecks(VALID_SHAPE, "A", STANDARD));
    expect(rows.map((r) => r.id)).toEqual(CHORD_CHECK_IDS);
  });

  it("marks a check 'pass' when no issue of that id is present", () => {
    const rows = chordCheckRows([]);
    expect(rows.every((r) => r.status === "pass")).toBe(true);
  });

  it("marks a check 'error'/'warning' from the matching issues' severity", () => {
    const rows = chordCheckRows(runChordChecks({ ...VALID_SHAPE, fingers: [0, 0, 0, 0, 0, 0] }, "A", STANDARD));
    const fingerZero = rows.find((r) => r.id === "finger-zero-on-movable");
    expect(fingerZero?.status).toBe("error");
  });
});

describe("arpeggio checks", () => {
  const seed = arpeggioShapes.all().find((a) => a.name === "E Shape Minor Arpeggio")!;

  it("ARPEGGIO_CHECK_IDS is exhaustive over a sweep of valid and malformed arpeggios", () => {
    const fixtures: ArpeggioShape[] = [
      ...arpeggioShapes.all(),
      { ...seed, chordType: "bogus-type-xyz" },
      { ...seed, strings: [null, null, null, null, null, null] },
      { ...seed, name: "" },
      { ...seed, overrides: "No Such Shape" },
      { ...seed, fingers: [[1], [1]] },
      { ...seed, strings: [["1P"], ["2M"], ["4P"], ["7M"], ["6M"], ["2m"]] },
    ];
    const seenIds = new Set<string>();
    for (const shape of fixtures) {
      for (const root of ["A", "C"]) {
        for (const issue of [
          ...auditArpeggioShape(shape, { root }),
          ...auditArpeggioShapeIntegration(shape, { root }),
        ]) {
          seenIds.add(issue.id);
        }
      }
    }
    expect(seenIds.size).toBeGreaterThan(0);
    for (const id of seenIds) expect(ARPEGGIO_CHECK_IDS).toContain(id);
  });

  it("runArpeggioChecks concatenates both audits and drops name-unique for existing edits", () => {
    const options = { root: "A", tuning: STANDARD };
    const all = [...auditArpeggioShape(seed, options), ...auditArpeggioShapeIntegration(seed, options)];
    expect(runArpeggioChecks(seed, "A", STANDARD)).toEqual(all);
    const clone = { ...seed, strings: seed.strings.map((s) => (s === null ? null : [...s])) };
    const filtered = runArpeggioChecks(clone, "A", STANDARD, { existingEdit: true });
    expect(filtered.some((i) => i.id === "name-unique")).toBe(false);
  });

  it("arpeggioCheckRows yields one row per id, all passing for a clean registered seed", () => {
    const rows = arpeggioCheckRows(runArpeggioChecks(seed, "A", STANDARD, { existingEdit: true }));
    expect(rows.map((r) => r.id)).toEqual(ARPEGGIO_CHECK_IDS);
    expect(rows.filter((r) => r.status === "error")).toEqual([]);
  });
});
