import { describe, expect, it } from "vitest";
import { auditAllShapes, auditChordShapeFull, CHECK_NAME_UNIQUE } from "tonal-guitar";
import type { AddChange, ChordShape, RemoveChange, UpdateChange } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import { initialWorkbenchState, type WorkbenchState } from "../store";
import {
  changeAfterShape,
  changeBeforeShape,
  changeCheckStatus,
  changeDisplayName,
  changeOpGlyph,
  changeShapeDiff,
  changeTargetFile,
  findDraftForChange,
  summarizeChangesByKindAndOp,
} from "./changeInfo";

// Populates the live registry (side-effect imports) so `changeCheckStatus`'s
// audit calls resolve against real registered shapes where needed.
auditAllShapes();

const NEW_SHAPE: ChordShape = {
  name: "A Shape Minor",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "b3m", "5P"],
  fingers: [null, 1, 3, 4, 2, 1],
  barres: [{ fret: 0, fromString: 1, toString: 5, finger: 1 }],
  rootString: 1,
  chordType: "m",
};

const addChange: AddChange = {
  op: "add",
  kind: "chord",
  file: "caged-chords-minor",
  shape: NEW_SHAPE,
};

const ORIGINAL_SHAPE: ChordShape = {
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

const UPDATED_SHAPE: ChordShape = { ...ORIGINAL_SHAPE, chordType: "maj", cagedPosition: "A" };

const updateChange: UpdateChange = {
  op: "update",
  kind: "chord",
  name: "A Shape Major",
  patch: { chordType: "maj", cagedPosition: "A" },
};

const removeChange: RemoveChange = { op: "remove", kind: "chord", name: "A Shape Major" };

function stateWithDrafts(drafts: Record<string, DraftShape>): WorkbenchState {
  return { ...initialWorkbenchState, drafts };
}

describe("changeOpGlyph", () => {
  it("maps add/update/remove to +/~/−", () => {
    expect(changeOpGlyph(addChange)).toBe("+");
    expect(changeOpGlyph(updateChange)).toBe("~");
    expect(changeOpGlyph(removeChange)).toBe("−");
  });
});

describe("changeDisplayName", () => {
  it("reads AddChange.shape.name for an add", () => {
    expect(changeDisplayName(addChange)).toBe("A Shape Minor");
  });
  it("reads .name directly for update/remove", () => {
    expect(changeDisplayName(updateChange)).toBe("A Shape Major");
    expect(changeDisplayName(removeChange)).toBe("A Shape Major");
  });
});

describe("changeTargetFile", () => {
  it("returns AddChange.file for an add", () => {
    expect(changeTargetFile(addChange)).toBe("caged-chords-minor");
  });
  it("returns undefined for update/remove (resolved server-side only)", () => {
    expect(changeTargetFile(updateChange)).toBeUndefined();
    expect(changeTargetFile(removeChange)).toBeUndefined();
  });
});

describe("findDraftForChange / changeAfterShape / changeBeforeShape", () => {
  it("matches a gap-origin draft to its AddChange by shape name", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: NEW_SHAPE, file: "caged-chords-minor" };
    const state = stateWithDrafts({ "m::C": draft });
    expect(findDraftForChange(state, addChange)).toBe(draft);
    expect(changeAfterShape(state, addChange)).toBe(NEW_SHAPE);
    expect(changeBeforeShape(state, addChange)).toBeUndefined();
  });

  it("falls back to AddChange.shape directly when no matching draft exists", () => {
    const state = initialWorkbenchState;
    expect(findDraftForChange(state, addChange)).toBeUndefined();
    expect(changeAfterShape(state, addChange)).toBe(NEW_SHAPE);
  });

  it("matches an existing-origin draft to its UpdateChange by original.name", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      shape: UPDATED_SHAPE,
      original: ORIGINAL_SHAPE,
    };
    const state = stateWithDrafts({ "A Shape Major": draft });
    expect(findDraftForChange(state, updateChange)).toBe(draft);
    expect(changeAfterShape(state, updateChange)).toBe(UPDATED_SHAPE);
    expect(changeBeforeShape(state, updateChange)).toBe(ORIGINAL_SHAPE);
  });

  it("returns undefined after/before for an UpdateChange whose draft is gone", () => {
    const state = initialWorkbenchState;
    expect(changeAfterShape(state, updateChange)).toBeUndefined();
    expect(changeBeforeShape(state, updateChange)).toBeUndefined();
  });

  it("returns undefined after/before for a RemoveChange (no draft, no shape data)", () => {
    const state = initialWorkbenchState;
    expect(findDraftForChange(state, removeChange)).toBeUndefined();
    expect(changeAfterShape(state, removeChange)).toBeUndefined();
    expect(changeBeforeShape(state, removeChange)).toBeUndefined();
  });
});

