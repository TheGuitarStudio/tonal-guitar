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
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [x] Phase 7: Specialized Reviews
- [x] Phase 8: Specialized Fixes
- [x] Phase 9: Final Verification

## Statistics (Loop 1)

- Findings: 26 total — 2 Critical (both fixed), 14 Important (10 fixed, 3 deferred, 1 won't-fix), 10 Suggestion (5 fixed inline, 5 deferred)
- Fixed: 17 | Deferred: 8 | Won't Fix: 1
- GitHub Issues Created: #115, #116, #117, #118, #119, #120, #121, #122
- Review Commits (loop 1): 8 | Loop 1 Status: PASS (all Critical fixed; lint, build, 1001 tests, and site build green)

## Loop 1 Summary

- Findings: 26 total (2 Critical, 14 Important, 10 Suggestion)
- Fixed: 17 | Deferred: 8 | Won't Fix: 1
- Commits: 8
- Phase 2 was clean (no lint/test/build failures); security review had zero findings; both Criticals (unvalidated unknown→number[] cast; inaccessible scale-shape diagrams) came from the specialized reviews and were fixed.

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

## Phase 5: Code Simplification Review

### src/ (library)

- CR-008: [Important] Six near-identical "registry-wide: no registered shape fails checkX" blocks in `src/audit.test.ts:434-449,503-518,552-566,630-644,756-776` — same three-line sweep shape varying only in source array, check invocation, and label; a shared `expectRegistryClean(shapes, check, label)` helper would collapse ~50 lines. Status: Open
- CR-009: [Suggestion] Terse local `gr` for "grip root" in `src/audit.ts:305-388` — rename to `gripRoot` so call sites are self-explanatory (details object already writes `gripRoot: gr`). Status: Open

Otherwise clean: no dead code, complexity, comment, or performance issues; the `data.test.ts` refactor to reuse audit checks is genuine deduplication.

### site/

- CR-010: [Important] `site/app/shapes/components/ShapeCard.tsx:78-105` — properties array built via seven near-identical conditional spreads with manual casts; mirror `metadataLines`' pairs-then-filter pattern to drop the casts and halve the block. Status: Open
- CR-011: [Important] `ShapeCatalogEntry.shape` typed `ScaleShape | ChordShape` without tying to the `kind` discriminant — forces ~9 unsafe `as ChordShape`/`as ScaleShape` casts across ShapeCard.tsx and shapeLibraryUtils.ts; a discriminated union removes every cast. Status: Open
- CR-012: [Important] Nested ternary in `site/app/shapes/components/FilterBar.tsx:152-156` radius calculation — use if/else chain. Status: Open
- CR-013: [Important] `site/app/shapes/components/shapeLibraryUtils.ts:90-128` — byte-for-byte reimplementation of `src/audit.ts` non-exported internals (`OPEN_NAME_ROOT_RE`, `gripRootFor`, `computeSourceFrets`) with nothing enforcing sync; durable fix is exporting the helper from the library instead of re-deriving in site. Status: Open
- CR-014: [Suggestion] `distinctVoicingFamilies`/`distinctQualities` in `site/app/shapes/components/shapeLibraryUtils.ts:286-300` structurally identical — could collapse to a generic helper; only two call sites, optional. Status: Open
- CR-015: [Suggestion] `ToggleGroup` options array literal recreated per render in `site/app/shapes/components/FilterBar.tsx:74-78` — hoist to module constant like `LEGEND`. Status: Open
- CR-016: [Suggestion] `auditAllShapes` imported as value in `site/app/shapes/components/shapeLibraryUtils.ts:8-18` but only used in a `typeof` type position — move to the `import type` block. Status: Open
- CR-017: [Suggestion] Repo slug `"TheGuitarStudio/tonal-guitar"` duplicated in `site/app/shapes/components/shapeLibraryUtils.ts:306` and `site/app/layout.config.tsx:29` — shared constant would avoid drift. Status: Open

## Phase 6: Code Simplification Fixes

### Fixed

- CR-008: Fixed — shared `expectRegistryClean` helper in audit.test.ts replaces all six registry-wide sweep blocks
- CR-009: Fixed — `gr` renamed to `gripRoot` throughout audit.ts (details object now uses shorthand)
- CR-010: Fixed — ShapeCard properties block rewritten as pairs array + filter, matching `metadataLines` pattern; casts dropped
- CR-011: Fixed — `ShapeCatalogEntry` is now a discriminated union (base + scale/chord variants; `sourceFrets`/`gripRoot` chord-only); all ~9 casts removed across shapeLibraryUtils.ts and ShapeCard.tsx. Triage note: exceeded the 20-line guideline but was mechanical and compiler-verified (`tsc --noEmit` + site build). One typing-driven change: `buildReportUrl`'s `if (entry.sourceFrets)` became `if (entry.kind === "chord" && entry.sourceFrets)` — behavior identical.
- CR-012: Fixed — FilterBar nested ternary replaced with if/else chain
- CR-015: Fixed — ToggleGroup options hoisted to module-level `KIND_TOGGLE_OPTIONS`
- CR-016: Fixed — `auditAllShapes` moved to the `import type` block

Triage note: trivial Suggestions (CR-009, CR-015, CR-016) were fixed inline rather than deferred — each was a one-liner cheaper to fix than to file.

### Deferred

- CR-013: GitHub issue #120 — needs a public-API design decision (export audit internals vs sync-guard test vs always-populated details)
- CR-014: GitHub issue #121 — optional generic-helper abstraction, only two call sites
- CR-017: GitHub issue #122 — needs a decision on where site-wide constants live

Verification: `npm run lint` + `npm run build` + `npm test` (1001 tests) pass at root; `tsc --noEmit` + `npm run build` pass in site/ (15 pages, /shapes at 4.38 kB).

## Phase 7: Specialized Reviews

### Security

No findings. Verified: no `dangerouslySetInnerHTML`/`eval`; `buildReportUrl` host is hardcoded and both interpolated segments fully `encodeURIComponent`-encoded; all report data originates from compile-time registries, never user input; filter inputs used only for array filtering; the one `target="_blank"` link has `rel="noopener"`; no URL/query-param parsing exists; library changes introduce no logging/secrets/dynamic execution.

### Type Safety

- CR-018: [Critical] `site/app/shapes/components/ShapeCard.tsx:44` — `issue?.details?.mismatchedStrings` (typed `unknown`) is cast `raw as number[]` after only an `Array.isArray` check; element types unvalidated. Guard with a `typeof v === "number"` filter/predicate. Status: Open
- CR-019: [Important] `src/audit.ts:328` — exported `sourceFrets` does `shape.baseFret as number` with no internal guard; called directly with an undefined `baseFret`, the octave-lift loop silently no-ops producing wrong-but-plausible frets. Accept `baseFret: number` as an explicit parameter (like `gripRoot`) or guard loudly. Status: Open
- CR-020: [Important] `site/app/shapes/components/FilterBar.tsx:16-19,84` — `KIND_TOGGLE_OPTIONS` typed `{value: string}[]` then `v as ShapeKind` cast at the call site; type the array's `value` as the literal union (making `ToggleGroup` generic) so the cast disappears and future edits are compiler-checked. Status: Open

Otherwise clean: no `any`/`as any`, no non-null assertions, discriminated union consumed correctly everywhere, explicit return types present, index accesses bounded.

### Accessibility

- CR-021: [Critical] `site/app/shapes/components/ShapeCard.tsx:146` + `ShapeCardDiagram.tsx:54` — scale-shape cards render the fret/interval table only for chords, and the `Fretboard` SVG has no `aria-label`/`role="img"`/`<title>`, so screen-reader users get zero content for the ~27 scale cards. Status: Open
- CR-022: [Important] `site/app/shapes/components/ShapeCardDiagram.tsx:54-65` — diagram not marked decorative where the chord table duplicates it; SVG text nodes surface as an unstructured character stream. Status: Open
- CR-023: [Important] `site/app/shapes/components/FilterBar.tsx:164-176` — Scale/Chord toggle conveys selection by styling only; no `aria-pressed`. Status: Open
- CR-024: [Important] `site/app/shapes/components/ShapeCard.tsx:25-33,192-197` — `text-amber-600` on `bg-amber-500/10` (~2.95:1) and `text-red-600` (~4.24:1) fail WCAG AA 4.5:1 for the 11px badge/mismatch text in light theme. Status: Open
- CR-025: [Important] `site/app/shapes/components/ShapeCard.tsx:111` — cards use `<h3>` but the page has only an `<h1>`; h1→h3 skips a level. Status: Open
- CR-026: [Suggestion] `site/app/shapes/components/FilterBar.tsx:134-136` — "Showing N of M" count updates silently; add `aria-live="polite"`. Status: Open

Note: skill map prescribes a `superpowers:code-reviewer` agent for accessibility; that plugin isn't installed, so `feature-dev:code-reviewer` was used.

## Phase 8: Specialized Fixes

### Fixed

- CR-018: Fixed — `mismatchedStringsFor` validates elements with a `typeof v === "number"` type-predicate filter instead of the blind cast
- CR-019: Fixed — `sourceFrets` now takes `baseFret: number` as an explicit parameter; internal cast removed; caller and test call site updated (docs needed no change — the doc only shows `sourceFrets` as a details field, not a signature)
- CR-020: Fixed — `ToggleGroup` made generic over its value type; `KIND_TOGGLE_OPTIONS` typed with `ShapeKind`; cast removed
- CR-021 + CR-022: Fixed together — diagram wrapper now has `role="img"` with a computed aria-label ("name at root, frets low to high: …"); gives scale cards accessible content and makes SVG internals presentational for chord cards
- CR-023: Fixed — `aria-pressed={active}` on toggle buttons
- CR-024: Fixed — light-mode badge/mismatch text darkened to `text-amber-700`/`text-red-700` (≥4.5:1 verified against the 10%-tint backgrounds), original shades kept for dark mode via `dark:` variants
- CR-025: Fixed — sr-only `<h2>Shape results</h2>` added above the grid in ShapeLibrary
- CR-026: Fixed inline (trivial Suggestion) — `aria-live="polite"` on the results count

### Deferred / Won't Fix

- (none)

Verification: `npm run lint` + `npm run build` + `npm test` pass at root; `tsc --noEmit` + `npm run build` pass in site/.
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
