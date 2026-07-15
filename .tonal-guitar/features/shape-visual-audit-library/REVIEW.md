# Code Review: feat/shape-visual-audit-library

**Date:** 2026-07-14 | **Base:** main | **Scope:** full
**Commits:** 34 | **Files Changed:** 26 | **Loop:** 1/2

## Affected Packages

- `src/` (library) — 5 files changed (audit.ts, audit.test.ts, data/data.test.ts, index.ts, version.ts)
- `site/` (site) — 9 files changed (shapes page: components, utils, layout, page)
- `docs/` (docs) — 2 files changed (api/audit.md, api/index.md)

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix
- [x] Phase 3: Architecture Review
- [x] Phase 4: Architecture Fix
- [ ] Phase 5: Code Simplification Review
- [ ] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred

## Phase 2: Lint/Test Results

All checks passed with 0 issues: `npm run lint`, `npm run build` (tsup + dts check), `npm test` (1001 tests, 11 files), and `site/` `npm run build` (Next.js, 15 static pages).

## Phase 3: Architecture Review

### src/ (library)

- CR-001: [Suggestion] Redundant `applyChordShape` recomputation in `src/audit.ts:402-417` — within one `auditChordShape` pass, `checkFretSpan`, `checkChordBuildLoss`, and `checkGeometryMismatch` each rebuild the shape with identical/near-identical arguments; the aggregate could hoist one build and pass it in. Status: Open
- CR-002: [Suggestion] `AuditSeverity` includes `"info"` in `src/audit.ts:20` but no check ever emits it — reserved value implies a code path that doesn't exist; comment or remove. Status: Open

Verified clean: no layer violations (`audit.ts` imports only `./build`, `./shape`, `./tuning`, `@tonaljs/note`), no circular deps, audit invariant logic correct, public API surface consistent (`gripRootFor`/`sourceFrets` withheld from index.ts), purity/naming conventions honored, `VERSION` matches package.json.

### site/

- CR-003: [Important] `site/app/shapes/components/ShapeLibrary.tsx:25-26` — `auditAllShapes()` + `buildCatalog()` run client-side on mount though their inputs are fully static; the catalog could be built in the server component `page.tsx` and passed as a serializable prop, leaving only filter/sort interactivity client-side. Status: Open
- CR-004: [Important] `site/app/shapes/components/ShapeLibrary.tsx:104-108` — grid mounts all filtered ShapeCards (up to 159 Fretboard subtrees) simultaneously with no virtualization; `content-visibility: auto` defers paint but React still mounts/reconciles every subtree up front. Status: Open
- CR-005: [Suggestion] `site/app/shapes/components/ShapeCard.tsx:224` — `buildReportUrl` eagerly JSON-stringifies + URL-encodes a large report body for every card at mount though the link is rarely clicked; compute on click/focus instead. Status: Open
- CR-006: [Suggestion] `site/app/shapes/components/ShapeCard.tsx` — 233 lines exceeds the ~200-line guideline; the chord interval/finger/fret table block would extract cleanly into a presentational subcomponent. Status: Open

Verified clean: no `useEffect` misuse (all derived data via `useMemo`), business logic extracted to `shapeLibraryUtils.ts`, stable list keys, server/client split follows existing site convention.

### docs

- CR-007: [Important] `CLAUDE.md:40` — source-layout tree describes `audit.ts` as "six checkX fns" but the module exports eight (`checkScaleBuildLoss` and `checkScaleMetadataCompleteness` uncounted); six is only the chord-specific subset. Status: Open

Verified clean: all documented signatures in `docs/api/audit.md` match real exports, worked examples numerically reproduce (`OPEN_G_AUG` traces), all new public exports documented, CLAUDE.md dependency-layer claims match actual imports.

## Phase 4: Architecture Fixes

### Fixed

- CR-007: Fixed — CLAUDE.md source-layout line now reads "eight checkX fns: six chord + two scale". Lint + 1001 tests pass.

### Deferred

- CR-001: GitHub issue #115 — hoisting shared applyChordShape build is a design trade-off (self-contained checks), only worth it if profiling shows need
- CR-002: GitHub issue #116 — unused "info" severity; document-or-remove decision
- CR-004: GitHub issue #117 — virtualization/windowing is not a <20-line change
- CR-005: GitHub issue #118 — lazy report-URL computation
- CR-006: GitHub issue #119 — ShapeCard subcomponent extraction

### Won't Fix

- CR-003: Measured the trade-off: client-side `auditAllShapes()` + catalog build costs ~11ms one-time (8.8ms audit + 1.8ms builds), while server-building would inline ~200KB of serialized catalog JSON into the static page (measured 187KB for the approximate entry set) against a total first-load JS of 111KB. Also `auditAllShapes()` returns `Map`s, which don't serialize across the RSC boundary without conversion. The current client-side build is the better trade.
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
