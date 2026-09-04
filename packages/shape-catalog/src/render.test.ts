/**
 * Printer-parity test (Task 22.3, resolving the placeholder left by Group
 * 18.3): asserts `renderShapeTs` (this package's re-export) and
 * `renderShape` (the underlying `scripts/lib/render-shape.mjs`, imported
 * directly here the same way `scripts/shapes-merge.mjs` does) produce
 * byte-identical output for the same input — the workbench's "Copy TS" and
 * the merge script's generated `src/data/*.ts` source must never diverge.
 */
import { describe, expect, it } from "vitest";
import { renderShape } from "../../../scripts/lib/render-shape.mjs";
import { renderShapeTs } from "./render";

const REPRESENTATIVE_CHORD = {
  name: "A Shape Minor",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "4P", "5P"],
  fingers: [null, 1, 3, 4, 1, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 3, toString: 4, finger: 4 },
  ],
  rootString: 1,
  chordType: "m",
  cagedPosition: "A" as const,
  tags: ["barre", "movable"],
};

const REPRESENTATIVE_SCALE = {
  name: "E Shape Major Scale",
  system: "caged",
  strings: [["1P", "2M"], ["3M"], ["5P", "6M"], ["1P", "2M"], ["3M"], ["1P"]],
  rootString: 0,
  quality: "major",
  cagedPosition: "E" as const,
};

// CR-026: `renderShapeTs === renderShape` (asserted implicitly below by
// every byte-identical-output test — `render.ts` just re-exports the
// printer) is a vacuous parity check on its own, since a `toBe` between two
// bindings of the SAME function reference can never fail regardless of what
// the printer actually does. This golden string (captured from the
// no-prettier fallback formatter, the deterministic path with no external
// tool involved) instead pins the ACTUAL output shape/format, so a future
// change to the printer that breaks formatting — even one that keeps
// `render.ts`'s re-export intact — fails this test.
const REPRESENTATIVE_CHORD_FALLBACK_GOLDEN =
  'export const CHORD_A_SHAPE_MINOR: ChordShape = {\n' +
  '  name: "A Shape Minor",\n' +
  '  system: "caged",\n' +
  '  strings: [null, "1P", "5P", "1P", "4P", "5P"],\n' +
  '  fingers: [null, 1, 3, 4, 1, 1],\n' +
  '  barres: [\n' +
  '    { fret: 0, fromString: 1, toString: 5, finger: 1 },\n' +
  '    { fret: 2, fromString: 3, toString: 4, finger: 4 },\n' +
  '  ],\n' +
  '  rootString: 1,\n' +
  '  chordType: "m",\n' +
  '  cagedPosition: "A",\n' +
  '  tags: ["barre", "movable"],\n' +
  '};\n';

describe("renderShapeTs — printer parity with scripts/lib/render-shape.mjs", () => {
  it("no-prettier fallback output matches a committed golden string (not a self-comparison)", async () => {
    const out = await renderShapeTs("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    expect(out).toBe(REPRESENTATIVE_CHORD_FALLBACK_GOLDEN);
  });

  it("produces byte-identical output for a representative chord shape (prettier path)", async () => {
    const viaCatalog = await renderShapeTs("chord", REPRESENTATIVE_CHORD);
    const viaPrinter = await renderShape("chord", REPRESENTATIVE_CHORD);
    expect(viaCatalog).toBe(viaPrinter);
  });

  it("produces byte-identical output for a representative chord shape (fallback formatter)", async () => {
    const viaCatalog = await renderShapeTs("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    const viaPrinter = await renderShape("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    expect(viaCatalog).toBe(viaPrinter);
  });

  it("produces byte-identical output for a representative scale shape", async () => {
    const viaCatalog = await renderShapeTs("scale", REPRESENTATIVE_SCALE);
    const viaPrinter = await renderShape("scale", REPRESENTATIVE_SCALE);
    expect(viaCatalog).toBe(viaPrinter);
  });

  it("produces byte-identical output when an explicit `ident` override is supplied", async () => {
    const viaCatalog = await renderShapeTs("chord", REPRESENTATIVE_CHORD, { ident: "CAGED_CHORD_AM" });
    const viaPrinter = await renderShape("chord", REPRESENTATIVE_CHORD, { ident: "CAGED_CHORD_AM" });
    expect(viaCatalog).toBe(viaPrinter);
    expect(viaCatalog).toContain("export const CAGED_CHORD_AM: ChordShape = {");
  });
});
