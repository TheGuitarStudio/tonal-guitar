/**
 * Pure per-change presentation + audit helpers for the Export screen (spec
 * §5.4 Export requirements, tasks.md Group 27). Turns one `ChangesetChange`
 * plus the `WorkbenchState` it came from into everything the change list
 * and diff view need: the op glyph, the target file, the check status (by
 * re-running the SAME audit functions the Editor's Live Checks card
 * (`../editor/checks.ts`) and `scripts/shapes-merge.mjs` rule 8 already
 * use — never a new check), and the before/after shapes `diffShape` needs.
 *
 * No React/DOM imports.
 */
import {
  auditArpeggioShape,
  auditArpeggioShapeIntegration,
  auditChordShapeFull,
  auditScaleShape,
  CHECK_NAME_UNIQUE,
} from "tonal-guitar";
import type {
  ArpeggioShape,
  ChangesetChange,
  ChangesetKind,
  ChordShape,
  ScaleShape,
  ShapeAuditIssue,
} from "tonal-guitar";
import { diffShape } from "shape-catalog";
import type { DiffableShape, DraftShape, ShapeDiff } from "shape-catalog";
import type { WorkbenchState } from "../store";

export type ChangeOpGlyph = "+" | "~" | "−";

/** `+`/`~`/`−` per the Export screen's change-list requirement — one glyph
 * per `ChangesetChange["op"]`. */
export function changeOpGlyph(change: ChangesetChange): ChangeOpGlyph {
  if (change.op === "add") return "+";
  if (change.op === "update") return "~";
  return "−";
}

/** The shape name a change targets — `AddChange.shape.name` for an add,
 * `name` directly for update/remove. */
export function changeDisplayName(change: ChangesetChange): string {
  return change.op === "add" ? change.shape.name : change.name;
}

/**
 * `AddChange.file` for an add. `update`/`remove` targets only resolve to a
 * file by scanning `src/data/*.ts` server-side
 * (`scripts/shapes-merge.mjs`'s `locateOwnedRegion`) — the workbench has no
 * filesystem access, so this is `undefined` for those ops (the Export
 * screen displays a "resolved by shapes:merge" placeholder instead).
 */
export function changeTargetFile(change: ChangesetChange): string | undefined {
  return change.op === "add" ? change.file : undefined;
}

/**
 * The in-progress draft a change was produced from — the inverse of
 * `draftToChange`'s own lookup. `WorkbenchState.drafts` is keyed by slot
 * key, not by change, so this matches on the same identity `draftToChange`
 * used when the change was built: a `"gap"`-origin draft's `shape.name` for
 * an `AddChange`, an `"existing"`-origin draft's `original.name` for an
 * `UpdateChange`. A `RemoveChange` never originates from a draft.
 */
export function findDraftForChange(state: WorkbenchState, change: ChangesetChange): DraftShape | undefined {
  const drafts = Object.values(state.drafts);
  if (change.op === "add") {
    return drafts.find((draft) => draft.origin === "gap" && draft.shape.name === change.shape.name);
  }
  if (change.op === "update") {
    return drafts.find((draft) => draft.origin === "existing" && draft.original?.name === change.name);
  }
  return undefined;
}

/**
 * The shape a change would write, for diffing/auditing — the matching
 * draft's fully-authored `shape` (already the base shape with every edit
 * applied, per `../editor/saveDraft.ts`'s `computeSaveDraft`) when one is
 * found, else `AddChange.shape` directly (an add change always carries its
 * own shape even without a draft, e.g. a changeset built outside the
 * workbench). `undefined` for a `remove` (nothing is written) or an
 * `update` whose draft is no longer in `WorkbenchState.drafts`.
 */
export function changeAfterShape(state: WorkbenchState, change: ChangesetChange): DiffableShape | undefined {
  if (change.op === "remove") return undefined;
  const draft = findDraftForChange(state, change);
  if (draft) return draft.shape;
  return change.op === "add" ? change.shape : undefined;
}

/** The registered shape an `update` change started from (`diffShape`'s
 * `before`) — the matching draft's `original` snapshot. `undefined` for
 * `add` (nothing existed before) and `remove` (no draft). */
export function changeBeforeShape(state: WorkbenchState, change: ChangesetChange): DiffableShape | undefined {
  if (change.op !== "update") return undefined;
  return findDraftForChange(state, change)?.original;
}

/** `diffShape(before, after)` for a change, or `undefined` when there's no
 * `after` shape to diff (a `remove`, or an `update` whose draft is gone). */
export function changeShapeDiff(state: WorkbenchState, change: ChangesetChange): ShapeDiff | undefined {
  const after = changeAfterShape(state, change);
  if (after === undefined) return undefined;
  return diffShape(changeBeforeShape(state, change), after);
}

export type ChangeCheckStatus = "pass" | "warning" | "error" | "n/a";

function auditFor(kind: ChangesetKind, shape: DiffableShape, tuning: string[]): ShapeAuditIssue[] {
  const options = { tuning };
  if (kind === "chord") return auditChordShapeFull(shape as ChordShape, options);
  if (kind === "scale") return auditScaleShape(shape as ScaleShape, options);
  return [
    ...auditArpeggioShape(shape as ArpeggioShape, options),
    ...auditArpeggioShapeIntegration(shape as ArpeggioShape, options),
  ];
}

/**
 * Re-runs the SAME audit functions the Editor's Live Checks card and
 * `scripts/shapes-merge.mjs` rule 8 use against a change's `after` shape —
 * never a new check. `update` changes drop `CHECK_NAME_UNIQUE` (mirrors
 * both `../editor/checks.ts`'s `runChordChecks` `existingEdit` filter and
 * the merge script's identical rule-8 filter): an edited draft is always a
 * clone of the registered shape it started from, so the check would
 * otherwise fire a false "already registered" collision against itself on
 * every clean edit. `"n/a"` for a `remove` (nothing to audit) or an
 * `add`/`update` whose shape isn't resolvable (draft no longer present).
 */
export function changeCheckStatus(state: WorkbenchState, change: ChangesetChange): ChangeCheckStatus {
  const shape = changeAfterShape(state, change);
  if (shape === undefined) return "n/a";

  let issues = auditFor(change.kind, shape, state.tuning);
  if (change.op === "update") {
    issues = issues.filter((issue) => issue.id !== CHECK_NAME_UNIQUE);
  }
  if (issues.some((issue) => issue.severity === "error")) return "error";
  if (issues.length > 0) return "warning";
  return "pass";
}

export interface ChangeKindOpTally {
  kind: ChangesetKind;
  op: ChangesetChange["op"];
  count: number;
}

/**
 * Tallies `changes` by `(kind, op)` — the Export screen's "Test counts
 * touched" summary (spec §5.4). This is a client-side APPROXIMATION: the
 * exact assertion lines/deltas (`scripts/shapes-merge.mjs`'s
 * `computeCountsTouched`) are only knowable by scanning `src/data/*.test.ts`
 * on disk, which the browser has no access to — that exact report is what
 * running `shapes:merge --dry-run` prints (see the sample transcript). This
 * tally exists so the author can see at a glance which kinds/ops are in the
 * pending changeset before running the real command.
 */
export function summarizeChangesByKindAndOp(changes: readonly ChangesetChange[]): ChangeKindOpTally[] {
  const byKey = new Map<string, ChangeKindOpTally>();
  for (const change of changes) {
    const key = `${change.kind}:${change.op}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { kind: change.kind, op: change.op, count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.kind === b.kind ? a.op.localeCompare(b.op) : a.kind.localeCompare(b.kind),
  );
}
