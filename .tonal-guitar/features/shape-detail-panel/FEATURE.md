# Feature: Shape Library Detail Side Panel

**Issue:** #139 | **Started:** 2026-07-21

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [x] Phase 4: Implement

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
| Plan      | tasks.md    | complete | 0     | no       |
| Implement | FEATURE.md  | complete | 0     | no       |

## Loop History

## Review History

- **2026-07-21 — research-review.md (Codex, via /codex):** Endorsed component placement and scope; pushed to (1) define "scales containing this chord" precisely (favor chroma-subset sweep over curated mapping; helper belongs in `src/integration.ts` with tests, not site utils; resolve root semantics + omitted-tone handling; prototype early), (2) lock the interaction model as first-slice requirements (URL `shape` param decided not optional, button semantics/focus/keyboard, mobile sheet behavior, selectable alternate-fingering thumbnails), (3) make infrastructure explicit (declared `@tonaljs/*` site deps, static-export verification, bundle-size check / lazy-load panel). Raised visual-reorg risk to medium-high (audit failures-first invariant); challenged "no library work required" and the vagueness of "visual reorganization pass".

## Phase 4: Implement

| Layer | Task Group | Status | Agent | Notes |
| ----- | ---------- | ------ | ----- | ----- |
| 0 | TG1: `featured` metadata field on shape types | complete | sonnet | - |
| 0 | TG2: `scalesContainingChord` — types + stub + registration | complete | sonnet | - |
| 0 | TG7: `shapeLibraryUtils.ts` — URL state extension | complete | sonnet | - |
| 0 | TG11: `CompactFretboard.tsx` — thumbnail diagram adapter | complete | sonnet | - |
| 1 | TG3: Chord→scales chroma sweep, containment, and ranking | complete | sonnet | tests staged as it.todo for TG4 |
| 1 | TG5: Featured shape curation (registry data) | complete | sonnet | 32 chord + 5 scale flags |
| 1 | TG8: `shapeLibraryUtils.ts` — facet, grouping, and sort helpers | complete | sonnet | - |
| 1 | TG10: `ShapeCard.tsx` + `ShapeCardDiagram.tsx` — compact, monochrome, clickable card | complete | sonnet | also touched LazyShapeCard.tsx (real call site) |
| 2 | TG4: Wire `scalesContainingChord` public function + edge cases + docs entry | complete | sonnet | fixed L1 ranking-tiebreak concern |
| 2 | TG9: `FilterBar.tsx` rework — faceted chips | complete | sonnet | browser-verified interactively |
| 3 | TG6: API docs + README updates | complete | sonnet | examples verified against dist |
| 3 | TG12: `shapeDetailUtils.ts` — pure detail-derivation logic | complete | sonnet | - |
| 4 | TG13: `ShapeDetailPanel.tsx` — the non-modal slide-over | complete | sonnet | hardware-back + mobile full-height handed to TG14 |
| 5 | TG14: `ShapeLibrary.tsx` wiring — selection, grouped grid, failing-pinned section | complete | sonnet | browser-verified; fixed L4 mobile-sheet + hardware-back |
| 6 | TG15: Infrastructure — explicit `@tonaljs/*` deps + bundle/static-export verification | complete | sonnet | 118 kB first load; panel in 20 kB lazy chunk |
| 7 | TG16: Test review and gap analysis | complete | sonnet | +2 strategic tests; site checklist pass (mobile visual n/a) |

### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: 1 concern — `rankContainingScales` corpus-index tiebreak misses aeolian→minor normalization (index -1); handed to TG4 to fix when wiring the public function. Continued.
- **Layer 2**: No concerns (L1 tiebreak concern confirmed fixed). Continued.
- **Layer 3**: No concerns. Continued.
- **Layer 4**: 1 concern — mobile sheet is capped-height (`max-h-[85vh]`) vs spec's full-height `inset-0`; handed to TG14 alongside the deferred hardware-back wiring. Continued.
- **Layer 5**: No concerns (both L4 items confirmed fixed). Continued.
- **Layer 6**: No concerns. Continued.
- **Layer 7**: TG16 audit — all spec test expectations covered; 2 gap tests added; site manual checklist pass (mobile breakpoint code-reviewed, not visually exercisable in automation).

### Spec Compliance
