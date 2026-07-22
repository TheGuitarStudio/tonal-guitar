# Feature: Shape Library Detail Side Panel

**Issue:** #139 | **Started:** 2026-07-21

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** manual
- **Branch:** feat/shape-detail-panel
- **Priority:** unset
- **Size:** M

## Summary

Clicking a shape card in the Shape Library (`site/app/shapes/`) opens a side panel with
Tonal.js-powered context for the shape: identified chord name(s) (`identifyChord`),
scales/modes containing the chord (`relatedScales`), alternate fingerings of the same
chordType from the registry, and inversions. Includes a visual reorganization pass on the
Shape Library page (better filtering and organization).

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | complete | 0     | yes      |
| Shape     | spec.md     | complete | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Loop History

## Review History

- **2026-07-21 — research-review.md (Codex, via /codex):** Endorsed component placement and scope; pushed to (1) define "scales containing this chord" precisely (favor chroma-subset sweep over curated mapping; helper belongs in `src/integration.ts` with tests, not site utils; resolve root semantics + omitted-tone handling; prototype early), (2) lock the interaction model as first-slice requirements (URL `shape` param decided not optional, button semantics/focus/keyboard, mobile sheet behavior, selectable alternate-fingering thumbnails), (3) make infrastructure explicit (declared `@tonaljs/*` site deps, static-export verification, bundle-size check / lazy-load panel). Raised visual-reorg risk to medium-high (audit failures-first invariant); challenged "no library work required" and the vagueness of "visual reorganization pass".
