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
import { CHECK_NAME_UNIQUE, checkNameUnique, exportIdentifierFor } from "tonal-guitar";
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
   * merged elsewhere. Passed straight through to `checkNameUnique`.
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

function isIdentifierCollisionMessage(message: string): boolean {
  return message.includes("Export identifier");
}

/**
 * Collision detection for every `add` change in `changes` (spec §6.2.6):
 * each is checked against the live registry (`checkNameUnique`'s default,
 * no-`options` mode) AND against every other `add` change earlier in the
 * list, so two new shapes in the same batch that would collide with each
 * other are caught too, not just collisions against already-registered
 * shapes. `update`/`remove` changes are exempt — they target an existing
 * name by design.
 */
function detectCollisions(
  changes: readonly ChangesetChange[],
  extraKnownNames?: Set<string>,
  extraKnownIdentifiers?: Set<string>,
): ChangesetCollision[] {
  const collisions: ChangesetCollision[] = [];
  const seenNames = new Set<string>(extraKnownNames);
  const seenIdentifiers = new Set<string>(extraKnownIdentifiers);

  for (const change of changes) {
    if (change.op !== "add") continue;
    const kind = change.kind;
    const shapeLike = { name: change.shape.name };
    const identifier = change.ident ?? exportIdentifierFor(kind, shapeLike);

    const liveIssues = checkNameUnique(shapeLike, kind);
    const batchIssues = checkNameUnique(shapeLike, kind, {
      knownNames: seenNames,
      knownIdentifiers: seenIdentifiers,
    });

    for (const issue of [...liveIssues, ...batchIssues]) {
      if (issue.id !== CHECK_NAME_UNIQUE) continue;
      collisions.push({
        change,
        reason: isIdentifierCollisionMessage(issue.message) ? "identifier" : "name",
        detail: issue.message,
      });
    }

    seenNames.add(change.shape.name);
    seenIdentifiers.add(identifier);
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
