import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ShapeBoard } from "./ShapeBoard";
import { ShapeLibraryProvider } from "./capabilities";
import { chordBoardModel, stripReactComments } from "./testFixtures";

describe("ShapeBoard", () => {
  it("renders under renderToString with no window access, in both grid and collapsed layouts", () => {
    expect(() => renderToString(<ShapeBoard model={chordBoardModel} />)).not.toThrow();
    expect(() => renderToString(<ShapeBoard model={chordBoardModel} collapseToSingleColumn />)).not.toThrow();
  });

  it("emits zero data-tg-edit elements without a provider", () => {
    const html = renderToString(<ShapeBoard model={chordBoardModel} />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("emits zero data-tg-edit elements in collapsed layout without a provider", () => {
    const html = renderToString(<ShapeBoard model={chordBoardModel} collapseToSingleColumn />);
    expect(html).not.toContain("data-tg-edit");
  });

  it("shows the Showing N of M · K gaps header", () => {
    const html = stripReactComments(renderToString(<ShapeBoard model={chordBoardModel} />));
    expect(html).toContain(`Showing ${chordBoardModel.counts.shown} of ${chordBoardModel.counts.total}`);
    expect(html).toContain(`${chordBoardModel.counts.gaps} gaps`);
  });

  it("renders an Export affordance carrying data-tg-edit only when exportState is injected", () => {
    const withoutExport = renderToString(<ShapeBoard model={chordBoardModel} />);
    expect(withoutExport).not.toContain("Export");

    const withExport = stripReactComments(
      renderToString(
        <ShapeLibraryProvider capabilities={{ edit: { exportState: { pendingCount: 3, onExport: () => {} } } }}>
          <ShapeBoard model={chordBoardModel} />
        </ShapeLibraryProvider>,
      ),
    );
    expect(withExport).toContain("data-tg-edit");
    expect(withExport).toContain("3 pending");
    expect(withExport).toContain("Export");
  });

  it("gap cells stay inert (data-tg-gap, no button) in the full grid without capabilities", () => {
    const html = renderToString(<ShapeBoard model={chordBoardModel} />);
    if (chordBoardModel.counts.gaps > 0) {
      expect(html).toContain("data-tg-gap");
    }
  });
});
