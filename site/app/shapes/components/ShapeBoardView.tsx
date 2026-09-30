"use client";

// Read-only CAGED board view for `/shapes` (spec §7 "The read-only Board
// view (columns toggle) is added to `/shapes`; gap cells render inert, never
// 'Create' buttons"). Built entirely from `shape-catalog`'s `boardModel` and
// `shape-library-ui`'s `ShapeBoard` / `ColumnsToggle` — the same primitives the
// Shape Workbench's own Board screen (`packages/shape-workbench/src/screens/
// Board.tsx`) composes, just without any `EditCapabilities` wired in. The
// site's `ShapeLibraryProvider` (see `ShapeLibrary.tsx`) never passes
// `capabilities.edit`, so `BoardCellCard` renders every gap as an inert
// `<div data-tg-gap>` rather than a "Create …" button (the D-002 invariant
// this view depends on) — this component adds no capability wiring of its
// own, it just can't opt in.
//
// No diagram orientation toggle (CR-075): `BoardCellCard` renders text
// buttons, not diagrams, so it would do nothing here. The workbench keeps
// its copy because that one also sets the Editor's orientation.
import { useMemo, useState } from "react";
import { boardModel, type BoardAxis, type ShapeCatalogEntry, type ShapeKind } from "shape-catalog";
// Deep-imported from their own files rather than the `shape-library-ui`
// barrel (CR-068, see `ShapeLibrary.tsx`'s import comment): this component
// is statically imported by `ShapeLibrary.tsx`, so an unqualified
// `from "shape-library-ui"` import here would drag `index.ts`'s whole
// re-export graph — including the dynamically-imported `ShapeDetailPanel` —
// back into the eager `/shapes` chunk regardless of how `ShapeLibrary.tsx`
// itself imports things.
import { ColumnsToggle } from "shape-library-ui/src/ColumnsToggle";
import { ShapeBoard } from "shape-library-ui/src/ShapeBoard";

export interface ShapeBoardViewProps {
  catalog: readonly ShapeCatalogEntry[];
  kind: ShapeKind;
  nameQuery: string;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
  /** Collapses the grid to a single scrollable column below the mobile
   * breakpoint — mirrors `ShapeLibrary`'s own `isMobileViewport` check. */
  collapseToSingleColumn: boolean;
}

export function ShapeBoardView({
  catalog,
  kind,
  nameQuery,
  onSelectEntry,
  collapseToSingleColumn,
}: ShapeBoardViewProps) {
  const [columnAxis, setColumnAxis] = useState<BoardAxis>("cagedPosition");

  // `boardModel`'s `rowGrouping: "chordType"` is chord-only — scale shapes
  // carry no `chordType` facet, so grouping by it always yields zero rows
  // (CR-067). The "Board" toggle in `ShapeLibrary` is disabled whenever
  // `kind === "scale"`, but `kind` can still flip to "scale" out from under
  // an already-open board view via the FilterBar's own kind toggle (still
  // rendered in board mode per CR-070) — so this component defends itself
  // too, rather than trusting the toggle's disabled state to be the only
  // guard against a scale+board combination ever rendering.
  const isBoardSupported = kind === "chord";

  const model = useMemo(
    () =>
      isBoardSupported
        ? boardModel(catalog, {
            kind,
            axis: columnAxis,
            rowGrouping: "chordType",
            search: nameQuery,
          })
        : undefined,
    [catalog, kind, columnAxis, nameQuery, isBoardSupported],
  );

  if (!isBoardSupported || !model) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        Board view is chord-only. Switch to Grid to browse scale shapes.
      </p>
    );
  }

  return (
    <div>
      <div className="tg-filterbar-row mb-4">
        <span className="tg-facet-label">Columns</span>
        <ColumnsToggle value={columnAxis} onChange={setColumnAxis} />
      </div>
      <ShapeBoard model={model} onSelectEntry={onSelectEntry} collapseToSingleColumn={collapseToSingleColumn} />
    </div>
  );
}
