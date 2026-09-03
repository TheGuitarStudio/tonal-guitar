/**
 * `WorkbenchState`/`WorkbenchStore` reducer (spec §5.4). Pure — no React
 * import here, so the reducer and the `localStorage` persistence helpers are
 * unit-testable without rendering anything. `StoreProvider.tsx` wires this
 * up to React context + `useReducer` and calls `persistState` from a
 * `useEffect` that runs on every state change.
 */
import type { ChangesetChange } from "tonal-guitar";
import { STANDARD } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import type { Orientation } from "fretboard-ui";

export type ColumnAxis = "cagedPosition" | "stringSet" | "inversion";

export interface WorkbenchState {
  tuning: string[]; // STANDARD in MVP; picker locked
  authorRoot: string; // default "A"
  orientation: Orientation;
  columnAxis: ColumnAxis;
  drafts: Record<string, DraftShape>; // keyed by slotKey or shape name
  changes: ChangesetChange[]; // the pending changeset
  lastWrittenAt?: string;
}

export const initialWorkbenchState: WorkbenchState = {
  tuning: STANDARD,
  authorRoot: "A",
  orientation: "vertical",
  columnAxis: "cagedPosition",
  drafts: {},
  changes: [],
};

export type WorkbenchAction =
  | { type: "SET_AUTHOR_ROOT"; root: string }
  | { type: "SET_ORIENTATION"; orientation: Orientation }
  | { type: "SET_COLUMN_AXIS"; axis: ColumnAxis }
  | { type: "SET_DRAFT"; key: string; draft: DraftShape }
  | { type: "REMOVE_DRAFT"; key: string }
  | { type: "ADD_CHANGE"; change: ChangesetChange }
  | { type: "REMOVE_CHANGE"; index: number }
  | { type: "CLEAR_CHANGES" }
  | { type: "SET_LAST_WRITTEN_AT"; timestamp: string }
  | { type: "REPLACE_STATE"; state: WorkbenchState };

/** The op-target identity a `ChangesetChange` represents — `kind` plus
 * whichever of `shape.name` (`AddChange`) / `name` (`UpdateChange`/
 * `RemoveChange`) names the shape it targets. Two changes sharing this key
 * are "the same edit" for `ADD_CHANGE`'s dedup (CR-059): saving the same
 * shape a second time must replace its pending change, not append a
 * duplicate row next to it. */
function changeTargetKey(change: ChangesetChange): string {
  const name = change.op === "add" ? change.shape.name : change.name;
  return `${change.kind}::${name}`;
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "SET_AUTHOR_ROOT":
      return { ...state, authorRoot: action.root };
    case "SET_ORIENTATION":
      return { ...state, orientation: action.orientation };
    case "SET_COLUMN_AXIS":
      return { ...state, columnAxis: action.axis };
    case "SET_DRAFT":
      return { ...state, drafts: { ...state.drafts, [action.key]: action.draft } };
    case "REMOVE_DRAFT": {
      if (!(action.key in state.drafts)) return state;
      const drafts = { ...state.drafts };
      delete drafts[action.key];
      return { ...state, drafts };
    }
    case "ADD_CHANGE": {
      const key = changeTargetKey(action.change);
      const changes = state.changes.filter((c) => changeTargetKey(c) !== key);
      return { ...state, changes: [...changes, action.change] };
    }
    case "REMOVE_CHANGE": {
      if (action.index < 0 || action.index >= state.changes.length) return state;
      const changes = state.changes.filter((_, i) => i !== action.index);
      return { ...state, changes };
    }
    case "CLEAR_CHANGES":
      return state.changes.length === 0 ? state : { ...state, changes: [] };
    case "SET_LAST_WRITTEN_AT":
      return { ...state, lastWrittenAt: action.timestamp };
    case "REPLACE_STATE":
      return action.state;
    default:
      return state;
  }
}

// ============================================================
// localStorage persistence (crash resilience — spec §5.4: "Persisted to
// localStorage on every change"). `.workbench/changeset.json` persistence
// is separate and explicit (Export screen's "Write changeset.json", wired
// to the dev-server plugin in `plugins/workbench-io.ts`).
// ============================================================

export const WORKBENCH_STORAGE_KEY = "tonal-guitar/shape-workbench/state@1";

/** The subset of the `Storage` interface (`window.localStorage`) the store
 * needs — a structural type so tests can pass a plain mock without a DOM. */
export interface WorkbenchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Loads persisted state on startup. Falls back to `initialWorkbenchState`
 * when there's no storage, nothing persisted yet, or the persisted value is
 * corrupt/unparsable — persistence is best-effort crash resilience, never a
 * hard dependency. `tuning` is always forced back to `STANDARD` regardless
 * of what was persisted: it's locked in MVP (spec §5.4), so a stale
 * persisted value from a future non-STANDARD build must never leak in.
 */
export function loadPersistedState(storage: WorkbenchStorage | undefined | null): WorkbenchState {
  if (!storage) return initialWorkbenchState;

  let raw: string | null;
  try {
    raw = storage.getItem(WORKBENCH_STORAGE_KEY);
  } catch {
    return initialWorkbenchState;
  }
  if (!raw) return initialWorkbenchState;

  try {
    const parsed = JSON.parse(raw) as Partial<WorkbenchState>;
    return {
      ...initialWorkbenchState,
      ...parsed,
      tuning: STANDARD,
      drafts: parsed.drafts ?? {},
      changes: parsed.changes ?? [],
    };
  } catch {
    return initialWorkbenchState;
  }
}

/**
 * Persists the full state on every change. Best-effort: a `setItem` failure
 * (quota exceeded, storage disabled, serialization error) is swallowed
 * rather than thrown — losing crash-resilience persistence must never crash
 * the app or block an edit.
 */
export function persistState(state: WorkbenchState, storage: WorkbenchStorage | undefined | null): void {
  if (!storage) return;
  try {
    storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort only — see docstring.
  }
}
