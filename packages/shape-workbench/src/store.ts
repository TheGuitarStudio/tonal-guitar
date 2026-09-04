/**
 * `WorkbenchState`/`WorkbenchStore` reducer (spec §5.4). Pure — no React
 * import here, so the reducer and the `localStorage` persistence helpers are
 * unit-testable without rendering anything. `StoreProvider.tsx` wires this
 * up to React context + `useReducer` and calls `persistState` from a
 * `useEffect` that runs on every state change.
 */
import type { Barre, ChangesetChange } from "tonal-guitar";
import { STANDARD } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import type { EditorCell, Orientation } from "fretboard-ui";

export type ColumnAxis = "cagedPosition" | "stringSet" | "inversion";

/** The Editor's live fretboard-editor geometry — `cells`/`barres` — kept
 * independent of whatever `ChordShape` (if any) it currently derives
 * (CR-115). `shape-catalog`'s `DraftShape` has no `fretboard-ui` dependency
 * (see CLAUDE.md's dependency layers), so this extension lives here rather
 * than widening that type. */
export interface RawGeometry {
  cells: EditorCell[];
  barres: Barre[];
}

/** A `shape-catalog` `DraftShape` plus the workbench-local raw-geometry
 * bookkeeping above. Present once the Editor has run at least one
 * cells/barres change for this draft; absent for a draft that's never been
 * opened in the Editor yet (freshly seeded by `handlers.ts`). */
export type WorkbenchDraft = DraftShape & { rawGeometry?: RawGeometry };

export interface WorkbenchState {
  tuning: string[]; // STANDARD in MVP; picker locked
  authorRoot: string; // default "A"
  orientation: Orientation;
  columnAxis: ColumnAxis;
  drafts: Record<string, WorkbenchDraft>; // keyed by slotKey or shape name
  changes: ChangesetChange[]; // the pending changeset
  /** Parallel to `changes` (same index, same length) — the dedup key
   * `ADD_CHANGE` computed when each entry was added (CR-112/CR-113):
   * `add::<sourceKey>` for an `AddChange`, keyed by the *originating draft's
   * slot key* rather than the shape's name, so two distinct drafts that
   * happen to save the same shape name both survive (`detectCollisions`
   * needs both present to flag the collision) and a rename between saves of
   * the SAME draft still replaces its own earlier add (the slot key doesn't
   * change when the shape's `name` field does). `update::<name>`/
   * `remove::<name>` for the other ops, keyed by the change's own stable
   * target name. Internal bookkeeping only — never touches the written
   * changeset (`buildChangeset`/`postChangeset` only ever read `changes`). */
  changeKeys: string[];
  lastWrittenAt?: string;
}

export const initialWorkbenchState: WorkbenchState = {
  tuning: STANDARD,
  authorRoot: "A",
  orientation: "vertical",
  columnAxis: "cagedPosition",
  drafts: {},
  changes: [],
  changeKeys: [],
};

export type WorkbenchAction =
  | { type: "SET_AUTHOR_ROOT"; root: string }
  | { type: "SET_ORIENTATION"; orientation: Orientation }
  | { type: "SET_COLUMN_AXIS"; axis: ColumnAxis }
  | { type: "SET_DRAFT"; key: string; draft: WorkbenchDraft }
  | { type: "REMOVE_DRAFT"; key: string }
  // `sourceKey` (CR-112/CR-113) is always the Editor's `slotKey` — see
  // `screens/Editor.tsx`'s `handleSave` — for every op, though the reducer
  // below only actually keys on it for `op: "add"` (an `update`/`remove`
  // always targets a stable name it already carries).
  | { type: "ADD_CHANGE"; change: ChangesetChange; sourceKey: string }
  | { type: "REMOVE_CHANGE"; index: number }
  | { type: "CLEAR_CHANGES" }
  | { type: "SET_LAST_WRITTEN_AT"; timestamp: string }
  | { type: "REPLACE_STATE"; state: WorkbenchState };

