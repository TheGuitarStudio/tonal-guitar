import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { auditAllShapes } from "tonal-guitar";
import {
  boardModel,
  buildCatalog,
  chordEntryMatchesSelection,
  scaleEntryMatchesSelection,
  type BoardCell,
  type BoardModelResult,
  type ChordCatalogEntry,
  type ChordFacetSelection,
  type ScaleCatalogEntry,
  type ScaleFacetSelection,
  type ShapeCatalogEntry,
} from "shape-catalog";
import { ShapeLibraryProvider, type EditCapabilities } from "shape-library-ui";
import { BoardScreen, restrictCellsByEntry } from "./Board";
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
    // CR-042: `ShapeBoard` dropped the (invalid) `role="columnheader"`
    // markup — `class="tg-board-header"` (exact, not the `tg-board-header-bar`
    // wrapper above it) is what every header cell (including the
    // aria-hidden corner spacer) carries instead.
    const columnHeaderCount = (html.match(/class="tg-board-header"/g) ?? []).length;
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

  it("gap cells render a 'Create <column> Shape <type>' button carrying data-tg-edit only when capabilities.edit.onCreateShape is present", () => {
    const gapCell = [...expectedModel.cells.values()].find((cell) => cell.state === "gap");
    if (!gapCell) throw new Error("expected at least one gap cell in the fixture registry");
    // `rowGrouping: "chordType"` (Board.tsx's only usage) sets `slot.chordType`
    // to the row key on every `BoardSlot` variant — see BoardCellCard.tsx.
    const expectedType = gapCell.slot.chordType || gapCell.rowKey;

    const withoutEdit = renderBoard();
    expect(withoutEdit).not.toMatch(/>Create /);

    const withEdit = stripReactComments(renderBoard(initialWorkbenchState, { onCreateShape: () => {} }));
    expect(withEdit).toContain("data-tg-edit");
    expect(withEdit).toContain(`>Create ${gapCell.columnKey} Shape ${expectedType}<`);
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

  // `BoardScreen`'s `chordSelection`/`scaleSelection` are internal component
  // state with no prop for a `renderToString` test to drive, so these two
  // tests exercise Board.tsx's exported `restrictCellsByEntry` directly —
  // the exact composition the `model` `useMemo` performs for the Voicing
  // Family / Root (chord) and System / Quality (scale) `FilterBar` chips
  // (spec §5.4, task 25.2).
  describe("restrictCellsByEntry (Voicing Family / Root / scale System / Quality wiring)", () => {
    it("narrows filled chord cells to a single chordSelection.activeVoicingFamilies value (Columns: String set axis)", () => {
      // `axis: "cagedPosition"` (Board.tsx's default) has zero filled cells
      // in the live registry today — no `ChordShape` has `cagedPosition`
      // populated yet (that metadata is authored via the workbench, spec
      // §1.2). `axis: "stringSet"` is a real, user-selectable Columns option
      // (`ColumnsToggle`) that IS populated for every voicing family, so it
      // exercises the real facet wiring against real data.
      const raw = boardModel(catalog, { kind: "chord", axis: "stringSet", rowGrouping: "chordType" });
      const filledFamilies = new Set<string>();
      for (const cell of raw.cells.values()) {
        if (cell.state === "filled" && cell.entry?.kind === "chord" && cell.entry.shape.voicingFamily) {
          filledFamilies.add(cell.entry.shape.voicingFamily);
        }
      }
      expect(filledFamilies.size).toBeGreaterThan(1);
      const family = [...filledFamilies][0];

      const selection: ChordFacetSelection = { activeVoicingFamilies: [family] };
      const narrowed = restrictCellsByEntry(
        raw,
        undefined,
        (entry) => entry.kind === "chord" && chordEntryMatchesSelection(entry, selection, "type"),
      );

      expect(narrowed.rows).toEqual(raw.rows);
      expect(narrowed.columns).toEqual(raw.columns);
      expect(narrowed.counts.total).toBe(raw.counts.total);
      expect(narrowed.counts.shown).toBeGreaterThan(0);
      expect(narrowed.counts.shown).toBeLessThan(raw.counts.shown);
      for (const cell of narrowed.cells.values()) {
        if (cell.state !== "filled") continue;
        expect((cell.entry as ChordCatalogEntry).shape.voicingFamily).toBe(family);
      }
    });

    it('narrows filled scale cells (kind: "scale") to a single system and quality', () => {
      // No `ScaleShape` in the live registry has `chordType`/`cagedPosition`
      // populated yet, so `boardModel`'s real `rowGrouping: "chordType"`
      // scale board (Board.tsx's only usage) is empty for every axis today.
      // This hand-built 1-row x 3-column grid plugs in three REAL
      // `ScaleCatalogEntry` values (real `system`/`quality` metadata, no
      // fabricated shape data) so the test exercises the exact
      // `restrictCellsByEntry` + `scaleEntryMatchesSelection` composition
      // Board.tsx performs, independent of how much scale metadata has been
      // backfilled.
      const scaleEntries = catalog.filter((e): e is ScaleCatalogEntry => e.kind === "scale");
      const cagedMajor = scaleEntries.find((e) => e.shape.system === "caged" && e.shape.quality === undefined);
      const cagedMinor = scaleEntries.find((e) => e.shape.system === "caged" && e.shape.quality === "minor");
      const pentatonic = scaleEntries.find((e) => e.shape.system === "pentatonic");
      if (!cagedMajor || !cagedMinor || !pentatonic) {
        throw new Error(
          "expected a CAGED-major, CAGED-minor, and pentatonic scale entry in the fixture registry",
        );
      }

      const columns = [
        { key: "cagedMajor", label: "cagedMajor" },
        { key: "cagedMinor", label: "cagedMinor" },
        { key: "pentatonic", label: "pentatonic" },
      ];
      const rows = [{ key: "row", label: "row" }];
      const cellFor = (columnKey: string, entry: ScaleCatalogEntry): BoardCell => ({
        key: `row::${columnKey}`,
        rowKey: "row",
        columnKey,
        state: "filled",
        entry,
        slot: { kind: "scale", rowGrouping: "chordType", rowKey: "row", axis: "cagedPosition", columnKey, chordType: "row" },
      });
      const cells = new Map<string, BoardCell>([
        ["row::cagedMajor", cellFor("cagedMajor", cagedMajor)],
        ["row::cagedMinor", cellFor("cagedMinor", cagedMinor)],
        ["row::pentatonic", cellFor("pentatonic", pentatonic)],
      ]);
      const raw: BoardModelResult = { columns, rows, cells, counts: { shown: 3, total: 3, gaps: 0 } };

      const bySystem: ScaleFacetSelection = { activeSystems: ["caged"] };
      const narrowedBySystem = restrictCellsByEntry(
        raw,
        undefined,
        (entry) => entry.kind === "scale" && scaleEntryMatchesSelection(entry, bySystem),
      );
      expect(narrowedBySystem.rows).toEqual(raw.rows);
      expect(narrowedBySystem.columns).toEqual(raw.columns);
      expect(narrowedBySystem.counts.total).toBe(3);
      expect(narrowedBySystem.counts.shown).toBe(2);
      expect(narrowedBySystem.counts.gaps).toBe(1);
      expect(narrowedBySystem.cells.get("row::cagedMajor")?.state).toBe("filled");
      expect(narrowedBySystem.cells.get("row::cagedMinor")?.state).toBe("filled");
      expect(narrowedBySystem.cells.get("row::pentatonic")?.state).toBe("gap");

      const byBoth: ScaleFacetSelection = { activeSystems: ["caged"], activeQualities: ["minor"] };
      const narrowedByBoth = restrictCellsByEntry(
        raw,
        undefined,
        (entry) => entry.kind === "scale" && scaleEntryMatchesSelection(entry, byBoth),
      );
      expect(narrowedByBoth.counts.shown).toBe(1);
      expect(narrowedByBoth.counts.gaps).toBe(2);
      expect(narrowedByBoth.cells.get("row::cagedMajor")?.state).toBe("gap");
      expect(narrowedByBoth.cells.get("row::cagedMinor")?.state).toBe("filled");
      expect(narrowedByBoth.cells.get("row::pentatonic")?.state).toBe("gap");
    });
  });
});
