/**
 * Export screen — placeholder shell (Group 24 scope). The change list, diff
 * views, and "Write changeset.json" wiring to the dev-server plugin are
 * Group 27; this group only needs `#/export` to resolve to a real read of
 * `WorkbenchStore.changes`.
 */
import { useWorkbenchState } from "../StoreProvider";

export function ExportScreen() {
  const state = useWorkbenchState();
  return (
    <section data-testid="export-screen">
      <h1>Shape Workbench — Export</h1>
      <p>{state.changes.length} pending change(s)</p>
    </section>
  );
}
