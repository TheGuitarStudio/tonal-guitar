/**
 * Toggle between the Board view's column axis options — `BoardAxis` from
 * `shape-catalog`'s `boardModel` (spec §5.2, §5.4's `WorkbenchState.columnAxis`,
 * §7 "columns toggle"). Read-only, capability-independent: never emits
 * `data-tg-edit`.
 */
import type { BoardAxis } from "shape-catalog";

export interface ColumnsToggleProps {
  value: BoardAxis;
  onChange: (axis: BoardAxis) => void;
  /** Restricts which axis options are offered — defaults to all three. */
  options?: BoardAxis[];
  className?: string;
}

const AXIS_LABELS: Record<BoardAxis, string> = {
  cagedPosition: "CAGED position",
  stringSet: "String set",
  inversion: "Inversion",
};

const DEFAULT_OPTIONS: BoardAxis[] = ["cagedPosition", "stringSet", "inversion"];

export function ColumnsToggle({ value, onChange, options = DEFAULT_OPTIONS, className }: ColumnsToggleProps) {
  return (
    <div className={["tg-toggle-group", className].filter(Boolean).join(" ")} role="group" aria-label="Board columns">
      {options.map((axis) => (
        <button key={axis} type="button" aria-pressed={value === axis} onClick={() => onChange(axis)}>
          {AXIS_LABELS[axis]}
        </button>
      ))}
    </div>
  );
}
