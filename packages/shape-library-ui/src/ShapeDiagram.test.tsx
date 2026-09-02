import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ShapeDiagram } from "./ShapeDiagram";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { chordEntry, scaleEntry } from "./testFixtures";

describe("ShapeDiagram / ShapeCardDiagram", () => {
  it("render under renderToString with no window access", () => {
    expect(() => renderToString(<ShapeDiagram entry={chordEntry} />)).not.toThrow();
    expect(() => renderToString(<ShapeDiagram entry={scaleEntry} orientation="vertical" />)).not.toThrow();
    expect(() => renderToString(<ShapeCardDiagram entry={chordEntry} />)).not.toThrow();
    expect(() => renderToString(<ShapeCardDiagram entry={scaleEntry} />)).not.toThrow();
  });

  it("never emit data-tg-edit (read-only, capability-independent)", () => {
    expect(renderToString(<ShapeDiagram entry={chordEntry} />)).not.toContain("data-tg-edit");
    expect(renderToString(<ShapeCardDiagram entry={scaleEntry} />)).not.toContain("data-tg-edit");
  });

  it("renders an SVG fretboard for a real registered chord entry", () => {
    const html = renderToString(<ShapeCardDiagram entry={chordEntry} />);
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
  });

  it("renders the empty-diagram fallback when frettedScale has no notes", () => {
    const empty = { ...chordEntry, frettedScale: { ...chordEntry.frettedScale, notes: [] } };
    const html = renderToString(<ShapeDiagram entry={empty} />);
    expect(html).toContain("Failed to build at");
    expect(html).not.toContain("<svg");
  });
});
