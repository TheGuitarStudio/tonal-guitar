"use client";

// Read-only CAGED board view for `/shapes` (spec §7 "The read-only Board
// view (columns toggle + diagram orientation toggle) is added to `/shapes`;
// gap cells render inert, never 'Create' buttons"). Built entirely from
// `shape-catalog`'s `boardModel` and `shape-library-ui`'s `ShapeBoard` /
// `ColumnsToggle` / `DiagramOrientationToggle` — the same primitives the
// Shape Workbench's own Board screen (`packages/shape-workbench/src/screens/
// Board.tsx`) composes, just without any `EditCapabilities` wired in. The
// site's `ShapeLibraryProvider` (see `ShapeLibrary.tsx`) never passes
// `capabilities.edit`, so `BoardCellCard` renders every gap as an inert
// `<div data-tg-gap>` rather than a "Create …" button (the D-002 invariant
// this view depends on) — this component adds no capability wiring of its
// own, it just can't opt in.
//
// `orientation` mirrors the workbench Board screen's own toggle: it's a
// stored preference with no direct visual effect on the board itself
// (`BoardCellCard` renders plain text buttons, not diagrams) — the
// workbench's copy of this control also feeds its Editor screen when the
// author navigates there. The site has no such screen, so the toggle is
// kept here only because spec §7 calls for it explicitly alongside the
// columns toggle; it's included for parity rather than because a diagram on
// this page currently reads it.
import { useMemo, useState } from "react";
import type { Orientation } from "fretboard-ui";
import { boardModel, type BoardAxis, type ShapeCatalogEntry, type ShapeKind } from "shape-catalog";
// Deep-imported from their own files rather than the `shape-library-ui`
// barrel (CR-068, see `ShapeLibrary.tsx`'s import comment): this component
// is statically imported by `ShapeLibrary.tsx`, so an unqualified
// `from "shape-library-ui"` import here would drag `index.ts`'s whole
// re-export graph — including the dynamically-imported `ShapeDetailPanel` —
// back into the eager `/shapes` chunk regardless of how `ShapeLibrary.tsx`
// itself imports things.
import { ColumnsToggle } from "shape-library-ui/src/ColumnsToggle";
import { DiagramOrientationToggle } from "shape-library-ui/src/DiagramOrientationToggle";
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
  const [orientation, setOrientation] = useState<Orientation>("horizontal");

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
        <span className="tg-facet-label">Diagrams</span>
        <DiagramOrientationToggle value={orientation} onChange={setOrientation} />
      </div>
      <ShapeBoard model={model} onSelectEntry={onSelectEntry} collapseToSingleColumn={collapseToSingleColumn} />
    </div>
  );
}
