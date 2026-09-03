/**
 * The Export screen's change list (spec §5.4: "list of pending changes
 * with op glyph, target file, and check status", tasks.md 27.2). Pure
 * presentation over `../export/changeInfo.ts`'s helpers — this component
 * owns no logic of its own beyond mapping `WorkbenchState.changes` to rows
 * and reporting which row is selected for the diff view below it.
 */
import type { ChangesetChange } from "tonal-guitar";
import type { WorkbenchState } from "../store";
import { changeCheckStatus, changeDisplayName, changeOpGlyph, changeTargetFile } from "./changeInfo";

export interface ExportChangeListProps {
  state: WorkbenchState;
  changes: readonly ChangesetChange[];
  selectedIndex: number | undefined;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}

const STATUS_CLASS: Record<string, string> = {
  pass: "tg-badge",
  warning: "tg-badge tg-badge-warning",
  error: "tg-badge tg-badge-error",
  "n/a": "tg-badge",
};

export function ExportChangeList({ state, changes, selectedIndex, onSelect, onRemove }: ExportChangeListProps) {
  return (
    <table className="tg-table" data-testid="export-change-list">
      <thead>
        <tr>
          <th>Op</th>
          <th>Shape</th>
          <th>Target file</th>
          <th>Checks</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change, index) => {
          const status = changeCheckStatus(state, change);
          const targetFile = changeTargetFile(change);
          const selected = selectedIndex === index;
          return (
            <tr
              key={`${change.op}-${changeDisplayName(change)}-${index}`}
              data-testid="export-change-row"
              data-change-op={change.op}
              aria-selected={selected}
            >
              <td className="tg-mono" data-testid="export-change-glyph">
                {changeOpGlyph(change)}
              </td>
              <td>
                <button
                  type="button"
                  className="tg-link"
                  aria-pressed={selected}
                  onClick={() => onSelect(index)}
                >
                  {changeDisplayName(change)}
                </button>
              </td>
              <td className="tg-mono" data-testid="export-change-file">
                {targetFile !== undefined ? `src/data/${targetFile}.ts` : "resolved by shapes:merge"}
              </td>
              <td>
                <span className={STATUS_CLASS[status]} data-testid="export-change-status">
                  {status}
                </span>
              </td>
              <td>
                <button type="button" data-testid="export-change-remove" onClick={() => onRemove(index)}>
                  Remove
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
