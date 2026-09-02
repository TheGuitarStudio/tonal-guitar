/**
 * Live Checks card (spec §5.4: "`auditChordShape` + `auditChordShapeIntegration`
 * results, one row per check id, updated on every edit"; §3.3: "every entry
 * in the editor's Checks card maps 1:1 to an exported check function id").
 * All the check-running/roster logic lives in `./checks` (pure, unit-tested
 * there) — this component only renders `chordCheckRows`' output.
 */
import type { ChordShape } from "tonal-guitar";
import { chordCheckRows, runChordChecks } from "./checks";

export interface ChecksCardProps {
  shape: ChordShape;
  root: string;
  tuning: string[];
}

const STATUS_CLASS: Record<string, string> = {
  pass: "tg-badge",
  warning: "tg-badge tg-badge-warning",
  error: "tg-badge tg-badge-error",
};

export function ChecksCard({ shape, root, tuning }: ChecksCardProps) {
  const issues = runChordChecks(shape, root, tuning);
  const rows = chordCheckRows(issues);
  const errorCount = rows.filter((r) => r.status === "error").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;

  return (
    <div className="tg-section" data-testid="checks-card">
      <h3 className="tg-section-title">
        Checks{" "}
        <span className="tg-muted">
          ({errorCount} error{errorCount === 1 ? "" : "s"}, {warningCount} warning{warningCount === 1 ? "" : "s"})
        </span>
      </h3>
      <ul className="tg-scale-list" data-testid="checks-list">
        {rows.map((row) => (
          <li key={row.id} data-check-id={row.id} data-check-status={row.status}>
            <span className={STATUS_CLASS[row.status]}>{row.id}</span>{" "}
            {row.status === "pass" ? (
              <span className="tg-muted">pass</span>
            ) : (
              <span title={row.issues.map((i) => i.message).join("; ")}>
                {row.issues.map((i) => i.message).join("; ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
