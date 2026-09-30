/**
 * Board screen (spec §5.4 "Board requirements", tasks.md Group 25): the
 * CAGED grid — chord-type rows × C·A·G·E·D columns — built from
 * `shape-catalog`'s `boardModel`, with the quality-group/type row filter,
 * Voicing Family / Root (chord) and System / Quality (scale) cell filter
 * (`restrictCellsByEntry`, below), and search all wired from `shape-catalog`'s
 * facet helpers, and the Columns (`columnAxis`) / Diagrams (`orientation`)
 * controls wired to `WorkbenchStore`. Every rendering primitive (`ShapeBoard`, `BoardCellCard`
 * via `ShapeBoard`, `FilterBar`, `ColumnsToggle`, `DiagramOrientationToggle`)
 * is reused as-is from `shape-library-ui` — this screen only supplies the
 * `boardModel` options and the filter state that feeds them.
 *
 * `ShapeBoard` itself renders the "Showing N of M · K gaps" header and,
 * because `App.tsx` always populates `capabilities.edit.exportState`
 * (D-002 — never omitted, never runtime-sniffed), the pending-changes count
 * + "Export" link beside it — this screen never re-implements that header.
 * Gap cells become "Create <X> Shape <type>" buttons only when
 * `capabilities.edit.onCreateShape` is present, per the same D-002
 * invariant; clicking one dispatches `SET_DRAFT` and navigates to
 * `#/editor/<slotKey>` via `handlers.ts`'s `onCreateShape`.
 */
import { useMemo, useState } from "react";
import { auditAllShapes } from "tonal-guitar";
import {
  boardModel,
  buildCatalog,
  chordEntryMatchesSelection,
  scaleEntryMatchesSelection,
  type BoardCell,
  type BoardModelResult,
  type ChordFacetSelection,
  type ChordQualityGroup,
  type DraftBadge,
  type ScaleFacetSelection,
  type ShapeCatalogEntry,
  type ShapeKind,
} from "shape-catalog";
import {
  ColumnsToggle,
  DiagramOrientationToggle,
  FilterBar,
  ShapeBoard,
  useLibraryCapabilities,
  type ChordSortOption,
} from "shape-library-ui";
import { useWorkbenchDispatch, useWorkbenchState } from "../StoreProvider";

/**
 * Built once from the live registry (module scope, mirrors
 * `shape-library-ui`'s `testFixtures.ts`) — the registry is static for the
 * lifetime of the dev-server process, so there is no reason to re-audit the
 * whole catalog on every render.
 */
const catalog: ShapeCatalogEntry[] = buildCatalog(auditAllShapes());

/**
 * Narrows a `BoardModelResult` to a subset of rows — the "type" half of
 * "family/type filters" (spec §5.4). `boardModel`'s own `typeFilter` option
 * narrows rows by *quality group* only (Triads/Sevenths/Extended/Sus-Add);
 * narrowing further to the specific chord types the author has toggled on
 * within that group (`FilterBar`'s `activeTypes` chips) happens here.
 * Recomputes `counts` over the surviving rows so the "Showing N of M · K
 * gaps" header stays consistent with what's actually shown.
 */
function restrictToRowKeys(model: BoardModelResult, rowKeys: readonly string[] | undefined): BoardModelResult {
  if (!rowKeys || rowKeys.length === 0) return model;
  const allowed = new Set(rowKeys);
  const rows = model.rows.filter((row) => allowed.has(row.key));
  const cells = new Map<string, BoardCell>();
  let shown = 0;
  let gaps = 0;
  for (const row of rows) {
    for (const column of model.columns) {
      const cell = model.cells.get(`${row.key}::${column.key}`);
      if (!cell) continue;
      cells.set(cell.key, cell);
      if (cell.state === "filled") shown += 1;
      else if (cell.state === "gap") gaps += 1;
    }
  }
  return { columns: model.columns, rows, cells, counts: { shown, total: rows.length * model.columns.length, gaps } };
}

/**
 * Narrows each "filled" cell's `entries` to those passing a facet predicate,
 * downgrading a cell to "gap" (or "draft" if a draft badge exists for that
 * slot) only when none are left (CR-030) — the Voicing Family /
 * Root strip (chord) and System / Quality (scale) `FilterBar` chips (spec
 * §5.4, task 25.2's "wire family/type filters ... from shape-catalog"). None
 * of these facets correspond to a board row or column the way `typeFilter`/
 * `activeTypes` do (`restrictToRowKeys`, above) — they narrow which entries
 * are eligible to fill a cell, not which rows exist — so `rows`/`columns`/
 * `counts.total` are left untouched; only `cells` and `counts.shown`/`gaps`
 * are recomputed, mirroring `restrictToRowKeys`'s pattern.
 */
export function restrictCellsByEntry(
  model: BoardModelResult,
  drafts: Map<string, DraftBadge> | undefined,
  matches: (entry: ShapeCatalogEntry) => boolean,
): BoardModelResult {
  const cells = new Map<string, BoardCell>();
  let shown = 0;
  let gaps = 0;
  for (const cell of model.cells.values()) {
    if (cell.state === "filled") {
      const entries = cell.entries.filter(matches);
      if (entries.length === 0) {
        const hasDraft = drafts?.has(cell.key) ?? false;
        cells.set(cell.key, { ...cell, state: hasDraft ? "draft" : "gap", entries, entry: undefined });
        if (!hasDraft) gaps += 1;
        continue;
      }
      cells.set(cell.key, entries.length === cell.entries.length ? cell : { ...cell, entries, entry: entries[0] });
      shown += 1;
      continue;
    }
    cells.set(cell.key, cell);
    if (cell.state === "gap") gaps += 1;
  }
  return { columns: model.columns, rows: model.rows, cells, counts: { shown, total: model.counts.total, gaps } };
}

