/**
 * Pure glue between a `DraftShape` and the Editor's "Output preview" panel
 * (spec §5.4: "TS (via `renderShapeTs`) and JSON (the `changeset@1` change
 * object)... the TS must be byte-identical to what `shapes:merge` writes").
 *
 * `renderDraftTs` calls `renderShapeTs` with no extra formatting/argument
 * logic of its own beyond picking `(kind, shape, options)` out of the draft
 * — so its output is, by construction, identical to calling `renderShapeTs`
 * directly with the same arguments (asserted in `previewText.test.ts`).
 *
 * No React/DOM imports.
 */
import { renderShapeTs, draftToChange, type RenderShapeOptions, type ShapeLike } from "shape-catalog";
import type { DraftShape } from "shape-catalog";
import type { ChangesetChange } from "tonal-guitar";

/**
 * `draftToChange` throws for a `"gap"`-origin draft with no `file` set yet
 * (spec §6.1 `AddChange.file` is required) — this is the guard the Output
 * preview's JSON tab and "target file" line use to decide whether there's
 * anything to render yet, rather than catching the throw.
 */
export function canPreviewChange(draft: DraftShape): boolean {
  return draft.origin === "existing" || draft.file !== undefined;
}

/** The target `src/data/<file>.ts` this draft will land in once saved —
 * `draft.file` for a new shape, or the original shape's registration file
 * is unknown to the workbench (only the merge script's owned-block map
 * knows it), so an "existing"-origin draft has no single answer here and
 * this returns `undefined`. */
export function targetFileFor(draft: DraftShape): string | undefined {
  return draft.origin === "gap" ? draft.file : undefined;
}

/** The `changeset@1` `ChangesetChange` this draft currently represents, or
 * `undefined` when `canPreviewChange` is false (no target file chosen yet
 * for a new shape). */
export function draftChangePreview(draft: DraftShape): ChangesetChange | undefined {
  if (!canPreviewChange(draft)) return undefined;
  return draftToChange(draft);
}

/** Pretty-printed JSON for the Output preview's JSON tab. */
export function renderDraftJson(draft: DraftShape): string | undefined {
  const change = draftChangePreview(draft);
  return change === undefined ? undefined : JSON.stringify(change, null, 2);
}

/**
 * The exact `renderShapeTs(kind, shape, options)` call the merge script
 * would make for this draft's shape — same identifier-override precedence
 * (`draft.ident`, when set) as `AddChange.ident`/`draftToChange`.
 */
export function renderDraftTs(draft: DraftShape): Promise<string> {
  const options: RenderShapeOptions = {};
  if (draft.ident !== undefined) options.ident = draft.ident;
  // `renderShapeTs`'s `ShapeLike` is a deliberately loose structural type
  // (spec §6.5: "prints only the keys it finds") — `ChordShape`/`ScaleShape`/
  // `ArpeggioShape` all satisfy it structurally but lack its index
  // signature nominally, so TS needs the same `as unknown as ShapeLike`
  // bridge `scripts/shapes-merge.mjs` doesn't need (plain JS has no such
  // check) but every other TS caller of this printer does.
  return renderShapeTs(draft.kind, draft.shape as unknown as ShapeLike, options);
}
