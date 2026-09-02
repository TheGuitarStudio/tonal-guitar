/**
 * The Live Checks card's fixed check-id roster (spec §5.4: "one row per
 * `auditChordShape` + `auditChordShapeIntegration` check id") plus the
 * function that runs both against a draft shape. Spec §3.3's rule — "the
 * app never reimplements a check; every entry in the editor's Checks card
 * maps 1:1 to an exported check function id" — means this module owns
 * exactly two things: the roster of ids those two functions can ever
 * produce, and a thin composition of the two functions themselves. No check
 * logic is written here.
 *
 * No React/DOM imports.
 */
import {
  auditChordShape,
  auditChordShapeIntegration,
  CHECK_FRET_SPAN,
  CHECK_FINGER_ZERO_ON_MOVABLE,
  CHECK_REPEATED_FINGER_NO_BARRE,
  CHECK_BUILD_LOSS,
  CHECK_METADATA_COMPLETENESS,
  CHECK_GEOMETRY_MISMATCH,
  CHECK_STRINGSET_MISMATCH,
  CHECK_TUNING_MISMATCH,
  CHECK_BARRE_FRET_ORIGIN,
  CHECK_NAME_UNIQUE,
  CHECK_IDENTIFY_MISMATCH,
} from "tonal-guitar";
import type { ChordShape, ShapeAuditIssue } from "tonal-guitar";

/**
 * Every check id `auditChordShape` (required tier) or
 * `auditChordShapeIntegration` (optional tier) can produce, in the display
 * order the Checks card renders them. Sourced entirely from the exported
 * `CHECK_*` constants — never a hand-typed string — so this roster can never
 * drift from what the two audit functions actually emit.
 */
export const CHORD_CHECK_IDS: readonly string[] = [
  CHECK_FRET_SPAN,
  CHECK_FINGER_ZERO_ON_MOVABLE,
  CHECK_REPEATED_FINGER_NO_BARRE,
  CHECK_BUILD_LOSS,
  CHECK_METADATA_COMPLETENESS,
  CHECK_GEOMETRY_MISMATCH,
  CHECK_STRINGSET_MISMATCH,
  CHECK_TUNING_MISMATCH,
  CHECK_BARRE_FRET_ORIGIN,
  CHECK_NAME_UNIQUE,
  CHECK_IDENTIFY_MISMATCH,
];

/** Runs both check functions and returns their combined issue list — the
 * Checks card's sole data source.
 *
 * `existingEdit: true` (an `origin: "existing"` draft) drops
 * `CHECK_NAME_UNIQUE` issues: `checkNameUnique` falls back to
 * reference-equality against the live registry, and an edited draft is
 * always a clone of the registered shape, so the check would fire on every
 * clean edit. The merge script applies the identical filter to `update`
 * changes (scripts/shapes-merge.mjs), so the card stays consistent with
 * what a merge would actually refuse. */
export function runChordChecks(
  shape: ChordShape,
  root: string,
  tuning: string[],
  { existingEdit = false }: { existingEdit?: boolean } = {},
): ShapeAuditIssue[] {
  const options = { root, tuning };
  const issues = [...auditChordShape(shape, options), ...auditChordShapeIntegration(shape, options)];
  return existingEdit ? issues.filter((issue) => issue.id !== CHECK_NAME_UNIQUE) : issues;
}

export interface ChordCheckRow {
  id: string;
  issues: ShapeAuditIssue[];
  status: "pass" | "warning" | "error";
}

/** One row per `CHORD_CHECK_IDS` entry — `"pass"` when `issues` carries none
 * of that id, else the highest severity among the issues that do (an id can
 * report more than once, e.g. `barre-fret-origin` per offending barre). */
export function chordCheckRows(issues: ShapeAuditIssue[]): ChordCheckRow[] {
  return CHORD_CHECK_IDS.map((id) => {
    const matching = issues.filter((issue) => issue.id === id);
    const status: ChordCheckRow["status"] = matching.some((issue) => issue.severity === "error")
      ? "error"
      : matching.length > 0
        ? "warning"
        : "pass";
    return { id, issues: matching, status };
  });
}
