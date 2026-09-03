/**
 * CAGED-style board grid (spec §5.2 `boardModel`, §5.3, §5.4 "Board
 * requirements"). Renders `shape-catalog`'s `boardModel(...)` result as a
 * grid of `BoardCellCard`s — filled / gap / draft — with a
 * "Showing N of M · K gaps" header. New component (the site has no Board
 * view today; spec §7 adds a read-only one built on this package).
 *
 * Responsive per spec §7/§5.3: collapses to a single column below 768px
 * behind the `collapseToSingleColumn` prop — the caller computes the
 * breakpoint outside render (e.g. a `matchMedia` listener in a
 * `useEffect`), so this component never touches `window` during render and
 * stays safe under `renderToString`/SSR prerender.
 */
import { Fragment } from "react";
import { cellKey, type BoardModelResult, type ShapeCatalogEntry } from "shape-catalog";
import { BoardCellCard } from "./BoardCellCard";
import { useLibraryCapabilities } from "./capabilities";

export interface ShapeBoardProps {
  model: BoardModelResult;
  onSelectEntry?: (entry: ShapeCatalogEntry) => void;
  collapseToSingleColumn?: boolean;
  className?: string;
}

export function ShapeBoard({ model, onSelectEntry, collapseToSingleColumn = false, className }: ShapeBoardProps) {
  const capabilities = useLibraryCapabilities();
  const exportState = capabilities.edit?.exportState;

  const header = (
    <div className="tg-board-header-bar">
      <span className="tg-count">
        Showing {model.counts.shown} of {model.counts.total} · {model.counts.gaps} gaps
      </span>
      {exportState && (
        <span data-tg-edit className="tg-board-export">
          {exportState.pendingCount} pending
          <button type="button" data-tg-edit className="tg-link" onClick={exportState.onExport}>
            Export
          </button>
        </span>
      )}
    </div>
  );

  if (collapseToSingleColumn) {
    return (
      <div className={className}>
        {header}
        <div className={["tg-board", "tg-board-collapsed"].join(" ")}>
          {model.rows.map((row) => (
            <div key={row.key} className="tg-board-group">
              <div className="tg-board-row-label">{row.label}</div>
              {model.columns.map((column) => {
                const cell = model.cells.get(cellKey(row.key, column.key));
                if (!cell) return null;
                return (
                  <BoardCellCard key={cell.key} cell={cell} onSelectEntry={onSelectEntry} columnLabel={column.label} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const gridTemplateColumns = `auto repeat(${model.columns.length}, minmax(4rem, 1fr))`;

  return (
    <div className={className}>
      {header}
      <div className="tg-board" style={{ gridTemplateColumns }}>
        <div className="tg-board-header" aria-hidden="true" />
        {model.columns.map((column) => (
          <div key={column.key} className="tg-board-header">
            {column.label}
          </div>
        ))}
        {model.rows.map((row) => (
          <Fragment key={row.key}>
            <div className="tg-board-row-label">{row.label}</div>
            {model.columns.map((column) => {
              const cell = model.cells.get(cellKey(row.key, column.key));
              if (!cell) return <div key={column.key} className="tg-board-cell" />;
              return <BoardCellCard key={cell.key} cell={cell} onSelectEntry={onSelectEntry} />;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
