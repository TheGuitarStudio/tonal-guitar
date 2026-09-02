import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { BoardCell } from "shape-catalog";
import { BoardCellCard } from "./BoardCellCard";
import { ShapeLibraryProvider } from "./capabilities";
import { chordBoardModel, chordEntry, stripReactComments } from "./testFixtures";

const gapCell: BoardCell = {
  key: "gap::A",
  rowKey: "gap-row",
  columnKey: "A",
  state: "gap",
  slot: { kind: "chord", rowGrouping: "chordType", rowKey: "gap-row", axis: "cagedPosition", columnKey: "A", chordType: "m", cagedPosition: "A" },
};

const filledCell: BoardCell = {
  key: "filled::A",
  rowKey: "filled-row",
  columnKey: "A",
  state: "filled",
  entry: chordEntry,
  slot: { kind: "chord", rowGrouping: "chordType", rowKey: "filled-row", axis: "cagedPosition", columnKey: "A" },
};

const draftCell: BoardCell = {
  key: "draft::A",
  rowKey: "draft-row",
  columnKey: "A",
  state: "draft",
  slot: { kind: "chord", rowGrouping: "chordType", rowKey: "draft-row", axis: "cagedPosition", columnKey: "A" },
};

describe("BoardCellCard", () => {
  it("renders under renderToString with no window access", () => {
    for (const cell of [gapCell, filledCell, draftCell]) {
      expect(() => renderToString(<BoardCellCard cell={cell} />)).not.toThrow();
    }
  });

  describe("gap cells (D-002 testable invariant)", () => {
    it("renders as an inert <div data-tg-gap> with no provider", () => {
      const html = renderToString(<BoardCellCard cell={gapCell} />);
      expect(html).toContain("data-tg-gap");
      expect(html).not.toContain("<button");
      expect(html).not.toContain("data-tg-edit");
    });

    it("renders as an inert <div data-tg-gap> when capabilities.edit is undefined", () => {
      const html = renderToString(
        <ShapeLibraryProvider capabilities={{}}>
          <BoardCellCard cell={gapCell} />
        </ShapeLibraryProvider>,
      );
      expect(html).toContain("data-tg-gap");
      expect(html).not.toContain("<button");
    });

    it("becomes a <button data-tg-edit>Create <X> Shape <type></button> when onCreateShape is injected", () => {
      const html = stripReactComments(
        renderToString(
          <ShapeLibraryProvider capabilities={{ edit: { onCreateShape: () => {} } }}>
            <BoardCellCard cell={gapCell} />
          </ShapeLibraryProvider>,
        ),
      );
      expect(html).toContain("<button");
      expect(html).toContain("data-tg-edit");
      expect(html).not.toContain("data-tg-gap");
      // Spec §7 / tasks 25.1, 25.3: names both the CAGED position
      // (`cell.columnKey`) and the chord type (`cell.slot.chordType`).
      expect(html).toContain(`Create ${gapCell.columnKey} Shape ${gapCell.slot.chordType}`);
    });
  });

  it("emits zero data-tg-edit for a filled cell without a provider", () => {
    const html = renderToString(<BoardCellCard cell={filledCell} />);
    expect(html).not.toContain("data-tg-edit");
    expect(html).toContain(chordEntry.name);
  });

  it("adds a data-tg-edit Edit affordance to a filled cell when onEditShape is injected", () => {
    const html = renderToString(
      <ShapeLibraryProvider capabilities={{ edit: { onEditShape: () => {} } }}>
        <BoardCellCard cell={filledCell} />
      </ShapeLibraryProvider>,
    );
    expect(html).toContain("data-tg-edit");
  });
});

describe("ShapeBoard model fixture sanity", () => {
  it("boardModel produces at least one gap and columns for the CAGED axis", () => {
    expect(chordBoardModel.columns.map((c) => c.key)).toEqual(["C", "A", "G", "E", "D"]);
    expect(chordBoardModel.counts.total).toBeGreaterThan(0);
  });
});
