/**
 * `tonal-guitar/changeset@1` schema (spec §6.1).
 *
 * These types are exported as **public** library types (via `src/index.ts`,
 * wired up by a later task group) even though the only consumer in this
 * feature — `scripts/shapes-merge.mjs` — is internal tooling. The public
 * export lets external authoring tools (e.g. the Shape Workbench) produce
 * changesets against a stable, versioned contract without depending on the
 * merge script itself.
 *
 * Zero `@tonaljs/*` imports — this module only imports `./shape` for the
 * `ChordShape | ScaleShape | ArpeggioShape` union used in `AddChange.shape`.
 */
import type { ArpeggioShape, ChordShape, ScaleShape } from "./shape";

export interface Changeset {
  $schema: "tonal-guitar/changeset@1"; // exact string, required
  version: string; // registry VERSION the edits were made against
  tuning: string[]; // authoring tuning; MVP must equal STANDARD
  generator?: string; // e.g. "shape-workbench@0.1.0"
  createdAt?: string; // ISO 8601
  changes: ChangesetChange[]; // required, non-empty
}

export type ChangesetKind = "chord" | "arpeggio" | "scale";

export type ChangesetChange = AddChange | UpdateChange | RemoveChange;

export interface AddChange {
  op: "add";
  kind: ChangesetKind;
  file: string; // data-file basename, no path/extension, /^[a-z0-9-]+$/
  ident?: string; // export identifier; generated via exportIdentifierFor when absent
  after?: string; // registration-order anchor: another data-file basename
  shape: ChordShape | ScaleShape | ArpeggioShape; // per `kind`
}

export interface UpdateChange {
  op: "update";
  kind: ChangesetKind;
  name: string; // must resolve to exactly one registered shape
  patch: Record<string, unknown>; // partial of the shape type
  /**
   * Names of optional fields to delete from the target shape (additive,
   * backward-compatible — the schema string stays `"tonal-guitar/
   * changeset@1"`). Exists because `patch` alone can't express field
   * clearing: `JSON.stringify({ notes: undefined })` drops the key
   * entirely, so a `field: undefined` patch entry silently vanishes over
   * the wire and never reaches the merge script. Omit (or leave empty) when
   * the update doesn't clear anything. A name here must NOT also appear in
   * `patch` (contradictory — `scripts/shapes-merge.mjs` refuses the whole
   * merge) and must NOT name a per-kind required field (`name`, `system`,
   * `strings`, `fingers`, `barres`, `rootString` for a chord; the
   * equivalent required set for scale/arpeggio — see `./shape`'s
   * `ChordShape`/`ScaleShape`/`ArpeggioShape` interfaces).
   */
  unset?: string[];
}

export interface RemoveChange {
  op: "remove";
  kind: ChangesetKind;
  name: string;
}
