/**
 * Pure construction of a `tonal-guitar/changeset@1` `Changeset` (§6.1) from
 * Shape Workbench draft state (spec §5.2, §5.3, §5.4).
 *
 * Two entry points, matching the two moments a changeset gets touched:
 *  - `draftToChange(draft)` — the Editor's "Save to changeset" action
 *    (spec §5.4 Editor requirements): turns ONE in-progress `DraftShape`
 *    into ONE `ChangesetChange`, appended to `WorkbenchState.changes`.
 *  - `buildChangeset(state)` — the Export screen's "Write changeset.json"
 *    action: wraps the already-accumulated `WorkbenchState.changes` in the
 *    full `Changeset` envelope ($schema/version/tuning/...) and reports any
 *    name/export-identifier collisions before the caller offers to write.
 *
 * Zero React/DOM imports. Imports only from "tonal-guitar" and this
 * package's own `./diff`.
 */
import type {
  AddChange,
  ArpeggioShape,
  ChangesetChange,
  ChangesetKind,
  ChordShape,
  Changeset,
  ScaleShape,
  UpdateChange,
} from "tonal-guitar";
import type { ShapeAuditIssue } from "tonal-guitar";
import { checkIdentifierCollision, checkNameCollision, exportIdentifierFor } from "tonal-guitar";
import { diffShape } from "./diff";
import type { DiffableShape } from "./diff";

// ============================================================
// DraftShape — workbench draft state (spec §5.4's `WorkbenchState.drafts`)
// ============================================================

/**
 * Whether a draft started life as a gap in the board (a brand-new shape) or
 * as an edit opened from an already-registered shape. This is what lets
 * `draftToChange` emit an `AddChange` vs an `UpdateChange` — the update
 * path is what the §4.4 CAGED-major metadata backfill rides on: opening
 * "A Shape Major" via `onEditShape` seeds a draft with `origin: "existing"`
 * and `original` set to the live registered shape, so adding
 * `chordType`/`voicingFamily`/`cagedPosition` and saving produces an
 * `UpdateChange` whose `patch` is exactly those three fields.
 */
export type DraftOrigin = "gap" | "existing";

export interface DraftShape {
  kind: ChangesetKind;
  origin: DraftOrigin;
  /** The shape as currently authored in the editor. */
  shape: ChordShape | ScaleShape | ArpeggioShape;
  /**
   * Set when `origin === "existing"`: a snapshot of the registered shape at
   * the moment editing began. `draftToChange` diffs `shape` against this to
   * compute `UpdateChange.patch` (only the fields that actually changed —
   * never the whole shape) and uses its `name` to resolve `UpdateChange.name`
   * even if the author renames the shape mid-edit. Required for `origin:
   * "existing"` drafts; unused for `origin: "gap"`.
   */
  original?: ChordShape | ScaleShape | ArpeggioShape;
  /** `origin: "gap"` only: target data-file basename (`AddChange.file`). */
  file?: string;
  /** `origin: "gap"` only: explicit export identifier override
   * (`AddChange.ident`), for authored shorthand like `CAGED_CHORD_EM`. */
  ident?: string;
  /** `origin: "gap"` only: registration-order anchor (`AddChange.after`). */
  after?: string;
}

/**
 * Converts one `DraftShape` into the `ChangesetChange` it represents:
 * `AddChange` for `origin: "gap"`, `UpdateChange` for `origin: "existing"`.
 * Pure — throws (rather than guessing) when the draft is missing data its
 * origin requires, since both are author/programmer errors the Editor's own
 * save-validation (spec §5.4: "Refuses to save without a `1P`") should have
 * already prevented from reaching here.
 */
export function draftToChange(draft: DraftShape): ChangesetChange {
  if (draft.origin === "gap") {
    if (draft.file === undefined) {
      throw new Error(
        'draftToChange: a "gap"-origin draft must set `file` (the target data-file basename) before it can become an AddChange',
      );
    }
    const change: AddChange = {
      op: "add",
      kind: draft.kind,
      file: draft.file,
      shape: draft.shape,
    };
    if (draft.ident !== undefined) change.ident = draft.ident;
    if (draft.after !== undefined) change.after = draft.after;
    return change;
  }

  if (draft.original === undefined) {
    throw new Error(
      'draftToChange: an "existing"-origin draft must carry `original` (the registered shape being edited) to compute its patch',
    );
  }

  const diff = diffShape(draft.original as DiffableShape, draft.shape as DiffableShape);
  const shapeRecord = draft.shape as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const field of diff.added) patch[field] = shapeRecord[field];
  for (const change of diff.changed) patch[change.field] = change.after;

  const update: UpdateChange = {
    op: "update",
    kind: draft.kind,
    name: draft.original.name,
    patch,
  };
  // `diff.removed` — fields cleared in the editor (e.g. unsetting `notes`,
  // `overrides`, `tags`) — can't be expressed inside `patch` (a
  // `field: undefined` entry vanishes under `JSON.stringify`, spec §6.1
  // `UpdateChange.unset`'s doc comment), so it round-trips as its own
  // property instead. Omitted (not an empty array) when nothing was
  // cleared, matching every other optional `UpdateChange`/`Changeset` field.
  if (diff.removed.length > 0) update.unset = diff.removed;
  return update;
}

// ============================================================
// buildChangeset — the accumulated WorkbenchState.changes -> Changeset
// ============================================================

