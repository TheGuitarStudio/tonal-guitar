/**
 * `EditCapabilities` (spec §5.3, D-002) backed by `WorkbenchStore` actions.
 * `packages/shape-workbench` is the ONLY place `capabilities.edit` is ever
 * populated (the docs site never passes it) — this module is that
 * population, real store-backed implementations for all six handlers, per
 * spec §5.4 / tasks.md 24.6.
 *
 * Pure factory over `(state, dispatch, navigate)` — no React import here, so
 * every handler is unit-testable by constructing a fixed `WorkbenchState`
 * and recording what gets dispatched/navigated, without rendering anything.
 * `App.tsx` is the only caller, wiring `state`/`dispatch` from
 * `StoreProvider` and `navigate` from `useRoute`'s `navigateToRoute`.
 *
 * The full behavior behind each handler (seeding drafts from
 * `autoFingering`, the Editor's save-time `draftToChange` conversion, etc.)
 * is Groups 25-27's job — this group wires the contract with real,
 * minimal-but-correct implementations so those screens have something
 * concrete to call.
 */
import type { CagedPosition, ChordShape, ScaleShape } from "tonal-guitar";
import { arpeggioSlotKey } from "tonal-guitar";
import type { BoardSlot, ChordSlot, DraftShape, ShapeCatalogEntry } from "shape-catalog";
import type { DraftBadgeInfo, EditCapabilities } from "shape-library-ui";
import type { WorkbenchAction, WorkbenchState } from "./store";
import type { Route } from "./router";

/** True for the chord/scale board-cell slot shape (`ChordSlot`), false for
 * an `ArpeggioSlot` — the two halves of the `BoardSlot` union (spec §5.2)
 * are distinguished structurally: only `ChordSlot` carries `rowKey`. */
function isChordSlot(slot: BoardSlot): slot is ChordSlot {
  return "rowKey" in slot;
}

/**
 * The `WorkbenchState.drafts`/`ChangesetChange` key for a board slot: the
 * same `${rowKey}::${columnKey}` pairing `boardModel` uses for a
 * `ChordSlot`'s `BoardCell.key` (`packages/shape-catalog/src/board.ts`), or
 * `arpeggioSlotKey` for an `ArpeggioSlot`. Exported so the Board screen
 * (Group 25) can compute the same key when reading `draftFor`.
 */
export function slotKeyFor(slot: BoardSlot): string {
  return isChordSlot(slot) ? `${slot.rowKey}::${slot.columnKey}` : arpeggioSlotKey(slot);
}

function emptyStrings<T>(length: number, value: T): T[] {
  return Array.from({ length }, () => value);
}

function emptyChordShape(
  tuningLength: number,
  chordType?: string,
  cagedPosition?: CagedPosition,
  stringSet?: number[],
): ChordShape {
  const shape: ChordShape = {
    name: "",
    system: "caged",
    strings: emptyStrings<string | null>(tuningLength, null),
    fingers: emptyStrings<number | null>(tuningLength, null),
    barres: [],
    rootString: 0,
  };
  if (chordType !== undefined) shape.chordType = chordType;
  if (cagedPosition !== undefined) shape.cagedPosition = cagedPosition;
  if (stringSet !== undefined) shape.stringSet = stringSet;
  return shape;
}

function emptyScaleShape(
  tuningLength: number,
  chordType?: string,
  cagedPosition?: CagedPosition,
): ScaleShape {
  const shape: ScaleShape = {
    name: "",
    system: "caged",
    strings: emptyStrings<string[] | null>(tuningLength, null),
    rootString: 0,
  };
  if (chordType !== undefined) shape.chordType = chordType;
  if (cagedPosition !== undefined) shape.cagedPosition = cagedPosition;
  return shape;
}

/** Builds the empty draft a new board slot starts from (`onCreateShape`),
 * pre-populated with whatever the slot already implies (chord type, CAGED
 * position, string set) so the Editor opens with those fields filled in. */
function draftForSlot(slot: BoardSlot, tuningLength: number): DraftShape {
  if (isChordSlot(slot)) {
    if (slot.kind === "chord") {
      return {
        kind: "chord",
        origin: "gap",
        shape: emptyChordShape(tuningLength, slot.chordType, slot.cagedPosition, slot.stringSet),
      };
    }
    return {
      kind: "scale",
      origin: "gap",
      shape: emptyScaleShape(tuningLength, slot.chordType, slot.cagedPosition),
    };
  }

  const scaleBase = emptyScaleShape(tuningLength, slot.chordType, slot.cagedPosition);
  return {
    kind: "arpeggio",
    origin: "gap",
    shape: { ...scaleBase, chordType: slot.chordType },
  };
}

