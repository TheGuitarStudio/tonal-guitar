# Code Review: feat/minor-quality-shape-relabeling

**Date:** 2026-07-13 | **Base:** main | **Scope:** full
**Commits:** 22 | **Files Changed:** 26 | **Loop:** 1/3

## Affected Packages

- `src/` (library) — 11 files changed (transform.ts, integration.ts, index.ts, shape.ts, data/\*, tests)
- `docs/` — 5 files changed (PLAN.md, api/index.md, api/integration.md, api/shapes.md, api/transform.md)
- Root docs — CLAUDE.md, README.md, CHANGELOG.md
- Meta — .tonal-guitar feature files, package-lock.json

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix (all checks passed, 0 issues)
- [x] Phase 3: Architecture Review
- [x] Phase 4: Architecture Fix
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

## Phase 2: Lint/Test Results

All checks passed on first run (lint clean, build clean, 922/922 tests). No findings.

## Phase 3: Architecture Review

### src (library)

- CR-001: [Important] `buildFromScale` relabel fallback produces self-inconsistent `FrettedScale` in `src/integration.ts:161` — when `relabelShape` returns `undefined` (non-rotation-compatible pair), the unrelabeled shape is built but still stamped with the requested `scaleName`/`scaleType`, so the notes don't match the claimed scale. Note: the non-empty fallback itself is spec-mandated (spec.md:213); the open question is only the labeling.
- CR-002: [Suggestion] `relabelOrThrow` throws at import time in `src/data/caged-scales-minor.ts:36` and `src/data/pentatonic-minor.ts:378` — deviates from "no exceptions" convention; a broken invariant crashes `import "tonal-guitar"` entirely. Deliberate, documented fail-fast covered by tests.
- CR-003: [Suggestion] `chromaOf` helper duplicated verbatim in `src/transform.ts:22` and `src/integration.ts:394` — could be exported from transform.ts (already imported by integration.ts) to remove the copy.

### docs

- CR-004: [Important] Stale shape inventory in `docs/api/index.md:57` — count says 22 shapes and table omits the 10 new registered entries (5 minor CAGED + 5 minor pentatonic); should be 32 with two new rows, consistent with README.md and docs/api/shapes.md.
- CR-005: [Important] `modeShapes("A minor", "caged")` example output order wrong in `README.md:667` and `docs/api/integration.md:182` — shows Em/Am/Dm/Gm/Cm but registration order (= `all()` return order) is Dm, Cm, Am, Gm, Em; contradicts docs/api/shapes.md's correct example.
- CR-006: [Important] `CHANGELOG.md:24` conflates filtered and unfiltered queries — says `modeShapes("A minor", "caged")` returns "the 10 new registered minor-quality entries" but the caged-filtered call returns only the 5 minor CAGED entries; 10 requires the unfiltered call.
- CR-007: [Important] Broken examples using `get("CAGED E Shape")` in `docs/api/integration.md:9,25,32,86` and `docs/api/index.md:10,43` — registered name is `"E Shape"`, so `get()` returns `undefined` and the examples throw; README was fixed in this PR, these files were not.
- CR-008: [Suggestion] `docs/api/integration.md:30` uses `get("3NPS Pattern 1")` — registered name is `"3NPS Pattern 1 (Ionian)"`; pre-existing, adjacent to CR-007 fixes.

## Phase 4: Architecture Fixes

### Fixed

- CR-004: Fixed — docs/api/index.md shape count 22 → 32, added Minor CAGED Scales (5) and Minor Pentatonic (5) rows
- CR-005: Fixed — corrected `modeShapes("A minor", "caged")` example order to registration order (Dm, Cm, Am, Gm, Em) in README.md and docs/api/integration.md
- CR-006: Fixed — CHANGELOG.md now uses unfiltered `modeShapes("A minor")` for the 10-entry claim
- CR-007: Fixed — `get("CAGED E Shape")` → `get("E Shape")` in docs/api/integration.md and docs/api/index.md; **extended repo-wide**: verification showed 43 broken occurrences of `"CAGED {E,D,C,A,G} Shape"` (registered names have no "CAGED " prefix) across README.md, docs/api/{shapes,patterns,sequences}.md, and site/content/docs/*.mdx — all fixed, 0 remaining
- CR-008: Fixed — `get("3NPS Pattern 1")` → `get("3NPS Pattern 1 (Ionian)")`; extended to remaining bare occurrences in README.md, docs/api/shapes.md, docs/PLAN.md, site/content/docs/{integration,shapes}.mdx; also updated stale `names()` output examples (trailing entry is now "Pentatonic Box 5 Minor")

### Deferred

- CR-001: GitHub issue #87 — fallback labeling is a design decision; the non-empty fallback itself is spec-mandated (spec.md:213)
- CR-003: GitHub issue #88 — chromaOf dedupe widens transform.ts public surface; needs a call

### Won't Fix

- CR-002: `relabelOrThrow` import-time throw is a deliberate, documented fail-fast for a data invariant fully covered by tests; the "no exceptions" convention governs runtime API functions, not import-time data integrity checks

Verification: lint clean, build clean, 922/922 tests, site `npm run build` clean.

## Phase 5: Code Simplification Review

### src (library)

- CR-009: [Suggestion] Mod-12 normalization `((x % 12) + 12) % 12` appears three times in `src/transform.ts:23,67,81` — `chromaOf` encapsulates it but lines 67/81 re-implement inline; extract a shared `mod12` helper.
- CR-010: [Important] `tonicOffset as number` and `targetByChroma.get(newChroma) as string` casts in `src/transform.ts:81,83` — bind `const t = tonicOffset` after the undefined-check so TS narrows across the nested closures, avoiding both assertions. (Upgraded from Suggestion: type-safety criteria treat avoidable `as` assertions as Important.)
- CR-011: [Suggestion] `positionSet`/`minorPositionSet` helpers duplicated verbatim between describe blocks in `src/data/data.test.ts:745` and `src/data/data.test.ts:856` — share one file-level helper pair.
- CR-012: [Suggestion] Redundant explicit `parentShape: X.name` in every `relabelOrThrow` call in `src/data/caged-scales-minor.ts:44-72` and `src/data/pentatonic-minor.ts:54-102` — `relabelShape` already defaults `parentShape` to `shape.name` (`src/transform.ts:108`).

Triage note: all four are < 20-line localized cleanups; fixing directly in Phase 6 instead of filing issues.

## Phase 6: Code Simplification Fixes

### Fixed

- CR-009: Fixed — module-private `mod12()` helper in transform.ts, used by `chromaOf` and both inline sites
- CR-010: Fixed — narrowed `const offset = tonicOffset` binding + explicit `if (mapped === undefined) return undefined` guard; both `as` casts removed, sentinel-return convention preserved
- CR-011: Fixed — `positionSet`/`minorPositionSet` hoisted to file-level helpers in data.test.ts, duplicates removed
- CR-012: Fixed — redundant `parentShape: X.name` options removed from all `relabelOrThrow` calls (defaults to `shape.name` in relabelShape)

Verification: lint clean, build clean, 922/922 tests.

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
