# Code Review: feat/minor-quality-shape-relabeling

**Date:** 2026-07-13 | **Base:** main | **Scope:** full
**Commits:** 22 | **Files Changed:** 26 | **Loop:** 3/3 | **PR:** #89

## Affected Packages

- `src/` (library) — 11 files changed (transform.ts, integration.ts, index.ts, shape.ts, data/\*, tests)
- `docs/` — 5 files changed (PLAN.md, api/index.md, api/integration.md, api/shapes.md, api/transform.md)
- Root docs — CLAUDE.md, README.md, CHANGELOG.md
- Meta — .tonal-guitar feature files, package-lock.json

## Review Progress (Loop 3)

- [x] Phase 2: Lint/Test Fix (all checks passed, 0 issues)
- [x] Phase 3: Architecture Review (0 findings; 1 courtesy fix CR-017)
- [x] Phase 4: Architecture Fix (CR-017 applied)
- [x] Phase 5: Code Simplification Review (delta — no changes since loop 2's clean pass)
- [x] Phase 6: Code Simplification Fix (nothing to fix)
- [x] Phase 7: Specialized Reviews (delta — src production code unchanged since loop 1's clean passes)
- [x] Phase 8: Specialized Fixes (nothing to fix)
- [x] Phase 9: Final Verification

Loop 3 focus: verify loop-2 fixes (CR-013/14 doc examples, CR-015 test delegation); CR IDs continue from CR-016. Loops 1–2 completed all phases (see summaries).

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

## Loop 2 — Phase 5: Code Simplification Review

- CR-015: [Suggestion] `minorPositionSet` in `src/data/data.test.ts:88` duplicates `positionSet`'s body instead of delegating after resolving the shape — leftover from the loop-1 hoist.
- CR-016: [Suggestion] `relabelOrThrow` defined identically in `src/data/caged-scales-minor.ts:30` and `src/data/pentatonic-minor.ts:378` (only the error-message context string differs); could be hoisted to a shared internal helper.

All loop-1 simplification fixes verified clean; no other issues.

## Loop 2 — Phase 6: Code Simplification Fixes

### Fixed

- CR-015: Fixed — `minorPositionSet` now delegates to `positionSet(root, shape!)`. Lint clean, 922/922 tests.

### Won't Fix

- CR-016: Two copies is below the review's own 3+ DRY threshold; extraction would add a new internal data/ module (CLAUDE.md layout churn) to share ~10 lines of build-time guard logic with per-file error context. Premature abstraction.

## Loop 2 — Phase 7: Specialized Reviews

Delta review: production code in src/ is byte-identical to what loop 1's security and type-safety agents cleared (0 findings each). The only src/ change since is CR-015's 3-line test-helper delegation — no casts, no `any`, non-null assertion guarded by `toBeDefined()` per existing test convention, no new input surface. Re-running the full agents was skipped as redundant. Accessibility remains N/A.

## Loop 2 — Phase 8: Specialized Fixes

No findings to fix.

## Loop 3 — Phase 3: Architecture Review / Verification

Fresh-eyes agent verified both loop-2 fixes correct (names() ordering matches registration order end-to-end; minorPositionSet delegation faithful) and swept all changed hunks: rootString tables, transform.md worked example (t=9), modeShapes/isShapeCompatible claims, and the 32-shape count basis (27 scale shapes + 5 CAGED chord shapes) all verified. NO FINDINGS.

- CR-017: [Suggestion, courtesy fix] `site/content/docs/index.mdx:56` still said "22 shapes" with the pre-feature inventory table — same class as CR-004. Fixed: 32 shapes + Minor CAGED Scales / Minor Pentatonic rows. Site build verified.

## Statistics

- Loop 1 findings: 12 total — 0 Critical, 6 Important (5 fixed, 1 deferred), 6 Suggestion (4 fixed, 1 deferred, 1 won't fix)
- Loop 2 findings: 4 total — 0 Critical, 1 Important (fixed), 3 Suggestion (2 fixed, 1 won't fix)
- Loop 3 findings: 1 courtesy fix (CR-017), 0 review findings
- GitHub Issues Created: #87 (CR-001 fallback labeling), #88 (CR-003 chromaOf dedupe)
- Total Commits: 12 | Total Fixes: 13 | Final Status: **PASS** (0 Critical open, lint/build/922 tests/site build all green)

## Loop 3 Summary

- Findings: 0 (both loop-2 fixes independently verified correct; full consistency sweep clean)
- Courtesy fix: CR-017 (stale site mdx shape inventory)
- The pipeline converged: loop 1 found 12, loop 2 found 4 (including one silently-failed loop-1 fix), loop 3 found 0

## Loop 2 Summary

- Findings: 4 total (0 Critical, 1 Important, 3 Suggestion) — CR-013..CR-016
- Fixed: 3 (stale `names()` ordering examples in docs/api/shapes.md + site mirror; test-helper delegation) | Won't Fix: 1 (relabelOrThrow dedup — below DRY threshold)
- Notable: loop 2 caught a loop-1 fix that silently failed to apply (the trailing `names()` entry sed never matched after an earlier sed rewrote the line) — exactly the class of issue --loop exists for
- src production code verified unchanged since loop 1's clean security/type-safety passes

## Loop 1 Summary

- Findings: 12 total (0 Critical, 6 Important, 6 Suggestion)
- Fixed: 9 | Deferred: 2 (#87, #88) | Won't Fix: 1 (CR-002 deliberate fail-fast)
- Commits: 7 (phases 2, 3, 4, 5, 6, 7, 9)
- Highlights: repo-wide fix of broken `get("CAGED X Shape")` doc examples (43 occurrences); `as`-cast removal in transform.ts; modeShapes example-order and shape-inventory corrections
