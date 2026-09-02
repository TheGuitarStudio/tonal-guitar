import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ShapeCardChordTable } from "./ShapeCardChordTable";
import { chordEntry } from "./testFixtures";

describe("ShapeCardChordTable", () => {
  it("renders under renderToString with no window access", () => {
    expect(() =>
      renderToString(
        <ShapeCardChordTable
          chordShape={chordEntry.shape}
          builtFrets={chordEntry.builtFrets}
          sourceFrets={chordEntry.sourceFrets}
          gripRoot={chordEntry.gripRoot}
          renderRoot={chordEntry.renderRoot}
          issues={chordEntry.issues}
        />,
      ),
    ).not.toThrow();
  });

  it("never emits data-tg-edit (read-only, capability-independent)", () => {
    const html = renderToString(
      <ShapeCardChordTable
        chordShape={chordEntry.shape}
        builtFrets={chordEntry.builtFrets}
        sourceFrets={chordEntry.sourceFrets}
        gripRoot={chordEntry.gripRoot}
        renderRoot={chordEntry.renderRoot}
        issues={chordEntry.issues}
      />,
    );
    expect(html).not.toContain("data-tg-edit");
  });

  it("renders one column per string plus the row-label column", () => {
    const html = renderToString(
      <ShapeCardChordTable
        chordShape={chordEntry.shape}
        builtFrets={chordEntry.builtFrets}
        sourceFrets={chordEntry.sourceFrets}
        gripRoot={chordEntry.gripRoot}
        renderRoot={chordEntry.renderRoot}
        issues={chordEntry.issues}
      />,
    );
    expect(html).toContain("<table>");
    expect(html).toContain("interval");
    expect(html).toContain("finger");
  });
});
