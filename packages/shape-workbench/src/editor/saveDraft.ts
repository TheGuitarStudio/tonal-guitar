/**
 * Pure computation behind the Editor's "Save to changeset" action (spec
 * §5.4/§9 edge case 9, tasks.md 26.3/26.8). Never touches React or the
 * store — `Editor.tsx` calls this and dispatches `SET_DRAFT`/`ADD_CHANGE`
 * from the result; kept separate so the no-`1P`-no-save refusal and the
 * `AddChange`-vs-`UpdateChange` origin branching are unit-testable without
 * rendering or simulating a click.
 */
import { draftToChange } from "shape-catalog";
import type { DraftShape } from "shape-catalog";
import type { Barre, ChangesetChange, ChordShape } from "tonal-guitar";
import type { EditorCell } from "fretboard-ui";
import { buildShapeFromCells } from "./deriveShape";

/** Spec §9 edge case 9's exact refusal reason. */
export const NO_ROOT_MESSAGE =
  'Mark a root (interval "1P") before saving — marking a root is what makes the shape movable.';
export const NO_FILE_MESSAGE = "Choose a target file before saving this new shape.";

export type SaveDraftResult =
  | { ok: true; shape: ChordShape; draft: DraftShape; change: ChangesetChange }
  | { ok: false; error: string };

/**
 * Refuses (no `ChangesetChange` produced) when:
 *  - no string ends up carrying `"1P"` (`buildShapeFromCells` returns
 *    `undefined`) — spec §9 edge case 9's save refusal.
 *  - the draft is `"gap"`-origin with no target file chosen yet
 *    (`AddChange.file` is required, spec §6.1).
 *
 * On success, `change` is produced by `draftToChange` alone — an
 * `"existing"`-origin draft always yields an `UpdateChange` and a
 * `"gap"`-origin draft always yields an `AddChange` (spec §5.2's origin
 * tracking); this function never re-derives that branching itself.
 */
export function computeSaveDraft(
  draft: DraftShape,
  cells: EditorCell[],
  barres: Barre[],
  tuning: string[],
  authorRoot: string,
): SaveDraftResult {
  const shape = buildShapeFromCells(draft.shape as ChordShape, cells, barres, tuning, authorRoot);
  if (shape === undefined) {
    return { ok: false, error: NO_ROOT_MESSAGE };
  }
  if (draft.origin === "gap" && draft.file === undefined) {
    return { ok: false, error: NO_FILE_MESSAGE };
  }

  const nextDraft: DraftShape = { ...draft, shape };
  const change = draftToChange(nextDraft);
  return { ok: true, shape, draft: nextDraft, change };
}
