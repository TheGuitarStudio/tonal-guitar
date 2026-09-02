import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { auditAllShapes } from "tonal-guitar";
import { boardModel, buildCatalog, type ShapeCatalogEntry } from "shape-catalog";
import { ShapeLibraryProvider, type EditCapabilities } from "shape-library-ui";
import { BoardScreen } from "./Board";
import { WorkbenchDispatchContext, WorkbenchStateContext } from "../StoreProvider";
import { initialWorkbenchState, type WorkbenchState } from "../store";

// The same catalog/model Board.tsx builds internally (module-scope, from the
// live registry) — used here as the "fixture boardModel result" 25.1 asks
// for: since Board.tsx's default filter state (kind "chord", no quality
// group/search, `columnAxis: "cagedPosition"` from `initialWorkbenchState`)
// maps 1:1 onto these exact `boardModel` options, this is a deterministic,
// independently-computed expectation to assert the rendered header against.
const catalog: ShapeCatalogEntry[] = buildCatalog(auditAllShapes());
const expectedModel = boardModel(catalog, {
  kind: "chord",
  axis: "cagedPosition",
  rowGrouping: "chordType",
});

/** See `shape-library-ui/testFixtures.ts`'s doc comment: React SSR inserts
 * `<!-- -->` comment markers between adjacent text/expression children. */
function stripReactComments(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}

function renderBoard(state: WorkbenchState = initialWorkbenchState, edit?: EditCapabilities): string {
  return renderToString(
    <WorkbenchStateContext.Provider value={state}>
      <WorkbenchDispatchContext.Provider value={() => {}}>
        <ShapeLibraryProvider capabilities={edit ? { edit } : undefined}>
          <BoardScreen />
        </ShapeLibraryProvider>
      </WorkbenchDispatchContext.Provider>
    </WorkbenchStateContext.Provider>,
  );
}

describe("BoardScreen", () => {
  it("renders under renderToString with no window access", () => {
    expect(() => renderBoard()).not.toThrow();
  });

  it("shows the 'Showing N of M · K gaps' header matching the equivalent boardModel result", () => {
    const html = stripReactComments(renderBoard());
    expect(html).toContain(`Showing ${expectedModel.counts.shown} of ${expectedModel.counts.total}`);
    expect(html).toContain(`${expectedModel.counts.gaps} gaps`);
  });

  it("renders the full CAGED column set (C, A, G, E, D) as board headers", () => {
    expect(expectedModel.columns.map((c) => c.key)).toEqual(["C", "A", "G", "E", "D"]);
    const html = renderBoard();
    const columnHeaderCount = (html.match(/role="columnheader"/g) ?? []).length;
    // +1 for ShapeBoard's aria-hidden corner spacer cell.
    expect(columnHeaderCount).toBe(expectedModel.columns.length + 1);
  });

  it("emits zero data-tg-edit elements without capabilities.edit (read-only default)", () => {
    const html = renderBoard();
    expect(html).not.toContain("data-tg-edit");
  });

  it("gap cells stay inert (data-tg-gap, no button) without capabilities.edit", () => {
    const html = renderBoard();
    expect(expectedModel.counts.gaps).toBeGreaterThan(0);
    expect(html).toContain("data-tg-gap");
  });

  it("gap cells render a 'Create <column>' button carrying data-tg-edit only when capabilities.edit.onCreateShape is present", () => {
    const gapCell = [...expectedModel.cells.values()].find((cell) => cell.state === "gap");
    if (!gapCell) throw new Error("expected at least one gap cell in the fixture registry");

    const withoutEdit = renderBoard();
    expect(withoutEdit).not.toMatch(/>Create /);

    const withEdit = stripReactComments(renderBoard(initialWorkbenchState, { onCreateShape: () => {} }));
    expect(withEdit).toContain("data-tg-edit");
    expect(withEdit).toContain(`>Create ${gapCell.columnKey}<`);
  });

  it("renders a draft cell (not a gap or filled cell) for a slot key present in WorkbenchState.drafts", () => {
    const gapCell = [...expectedModel.cells.values()].find((cell) => cell.state === "gap");
    if (!gapCell) throw new Error("expected at least one gap cell in the fixture registry");
    const key = gapCell.key;

    const state: WorkbenchState = {
      ...initialWorkbenchState,
      drafts: {
        [key]: {
          kind: "chord",
          origin: "gap",
          shape: {
            name: "Draft Shape",
            system: "caged",
            strings: [null, null, null, null, null, null],
            fingers: [null, null, null, null, null, null],
            barres: [],
            rootString: 0,
          },
        },
      },
    };
    const draftFor: EditCapabilities["draftFor"] = (slotKey) =>
      slotKey === key ? { label: "Draft Shape", status: "draft" } : undefined;

    const html = renderBoard(state, { onCreateShape: () => {}, draftFor });
    expect(html).toContain("tg-board-cell-draft");
    expect(html).toContain("Draft Shape");
  });

  it("shows the pending-changes count and Export affordance from WorkbenchStore.changes.length when exportState is injected", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      changes: [
        { op: "remove", kind: "chord", name: "x" },
        { op: "remove", kind: "chord", name: "y" },
      ],
    };
    const html = stripReactComments(
      renderBoard(state, { exportState: { pendingCount: state.changes.length, onExport: () => {} } }),
    );
    expect(html).toContain("data-tg-edit");
    expect(html).toContain("2 pending");
    expect(html).toContain("Export");
  });

  it("wires the Columns control to WorkbenchState.columnAxis (cagedPosition selected by default, per initialWorkbenchState)", () => {
    const html = renderBoard();
    expect(html).toMatch(/aria-label="Board columns"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>CAGED position</);
  });

  it("wires the Diagrams control to WorkbenchState.orientation (vertical selected by default, per initialWorkbenchState)", () => {
    const html = renderBoard();
    expect(html).toMatch(/aria-label="Diagram orientation"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Vertical</);
  });
});
