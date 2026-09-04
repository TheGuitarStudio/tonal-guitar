import { describe, expect, it } from "vitest";
import { renderShapeTs } from "shape-catalog";
import type { DraftShape, ShapeLike } from "shape-catalog";
import type { ChordShape } from "tonal-guitar";
import {
  canPreviewChange,
  draftChangePreview,
  renderDraftJson,
  renderDraftTs,
  targetFileFor,
} from "./previewText";

const SHAPE: ChordShape = {
  name: "E Shape Minor",
  system: "caged",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 1, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m",
  cagedPosition: "E",
};

describe("canPreviewChange / targetFileFor", () => {
  it("is previewable for an existing-origin draft with no file", () => {
    const draft: DraftShape = { kind: "chord", origin: "existing", shape: SHAPE, original: SHAPE };
    expect(canPreviewChange(draft)).toBe(true);
    expect(targetFileFor(draft)).toBeUndefined();
  });

  it("is not previewable for a gap-origin draft with no file chosen yet", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: SHAPE };
    expect(canPreviewChange(draft)).toBe(false);
    expect(targetFileFor(draft)).toBeUndefined();
  });

  it("is previewable for a gap-origin draft once a file is set", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: SHAPE, file: "caged-chords-minor" };
    expect(canPreviewChange(draft)).toBe(true);
    expect(targetFileFor(draft)).toBe("caged-chords-minor");
  });
});

describe("draftChangePreview / renderDraftJson", () => {
  it("returns undefined (no throw) when the draft isn't previewable yet", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: SHAPE };
    expect(draftChangePreview(draft)).toBeUndefined();
    expect(renderDraftJson(draft)).toBeUndefined();
  });

  it("produces an AddChange for a gap-origin draft with a file, matching draftToChange", () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: SHAPE, file: "caged-chords-minor" };
    const change = draftChangePreview(draft);
    expect(change).toEqual({ op: "add", kind: "chord", file: "caged-chords-minor", shape: SHAPE });
    expect(JSON.parse(renderDraftJson(draft)!)).toEqual(change);
  });
});

describe("renderDraftTs", () => {
  it("is byte-identical to calling renderShapeTs directly with the same (kind, shape, options)", async () => {
    const draft: DraftShape = { kind: "chord", origin: "gap", shape: SHAPE, file: "caged-chords-minor" };
    const [fromDraft, direct] = await Promise.all([
      renderDraftTs(draft),
      renderShapeTs("chord", SHAPE as unknown as ShapeLike),
    ]);
    expect(fromDraft).toBe(direct);
  });

  it("passes draft.ident through as the renderShapeTs options.ident override", async () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "gap",
      shape: SHAPE,
      file: "caged-chords-minor",
      ident: "CAGED_CHORD_EM",
    };
    const [fromDraft, direct] = await Promise.all([
      renderDraftTs(draft),
      renderShapeTs("chord", SHAPE as unknown as ShapeLike, { ident: "CAGED_CHORD_EM" }),
    ]);
    expect(fromDraft).toBe(direct);
    expect(fromDraft).toContain("CAGED_CHORD_EM");
  });
});
