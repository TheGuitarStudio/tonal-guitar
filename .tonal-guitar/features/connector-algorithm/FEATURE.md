# Feature: Connector algorithm — bridge chained sequences

**Issue:** _pending — draft not yet promoted to a real issue_ | **Started:** 2026-05-16

## Pipeline Progress

- [x] Phase 1: Research
- [ ] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** `/idea PVTI_lADOEFcb-s4BX5t_zgs8ILM` (draft `DI_lADOEFcb-s4BX5t_zgKgNPs`)
- **Branch:** `feat/connector-algorithm`
- **Priority:** P1
- **Size:** M

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | draft   | 1     | no       |
| Shape     | spec.md     | pending | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Deferred GitHub steps

This feature was graduated locally with `/idea --shape` using the "no push yet" option. Before starting the feature pipeline (`/feature --from`), complete:

- [ ] Promote the project draft (`DI_lADOEFcb-s4BX5t_zgKgNPs`) to a real GitHub issue with the `feature-spec` label
- [ ] Move the project item from `Spark` to `Backlog`
- [ ] `git push -u origin feat/connector-algorithm`

## Loop History

### Phase 1 · Loop 1 — 2026-05-16

Read library primitives (`walker.ts`, `sequence.ts`, `build.ts`, `fretboard.ts`,
`output/alphatex.ts`), CAGED shape data, and the lab's `ChainSection` /
`PipelineBuilder` / `codeGen` chain wiring. Built `dist/` and ran
`scratch/connector-probe.mjs` to validate the four MVP cases against concrete
A-major data.

Findings: re-framed V1–V4 in pitch terms (H+ / H- × direction) since "CAGED
order" doesn't always match pitch order for a given key. Concluded the
algorithm collapses to **extend (linear bridge)** vs. **reach-back (re-walk
next over combined scale)**. Picked linear-bridge over motif-extend for
predictability and musicality.

Identified API shape: `connectSequences(prev, next, opts) → { connector,
nextOverride }`. All existing primitives suffice — no new library plumbing
needed. AlphaTeX and lab integration are non-blocking.

8 open questions remaining (1 needs explicit pick in Shape phase, rest are
scoping or post-MVP).

## Review History

_Appended per external review._
