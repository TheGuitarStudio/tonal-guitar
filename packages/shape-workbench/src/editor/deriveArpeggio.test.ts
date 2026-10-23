import { describe, expect, it } from "vitest";
import { arpeggioShapes, STANDARD } from "tonal-guitar";
import type { ArpeggioShape, UpdateChange } from "tonal-guitar";
import { draftToChange } from "shape-catalog";
import {
  arpeggioIsBlank,
  buildArpeggioFromCells,
  deriveArpeggioRootString,
  seedCellsFromArpeggio,
  seedForArpeggioDraft,
} from "./deriveArpeggio";

const SEEDS = arpeggioShapes.all();
const ROOTS = ["A", "C", "F#"];

function updateFor(derived: ArpeggioShape, original: ArpeggioShape): UpdateChange {
  const change = draftToChange({ kind: "arpeggio", origin: "existing", shape: derived, original });
  expect(change.op).toBe("update");
  return change as UpdateChange;
}

describe("deriveArpeggioRootString", () => {
  it("returns the lowest string carrying 1P, or undefined", () => {
    expect(deriveArpeggioRootString([["3M"], ["1P"], null, ["1P"]])).toBe(1);
    expect(deriveArpeggioRootString([["3M"], null])).toBeUndefined();
  });
});

describe("arpeggio seed round trip", () => {
  it("has the 20 registered seeds", () => {
    expect(SEEDS.length).toBe(20);
  });

  for (const root of ROOTS) {
    it(`reproduces every seed unchanged at root ${root} (empty UpdateChange patch)`, () => {
      for (const shape of SEEDS) {
        const cells = seedCellsFromArpeggio(shape, STANDARD, root);
        const derived = buildArpeggioFromCells(shape, cells, STANDARD, root);
        expect(derived, shape.name).toEqual(shape);
        const change = updateFor(derived!, shape);
        expect(change.patch, shape.name).toEqual({});
        expect(change.unset, shape.name).toBeUndefined();
      }
    });
  }
});

describe("arpeggio edits", () => {
  const shape = arpeggioShapes.all().find((s) => s.name === "E Shape Minor Arpeggio")!;
  const cells = seedCellsFromArpeggio(shape, STANDARD, "A");

  it("removing a non-root cell patches only strings", () => {
    const victim = cells.find((c) => !c.isRoot)!;
    const next = cells.filter((c) => c !== victim);
    const derived = buildArpeggioFromCells(shape, next, STANDARD, "A")!;
    const change = updateFor(derived, shape);
    expect(Object.keys(change.patch)).toEqual(["strings"]);
  });

  it("adding a cell patches only strings", () => {
    const used = new Set(cells.map((c) => `${c.string}:${c.fret}`));
    // a fret on string 0 not already used, a different chroma than any seeded
    const fret = [...Array(12).keys()].find((f) => !used.has(`0:${f}`))!;
    const next = [...cells, { string: 0, fret, isRoot: false }];
    const derived = buildArpeggioFromCells(shape, next, STANDARD, "A")!;
    const change = updateFor(derived, shape);
    expect(Object.keys(change.patch)).toEqual(["strings"]);
  });

  it("a metadata-only edit patches only tags", () => {
    const derived = buildArpeggioFromCells({ ...shape, tags: [...(shape.tags ?? []), "verified"] }, cells, STANDARD, "A")!;
    const change = updateFor(derived, shape);
    expect(Object.keys(change.patch)).toEqual(["tags"]);
  });

  it("returns undefined without a 1P on any string", () => {
    expect(buildArpeggioFromCells(shape, [], STANDARD, "A")).toBeUndefined();
    const noRoot = cells.filter((c) => !c.isRoot);
    // dropping every 1P cell leaves no string carrying 1P
    expect(buildArpeggioFromCells(shape, noRoot, STANDARD, "A")).toBeUndefined();
  });
});

describe("seedForArpeggioDraft / arpeggioIsBlank", () => {
  const shape = SEEDS[0]!;
  const blank: ArpeggioShape = { ...shape, strings: STANDARD.map(() => null) };

  it("detects blank shapes", () => {
    expect(arpeggioIsBlank(blank)).toBe(true);
    expect(arpeggioIsBlank(shape)).toBe(false);
  });

  it("prefers rawGeometry, else seeds blank/derived", () => {
    const raw = { cells: [{ string: 0, fret: 3, isRoot: true }], barres: [] };
    expect(seedForArpeggioDraft({ shape, rawGeometry: raw }, STANDARD, "A").cells).toBe(raw.cells);
    expect(seedForArpeggioDraft({ shape: blank }, STANDARD, "A")).toEqual({ cells: [], barres: [] });
    expect(seedForArpeggioDraft({ shape }, STANDARD, "A").cells).toEqual(seedCellsFromArpeggio(shape, STANDARD, "A"));
  });
});
