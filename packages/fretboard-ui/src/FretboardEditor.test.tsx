/**
 * Tests for Task Group 20 (shape-workbench): EditorCell's new optional
 * `finger`/`muted` fields, and the new `cellsToChordShape` companion to
 * `cellsToScaleShapeStrings`.
 */
import { describe, it, expect } from "vitest";
import {
  cellsToChordShape,
  cellsToScaleShapeStrings,
  frettedNotesToCells,
  type EditorCell,
} from "./FretboardEditor";
import type { FrettedNote } from "tonal-guitar";

const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"];

describe("cellsToChordShape", () => {
  it("returns null when no root is marked and no rootPitchClass override is given", () => {
    const cells: EditorCell[] = [{ string: 0, fret: 0 }];
    expect(cellsToChordShape(cells, STANDARD)).toBeNull();
  });

  it("produces one interval per string for an open E-major-shaped grip", () => {
    const cells: EditorCell[] = [
      { string: 0, fret: 0, isRoot: true },
      { string: 1, fret: 2, finger: 2 },
      { string: 2, fret: 2, finger: 3 },
      { string: 3, fret: 1, finger: 1 },
      { string: 4, fret: 0 },
      { string: 5, fret: 0 },
    ];

    const result = cellsToChordShape(cells, STANDARD);

    expect(result).not.toBeNull();
    expect(result!.strings).toEqual(["1P", "5P", "1P", "3M", "5P", "1P"]);
    expect(result!.fingers).toEqual([0, 2, 3, 1, 0, 0]);
    expect(result!.barres).toEqual([]);
    expect(result!.rootString).toBe(0);
  });

  it("marks a muted string as null regardless of any fret data on that string", () => {
    const cells: EditorCell[] = [
      { string: 0, fret: 0, isRoot: true },
      { string: 1, fret: 0, muted: true },
    ];

    const result = cellsToChordShape(cells, STANDARD);

    expect(result).not.toBeNull();
    expect(result!.strings[1]).toBeNull();
    expect(result!.fingers[1]).toBeNull();
  });

  it("leaves strings with no cell as null (unplayed)", () => {
    const cells: EditorCell[] = [{ string: 0, fret: 0, isRoot: true }];
    const result = cellsToChordShape(cells, STANDARD);

    expect(result).not.toBeNull();
    expect(result!.strings).toEqual(["1P", null, null, null, null, null]);
    expect(result!.fingers).toEqual([0, null, null, null, null, null]);
  });

  it("last cell wins (by fret, ascending) when a string carries duplicate cells", () => {
    const cells: EditorCell[] = [
      { string: 0, fret: 0, isRoot: true },
      { string: 1, fret: 1 },
      { string: 1, fret: 3 },
    ];

    const result = cellsToChordShape(cells, STANDARD);

    expect(result).not.toBeNull();
    // string1: A2 + 3 semitones = C -> interval "6m" from root E, not the
    // fret-1 cell's "5d" (A2 + 1 = A#/Bb).
    expect(result!.strings[1]).toBe("6m");
  });

  it("honors an explicit rootPitchClass override even without an isRoot cell", () => {
    const cells: EditorCell[] = [{ string: 0, fret: 0 }];
    const result = cellsToChordShape(cells, STANDARD, "E");

    expect(result).not.toBeNull();
    expect(result!.strings[0]).toBe("1P");
    // No isRoot cell present, so rootString falls back to 0 per the
    // documented `rootCell?.string ?? 0` convention shared with
    // cellsToScaleShapeStrings.
    expect(result!.rootString).toBe(0);
  });
});

describe("EditorCell new optional fields do not break existing converters", () => {
  it("cellsToScaleShapeStrings ignores finger/muted and behaves as before", () => {
    const cells: EditorCell[] = [
      { string: 0, fret: 0, isRoot: true, finger: null, muted: false },
      { string: 1, fret: 2, finger: 2 },
      { string: 1, fret: 4 },
    ];

    const result = cellsToScaleShapeStrings(cells, STANDARD);

    expect(result).not.toBeNull();
    expect(result!.strings[0]).toEqual(["1P"]);
    expect(result!.strings[1]).toEqual(["5P", "6M"]);
    expect(result!.rootString).toBe(0);
  });

  it("cellsToScaleShapeStrings still returns null with no root marked", () => {
    const cells: EditorCell[] = [{ string: 0, fret: 0, muted: true }];
    expect(cellsToScaleShapeStrings(cells, STANDARD)).toBeNull();
  });

  it("frettedNotesToCells output is unaffected by the new optional fields (they're simply absent)", () => {
    const notes: FrettedNote[] = [
      {
        string: 0,
        fret: 0,
        note: "E2",
        pc: "E",
        interval: "1P",
        scaleIndex: 0,
        degree: 1,
        intervalNumber: 1,
        midi: 40,
      },
      {
        string: 1,
        fret: 2,
        note: "B2",
        pc: "B",
        interval: "5P",
        scaleIndex: 1,
        degree: 2,
        intervalNumber: 5,
        midi: 47,
      },
    ];

    const cells = frettedNotesToCells(notes);

    expect(cells).toEqual([
      { string: 0, fret: 0, isRoot: true },
      { string: 1, fret: 2, isRoot: false },
    ]);
    // The result type permits finger/muted, but frettedNotesToCells doesn't
    // set them — confirm they're genuinely absent, not defaulted.
    expect(cells[0].finger).toBeUndefined();
    expect(cells[0].muted).toBeUndefined();
  });
});
