# Code Review: feat/shape-detail-panel

**Date:** 2026-07-25 | **Base:** main | **Scope:** full
**Commits:** 43 | **Files Changed:** 41 | **Loop:** 1/1

## Affected Packages

- `src/` — library (14 files changed: shape.ts, integration.ts, index.ts, data/*, tests)
- `site/` — Next.js lab site (11 files changed: shapes components, package.json/lockfile)
- `docs/` — API docs (2 files) + README.md + CHANGELOG.md

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix
- [x] Phase 3: Architecture Review
- [ ] Phase 4: Architecture Fix
- [ ] Phase 5: Code Simplification Review
- [ ] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

## Phase 2: Lint/Test Results

All green on first run — no fixes needed. `npm run lint` pass, `npm run build` (tsup + check-dts) pass, `npm test` 1070/1070, `site npm run build` pass. 0 findings.

## Phase 3: Architecture Review

### src (library) + docs

- CR-001: [Important] Inaccurate JSDoc contract on `scalesContainingChord` in `src/integration.ts:505` — claims "no matches" also returns the empty `chord:""` sentinel; in reality a resolvable chord with no matches returns populated `chord`/`root` with empty groups. README/docs/CHANGELOG are correct; only the source JSDoc misleads.
- CR-002: [Suggestion] Whole-corpus recomputation per call in `sweepCorpus` (`src/integration.ts:689`) — 132 input-independent `getScale` resolutions rebuilt on every invocation; a module-scope precomputed table for the default corpus would make the hot path pure set arithmetic.
- CR-003: [Suggestion] `rankContainingScales` (`src/integration.ts:788`) calls `noteChroma` inside the sort comparator (O(n log n) re-derivations); compute root chroma once per candidate in `sweepCorpus`.
- CR-004: [Suggestion] Custom-corpus dedup gap (`src/integration.ts:689`) — user-supplied `options.corpus` with duplicates (or both "aeolian" and "minor") yields duplicate candidates; `[...new Set(corpus)]` would make the "deduped" guarantee uniform.

### site

- CR-005: [Important] `scaleSiblingsFor` in `ShapeDetailPanel.tsx:1139` duplicates the filter/sort logic inside `siblingScaleStepper` (`shapeDetailUtils.ts`) — hidden correctness coupling; stepper index is only meaningful against the locally-recomputed list. Share one `scaleSiblings` helper like the chord path does.
- CR-006: [Important] Failing entries render twice in `ShapeLibrary.tsx:2368/2373` — pinned "Needs attention" section plus their normal grouped section; both carry selection highlight. Verify against D-004 intent: exclude failing entries from grouped grid, or document the double-render as intended.
- CR-007: [Suggestion] Triple `identifyChord` call per chord selection in `ShapeDetailPanel.tsx:1157` (`identified`, `resolveChordName`, `scalesOverChord` each re-derive); collapse into one `shapeDetailUtils` helper returning `{ identified, chordName, scales }`.
- CR-008: [Suggestion] `identifyChord`/`STANDARD` invoked directly in the panel's `buildDetail` (`ShapeDetailPanel.tsx:1162`) — Tonal-derivation boundary bleed; fold into `shapeDetailUtils.ts` (same fix as CR-007).
- CR-009: [Suggestion] `groupScaleEntriesByQuality` in `shapeLibraryUtils.ts:3499` is exported but never wired — dead code that will drift from its by-system sibling.
- CR-010: [Suggestion] Unused imports `CHROMATIC_ROOTS`/`chordRootSelectionResult` in `FilterBar.tsx:14/17` — dead imports; root-chip labeling diverged from its intended data source.

Clean: dependency layers, sentinel error handling, public API surface, hydration safety, peer-dep boundary, replaceState/pushState history model.

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
