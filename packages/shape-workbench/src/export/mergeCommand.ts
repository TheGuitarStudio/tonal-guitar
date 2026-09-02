/**
 * The `shapes:merge` CLI invocation + hints the Export screen displays
 * verbatim (spec's Export screen requirements: "the exact
 * `npm run shapes:merge -- .workbench/changeset.json` command with a sample
 * transcript, plus `Dry run: --check` and `Undo: git checkout -- src/data`
 * hints"). Kept as named constants (not inlined in JSX) so a test can
 * assert the copy-pasteable command text directly, and so it can be
 * cross-checked against `scripts/shapes-merge.mjs`'s real CLI signature
 * (task 27.4's acceptance criterion: "must match ... exactly").
 */

/** `.workbench/` is where the dev-server plugin writes
 * (`plugins/workbench-io.ts`'s `WORKBENCH_DIR_NAME`/`CHANGESET_FILE_NAME`),
 * and `scripts/shapes-merge.mjs`'s CLI signature is
 * `<changeset.json> [--dry-run] [--check] [--force] [--update-counts]
 * [--out <ident>] [--root <dir>] [--json]` — this is the exact invocation
 * for the file the "Write changeset.json" button just wrote. */
export const MERGE_COMMAND = "npm run shapes:merge -- .workbench/changeset.json";

/** Verbatim per the spec's Export screen requirements. */
export const DRY_RUN_HINT = "Dry run: --check";
export const UNDO_HINT = "Undo: git checkout -- src/data";

/**
 * A representative `npm run shapes:merge` transcript (spec: "a sample
 * transcript") — illustrative only, mirroring `scripts/shapes-merge.mjs`'s
 * `printPlanSummary` output shape exactly (the `✔ N added, M updated`
 * summary line, per-file `write`/`delete` lines, the audit summary line,
 * an optional `test counts touched:` block, and the two closing
 * `review`/`Undo` lines). The real numbers only exist once the command
 * actually runs against the changeset just written — this is a fixed
 * sample, not computed from `WorkbenchState`.
 */
export const SAMPLE_TRANSCRIPT = [
  "✔ 2 shape(s) added, 1 updated, 0 removed",
  "  write  src/data/caged-chords-minor.ts",
  "  write  src/data/caged-chords.ts",
  "✔ audit: 0 errors, 0 warnings in changed shapes",
  "test counts touched:",
  "  src/data/data.test.ts:897 shellCount 16 -> 17",
  "→ review with: git diff --stat",
  "Undo: git checkout -- src/data",
].join("\n");
