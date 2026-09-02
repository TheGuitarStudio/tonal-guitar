/**
 * Export screen (spec §5.4 Export requirements, tasks.md Group 27): lists
 * every pending `WorkbenchState.changes` entry with its op glyph, target
 * file and check status (`../export/ExportChangeList.tsx`); a per-change
 * diff view — TS diff / JSON / before-after, with a "geometry unchanged"
 * badge for metadata-only edits (`../export/ExportDiffView.tsx`); a
 * "Test counts touched" summary; name/identifier conflict detection
 * (`shape-catalog`'s `buildChangeset`, which itself reuses `tonal-guitar`'s
 * `checkNameUnique`/`exportIdentifierFor` — never reimplemented here);
 * "Write changeset.json" against the dev-server plugin's
 * `/__workbench/changeset` endpoint (`../export/writeChangeset.ts`); and
 * the exact `shapes:merge` CLI invocation with a sample transcript plus the
 * Dry-run/Undo hints, verbatim per spec (`../export/mergeCommand.ts`).
 *
 * All non-trivial logic lives in pure, independently-tested modules under
 * `../export/*` — this file is wiring + layout, mirroring `Editor.tsx`'s
 * split between screen and `../editor/*` helpers.
 */
import { useMemo, useState } from "react";
import { VERSION } from "tonal-guitar";
import { buildChangeset } from "shape-catalog";
import { useWorkbenchDispatch, useWorkbenchState } from "../StoreProvider";
import { ExportChangeList } from "../export/ExportChangeList";
import { ExportDiffView } from "../export/ExportDiffView";
import { summarizeChangesByKindAndOp } from "../export/changeInfo";
import { writeChangesetAndDispatch, type FetchLike, type WriteOutcome } from "../export/writeChangeset";
import { DRY_RUN_HINT, MERGE_COMMAND, SAMPLE_TRANSCRIPT, UNDO_HINT } from "../export/mergeCommand";

export interface ExportScreenProps {
  /** Test-only injection point for the "Write changeset.json" network call
   * (spec/tasks 27.1: "mock the endpoint in tests"). Defaults to the real
   * browser `fetch`, resolved lazily inside the click handler — never at
   * module/render time — so this screen never touches `window` during
   * `renderToString`, matching every other screen in this package. */
  fetchImpl?: FetchLike;
}

const OP_LABEL: Record<string, string> = { add: "added", update: "updated", remove: "removed" };

type WriteUiState = { status: "idle" | "writing" } | ({ status: "done" } & WriteOutcome);

export function ExportScreen({ fetchImpl }: ExportScreenProps = {}) {
  const state = useWorkbenchState();
  const dispatch = useWorkbenchDispatch();
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(state.changes.length > 0 ? 0 : undefined);
  const [writeState, setWriteState] = useState<WriteUiState>({ status: "idle" });

  const built = useMemo(
    () => buildChangeset({ version: VERSION, tuning: state.tuning, changes: state.changes }),
    [state.changes, state.tuning],
  );
  const tally = useMemo(() => summarizeChangesByKindAndOp(state.changes), [state.changes]);
  const selectedChange =
    selectedIndex !== undefined ? state.changes[selectedIndex] : undefined;

  async function handleWrite(): Promise<void> {
    setWriteState({ status: "writing" });
    const resolvedFetch: FetchLike = fetchImpl ?? ((url, init) => window.fetch(url, init));
    const outcome = await writeChangesetAndDispatch(state, dispatch, resolvedFetch);
    setWriteState({ status: "done", ...outcome });
  }

  if (state.changes.length === 0) {
    return (
      <section data-testid="export-screen">
        <h1>Shape Workbench — Export</h1>
        <p data-testid="export-empty">No pending changes.</p>
      </section>
    );
  }

  return (
    <section data-testid="export-screen">
      <h1>Shape Workbench — Export</h1>
      <p className="tg-muted">{state.changes.length} pending change(s)</p>

      <ExportChangeList
        state={state}
        changes={state.changes}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

      <div className="tg-section" data-testid="export-counts-touched">
        <h3 className="tg-section-title">Test counts touched</h3>
        {tally.length === 0 ? (
          <p className="tg-muted">Nothing touches a registry count.</p>
        ) : (
          <ul className="tg-scale-list">
            {tally.map((row) => (
              <li key={`${row.kind}-${row.op}`}>
                {row.count} {row.kind} shape(s) {OP_LABEL[row.op]}
              </li>
            ))}
          </ul>
        )}
        <p className="tg-muted">
          Exact assertion counts/lines are reported by{" "}
          <code className="tg-mono">shapes:merge --dry-run</code> — see the sample transcript below.
        </p>
      </div>

      <div className="tg-section" data-testid="export-conflicts">
        <h3 className="tg-section-title">Conflicts</h3>
        {built.collisions.length === 0 ? (
          <p className="tg-muted" data-testid="export-no-conflicts">
            No name/identifier collisions detected.
          </p>
        ) : (
          <ul className="tg-scale-list">
            {built.collisions.map((collision, index) => (
              <li key={index} data-testid="export-conflict-row">
                <span className="tg-badge tg-badge-error">{collision.reason}</span> {collision.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedChange !== undefined && <ExportDiffView state={state} change={selectedChange} />}

      <div className="tg-section" data-testid="export-write">
        <h3 className="tg-section-title">Write changeset.json</h3>
        <button type="button" data-testid="write-changeset-button" onClick={() => void handleWrite()}>
          Write changeset.json
        </button>
        {writeState.status === "writing" && <p className="tg-muted">Writing…</p>}
        {writeState.status === "done" && writeState.ok && (
          <p data-testid="write-success">
            Wrote {writeState.bytes} bytes to <span className="tg-mono">{writeState.path}</span> (
            {writeState.changeCount} change(s))
          </p>
        )}
        {writeState.status === "done" && !writeState.ok && (
          <p role="alert" data-testid="write-error">
            {writeState.message}
          </p>
        )}
        {state.lastWrittenAt !== undefined && (
          <p className="tg-muted" data-testid="last-written-at">
            Last written: {state.lastWrittenAt}
          </p>
        )}
      </div>

      <div className="tg-section" data-testid="export-merge-command">
        <h3 className="tg-section-title">Merge</h3>
        <pre className="tg-mono" data-testid="merge-command">
          {MERGE_COMMAND}
        </pre>
        <pre className="tg-mono" data-testid="merge-transcript">
          {SAMPLE_TRANSCRIPT}
        </pre>
        <p className="tg-muted" data-testid="dry-run-hint">
          {DRY_RUN_HINT}
        </p>
        <p className="tg-muted" data-testid="undo-hint">
          {UNDO_HINT}
        </p>
      </div>
    </section>
  );
}
