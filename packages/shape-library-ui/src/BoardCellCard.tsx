/**
 * One cell of `ShapeBoard`'s CAGED-style grid (spec §5.2 `boardModel`, §5.3
 * `BoardCell`). New component — no direct site precedent (the site has no
 * Board view yet, spec §7 adds a read-only one using this package).
 *
 * The D-002 testable invariant lives here: a `"gap"` cell renders as an
 * inert `<div data-tg-gap>` when no `capabilities.edit.onCreateShape` is
 * injected, and only becomes a `<button data-tg-edit>Create …</button>`
 * when it is. A `"filled"` cell is always a plain read-only button; an
 * "Edit" affordance (`data-tg-edit`) is added as a sibling only when
 * `capabilities.edit.onEditShape` is present.
 */
import type { BoardCell, ShapeCatalogEntry } from "shape-catalog";
import { useLibraryCapabilities } from "./capabilities";

export interface BoardCellCardProps {
  cell: BoardCell;
  onSelectEntry?: (entry: ShapeCatalogEntry) => void;
  /** Shown alongside the cell's content — used by `ShapeBoard`'s
   * single-column collapsed layout, where the grid's column headers
   * disappear and each cell needs to carry its own column label. */
  columnLabel?: string;
}

export function BoardCellCard({ cell, onSelectEntry, columnLabel }: BoardCellCardProps) {
  const capabilities = useLibraryCapabilities();
  const edit = capabilities.edit;

  if (cell.state === "filled" && cell.entry) {
    const entry = cell.entry;
    return (
      <div className="tg-board-cell-wrapper">
        <button type="button" className="tg-board-cell" onClick={() => onSelectEntry?.(entry)} aria-label={entry.name}>
          {columnLabel ? `${columnLabel}: ${entry.name}` : entry.name}
        </button>
        {edit?.onEditShape && (
          <button
            type="button"
            data-tg-edit
            className="tg-board-cell-edit"
            onClick={() => edit.onEditShape?.(entry)}
            aria-label={`Edit ${entry.name}`}
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  if (cell.state === "draft") {
    const draftInfo = edit?.draftFor?.(cell.key);
    const label = draftInfo?.label ?? "Draft";
    if (edit?.onCreateShape) {
      return (
        <button
          type="button"
          data-tg-edit
          className="tg-board-cell tg-board-cell-draft"
          onClick={() => edit.onCreateShape?.(cell.slot)}
        >
          {label}
        </button>
      );
    }
    return (
      <div className="tg-board-cell tg-board-cell-draft" aria-hidden="true">
        {label}
      </div>
    );
  }

  // state === "gap"
  if (edit?.onCreateShape) {
    return (
      <button
        type="button"
        data-tg-edit
        className="tg-board-cell tg-board-cell-gap"
        onClick={() => edit.onCreateShape?.(cell.slot)}
      >
        Create {columnLabel ?? cell.columnKey}
      </button>
    );
  }
  return <div data-tg-gap className="tg-board-cell tg-board-cell-gap" aria-hidden="true" />;
}
