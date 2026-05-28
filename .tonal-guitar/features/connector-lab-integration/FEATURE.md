# Feature: Connector lab integration — wire connectSequences into Guitar Lab

**Issue:** [#5](https://github.com/TheGuitarStudio/tonal-guitar/issues/5) | **Started:** 2026-05-18

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [x] Phase 4: Implement

## Context

- **Origin:** spec §8 of [connector-algorithm](../connector-algorithm/spec.md) — explicit follow-up scoped out of MVP
- **Branch:** `feat/connector-lab-integration`
- **Base branch:** `feat/connector-algorithm` (PR [#4](https://github.com/TheGuitarStudio/tonal-guitar/pull/4)) — will rebase onto main once that merges
- **Priority:** unset
- **Size:** unset
- **Purpose:** verification harness for the connector algorithm against the actual lab UI

## Artifacts

| Phase     | File        | Status   | Loops | Reviewed |
| --------- | ----------- | -------- | ----- | -------- |
| Research  | research.md | complete | 0     | no       |
| Shape     | spec.md     | complete | 0     | no       |
| Plan      | tasks.md    | complete | 1     | yes      |
| Implement | FEATURE.md  | pending  | 0     | no       |

## Pre-existing design notes

Spec §8 of the connector-algorithm sketches the integration plan:

- Factor `buildFrettedScale(get(name), root, tuning, opts)` out of `PipelineBuilder` into a helper used by both `currentNotes` and the new connector recompute.
- Add `connectorsAndNextNotes` memo (see connector-algorithm spec §4.3).
- Wire `connector` into each `ChainEntry` so `ConnectorSlot` can display the real preview.
- Replace `chain.flatMap((e) => e.notes)` in the `selectedNotes` derivation with the chained-connector flatten.
- Update `codeGen.ts` to emit `connectSequences()` calls between segments.
- Add a "bridge" toggle to `ChainSection` (header switch) — off by default to preserve the current beginner-friendly restart behavior; on enables the intermediate continuous-arc behavior.

Research (Phase 1) should map these terms onto the current `site/app/experiments/` codebase and surface any drift since the spec was written.

## Phase 4: Implement

| Layer | Task Group                                                                                  | Status      | Agent | Notes |
| ----- | ------------------------------------------------------------------------------------------- | ----------- | ----- | ----- |
| 0     | TG1: chainUtils.ts — rebuildScale helper                                                    | complete    | sonnet | -     |
| 1     | TG2: PipelineBuilder — bridgeEnabled state, connectorsAndNextNotes memo, selectedNotes      | complete    | sonnet | -     |
| 2     | TG3: ChainSection — Bridge toggle and ConnectorSlot strategy display                        | complete    | sonnet | -     |
| 2     | TG4: codeGen.ts — emit connectSequences calls                                               | complete    | sonnet | -     |
| 3     | TG5: Manual acceptance verification (4 scenarios)                                           | complete    | user  | bridge validated by user in lab; spec scenario text updated to match algorithm contract |

### Oversight Reports

### Spec Compliance

### Follow-ups (out of scope for this feature)

- **Chain description in header/output** — partially landed: per-entry labels
  now read `"A Major · E Shape · Ascend in Thirds (1,3)"`, and the
  whole-chain `selectedLabel` joins entries as
  `"A Major (Ionian) · E Shape ↑ Thirds, D Shape ↓ Thirds"` which flows
  into the OutputStep subtitle and JSON output title. Future work could
  surface the same description as a dedicated header in ChainSection.
- **Bridge default OFF** — D-003 already keeps the toggle off by default;
  user confirmed they will not use it initially to keep things simple.
- **Algorithm refinements** — the same-string bridge model lands as v1.
  Possible future directions:
  - more aggressive overlap dedup (e.g. across multiple pairs, not just one)
  - string-pivot heuristics when prev's last note lands on a string that
    next's shape can't continue
  - configurable strategy via `ConnectorOptions.strategy`

## Loop History

(none yet)

## Review History

(none yet)
