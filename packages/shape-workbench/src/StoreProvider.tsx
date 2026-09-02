/**
 * React context + `useReducer` wiring for `WorkbenchStore` (spec §5.4). All
 * the actual logic (the reducer, `localStorage` load/persist) lives in the
 * pure `./store` module and is unit-tested there — this file is thin glue:
 * it supplies `window.localStorage` to those pure functions and re-runs
 * `persistState` in a `useEffect` on every state change.
 */
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  initialWorkbenchState,
  loadPersistedState,
  persistState,
  workbenchReducer,
  type WorkbenchAction,
  type WorkbenchState,
  type WorkbenchStorage,
} from "./store";

function browserStorage(): WorkbenchStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

// Exported (alongside the hooks below) so screen tests can render a
// component subtree against an arbitrary fixture `WorkbenchState` — e.g.
// one with `drafts` populated — via `WorkbenchStateContext.Provider`
// directly, without going through `localStorage`/`WorkbenchStoreProvider`'s
// browser-only persistence machinery.
export const WorkbenchStateContext = createContext<WorkbenchState>(initialWorkbenchState);
export const WorkbenchDispatchContext = createContext<Dispatch<WorkbenchAction>>(() => {
  // Default no-op dispatch for components rendered outside a
  // WorkbenchStoreProvider (mirrors shape-library-ui's provider-less
  // default pattern) — never reached once the app is mounted for real.
});

export interface WorkbenchStoreProviderProps {
  children?: ReactNode;
}

export function WorkbenchStoreProvider({ children }: WorkbenchStoreProviderProps) {
  const [state, dispatch] = useReducer(workbenchReducer, undefined, () =>
    loadPersistedState(browserStorage()),
  );

  useEffect(() => {
    persistState(state, browserStorage());
  }, [state]);

  return (
    <WorkbenchStateContext.Provider value={state}>
      <WorkbenchDispatchContext.Provider value={dispatch}>{children}</WorkbenchDispatchContext.Provider>
    </WorkbenchStateContext.Provider>
  );
}

export function useWorkbenchState(): WorkbenchState {
  return useContext(WorkbenchStateContext);
}

export function useWorkbenchDispatch(): Dispatch<WorkbenchAction> {
  return useContext(WorkbenchDispatchContext);
}
