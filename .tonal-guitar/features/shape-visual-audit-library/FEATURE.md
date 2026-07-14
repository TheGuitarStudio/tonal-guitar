# Feature: Shape Visual Audit Library

**Issue:** #97 | **Started:** 2026-07-14

## Pipeline Progress

- [x] Phase 1: Research
- [ ] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** /idea #97
- **Branch:** feat/shape-visual-audit-library
- **Priority:** P1
- **Size:** M

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | complete | 1     | yes      |
| Shape     | spec.md     | pending | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Loop History

## Review History

### 2026-07-14 — Research review (adversarial, via Codex)

Saved to `reviews/research-review.md`. Verdict: proceed to Shape, but tighten spec first. Key findings: (1) **factual correction** — `baseFret` IS set on all 70 open-chords shapes (research claimed unset; corrected in research.md), the real issue is `applyChordShape` ignores it; (2) **biggest risk** — built geometry vs. source-diagram geometry may disagree for `baseFret > 1` shapes; validate with a pre-UI spike; (3) recommends adding build-loss + metadata-completeness badges, a deterministic `displayRootForChordShape` helper, structured audit-issue API (`id`/`severity`/`message`), failures-first default view, and a stable issue-body schema as the `/fix` input contract; (4) defer the voicingFamily/baseFret badge unless semantics are made precise.
