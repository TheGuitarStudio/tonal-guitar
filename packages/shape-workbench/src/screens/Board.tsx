/**
 * Board screen — placeholder shell (Group 24 scope). The real CAGED grid
 * (`boardModel` from `shape-catalog`, filters, per-cell state, header
 * summary) is Group 25; this group only needs the route to render
 * *something* real and the `EditCapabilities` this screen will eventually
 * call to already be store-backed (see `../handlers.ts`).
 */
import { useWorkbenchState } from "../StoreProvider";

export function BoardScreen() {
  const state = useWorkbenchState();
  return (
    <section data-testid="board-screen">
      <h1>Shape Workbench — Board</h1>
      <p>
        {Object.keys(state.drafts).length} draft(s) · {state.changes.length} pending change(s)
      </p>
    </section>
  );
}
