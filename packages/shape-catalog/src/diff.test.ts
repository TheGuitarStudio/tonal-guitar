/**
 * Task 22.1/22.5: `diffShape` field-level diffing, including
 * `geometryChanged` detection.
 */
import { describe, expect, it } from "vitest";
import type { ChordShape } from "tonal-guitar";
import { diffShape } from "./diff";

const A_SHAPE_MAJOR: ChordShape = {
  name: "A Shape Major",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 1, 3, 3, 3, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 4, finger: 3 },
  ],
  rootString: 1,
};

describe("diffShape", () => {
  it("reports every defined field as added when `before` is undefined (a fresh Add)", () => {
    const diff = diffShape(undefined, A_SHAPE_MAJOR);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.added.sort()).toEqual(
      ["barres", "fingers", "name", "rootString", "strings", "system"].sort(),
    );
    expect(diff.geometryChanged).toBe(true);
  });

  it("the §4.4 CAGED-major metadata backfill is added-only and geometry-unchanged", () => {
    const after: ChordShape = {
      ...A_SHAPE_MAJOR,
      chordType: "M",
      voicingFamily: "caged",
      cagedPosition: "A",
    };
    const diff = diffShape(A_SHAPE_MAJOR, after);
    expect(diff.added.sort()).toEqual(["cagedPosition", "chordType", "voicingFamily"].sort());
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.geometryChanged).toBe(false);
  });

  it("detects a changed field with its before/after values", () => {
    const after: ChordShape = { ...A_SHAPE_MAJOR, rootString: 2 };
    const diff = diffShape(A_SHAPE_MAJOR, after);
    expect(diff.changed).toEqual([{ field: "rootString", before: 1, after: 2 }]);
    expect(diff.geometryChanged).toBe(true);
  });

  it("detects an array-valued field change via deep equality, not reference equality", () => {
    const after: ChordShape = { ...A_SHAPE_MAJOR, strings: [...A_SHAPE_MAJOR.strings] };
    const unchanged = diffShape(A_SHAPE_MAJOR, after);
    expect(unchanged.changed).toEqual([]);
    expect(unchanged.geometryChanged).toBe(false);

    const changedStrings: ChordShape = {
      ...A_SHAPE_MAJOR,
      strings: [null, "1P", "5P", "1P", "3M", "1P"],
    };
    const diff = diffShape(A_SHAPE_MAJOR, changedStrings);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].field).toBe("strings");
    expect(diff.geometryChanged).toBe(true);
  });

  it("reports a field present on `before` but dropped from `after` as removed", () => {
    const before: ChordShape = { ...A_SHAPE_MAJOR, tags: ["core"] };
    const after: ChordShape = { ...A_SHAPE_MAJOR };
    const diff = diffShape(before, after);
    expect(diff.removed).toEqual(["tags"]);
    expect(diff.added).toEqual([]);
    expect(diff.geometryChanged).toBe(false);
  });

  it("reports no differences for structurally-identical shapes", () => {
    const diff = diffShape(A_SHAPE_MAJOR, { ...A_SHAPE_MAJOR, barres: [...A_SHAPE_MAJOR.barres] });
    expect(diff).toEqual({ added: [], removed: [], changed: [], geometryChanged: false });
  });
});
