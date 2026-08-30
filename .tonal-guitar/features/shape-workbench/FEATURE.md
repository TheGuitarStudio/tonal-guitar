# Feature: Shape Workbench

**Issue:** #161 | **Started:** 2026-08-30

## Pipeline Progress

- [x] Phase 1: Research
- [ ] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** manual (design canvas session 2026-08-30 — https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd)
- **Branch:** feat/shape-workbench
- **Priority:** unset
- **Size:** L

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | done    | 1     | yes      |
| Shape     | spec.md     | pending | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Loop History

## Review History

- 2026-08-30 — External review of research.md by Codex CLI (reviews/research-review.md). Highlights: shared-UI needs a dedicated React package (proposed `packages/shape-library-ui`), merge script needs AST/generator strategy + fixtures, Barre.fret migration riskier than display-only (audit.ts:147 uses barre ranges), override mechanism needs an explicit resolver layer; corrections: open-chords is 70 shapes/35 barres, ScaleShape.parentShape already exists (ChordShape lacks it). Recommendations accepted into Phase 2 inputs.
