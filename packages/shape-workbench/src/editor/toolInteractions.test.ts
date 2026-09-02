import { describe, expect, it } from "vitest";
import type { EditorCell } from "fretboard-ui";
import { applyCellsChange } from "./toolInteractions";

describe("applyCellsChange", () => {
  it("select: ignores an added cell (no mutation)", () => {
    const prev: EditorCell[] = [];
    const next: EditorCell[] = [{ string: 2, fret: 3 }];
    expect(applyCellsChange(prev, next, "select", 1)).toBe(prev);
  });

  it("select: ignores a removed cell (no mutation)", () => {
    const prev: EditorCell[] = [{ string: 2, fret: 3 }];
    const next: EditorCell[] = [];
    expect(applyCellsChange(prev, next, "select", 1)).toBe(prev);
  });

  it("barre: never mutates cells regardless of add/remove diff", () => {
    const prev: EditorCell[] = [{ string: 0, fret: 5 }];
    const added: EditorCell[] = [...prev, { string: 1, fret: 5 }];
    expect(applyCellsChange(prev, added, "barre", 2)).toBe(prev);
    expect(applyCellsChange(prev, [], "barre", 2)).toBe(prev);
  });

  it("note: passes a plain add straight through", () => {
    const prev: EditorCell[] = [];
    const next: EditorCell[] = [{ string: 2, fret: 3 }];
    expect(applyCellsChange(prev, next, "note", 1)).toBe(next);
  });

  it("note: passes a plain remove straight through", () => {
    const prev: EditorCell[] = [{ string: 2, fret: 3 }];
    const next: EditorCell[] = [];
    expect(applyCellsChange(prev, next, "note", 1)).toBe(next);
  });

  it("root: a newly added cell becomes the sole root, clearing any prior root", () => {
    const prev: EditorCell[] = [{ string: 0, fret: 5, isRoot: true }, { string: 1, fret: 5 }];
    const next: EditorCell[] = [...prev, { string: 2, fret: 5 }];
    const result = applyCellsChange(prev, next, "root", 1);
    expect(result).toEqual([
      { string: 0, fret: 5, isRoot: false },
      { string: 1, fret: 5 },
      { string: 2, fret: 5, isRoot: true },
    ]);
  });

  it("root: ignores an attempted removal (switch to Note to delete)", () => {
    const prev: EditorCell[] = [{ string: 0, fret: 5, isRoot: true }, { string: 1, fret: 5 }];
    const next: EditorCell[] = [{ string: 0, fret: 5, isRoot: true }];
    expect(applyCellsChange(prev, next, "root", 1)).toBe(prev);
  });

  it("finger: a newly added cell carries the active finger", () => {
    const prev: EditorCell[] = [];
    const next: EditorCell[] = [{ string: 3, fret: 2 }];
    const result = applyCellsChange(prev, next, "finger", 3);
    expect(result).toEqual([{ string: 3, fret: 2, finger: 3 }]);
  });

  it("finger: re-clicking an existing note re-fingers it instead of deleting it", () => {
    const prev: EditorCell[] = [{ string: 3, fret: 2, finger: 1 }];
    const next: EditorCell[] = [];
    const result = applyCellsChange(prev, next, "finger", 4);
    expect(result).toEqual([{ string: 3, fret: 2, finger: 4 }]);
  });

  it("mute: a newly added cell carries muted: true", () => {
    const prev: EditorCell[] = [];
    const next: EditorCell[] = [{ string: 4, fret: 0 }];
    const result = applyCellsChange(prev, next, "mute", 1);
    expect(result).toEqual([{ string: 4, fret: 0, muted: true }]);
  });

  it("mute: re-clicking an existing note toggles muted in place instead of deleting it", () => {
    const prev: EditorCell[] = [{ string: 4, fret: 0 }];
    const next: EditorCell[] = [];
    const once = applyCellsChange(prev, next, "mute", 1);
    expect(once).toEqual([{ string: 4, fret: 0, muted: true }]);

    const twice = applyCellsChange(once, [], "mute", 1);
    expect(twice).toEqual([{ string: 4, fret: 0, muted: false }]);
  });

  it("passes through unrecognized diffs (e.g. the built-in Clear button) unmodified", () => {
    const prev: EditorCell[] = [{ string: 0, fret: 1 }, { string: 1, fret: 2 }];
    const next: EditorCell[] = [];
    // Clearing removes 2 cells at once — not a single-remove — so every
    // tool passes it straight through rather than trying to reinterpret it.
    expect(applyCellsChange(prev, next, "finger", 2)).toBe(next);
    expect(applyCellsChange(prev, next, "mute", 2)).toBe(next);
  });

  it("passes through the built-in Set-Root button's in-place isRoot flip", () => {
    const prev: EditorCell[] = [{ string: 0, fret: 5, isRoot: true }, { string: 1, fret: 5 }];
    const next: EditorCell[] = [{ string: 0, fret: 5, isRoot: false }, { string: 1, fret: 5, isRoot: true }];
    expect(applyCellsChange(prev, next, "note", 1)).toBe(next);
  });
});
