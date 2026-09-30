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
 *
 * A filled cell can hold several matches (`cell.entries`, CR-030). It shows
 * one at a time plus a `+N` badge button that cycles to the next match;
 * the cell button, and "Edit", act on whichever match is shown. Cycling
 * (rather than a popover picker) keeps the cell a pair of native buttons —
 * no focus trap, outside-click or Escape handling, and nothing overflowing
 * a 4rem grid track.
 */
import { useState } from "react";
import type { BoardCell, ShapeCatalogEntry } from "shape-catalog";
import { useLibraryCapabilities } from "./capabilities";

/** Index of the match a cell shows: the one named `shownName`, or the first
 * if that name is gone (e.g. a filter narrowed `entries`). */
export function shownEntryIndex(entries: readonly ShapeCatalogEntry[], shownName: string | undefined): number {
  const index = shownName === undefined ? -1 : entries.findIndex((entry) => entry.name === shownName);
  return index === -1 ? 0 : index;
}

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
  // Tracked by name, not index, so the shown match survives `entries`
  // being re-derived (new array identity, or narrowed by a filter).
  const [shownName, setShownName] = useState<string | undefined>(undefined);

  if (cell.state === "filled" && cell.entries.length > 0) {
    const { entries } = cell;
    const shownIndex = shownEntryIndex(entries, shownName);
    const entry = entries[shownIndex];
    const total = entries.length;
    const more = total - 1;
    return (
      <div className="tg-board-cell-wrapper">
        <button
          type="button"
          className={more > 0 ? "tg-board-cell tg-board-cell-stacked" : "tg-board-cell"}
          onClick={() => onSelectEntry?.(entry)}
          aria-label={total > 1 ? `${entry.name} (${shownIndex + 1} of ${total} in this cell)` : entry.name}
        >
          {columnLabel ? `${columnLabel}: ${entry.name}` : entry.name}
        </button>
        {more > 0 && (
          <button
            type="button"
            className="tg-board-cell-more"
            onClick={() => setShownName(entries[(shownIndex + 1) % total].name)}
            aria-label={`${more} more ${more === 1 ? "shape" : "shapes"} in this cell, show next`}
            title={`Showing ${shownIndex + 1} of ${total}`}
          >
            +{more}
          </button>
        )}
        {more > 0 && (
          <span aria-live="polite" className="tg-sr-only">
            {shownName === undefined ? "" : `Showing ${entry.name}, ${shownIndex + 1} of ${total}`}
          </span>
        )}
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
    // Spec §7 / tasks 25.1, 25.3: "Create <X> Shape <type>" — X is the
    // column (CAGED position etc.), type is the chord/arpeggio type the row
    // represents. `cell.slot.chordType` already carries the raw row token
    // (`ChordSlot`/`ArpeggioSlot` both set it to `row.key` for `rowGrouping:
    // "chordType"`, the only grouping the workbench's Board screen uses) —
    // falling back to `cell.rowKey` covers any other `rowGrouping` a future
    // caller might pass, so this never renders an empty "Shape" suffix.
    const typeLabel = cell.slot.chordType || cell.rowKey;
    return (
      <button
        type="button"
        data-tg-edit
        className="tg-board-cell tg-board-cell-gap"
        onClick={() => edit.onCreateShape?.(cell.slot)}
      >
        Create {columnLabel ?? cell.columnKey} Shape {typeLabel}
      </button>
    );
  }
  return <div data-tg-gap className="tg-board-cell tg-board-cell-gap" aria-hidden="true" />;
}
