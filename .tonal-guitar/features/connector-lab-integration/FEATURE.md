# Feature: Connector lab integration — wire connectSequences into Guitar Lab

**Issue:** [#5](https://github.com/TheGuitarStudio/tonal-guitar/issues/5) | **Started:** 2026-05-18

## Pipeline Progress

- [ ] Phase 1: Research
- [ ] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** spec §8 of [connector-algorithm](../connector-algorithm/spec.md) — explicit follow-up scoped out of MVP
- **Branch:** `feat/connector-lab-integration`
- **Base branch:** `feat/connector-algorithm` (PR [#4](https://github.com/TheGuitarStudio/tonal-guitar/pull/4)) — will rebase onto main once that merges
- **Priority:** unset
- **Size:** unset
- **Purpose:** verification harness for the connector algorithm against the actual lab UI

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | pending | 0     | no       |
| Shape     | spec.md     | pending | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Pre-existing design notes

Spec §8 of the connector-algorithm sketches the integration plan:

- Factor `buildFrettedScale(get(name), root, tuning, opts)` out of `PipelineBuilder` into a helper used by both `currentNotes` and the new connector recompute.
- Add `connectorsAndNextNotes` memo (see connector-algorithm spec §4.3).
- Wire `connector` into each `ChainEntry` so `ConnectorSlot` can display the real preview.
- Replace `chain.flatMap((e) => e.notes)` in the `selectedNotes` derivation with the chained-connector flatten.
- Update `codeGen.ts` to emit `connectSequences()` calls between segments.
- Add a "bridge" toggle to `ChainSection` (header switch) — off by default to preserve the current beginner-friendly restart behavior; on enables the intermediate continuous-arc behavior.

Research (Phase 1) should map these terms onto the current `site/app/experiments/` codebase and surface any drift since the spec was written.

## Loop History

(none yet)

## Review History

(none yet)
