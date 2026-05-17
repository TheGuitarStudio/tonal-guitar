# Feature: Connector algorithm — bridge chained sequences

**Issue:** _pending — draft not yet promoted to a real issue_ | **Started:** 2026-05-16

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
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
| Shape     | spec.md     | draft   | 1     | no       |
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

### Phase 2 · Loop 1 — 2026-05-16

Resolved all 8 research questions. User direction mid-phase: **same-direction
chains do NOT get a bridge** — they express a beginner "restart in another
position" exercise, distinct from the intermediate "ascend-then-descend"
arc that bridging serves. Spec collapses the strategy taxonomy to three
cases (`none` / `extend` / `reach-back`) with a deterministic classifier
based on direction-pair × pitch-side.

API locked: `connectSequences({prev, next}, options?) → {connector,
nextNotes, strategy}`. Pure midi logic, no new dependencies. ~150-line
new file `src/connect.ts`. AlphaTeX and lab integration are post-library
follow-ups, plan-scoped separately.

Worked expected-output fingerprints for all 8 test scenarios committed in
spec §3.4 — these become Phase 4 test assertions.

## Review History

_Appended per external review._
