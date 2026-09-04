/**
 * Root component (spec §5.4): wires `WorkbenchStoreProvider` (state) and
 * `useHashRoute` (routing) into `ShapeLibraryProvider`, always populating
 * `capabilities.edit` — never omitted, never runtime-sniffed (D-002). The
 * three MVP screens (Board/Editor/Export, D-004) are minimal placeholder
 * shells here; Groups 25-27 build out their real content against the same
 * `EditCapabilities` this file already wires for real.
 */
import { useMemo } from "react";
import { ShapeLibraryProvider } from "shape-library-ui";
import "shape-library-ui/src/styles.css";
import { createEditCapabilities } from "./handlers";
import { useHashRoute, navigateToRoute } from "./useRoute";
import { useWorkbenchDispatch, useWorkbenchState, WorkbenchStoreProvider } from "./StoreProvider";
import { BoardScreen } from "./screens/Board";
import { EditorScreen } from "./screens/Editor";
import { ExportScreen } from "./screens/Export";

function WorkbenchApp() {
  const route = useHashRoute();
  const state = useWorkbenchState();
  const dispatch = useWorkbenchDispatch();

  const capabilities = useMemo(
    () => ({
      edit: createEditCapabilities({ state, dispatch, navigate: navigateToRoute }),
    }),
    [state, dispatch],
  );

  return (
    <ShapeLibraryProvider capabilities={capabilities}>
      {route.type === "board" && <BoardScreen />}
      {route.type === "editor" && <EditorScreen slotKey={route.id} />}
      {route.type === "export" && <ExportScreen />}
    </ShapeLibraryProvider>
  );
}

export function App() {
  return (
    <WorkbenchStoreProvider>
      <WorkbenchApp />
    </WorkbenchStoreProvider>
  );
}
