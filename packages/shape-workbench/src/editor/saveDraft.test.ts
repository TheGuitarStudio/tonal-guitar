import { describe, expect, it } from "vitest";
import { STANDARD } from "tonal-guitar";
import type { ChordShape } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import type { EditorCell } from "fretboard-ui";
import { computeSaveDraft, NO_FILE_MESSAGE, NO_ROOT_MESSAGE } from "./saveDraft";

const EMPTY_SHAPE: ChordShape = {
  name: "New Shape",
  system: "caged",
  strings: [null, null, null, null, null, null],
  fingers: [null, null, null, null, null, null],
  barres: [],
  rootString: 0,
};

const ROOTED_CELLS: EditorCell[] = [
  { string: 0, fret: 5, isRoot: true },
  { string: 1, fret: 7 },
  { string: 2, fret: 7 },
  { string: 3, fret: 5 },
  { string: 4, fret: 5 },
  { string: 5, fret: 5 },
];

describe("computeSaveDraft", () => {
  it("refuses a gap-origin draft with no marked root (spec §9 edge case 9)", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: EMPTY_SHAPE, file: "caged-chords-minor" };
    const result = computeSaveDraft(draft, [], [], STANDARD, "A");
    expect(result).toEqual({ ok: false, error: NO_ROOT_MESSAGE });
  });

  it("refuses a gap-origin draft with a marked root but no chosen file", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: EMPTY_SHAPE };
    const result = computeSaveDraft(draft, ROOTED_CELLS, [], STANDARD, "A");
    expect(result).toEqual({ ok: false, error: NO_FILE_MESSAGE });
  });

  it("produces an AddChange for a gap-origin draft once rooted and filed", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: EMPTY_SHAPE, file: "caged-chords-minor" };
    const result = computeSaveDraft(draft, ROOTED_CELLS, [], STANDARD, "A");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.change.op).toBe("add");
    expect(result.change).toMatchObject({ op: "add", kind: "chord", file: "caged-chords-minor" });
    expect(result.shape.rootString).toBe(0);
    expect(result.shape.strings[0]).toBe("1P");
  });

  it("produces an UpdateChange for an existing-origin draft, never AddChange (spec §5.3 onEditShape)", () => {
    const original: ChordShape = {
      ...EMPTY_SHAPE,
      name: "A Shape Major",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 3, 2, 1, 1],
    };
    const draft: DraftShape = { kind: "chord", origin: "existing", shape: { ...original }, original };
    // Save without changing anything geometry-wise — original already has a
    // 1P at string 0, no file needed for an existing-origin draft.
    const cells: EditorCell[] = [
      { string: 0, fret: 0, isRoot: true },
      { string: 1, fret: 0 },
      { string: 2, fret: 0 },
      { string: 3, fret: 0 },
      { string: 4, fret: 0 },
      { string: 5, fret: 0 },
    ];
    const result = computeSaveDraft(draft, cells, [], STANDARD, "A");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.change.op).toBe("update");
    if (result.change.op !== "update") throw new Error("unreachable");
    expect(result.change.name).toBe("A Shape Major");
  });

  it("still refuses an existing-origin draft edited down to no root", () => {
    const original: ChordShape = {
      ...EMPTY_SHAPE,
      name: "A Shape Major",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 3, 2, 1, 1],
    };
    const draft: DraftShape = { kind: "chord", origin: "existing", shape: { ...original }, original };
    const result = computeSaveDraft(draft, [], [], STANDARD, "A");
    expect(result).toEqual({ ok: false, error: NO_ROOT_MESSAGE });
  });
});
