/**
 * Board screen (spec §5.4 "Board requirements", tasks.md Group 25): the
 * CAGED grid — chord-type rows × C·A·G·E·D columns — built from
 * `shape-catalog`'s `boardModel`, with the family/type quality-group filter
 * and search wired from `shape-catalog`'s facet helpers, and the Columns
 * (`columnAxis`) / Diagrams (`orientation`) controls wired to
 * `WorkbenchStore`. Every rendering primitive (`ShapeBoard`, `BoardCellCard`
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
  FILTER_ALL,
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

export function BoardScreen() {
  const state = useWorkbenchState();
  const dispatch = useWorkbenchDispatch();
  const capabilities = useLibraryCapabilities();
  const edit = capabilities.edit;

  const [kind, setKind] = useState<ShapeKind>("chord");
  const [chordSelection, setChordSelection] = useState<ChordFacetSelection>({});
  const [chordSort, setChordSort] = useState<ChordSortOption>("baseFret");
  const [scaleSelection, setScaleSelection] = useState<ScaleFacetSelection>({});
  const [system, setSystem] = useState(FILTER_ALL);
  const [quality, setQuality] = useState(FILTER_ALL);
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

  // `system`/`quality` drive the chip's `aria-pressed` state; `scaleSelection`
  // is the parallel `ScaleFacetSelection` `FilterBar`'s live-count helpers
  // (`scaleSystemCounts`/`scaleQualityCounts`) need — both must move
  // together or the chip counts drift from what's actually toggled active.
  function handleSystemChange(value: string): void {
    setSystem(value);
    setScaleSelection((prev) => ({ ...prev, activeSystems: value === FILTER_ALL ? undefined : [value] }));
  }

  function handleQualityChange(value: string): void {
    setQuality(value);
    setScaleSelection((prev) => ({ ...prev, activeQualities: value === FILTER_ALL ? undefined : [value] }));
  }

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
    return restrictToRowKeys(raw, chordSelection.activeTypes);
  }, [kind, state.columnAxis, chordSelection.qualityGroup, chordSelection.activeTypes, nameQuery, drafts]);

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
        chordSelection={chordSelection}
        onQualityGroupChange={(group) => setChordSelection((prev) => ({ ...prev, qualityGroup: group }))}
        onActiveTypesChange={(types) => setChordSelection((prev) => ({ ...prev, activeTypes: types }))}
        onActiveVoicingFamiliesChange={(families) =>
          setChordSelection((prev) => ({ ...prev, activeVoicingFamilies: families }))
        }
        onRootChange={(root) => setChordSelection((prev) => ({ ...prev, root }))}
        chordSort={chordSort}
        onChordSortChange={setChordSort}
        scaleSelection={scaleSelection}
        system={system}
        onSystemChange={handleSystemChange}
        quality={quality}
        onQualityChange={handleQualityChange}
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
