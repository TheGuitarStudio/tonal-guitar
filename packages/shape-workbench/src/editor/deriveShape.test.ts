import { describe, expect, it } from "vitest";
import { STANDARD } from "tonal-guitar";
import type { ChordShape } from "tonal-guitar";
import type { EditorCell } from "fretboard-ui";
import {
  buildShapeFromCells,
  deriveChordGeometry,
  deriveRootString,
  movableReason,
  seedCellsFromShape,
} from "./deriveShape";

const EMPTY_SHAPE: ChordShape = {
  name: "",
  system: "caged",
  strings: [null, null, null, null, null, null],
  fingers: [null, null, null, null, null, null],
  barres: [],
  rootString: 0,
};

describe("deriveRootString", () => {
  it("returns the lowest string index carrying '1P'", () => {
    expect(deriveRootString([null, "1P", "5P", "1P", null, null])).toBe(1);
  });

  it("returns undefined when no string carries '1P'", () => {
    expect(deriveRootString([null, "5P", "3M", null, null, null])).toBeUndefined();
  });
});

describe("deriveChordGeometry", () => {
  it("returns undefined when no cell is marked as root (spec §9 edge case 9)", () => {
    // A Shape Minor-ish grip at fret 5, no isRoot cell — cellsToChordShape
    // itself refuses (returns null) with no root pitch class to anchor on.
    const cells: EditorCell[] = [
      { string: 0, fret: 5 },
      { string: 1, fret: 7 },
      { string: 2, fret: 7 },
    ];
    expect(deriveChordGeometry(cells, STANDARD, undefined)).toBeUndefined();
  });

  it("derives rootString as the LOWEST string carrying '1P', not necessarily the isRoot-marked cell's own string", () => {
    // E Shape Minor barre grip at fret 5 (root A): strings 0 and 2 both
    // land on pitch class A ("1P") an octave apart; the author marks
    // isRoot on string 2 (say, for visual convenience while drawing), but
    // rootString must still land on string 0 — the lowest carrier.
    const cells: EditorCell[] = [
      { string: 0, fret: 5 },
      { string: 1, fret: 7 },
      { string: 2, fret: 7, isRoot: true },
      { string: 3, fret: 6 },
      { string: 4, fret: 5 },
      { string: 5, fret: 5 },
    ];
    const geometry = deriveChordGeometry(cells, STANDARD, undefined);
    expect(geometry).toBeDefined();
    expect(geometry?.strings[0]).toBe("1P");
    expect(geometry?.strings[2]).toBe("1P");
    expect(geometry?.rootString).toBe(0);
  });

  it("refuses when a root was marked but no string ends up carrying '1P' (e.g. muted away)", () => {
    const cells: EditorCell[] = [
      { string: 0, fret: 5, isRoot: true, muted: true },
      { string: 1, fret: 7 },
    ];
    expect(deriveChordGeometry(cells, STANDARD, undefined)).toBeUndefined();
  });
});

describe("buildShapeFromCells", () => {
  it("refuses to build a shape without a marked '1P' root", () => {
    const cells: EditorCell[] = [{ string: 0, fret: 5 }];
    expect(buildShapeFromCells(EMPTY_SHAPE, cells, [], STANDARD, undefined)).toBeUndefined();
  });

  it("carries every non-geometry field on `base` through untouched", () => {
    const base: ChordShape = {
      ...EMPTY_SHAPE,
      name: "E Shape Minor",
      chordType: "m",
      cagedPosition: "E",
      tags: ["caged", "core"],
    };
    const cells: EditorCell[] = [
      { string: 0, fret: 5, isRoot: true },
      { string: 1, fret: 7 },
      { string: 2, fret: 7 },
      { string: 3, fret: 6 },
      { string: 4, fret: 5 },
      { string: 5, fret: 5 },
    ];
    const barres = [{ fret: 0, fromString: 0, toString: 5, finger: 1 }];
    const shape = buildShapeFromCells(base, cells, barres, STANDARD, undefined);
    expect(shape).toBeDefined();
    expect(shape?.name).toBe("E Shape Minor");
    expect(shape?.chordType).toBe("m");
    expect(shape?.cagedPosition).toBe("E");
    expect(shape?.tags).toEqual(["caged", "core"]);
    expect(shape?.rootString).toBe(0);
    expect(shape?.barres).toBe(barres);
  });
});

