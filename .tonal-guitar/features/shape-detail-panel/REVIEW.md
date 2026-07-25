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
- [x] Phase 4: Architecture Fix
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [x] Phase 7: Specialized Reviews
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

## Phase 4: Architecture Fixes

### Fixed

- CR-001: Fixed — JSDoc now distinguishes unresolvable-chord sentinel from resolved-but-no-matches result
- CR-004: Fixed — corpus deduped via `[...new Set(corpus)]` at dispatch; new duplicate-corpus test (1071 tests)
- CR-005: Fixed — shared `scaleSiblings(entry, catalog)` in `shapeDetailUtils.ts`; panel-local duplicate deleted; `siblingScaleStepper` uses it internally
- CR-006: Fixed — failing entries excluded from grouped grid (pinned section is their home); D-004 checked first, doesn't require double placement; `failingOnly` toggle still narrows the grouped grid to failures
- CR-007/CR-008: Fixed — single-pass `chordDetailFor(entry)` helper; panel no longer imports `identifyChord`/`STANDARD`; dead `resolveChordName`/`scalesOverChord` exports removed
- CR-009: Fixed — `groupScaleEntriesByQuality` + orphaned `otherScaleGroupLabel` removed
- CR-010: Fixed — unused FilterBar imports removed

### Deferred

- CR-002/CR-003: GitHub issue #156 — sweep perf refactors (precomputed corpus table, comparator chroma hoist)

### Won't Fix

- (none)

## Phase 5: Code Simplification Review

### src (library)

- CR-011: [Suggestion] `scalesContainingChord` uses let-reassignment for `limitPerGroup` capping (`src/integration.ts:511-542`) — a tiny `capGroup(list, limit)` helper lets both groups be `const`.

### site

- CR-012: [Important] Dead code: `filterCatalog` + `ShapeCatalogFilters` in `shapeLibraryUtils.ts:71-82,178-211` — exported, never consumed; leftover predicate-filter design.
- CR-013: [Suggestion] Dead code: `sortChordEntries` in `shapeLibraryUtils.ts:482-488` — unused.
- CR-014: [Important] Nested ternary building inversion group labels in `shapeDetailUtils.ts:187-194` — extract `groupLabelFor` with if/else.
- CR-015: [Important] `buildDetail` scale branch calls `scaleSiblings` AND `siblingScaleStepper` which recomputes `scaleSiblings` internally (`ShapeDetailPanel.tsx:137-138`, `shapeDetailUtils.ts:337-344`) — stepper should accept the precomputed list like the chord path.
- CR-016: [Important] DRY: `severityRank`/`badgeClassFor`/issue-badge JSX duplicated between `ShapeCard.tsx:25-34,96-108` and `ShapeDetailPanel.tsx:292-325` — hoist to `shapeLibraryUtils.ts` + one shared `IssueBadges` component.
- CR-017: [Important] DRY: `fretSummary` + marker-building/fret-range logic duplicated between `ShapeCardDiagram.tsx:44-87` and `CompactFretboard.tsx:52-80` — export from `ShapeCardDiagram.tsx` alongside `MONOCHROME_THEME`.
- CR-018: [Important] `ShapeCard`'s `memo()` is defeated: `handleSelectEntry` (`ShapeLibrary.tsx:199`) is a fresh closure each render (no `useCallback`) and `LazyShapeCard` isn't memoized — every facet/search keystroke re-renders all visible cards.
- CR-019: [Suggestion] `FeaturedMark` component exists in `ShapeDetailPanel.tsx:327-333` but `ShapeCard.tsx:77-81` re-renders the identical ★ markup inline.
- CR-020: [Suggestion] `siblingAt(offset)` bounds-check closure duplicated between `ChordDetailView` and `ScaleDetailView` (`ShapeDetailPanel.tsx:407-412,784-789`).
- CR-021: [Suggestion] `ShapeDetailPanel.tsx` is 928 lines — well decomposed internally, but `ChordDetailView`/`ScaleDetailView` (+ sections) belong in their own files.

## Phase 6: Simplification Fixes

### Fixed

- CR-011: Fixed (lead) — `capGroup` helper, both ranked groups now `const`
- CR-012: Fixed — dead `filterCatalog`/`ShapeCatalogFilters` removed
- CR-013: Fixed — dead `sortChordEntries` removed
- CR-014: Fixed — `groupLabelFor` if/else helper replaces nested ternary
- CR-015: Fixed — `siblingScaleStepper(entry, siblings)` takes precomputed list; single `scaleSiblings` computation in `buildDetail`
- CR-016: Fixed — `severityRank`/`badgeClassFor` hoisted to `shapeLibraryUtils.ts`; new shared `IssueBadges.tsx` consumed by card + panel
- CR-017: Fixed — `fretSummary`/`buildFretMarkers`/`fretRangeFor` exported from `ShapeCardDiagram.tsx`, imported by `CompactFretboard.tsx`
- CR-018: Fixed — `handleSelectEntry` in stable `useCallback` (ref-based), `LazyShapeCard` memoized; card-tree props referentially stable
- CR-019: Fixed — `FeaturedMark` moved to `IssueBadges.tsx`, reused by `ShapeCard` (no panel import — chunk split verified intact)
- CR-020: Fixed — shared `siblingIndexAt` helper for both detail views

### Deferred

- CR-021: GitHub issue #157 — split `ShapeDetailPanel.tsx` into view files

### Won't Fix

- (none)

## Phase 7: Specialized Reviews

### Security

0 findings. No XSS sinks; `buildReportUrl` encodes via `encodeURIComponent` against a hardcoded base; `parseShapesUrlState` has no dynamic-key assignment (no prototype-pollution vector); history API fed only by `URLSearchParams`-built strings; no secrets; dependency additions are the official Tonal peer family.

### Type Safety

- CR-022: [Important] Unvalidated `as ChordQualityGroup` cast of URL param in `ShapeLibrary.tsx:116` — `parseShapesUrlState` validates `kind` and `sort` against their literal unions but passes `qualityGroup` through as bare `string`; a stale `?qualityGroup=` link violates the union. Validate at parse time (type the field `ChordQualityGroup | undefined`).

Cleared: no `any`/`as any` anywhere; Tonal `getChord`/`getScale` results guarded; `.find()` results guarded; optional shape fields explicitly checked; the two discriminant-correlated casts reviewed and judged sound.

### Accessibility

- CR-023: [Critical] Focus lost to `<body>` on panel close when there is no captured trigger (deep-linked `?shape=` open) — `ShapeLibrary.tsx:251-264` only refocuses `lastTriggerRef.current`, which stays null for URL-opened panels; add a stable fallback focus target.
- CR-024: [Important] "Showing N of M" `aria-live` region re-announces per search keystroke (`FilterBar.tsx:143-145`) — debounce the live-region text independent of instant filtering.
- CR-025: [Important] Root-strip chips convey zero-match via opacity alone (`FilterBar.tsx:287-298`) — other facet rows show a visible count; root chips bury it in `title`/`aria-label`. Add a visible count.
- CR-026: [Important] Panel is last in DOM/tab order and focus never moves into it on open (`ShapeLibrary.tsx:497`) — keyboard users must tab through the whole grid to reach it; focus the panel container (`tabIndex={-1}`) on open per the non-modal disclosure pattern.

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