/** Whether a change in the accumulated changeset already targets `name`
 * (used by `draftFor` to distinguish "draft" from "in-changeset"). */
function changeTargets(change: WorkbenchState["changes"][number], name: string): boolean {
  return change.op === "add" ? change.shape.name === name : change.name === name;
}

export interface HandlerDeps {
  state: WorkbenchState;
  dispatch: (action: WorkbenchAction) => void;
  navigate: (route: Route) => void;
}

function onCreateShape(deps: HandlerDeps, slot: BoardSlot): void {
  const key = slotKeyFor(slot);
  const draft = draftForSlot(slot, deps.state.tuning.length);
  deps.dispatch({ type: "SET_DRAFT", key, draft });
  deps.navigate({ type: "editor", id: key });
}

function onEditShape(deps: HandlerDeps, entry: ShapeCatalogEntry): void {
  const key = entry.shape.name;
  const draft: DraftShape =
    entry.kind === "chord"
      ? { kind: "chord", origin: "existing", shape: { ...entry.shape }, original: { ...entry.shape } }
      : { kind: "scale", origin: "existing", shape: { ...entry.shape }, original: { ...entry.shape } };
  deps.dispatch({ type: "SET_DRAFT", key, draft });
  deps.navigate({ type: "editor", id: key });
}

function onDuplicateToPosition(
  deps: HandlerDeps,
  entry: ShapeCatalogEntry,
  position: CagedPosition,
): void {
  const rowKey = entry.shape.chordType ?? entry.shape.name;
  const key = `${rowKey}::${position}`;
  // A duplicate starts life as a brand-new shape (origin "gap" ->
  // AddChange, spec §5.2's draftToChange): cleared name so the author
  // can't accidentally save a same-named collision, cagedPosition moved to
  // the target column.
  const draft: DraftShape =
    entry.kind === "chord"
      ? { kind: "chord", origin: "gap", shape: { ...entry.shape, name: "", cagedPosition: position } }
      : { kind: "scale", origin: "gap", shape: { ...entry.shape, name: "", cagedPosition: position } };
  deps.dispatch({ type: "SET_DRAFT", key, draft });
  deps.navigate({ type: "editor", id: key });
}

function onAddTag(deps: HandlerDeps, entry: ShapeCatalogEntry, tag: string): void {
  const key = entry.shape.name;
  const existing = deps.state.drafts[key];
  const original = existing?.original ?? entry.shape;

  if (entry.kind === "chord") {
    const base = (existing?.shape as ChordShape | undefined) ?? entry.shape;
    const tags = base.tags?.includes(tag) ? base.tags : [...(base.tags ?? []), tag];
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      shape: { ...base, tags },
      original: original as ChordShape,
    };
    deps.dispatch({ type: "SET_DRAFT", key, draft });
    return;
  }

  const base = (existing?.shape as ScaleShape | undefined) ?? entry.shape;
  const tags = base.tags?.includes(tag) ? base.tags : [...(base.tags ?? []), tag];
  const draft: DraftShape = {
    kind: "scale",
    origin: "existing",
    shape: { ...base, tags },
    original: original as ScaleShape,
  };
  deps.dispatch({ type: "SET_DRAFT", key, draft });
}

function draftFor(deps: HandlerDeps, slotKey: string): DraftBadgeInfo | undefined {
  const draft = deps.state.drafts[slotKey];
  if (!draft) return undefined;

  const name = draft.shape.name;
  const inChangeset = deps.state.changes.some((change) => changeTargets(change, name));
  return { label: name.length > 0 ? name : "Untitled", status: inChangeset ? "in-changeset" : "draft" };
}

/**
 * Builds the `EditCapabilities` object `App.tsx` injects into
 * `ShapeLibraryProvider` — always populated (never omitted, never sniffed
 * at runtime), per D-002/spec §5.3.
 */
export function createEditCapabilities(deps: HandlerDeps): EditCapabilities {
  return {
    onCreateShape: (slot) => onCreateShape(deps, slot),
    onEditShape: (entry) => onEditShape(deps, entry),
    onDuplicateToPosition: (entry, position) => onDuplicateToPosition(deps, entry, position),
    onAddTag: (entry, tag) => onAddTag(deps, entry, tag),
    draftFor: (slotKey) => draftFor(deps, slotKey),
    exportState: {
      pendingCount: deps.state.changes.length,
      onExport: () => deps.navigate({ type: "export" }),
    },
  };
}
