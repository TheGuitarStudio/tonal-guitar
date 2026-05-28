# Feature: Connector lab integration — wire connectSequences into Guitar Lab

**Issue:** [#5](https://github.com/TheGuitarStudio/tonal-guitar/issues/5) | **Started:** 2026-05-18

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [ ] Phase 4: Implement (in progress)

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
| 3     | TG5: Manual acceptance verification (4 scenarios)                                           | pending     | user  | requires browser interaction |

### Oversight Reports

### Spec Compliance

## Loop History

(none yet)

## Review History

(none yet)