/**
 * The subset of `WorkbenchState` (spec §5.4) `buildChangeset` needs. A
 * structural (not imported) type — `packages/shape-workbench` depends on
 * `shape-catalog`, not the other way around, so this package can't import
 * `WorkbenchState` itself; any object shaped like this satisfies it.
 */
export interface BuildChangesetState {
  /** Registry `VERSION` the edits were made against (`Changeset.version`). */
  version: string;
  /** Authoring tuning (`Changeset.tuning`) — MVP must equal `STANDARD`; not
   * enforced here (that's the merge script's job, spec §6.2.3). */
  tuning: string[];
  /** Already-accumulated changes, one per saved draft (each produced by
   * `draftToChange`). */
  changes: readonly ChangesetChange[];
  generator?: string;
  createdAt?: string;
  /**
   * Known names/identifiers to check `add` changes against, in addition to
   * the live `tonal-guitar` registry — e.g. other pending changes already
   * merged elsewhere. Passed straight through as `checkNameCollision`'s/
   * `checkIdentifierCollision`'s `knownNames`/`knownIdentifiers`.
   * Collision detection always separately checks the live registry
   * regardless of this option, matching spec §6.2.6 ("against the live
   * registry AND within the changeset").
   */
  knownNames?: Set<string>;
  knownIdentifiers?: Set<string>;
}

export interface ChangesetCollision {
  change: ChangesetChange;
  reason: "name" | "identifier";
  detail: string;
}

export interface BuildChangesetResult {
  changeset: Changeset;
  collisions: ChangesetCollision[];
}

/**
 * The name a change introduces, if it introduces one: an `add`'s
 * `shape.name`, or a renaming `update`'s `patch.name` (when it differs from
 * the current `name`). `undefined` for non-renaming `update`s and `remove`s,
 * which target an existing name by design.
 */
function introducedName(change: ChangesetChange): string | undefined {
  if (change.op === "add") return change.shape.name;
  if (change.op === "update" && typeof change.patch?.name === "string" && change.patch.name !== change.name) {
    return change.patch.name;
  }
  return undefined;
}

/**
 * Collision detection (spec §6.2.6) for every `add` change and every
 * renaming `update` in `changes`: each is checked against the live registry
 * (the checks' default, no-`options` mode) AND against every earlier
 * add/rename in the list, so two changes in the same batch that would
 * collide with each other are caught too, not just collisions against
 * already-registered shapes.
 *
 * Only an `add` is checked for identifier collisions — both its derived
 * identifier and, when set, its explicit `ident` override, matching
 * `shapes-merge` rule 6. A renaming `update` gets the name check only
 * (CR-019): an `update` never derives a fresh export identifier (the merge
 * script keeps a renamed shape's marker identifier fixed at whatever it was
 * set to at `add` time), so running it through `exportIdentifierFor(kind,
 * { name: newName })` would flag false "identifier" collisions unrelated to
 * what actually gets written.
 */
function detectCollisions(
  changes: readonly ChangesetChange[],
  extraKnownNames?: Set<string>,
  extraKnownIdentifiers?: Set<string>,
): ChangesetCollision[] {
  const collisions: ChangesetCollision[] = [];
  const seenNames = new Set<string>(extraKnownNames);
  const seenIdentifiers = new Set<string>(extraKnownIdentifiers);
  const batch = { knownNames: seenNames, knownIdentifiers: seenIdentifiers };

  const report = (
    change: ChangesetChange,
    reason: ChangesetCollision["reason"],
    issues: ShapeAuditIssue[],
  ) => {
    for (const issue of issues) collisions.push({ change, reason, detail: issue.message });
  };

  for (const change of changes) {
    const name = introducedName(change);
    if (name === undefined) continue;
    const kind = change.kind;
    const shapeLike = { name };

    report(change, "name", [
      ...checkNameCollision(shapeLike, kind),
      ...checkNameCollision(shapeLike, kind, batch),
    ]);

    if (change.op === "add") {
      const derived = exportIdentifierFor(kind, shapeLike);
      const identifiers =
        change.ident !== undefined && change.ident !== derived ? [derived, change.ident] : [derived];
      for (const identifier of identifiers) {
        report(change, "identifier", [
          ...checkIdentifierCollision(shapeLike, kind, { identifier }),
          ...checkIdentifierCollision(shapeLike, kind, { ...batch, identifier }),
        ]);
      }
      seenIdentifiers.add(change.ident ?? derived);
    }

    // Tracked so a LATER change in this same batch introducing the same
    // name/identifier is also caught.
    seenNames.add(name);
  }

  return collisions;
}

/**
 * Wraps `state.changes` in the full `Changeset` envelope and reports any
 * name/export-identifier collisions found across them. Does not itself
 * write anything or refuse on collisions — the caller (Export screen /
 * `scripts/shapes-merge.mjs`) decides what to do with `collisions`.
 */
export function buildChangeset(state: BuildChangesetState): BuildChangesetResult {
  const changeset: Changeset = {
    $schema: "tonal-guitar/changeset@1",
    version: state.version,
    tuning: state.tuning,
    changes: [...state.changes],
  };
  if (state.generator !== undefined) changeset.generator = state.generator;
  if (state.createdAt !== undefined) changeset.createdAt = state.createdAt;

  return {
    changeset,
    collisions: detectCollisions(state.changes, state.knownNames, state.knownIdentifiers),
  };
}
