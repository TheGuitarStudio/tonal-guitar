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
import { ColumnsToggle, DiagramOrientationToggle, ShapeBoard } from "shape-library-ui";

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

  const model = useMemo(
    () =>
      boardModel(catalog, {
        kind,
        axis: columnAxis,
        rowGrouping: "chordType",
        search: nameQuery,
      }),
    [catalog, kind, columnAxis, nameQuery],
  );

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