/** The dedup key for a `ChangesetChange`, given the `sourceKey` of the
 * draft that produced it (see `ADD_CHANGE`'s doc comment above and
 * `WorkbenchState.changeKeys`'s). Also used as the fallback when
 * regenerating `changeKeys` for a persisted payload that predates this
 * field (CR-119) — passing `""` for `sourceKey` there degrades to the
 * pre-CR-112 `kind::name`-equivalent dedup (the best available without the
 * original slot key), not a crash. */
function changeDedupKey(change: ChangesetChange, sourceKey: string): string {
  if (change.op === "add") return `add::${sourceKey}`;
  return `${change.op}::${change.name}`;
}

/** Regenerates a dedup key straight from a change's own content — used only
 * as the CR-119 fallback for a persisted `changeKeys` that's missing,
 * wrong-length, or otherwise invalid. For an `AddChange` this can't recover
 * the original slot key (never persisted before CR-112), so it falls back
 * to the shape's current name — the same collapsing-by-name behavior
 * CR-112 fixes going forward, but only for state loaded from a stale
 * pre-fix payload. */
function fallbackChangeKey(change: ChangesetChange): string {
  return changeDedupKey(change, change.op === "add" ? change.shape.name : "");
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
      const key = changeDedupKey(action.change, action.sourceKey);
      const changes: ChangesetChange[] = [];
      const changeKeys: string[] = [];
      state.changes.forEach((c, i) => {
        if (state.changeKeys[i] === key) return; // true same-target re-save — replaced below
        changes.push(c);
        changeKeys.push(state.changeKeys[i]);
      });
      changes.push(action.change);
      changeKeys.push(key);
      return { ...state, changes, changeKeys };
    }
    case "REMOVE_CHANGE": {
      if (action.index < 0 || action.index >= state.changes.length) return state;
      const changes = state.changes.filter((_, i) => i !== action.index);
      const changeKeys = state.changeKeys.filter((_, i) => i !== action.index);
      return { ...state, changes, changeKeys };
    }
    case "CLEAR_CHANGES":
      return state.changes.length === 0 ? state : { ...state, changes: [], changeKeys: [] };
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

/** A non-null, non-array object — the minimum shape check a JSON value must
 * pass before it's safe to spread or index into (CR-105). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `changes` must be an array whose entries are at least plain objects
 * (CR-105) — full `ChangesetChange` shape validation happens downstream
 * (`buildChangeset`/the merge script's own audit), this is just enough to
 * keep a corrupt/hostile localStorage payload from crashing the reducer or
 * silently carrying garbage entries into a written changeset. */
function isValidChangesArray(value: unknown): value is ChangesetChange[] {
  return Array.isArray(value) && value.every(isPlainObject);
}

/** `changeKeys` must be a string array the same length as `changes` — the
 * reducer indexes it in lockstep (CR-112). A persisted payload from before
 * that field existed, or one that's been tampered with, fails this and
 * falls back to `fallbackChangeKey` below rather than crashing `ADD_CHANGE`
 * on the next save. */
function isValidChangeKeysArray(value: unknown, changesLength: number): value is string[] {
  return Array.isArray(value) && value.length === changesLength && value.every((v) => typeof v === "string");
}

const ORIENTATIONS: readonly Orientation[] = ["horizontal", "vertical"];
const COLUMN_AXES: readonly ColumnAxis[] = ["cagedPosition", "stringSet", "inversion"];

function isOrientation(value: unknown): value is Orientation {
  return typeof value === "string" && (ORIENTATIONS as readonly string[]).includes(value);
}

function isColumnAxis(value: unknown): value is ColumnAxis {
  return typeof value === "string" && (COLUMN_AXES as readonly string[]).includes(value);
}

