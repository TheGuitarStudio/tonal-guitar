import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { BoardCell } from "shape-catalog";
import { BoardCellCard, shownEntryIndex } from "./BoardCellCard";
import { ShapeLibraryProvider } from "./capabilities";
import { catalog, chordBoardModel, chordEntry, stripReactComments } from "./testFixtures";

const gapCell: BoardCell = {
  key: "gap::A",
  rowKey: "gap-row",
  columnKey: "A",
  state: "gap",
  entries: [],
  slot: { kind: "chord", rowGrouping: "chordType", rowKey: "gap-row", axis: "cagedPosition", columnKey: "A", chordType: "m", cagedPosition: "A" },
};

const filledCell: BoardCell = {
  key: "filled::A",
  rowKey: "filled-row",
  columnKey: "A",
  state: "filled",
  entries: [chordEntry],
  entry: chordEntry,
  slot: { kind: "chord", rowGrouping: "chordType", rowKey: "filled-row", axis: "cagedPosition", columnKey: "A" },
};

const stackedEntries = catalog.filter((entry) => entry.kind === "chord").slice(0, 3);
const stackedCell: BoardCell = {
  ...filledCell,
  key: "stacked::A",
  entries: stackedEntries,
  entry: stackedEntries[0],
};

const draftCell: BoardCell = {
  key: "draft::A",
  rowKey: "draft-row",
  columnKey: "A",
  state: "draft",
  entries: [],
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

describe("BoardCellCard — cells holding several matches (CR-030)", () => {
  it("shows the first match plus a +N badge with an accessible label", () => {
    const html = stripReactComments(renderToString(<BoardCellCard cell={stackedCell} />));
    expect(html).toContain(stackedEntries[0].name);
    expect(html).not.toContain(`>${stackedEntries[1].name}<`);
    expect(html).toContain("tg-board-cell-more");
    expect(html).toContain(">+2</button>");
    expect(html).toContain('aria-label="2 more shapes in this cell, show next"');
    expect(html).toContain(`aria-label="${stackedEntries[0].name} (1 of 3 in this cell)"`);
    // Read-only: the badge is not an edit affordance.
    expect(html).not.toContain("data-tg-edit");
  });

  it("uses the singular for one extra match", () => {
    const pair: BoardCell = { ...stackedCell, entries: stackedEntries.slice(0, 2) };
    const html = stripReactComments(renderToString(<BoardCellCard cell={pair} />));
    expect(html).toContain('aria-label="1 more shape in this cell, show next"');
  });

  it("renders no badge for a single-match cell", () => {
    const html = renderToString(<BoardCellCard cell={filledCell} />);
    expect(html).not.toContain("tg-board-cell-more");
    expect(html).toContain(`aria-label="${chordEntry.name}"`);
  });

  it("shownEntryIndex follows the shown name and falls back to the first match", () => {
    const [a, b, c] = stackedEntries;
    expect(shownEntryIndex(stackedEntries, undefined)).toBe(0);
    expect(shownEntryIndex(stackedEntries, b.name)).toBe(1);
    expect(shownEntryIndex(stackedEntries, c.name)).toBe(2);
    // A filter dropped the shown match: back to the first one still there.
    expect(shownEntryIndex([a, c], b.name)).toBe(0);
  });
});

describe("ShapeBoard model fixture sanity", () => {
  it("boardModel produces at least one gap and columns for the CAGED axis", () => {
    expect(chordBoardModel.columns.map((c) => c.key)).toEqual(["C", "A", "G", "E", "D"]);
    expect(chordBoardModel.counts.total).toBeGreaterThan(0);
  });
});
