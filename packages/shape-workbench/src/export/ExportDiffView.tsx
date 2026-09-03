/**
 * The Export screen's per-change diff view (spec §5.4: "per-change diff
 * (TS diff / JSON / before-after) from `diffShape`", tasks.md 27.5) — three
 * tabs over one selected `ChangesetChange`, plus a "geometry unchanged"
 * badge for metadata-only edits (`diffShape`'s `geometryChanged` flag).
 *
 * The TS text for both tabs comes from `shape-catalog`'s `renderShapeTs`
 * (never a local reimplementation — spec §6.5's byte-identical-with-
 * `shapes:merge` guarantee), fetched asynchronously exactly like the
 * Editor's `../editor/OutputPreview.tsx`.
 */
import { useEffect, useState } from "react";
import type { ChangesetChange } from "tonal-guitar";
import { renderShapeTs } from "shape-catalog";
import type { ShapeLike } from "shape-catalog";
import type { WorkbenchState } from "../store";
import { changeAfterShape, changeBeforeShape, changeShapeDiff } from "./changeInfo";

export interface ExportDiffViewProps {
  state: WorkbenchState;
  change: ChangesetChange;
}

type DiffTab = "ts" | "json" | "before-after";

/** Best-effort clipboard write, mirroring `../editor/OutputPreview.tsx`'s
 * helper — the Clipboard API is unavailable in some embeddings, and a
 * failed copy must never throw or crash the screen. */
function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    // best-effort only
  }
}

function formatCell(value: unknown): string {
  return value === undefined ? "—" : JSON.stringify(value);
}

export function ExportDiffView({ state, change }: ExportDiffViewProps) {
  const [tab, setTab] = useState<DiffTab>("ts");
  const [beforeTs, setBeforeTs] = useState<string | undefined>(undefined);
  const [afterTs, setAfterTs] = useState<string | undefined>(undefined);
  const [beforeError, setBeforeError] = useState<string | undefined>(undefined);
  const [afterError, setAfterError] = useState<string | undefined>(undefined);

  const diff = changeShapeDiff(state, change);
  const after = changeAfterShape(state, change);
  const before = changeBeforeShape(state, change);

  useEffect(() => {
    let cancelled = false;
    setBeforeTs(undefined);
    setAfterTs(undefined);
    setBeforeError(undefined);
    setAfterError(undefined);

    function errorMessage(error: unknown): string {
      return error instanceof Error ? error.message : "Failed to render TS preview.";
    }

    if (after !== undefined) {
      renderShapeTs(change.kind, after as unknown as ShapeLike).then(
        (text) => {
          if (!cancelled) setAfterTs(text);
        },
        (error: unknown) => {
          if (!cancelled) setAfterError(errorMessage(error));
        },
      );
    }
    if (before !== undefined) {
      renderShapeTs(change.kind, before as unknown as ShapeLike).then(
        (text) => {
          if (!cancelled) setBeforeTs(text);
        },
        (error: unknown) => {
          if (!cancelled) setBeforeError(errorMessage(error));
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [change, after, before]);

  return (
    <div className="tg-section" data-testid="export-diff-view">
      <h3 className="tg-section-title">
        Diff
        {diff !== undefined && !diff.geometryChanged && (
          <span className="tg-tag" data-testid="geometry-unchanged-badge">
            {" "}
            geometry unchanged
          </span>
        )}
      </h3>

      <div className="tg-toggle-group" role="tablist" aria-label="Diff format">
        <button type="button" role="tab" aria-selected={tab === "ts"} onClick={() => setTab("ts")}>
          TS diff
        </button>
        <button type="button" role="tab" aria-selected={tab === "json"} onClick={() => setTab("json")}>
          JSON
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "before-after"}
          onClick={() => setTab("before-after")}
        >
          Before / after
        </button>
      </div>

      {tab === "ts" && (
        <div data-testid="export-diff-ts">
          {after === undefined ? (
            <p className="tg-muted">No shape data available for this change (remove operations carry only a name).</p>
          ) : (
            <>
              {before !== undefined && (
                <>
                  <p className="tg-muted">before:</p>
                  <pre className="tg-mono" data-testid="export-diff-ts-before">
                    {beforeTs ?? (beforeError !== undefined ? `Error: ${beforeError}` : "rendering…")}
                  </pre>
                </>
              )}
              <p className="tg-muted">after:</p>
              <pre className="tg-mono" data-testid="export-diff-ts-after">
                {afterTs ?? (afterError !== undefined ? `Error: ${afterError}` : "rendering…")}
              </pre>
              <button
                type="button"
                disabled={afterTs === undefined}
                onClick={() => afterTs !== undefined && copyToClipboard(afterTs)}
              >
                Copy TS
              </button>
            </>
          )}
        </div>
      )}

      {tab === "json" && (
        <pre className="tg-mono" data-testid="export-diff-json">
          {JSON.stringify(change, null, 2)}
        </pre>
      )}

      {tab === "before-after" && (
        <div data-testid="export-diff-before-after">
          {diff === undefined ? (
            <p className="tg-muted">No diff available (remove operations carry only a name).</p>
          ) : (
            <table className="tg-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {diff.added.map((field) => (
                  <tr key={`added-${field}`}>
                    <td>{field}</td>
                    <td className="tg-muted">—</td>
                    <td className="tg-mono">
                      {formatCell((after as unknown as Record<string, unknown>)[field])}
                    </td>
                  </tr>
                ))}
                {diff.changed.map((entry) => (
                  <tr key={`changed-${entry.field}`}>
                    <td>{entry.field}</td>
                    <td className="tg-mono">{formatCell(entry.before)}</td>
                    <td className="tg-mono">{formatCell(entry.after)}</td>
                  </tr>
                ))}
                {diff.removed.map((field) => (
                  <tr key={`removed-${field}`}>
                    <td>{field}</td>
                    <td className="tg-mono">
                      {formatCell((before as unknown as Record<string, unknown> | undefined)?.[field])}
                    </td>
                    <td className="tg-muted">—</td>
                  </tr>
                ))}
                {diff.added.length === 0 && diff.changed.length === 0 && diff.removed.length === 0 && (
                  <tr>
                    <td colSpan={3} className="tg-muted">
                      No field-level differences.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
