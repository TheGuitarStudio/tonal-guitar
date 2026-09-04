/**
 * Output preview panel (spec §5.4: "Output preview: TS (via `renderShapeTs`)
 * and JSON (the `changeset@1` change object), with 'Copy' — the TS must be
 * byte-identical to what `shapes:merge` writes"). The TS/JSON text itself
 * comes entirely from `./previewText`'s pure helpers (`renderDraftTs`
 * calls `renderShapeTs` with no extra formatting) — this component only
 * owns the tab toggle, the async fetch of the TS text, and the Copy
 * buttons.
 */
import { useEffect, useState } from "react";
import type { DraftShape } from "shape-catalog";
import { canPreviewChange, renderDraftJson, renderDraftTs, targetFileFor } from "./previewText";

export interface OutputPreviewProps {
  draft: DraftShape;
}

type PreviewTab = "ts" | "json";

/** Best-effort clipboard write — the Clipboard API is unavailable in some
 * embeddings (insecure context, permissions denied, non-browser test
 * environments); a failed copy must never throw or crash the editor. */
function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    // best-effort only
  }
}

export function OutputPreview({ draft }: OutputPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("ts");
  const [tsText, setTsText] = useState<string | undefined>(undefined);
  const [tsError, setTsError] = useState<string | undefined>(undefined);

  const previewable = canPreviewChange(draft);
  const targetFile = targetFileFor(draft);
  const jsonText = renderDraftJson(draft);

  useEffect(() => {
    let cancelled = false;
    if (!previewable) {
      setTsText(undefined);
      setTsError(undefined);
      return;
    }
    setTsError(undefined);
    renderDraftTs(draft).then(
      (text) => {
        if (!cancelled) setTsText(text);
      },
      (error: unknown) => {
        if (!cancelled) {
          setTsText(undefined);
          setTsError(error instanceof Error ? error.message : "Failed to render TS preview.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // `draft` is a plain object recreated on every keystroke by the parent
    // Editor screen — re-rendering the TS preview on every field's identity
    // change (not a deep-equal check) matches "updated on every edit".
  }, [draft, previewable]);

  return (
    <div className="tg-section" data-testid="output-preview">
      <h3 className="tg-section-title">Output preview</h3>

      {!previewable && (
        <p className="tg-muted" data-testid="output-preview-unavailable">
          Set a target file below to preview the generated change.
        </p>
      )}

      {previewable && (
        <>
          <div className="tg-toggle-group" role="tablist" aria-label="Output preview format">
            <button type="button" role="tab" aria-selected={tab === "ts"} onClick={() => setTab("ts")}>
              TS
            </button>
            <button type="button" role="tab" aria-selected={tab === "json"} onClick={() => setTab("json")}>
              JSON
            </button>
          </div>

          {targetFile !== undefined && (
            <p className="tg-muted tg-mono" data-testid="output-preview-target-file">
              target: src/data/{targetFile}.ts
            </p>
          )}

          {tab === "ts" && (
            <div>
              <pre className="tg-mono" data-testid="output-preview-ts">
                {tsText ?? (tsError !== undefined ? `Error: ${tsError}` : "rendering…")}
              </pre>
              <button
                type="button"
                disabled={tsText === undefined}
                onClick={() => tsText !== undefined && copyToClipboard(tsText)}
              >
                Copy TS
              </button>
            </div>
          )}

          {tab === "json" && (
            <div>
              <pre className="tg-mono" data-testid="output-preview-json">
                {jsonText ?? ""}
              </pre>
              <button
                type="button"
                disabled={jsonText === undefined}
                onClick={() => jsonText !== undefined && copyToClipboard(jsonText)}
              >
                Copy JSON
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