export function BoardScreen() {
  const state = useWorkbenchState();
  const dispatch = useWorkbenchDispatch();
  const capabilities = useLibraryCapabilities();
  const edit = capabilities.edit;

  const [kind, setKind] = useState<ShapeKind>("chord");
  const [chordSelection, setChordSelection] = useState<ChordFacetSelection>({});
  const [chordSort, setChordSort] = useState<ChordSortOption>("baseFret");
  const [scaleSelection, setScaleSelection] = useState<ScaleFacetSelection>({});
  const [nameQuery, setNameQuery] = useState("");
  const [failingOnly, setFailingOnly] = useState(false);

  // Draft badges (spec §5.2 `DraftBadge`) keyed identically to `BoardCell.key`
  // — `handlers.ts`'s `slotKeyFor` produces the same `${rowKey}::${columnKey}`
  // pairing `boardModel` uses, so every gap-origin draft key already lines up
  // with a real cell key. Existing-origin drafts (keyed by shape name) never
  // match a gap/draft cell key — those cells are already "filled" and
  // `boardModel` prefers `filled` over `draft` regardless.
  const drafts = useMemo(() => {
    const map = new Map<string, DraftBadge>();
    for (const key of Object.keys(state.drafts)) {
      const badge = edit?.draftFor?.(key);
      if (badge) map.set(key, badge);
    }
    return map;
  }, [state.drafts, state.changes, edit]);

  // The search box feeds the facet selections too, so `FilterBar`'s live
  // chip counts (and the cell-level pass below) narrow with it.
  const chordFacets = useMemo<ChordFacetSelection>(
    () => ({ ...chordSelection, nameQuery: nameQuery || undefined }),
    [chordSelection, nameQuery],
  );
  const scaleFacets = useMemo<ScaleFacetSelection>(
    () => ({ ...scaleSelection, nameQuery: nameQuery || undefined }),
    [scaleSelection, nameQuery],
  );

  const model = useMemo(() => {
    const typeFilter: ChordQualityGroup[] | undefined = chordSelection.qualityGroup
      ? [chordSelection.qualityGroup]
      : undefined;
    const raw = boardModel(catalog, {
      kind,
      axis: state.columnAxis,
      rowGrouping: "chordType",
      typeFilter,
      search: nameQuery,
      drafts,
    });
    const rowRestricted = restrictToRowKeys(raw, chordSelection.activeTypes);

    // Voicing Family / Root (chord) and System / Quality (scale) narrow
    // which entries can fill a cell, not which rows exist — apply them as a
    // cell-level pass after the row-level narrowing above. `ignoring: "type"`
    // skips re-checking `qualityGroup`/`activeTypes` in
    // `chordEntryMatchesSelection` since `typeFilter`/`restrictToRowKeys`
    // already fully applied those two dimensions.
    if (kind === "chord") {
      return restrictCellsByEntry(
        rowRestricted,
        drafts,
        (entry) => entry.kind === "chord" && chordEntryMatchesSelection(entry, chordFacets, "type"),
      );
    }
    if (kind === "scale") {
      return restrictCellsByEntry(
        rowRestricted,
        drafts,
        (entry) => entry.kind === "scale" && scaleEntryMatchesSelection(entry, scaleFacets),
      );
    }
    return rowRestricted;
  }, [kind, state.columnAxis, chordSelection, chordFacets, nameQuery, drafts, scaleFacets]);

  return (
    <section data-testid="board-screen">
      <h1>Shape Workbench — Board</h1>

      <div className="tg-filterbar-row">
        <span className="tg-facet-label">Columns</span>
        <ColumnsToggle value={state.columnAxis} onChange={(axis) => dispatch({ type: "SET_COLUMN_AXIS", axis })} />
        <span className="tg-facet-label">Diagrams</span>
        <DiagramOrientationToggle
          value={state.orientation}
          onChange={(orientation) => dispatch({ type: "SET_ORIENTATION", orientation })}
        />
      </div>

      <FilterBar
        entries={catalog}
        kind={kind}
        onKindChange={setKind}
        chordSelection={chordFacets}
        onQualityGroupChange={(group) => setChordSelection((prev) => ({ ...prev, qualityGroup: group }))}
        onActiveTypesChange={(types) => setChordSelection((prev) => ({ ...prev, activeTypes: types }))}
        onActiveVoicingFamiliesChange={(families) =>
          setChordSelection((prev) => ({ ...prev, activeVoicingFamilies: families }))
        }
        onRootChange={(root) => setChordSelection((prev) => ({ ...prev, root }))}
        chordSort={chordSort}
        onChordSortChange={setChordSort}
        scaleSelection={scaleFacets}
        onActiveSystemsChange={(systems) => setScaleSelection((prev) => ({ ...prev, activeSystems: systems }))}
        onActiveQualitiesChange={(qualities) => setScaleSelection((prev) => ({ ...prev, activeQualities: qualities }))}
        nameQuery={nameQuery}
        onNameQueryChange={setNameQuery}
        failingOnly={failingOnly}
        onFailingOnlyChange={setFailingOnly}
        shownCount={model.counts.shown}
        totalCount={model.counts.total}
      />

      <ShapeBoard model={model} />
    </section>
  );
}
