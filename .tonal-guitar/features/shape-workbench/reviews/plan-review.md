# Plan Review — tasks.md vs spec.md

**Date:** 2026-08-30 · **Reviewer:** feature-plan plan-reviewer agent (sonnet) · **Verdict:** NEEDS REVISION → revisions applied, see below

## Coverage Analysis

- Requirements covered: effectively all of spec §1–§9 plus the §10 build sequence map onto at least one task group (§1→Groups 2–7, §2→8/11, §3→9/10, §4→13/14/19, §5→20–27, §6→15–19, §7→28–29, §8→1/29.8/30, §9→30.4). ~15 file:line anchors spot-checked against source; all accurate.

## Findings (and resolutions)

1. **Group 19 could bypass the §4.3 dogfooding requirement (confidence 90).** Task 19.2 allowed a hand-written changeset fixture as an alternative, and Group 19 did not depend on Groups 26/27 (Editor/Export), so nothing structurally forced the CAGED-minor-triad changeset to be produced by the running workbench — contradicting spec §4.3 ("authored in the workbench, not a hand-written file").
   **Resolved:** Group 19 now depends on Groups 26 + 27; 19.2 requires driving the running workbench and using `.workbench/changeset.json` as the input to 19.3; a dogfooding line was added to Group 19's acceptance criteria; Execution Order item 12 updated.

2. **`EditCapabilities` handlers beyond `onCreateShape` declared but never implemented (confidence 82).** Spec §5.3 defines six hooks (`onCreateShape`, `onEditShape`, `onDuplicateToPosition`, `onAddTag`, `draftFor`, `exportState`); only `onCreateShape` was concretely wired. Knock-on: nothing distinguished add-vs-update draft origin, which the §4.4 metadata backfill needs.
   **Resolved:** 22.4 now requires `DraftShape` origin tracking (gap vs existing) so `draftToChange` emits `AddChange` vs `UpdateChange`; 24.6 requires all six handlers populated; new 26.8 wires `onEditShape`/`onDuplicateToPosition`/`onAddTag` with an add-vs-update test; new 27.6 wires `exportState`; Group 26 acceptance criteria extended.

## Minor / non-blocking notes

- Group 8's dependency label said "Group 2 (Barre offset semantics)" — the offset convention actually lands in Group 5.8. Label corrected.
- Group 23 bundles scaffolding + capability contract + ~12 ported components; reviewer suggested an optional split for review checkpoints. Left as-is (sizing nit, not correctness).

## Dependency check

No ordering problems beyond finding 1. Wave A–E parallel-dispatch plan and the sequential spine are internally consistent with each group's Dependencies line (Groups 2–14, 20–24, 28–30 verified against the Execution Order section). No cycle introduced by the Group 19 fix (26/27 do not depend on 19).