describe("changeShapeDiff", () => {
  it("diffs an update's before/after via the matching draft, geometryChanged false for a metadata-only edit", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      shape: UPDATED_SHAPE,
      original: ORIGINAL_SHAPE,
    };
    const state = stateWithDrafts({ "A Shape Major": draft });
    const diff = changeShapeDiff(state, updateChange);
    expect(diff).toBeDefined();
    expect(diff!.geometryChanged).toBe(false);
    expect(diff!.added.sort()).toEqual(["cagedPosition", "chordType"]);
  });

  it("returns undefined for a RemoveChange", () => {
    expect(changeShapeDiff(initialWorkbenchState, removeChange)).toBeUndefined();
  });

  it("treats every field as added for an AddChange (before is undefined)", () => {
    const diff = changeShapeDiff(initialWorkbenchState, addChange);
    expect(diff).toBeDefined();
    expect(diff!.removed).toEqual([]);
    expect(diff!.added).toContain("strings");
    expect(diff!.geometryChanged).toBe(true);
  });
});

describe("changeCheckStatus", () => {
  it("mirrors auditChordShapeFull's severity for an add change", () => {
    const state = initialWorkbenchState;
    const expectedIssues = auditChordShapeFull(NEW_SHAPE, { tuning: state.tuning });
    const expectedStatus = expectedIssues.some((issue) => issue.severity === "error")
      ? "error"
      : expectedIssues.length > 0
        ? "warning"
        : "pass";
    expect(changeCheckStatus(state, addChange)).toBe(expectedStatus);
  });

  it("returns n/a for a remove change (no shape data to audit)", () => {
    expect(changeCheckStatus(initialWorkbenchState, removeChange)).toBe("n/a");
  });

  it("filters out CHECK_NAME_UNIQUE for update changes (mirrors the merge script's rule-8 filter)", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      shape: ORIGINAL_SHAPE, // unchanged clone of a live registered shape
      original: ORIGINAL_SHAPE,
    };
    const state = stateWithDrafts({ "A Shape Major": draft });
    // Without the update-only filter, auditing a clone of a live registered
    // shape would report CHECK_NAME_UNIQUE (reference-inequality collision
    // against itself) as an error — asserting that directly here, then
    // asserting changeCheckStatus does NOT surface it.
    const rawIssues = auditChordShapeFull(ORIGINAL_SHAPE, { tuning: state.tuning });
    expect(rawIssues.some((issue) => issue.id === CHECK_NAME_UNIQUE)).toBe(true);

    const updateOnThisShape: UpdateChange = { op: "update", kind: "chord", name: "A Shape Major", patch: {} };
    expect(changeCheckStatus(state, updateOnThisShape)).not.toBe("error");
  });
});

describe("summarizeChangesByKindAndOp", () => {
  it("tallies changes by (kind, op), sorted by kind then op", () => {
    const anotherAdd: AddChange = { ...addChange, shape: { ...NEW_SHAPE, name: "D Shape Minor" } };
    const scaleUpdate: UpdateChange = { op: "update", kind: "scale", name: "Some Scale", patch: {} };
    const tally = summarizeChangesByKindAndOp([addChange, anotherAdd, updateChange, scaleUpdate]);
    expect(tally).toEqual([
      { kind: "chord", op: "add", count: 2 },
      { kind: "chord", op: "update", count: 1 },
      { kind: "scale", op: "update", count: 1 },
    ]);
  });

  it("returns an empty array for no changes", () => {
    expect(summarizeChangesByKindAndOp([])).toEqual([]);
  });
});