describe("buildShapeFromCells — compound interval spelling preservation (CR-055)", () => {
  const EXTENDED: ChordShape = {
    ...EMPTY_SHAPE,
    name: "Extended Voicing",
    strings: ["1P", "5P", "7m", "3M", "5P", "9M"],
    fingers: [1, 3, 1, 2, 4, 4],
    rootString: 0,
  };

  it("keeps a compound spelling ('9M') when re-derived geometry is only chroma-equivalent, not actually changed", () => {
    // `intervalFromTo` (the base editor's cells->interval conversion) only
    // emits the 12 simple names, so round-tripping unchanged cells through
    // `cellsToChordShape` would naively collapse "9M" (14 semitones) down to
    // "2M" (its mod-12 chroma) even though nothing about the grip changed.
    const { cells, barres } = seedCellsFromShape(EXTENDED, STANDARD, "A");
    const rebuilt = buildShapeFromCells(EXTENDED, cells, barres, STANDARD, "A");
    expect(rebuilt).toBeDefined();
    expect(rebuilt?.strings).toEqual(EXTENDED.strings);
    expect(rebuilt?.strings[5]).toBe("9M");
  });

  it("uses the freshly-derived (simple) spelling once the finger at that string actually changes", () => {
    const { cells, barres } = seedCellsFromShape(EXTENDED, STANDARD, "A");
    const editedCells = cells.map((c) => (c.string === 5 ? { ...c, finger: 3 } : c));
    const rebuilt = buildShapeFromCells(EXTENDED, editedCells, barres, STANDARD, "A");
    expect(rebuilt?.fingers[5]).toBe(3);
    expect(rebuilt?.strings[5]).toBe("2M");
  });
});

describe("seedCellsFromShape / buildShapeFromCells round trip", () => {
  it("round-trips an authored shape's strings/fingers through seed -> build", () => {
    const shape: ChordShape = {
      name: "E Shape Minor",
      system: "caged",
      strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
      fingers: [1, 3, 4, 1, 1, 1],
      barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
      rootString: 0,
      chordType: "m",
      cagedPosition: "E",
    };
    const { cells, barres } = seedCellsFromShape(shape, STANDARD, "A");
    const rebuilt = buildShapeFromCells(shape, cells, barres, STANDARD, "A");
    expect(rebuilt).toBeDefined();
    expect(rebuilt?.strings).toEqual(shape.strings);
    expect(rebuilt?.fingers).toEqual(shape.fingers);
    expect(rebuilt?.rootString).toBe(shape.rootString);
    expect(rebuilt?.barres).toEqual(shape.barres);
  });
});

describe("movableReason", () => {
  it("reports the default 'no canonicalRoot' reason for a movable shape", () => {
    expect(movableReason(EMPTY_SHAPE)).toMatch(/movable — no canonicalRoot set/);
  });

  it("reports the canonicalRoot pin for a non-movable shape", () => {
    const shape: ChordShape = { ...EMPTY_SHAPE, canonicalRoot: "C" };
    expect(movableReason(shape)).toMatch(/not movable — canonicalRoot "C"/);
  });

  it("reports an explicit movable: true override even with a canonicalRoot set", () => {
    const shape: ChordShape = { ...EMPTY_SHAPE, canonicalRoot: "C", movable: true };
    expect(movableReason(shape)).toBe("movable: true (explicit override)");
  });

  it("reports an explicit movable: false override even without a canonicalRoot", () => {
    const shape: ChordShape = { ...EMPTY_SHAPE, movable: false };
    expect(movableReason(shape)).toBe("movable: false (explicit override)");
  });
});
