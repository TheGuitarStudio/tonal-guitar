# Code Review: feat/minor-quality-shape-relabeling

**Date:** 2026-07-13 | **Base:** main | **Scope:** full
**Commits:** 22 | **Files Changed:** 26 | **Loop:** 2/3 | **PR:** #89

## Affected Packages

- `src/` (library) — 11 files changed (transform.ts, integration.ts, index.ts, shape.ts, data/\*, tests)
- `docs/` — 5 files changed (PLAN.md, api/index.md, api/integration.md, api/shapes.md, api/transform.md)
- Root docs — CLAUDE.md, README.md, CHANGELOG.md
- Meta — .tonal-guitar feature files, package-lock.json

## Review Progress (Loop 2)

- [x] Phase 1: Setup (carried over)
- [x] Phase 2: Lint/Test Fix (all checks passed, 0 issues)
- [x] Phase 3: Architecture Review (2 findings)
- [x] Phase 4: Architecture Fix
- [ ] Phase 5: Code Simplification Review
- [ ] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

Loop 2 focus: re-review including all loop-1 fix commits; CR IDs continue from CR-012.

<details><summary>Loop 1 phase log (completed)</summary>

- Phases 1–9 all completed; see phase sections below and Loop 1 Summary.

</details>

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

## Phase 7: Specialized Reviews

### Security (src)

No findings. Verified: Map-based registries immune to prototype pollution; no new regexes (no ReDoS surface); relabelShape bounded by input sizes; malformed interval strings degrade to NaN chromas handled safely by Map/Set semantics (sentinel returns, no crashes); no new dependencies (package.json untouched; @tonaljs/interval already a declared peer dep).

### Type Safety (src)

No findings. Verified: no `any`/`as any`/`as Type` assertions in the diff; `ScaleShape | undefined` returns consistently narrowed with explicit checks; `quality`/`parentShape` optional fields populated consistently; explicit return types on new exports; non-null assertions confined to tests behind `toBeDefined()` guards.

### Accessibility

Skipped — no UI components affected (branch changes are library code + docs; the mdx edits from Phase 4 touched code-example text only).

## Phase 8: Specialized Fixes

No findings to fix.

## Loop 2 — Phase 3: Architecture Review

### src (library)

No findings. The loop-1 transform.ts Step-4 rewrite was verified exactly behavior-equivalent (the new undefined guard is provably unreachable — every Step-4 chroma is in `parentChromas`, and Step 3 only selects offsets where all parent chromas map); `parentShape` default removal verified against source names; dependency layering and registry side-effects intact.

### docs

- CR-013: [Important] Stale `names()` example in `docs/api/shapes.md:84` — loop 1 renamed entries but the listing skipped the 5 minor CAGED names between "G Shape" and the 3NPS entries, and closed with "Pentatonic Box 5" instead of the actual last entry "Pentatonic Box 5 Minor" (the loop-1 sed for the trailing entry never matched because an earlier sed had already rewritten the line).
- CR-014: [Suggestion] Same stale listing in `site/content/docs/shapes.mdx:80`.

## Loop 2 — Phase 4: Architecture Fixes

### Fixed

- CR-013, CR-014: Fixed — both `names()` examples now list E/D/C/A/G, then Dm/Cm/Am/Gm/Em, then "3NPS Pattern 1 (Ionian)", ..., "Pentatonic Box 5 Minor", matching registration order in src/index.ts. Verified: tests 922/922, site build clean.

## Statistics

- Loop 1 findings: 12 total — 0 Critical, 6 Important (5 fixed, 1 deferred), 6 Suggestion (4 fixed, 1 deferred, 1 won't fix)
- GitHub Issues Created: #87 (CR-001 fallback labeling), #88 (CR-003 chromaOf dedupe)
- Total Commits: 7 | Total Fixes: 9 | Loop 1 Status: **PASS** (0 Critical open, lint/build/922 tests/site build all green)

## Loop 1 Summary

- Findings: 12 total (0 Critical, 6 Important, 6 Suggestion)
- Fixed: 9 | Deferred: 2 (#87, #88) | Won't Fix: 1 (CR-002 deliberate fail-fast)
- Commits: 7 (phases 2, 3, 4, 5, 6, 7, 9)
- Highlights: repo-wide fix of broken `get("CAGED X Shape")` doc examples (43 occurrences); `as`-cast removal in transform.ts; modeShapes example-order and shape-inventory corrections
