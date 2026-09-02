/**
 * Editor screen — placeholder shell (Group 24 scope). The tool palette,
 * fretboard editor, live checks, output preview, etc. are Group 26; this
 * group only needs `#/editor/<slotKey|shapeName>` to resolve to a real
 * draft read out of `WorkbenchStore`.
 */
import { useWorkbenchState } from "../StoreProvider";

export interface EditorScreenProps {
  slotKey: string;
}

export function EditorScreen({ slotKey }: EditorScreenProps) {
  const state = useWorkbenchState();
  const draft = state.drafts[slotKey];
  return (
    <section data-testid="editor-screen">
      <h1>Shape Workbench — Editor</h1>
      <p>slot: {slotKey}</p>
      <p>{draft ? `Editing draft "${draft.shape.name || "Untitled"}" (${draft.origin})` : "No draft yet."}</p>
    </section>
  );
}