/** A draft entry survives (CR-119) only if it's at least a plain object
 * carrying a `shape` object — the minimum every downstream reader
 * (`findDraftForChange`, `draft.shape.name`, the Editor's `draft.shape as
 * ChordShape`, ...) unconditionally dereferences. Anything else (`null`, a
 * bare string, a shape-less object) is dropped rather than failing the
 * whole `drafts` record, so one corrupt entry doesn't cost every other
 * in-progress draft. */
function isValidDraftValue(value: unknown): value is WorkbenchDraft {
  return isPlainObject(value) && isPlainObject((value as Record<string, unknown>).shape);
}

/** `rawGeometry` feeds `seedForDraft` → `useState(seed.cells)` → a
 * render-body `buildShapeFromCells` call with no error boundary above it
 * (CR-122), so a malformed persisted value must be dropped here — the draft
 * itself survives and falls back to the derive-from-shape seed path. */
function isValidRawGeometry(value: unknown): value is RawGeometry {
  if (!isPlainObject(value)) return false;
  const { cells, barres } = value as Record<string, unknown>;
  return (
    Array.isArray(cells) &&
    cells.every(
      (c) => isPlainObject(c) && typeof (c as Record<string, unknown>).string === "number" && typeof (c as Record<string, unknown>).fret === "number",
    ) &&
    Array.isArray(barres) &&
    barres.every((b) => isPlainObject(b))
  );
}

function sanitizeDrafts(value: unknown): Record<string, WorkbenchDraft> {
  if (!isPlainObject(value)) return {};
  const result: Record<string, WorkbenchDraft> = {};
  for (const [key, draft] of Object.entries(value)) {
    if (!isValidDraftValue(draft)) continue;
    if ("rawGeometry" in draft && !isValidRawGeometry(draft.rawGeometry)) {
      const { rawGeometry: _dropped, ...rest } = draft;
      result[key] = rest;
    } else {
      result[key] = draft;
    }
  }
  return result;
}

/**
 * Loads persisted state on startup. Falls back to `initialWorkbenchState`
 * when there's no storage, nothing persisted yet, the persisted value is
 * corrupt/unparsable, or (CR-105) the parsed JSON isn't even a plain object
 * — persistence is best-effort crash resilience, never a hard dependency,
 * and a non-object top-level value (a bare string/number/array/boolean)
 * would otherwise spread garbage properties onto the returned state. Every
 * field below is validated individually and falls back to its initial
 * value (or, for `drafts`/`changes`, is dropped per-entry) rather than
 * failing the whole payload (CR-105/CR-119) — `authorRoot` must be a string
 * (a non-string reaches `applyChordShape` and throws), `orientation`/
 * `columnAxis` must be one of their legal literal values, `lastWrittenAt`
 * must be a string or is omitted, and each `drafts` value must at least be
 * a plain object carrying a `shape`. `tuning` is always forced back to
 * `STANDARD` regardless of what was persisted: it's locked in MVP (spec
 * §5.4), so a stale persisted value from a future non-STANDARD build must
 * never leak in.
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
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return initialWorkbenchState;
    const changes = isValidChangesArray(parsed.changes) ? parsed.changes : [];
    const changeKeys = isValidChangeKeysArray(parsed.changeKeys, changes.length)
      ? parsed.changeKeys
      : changes.map(fallbackChangeKey);
    return {
      ...initialWorkbenchState,
      ...parsed,
      tuning: STANDARD,
      authorRoot: typeof parsed.authorRoot === "string" ? parsed.authorRoot : initialWorkbenchState.authorRoot,
      orientation: isOrientation(parsed.orientation) ? parsed.orientation : initialWorkbenchState.orientation,
      columnAxis: isColumnAxis(parsed.columnAxis) ? parsed.columnAxis : initialWorkbenchState.columnAxis,
      drafts: sanitizeDrafts(parsed.drafts),
      changes,
      changeKeys,
      lastWrittenAt: typeof parsed.lastWrittenAt === "string" ? parsed.lastWrittenAt : undefined,
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
