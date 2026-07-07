# Code Review: feat/extended-chord-shapes-import

**Date:** 2026-07-06 | **Base:** main | **Scope:** full
**Commits:** 19 | **Files Changed:** 13 (5 implementation) | **Loop:** 1/3

## Affected Packages

- `tonal-guitar` (single-package library) — `src/data/extended-chords.ts`, `src/data/extended-chords.test.ts`, `src/data/data.test.ts`, `src/index.ts`, `docs/api/arpeggios.md`

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

All clean on entry — lint pass, build (tsup + DTS) pass, 803/803 tests pass. 0 issues, no CR IDs assigned.

## Phase 3: Architecture Review

### tonal-guitar

- CR-001: [Important] `voicingFamily: "caged"` on all 30 extended shapes in `src/data/extended-chords.ts` dilutes the `caged` query bucket — `query({ voicingFamily: "caged" })` now returns extended/altered grips alongside CAGED triads/7ths, and `data.test.ts` needed a name-exclusion workaround. Note: spec §Data Model and decisions.md explicitly mandate `voicingFamily: "caged"`, so changing this requires a spec-level decision (e.g., adding an `extended` VoicingFamily member).
- CR-002: [Suggestion] Exact-count assertions in `src/data/extended-chords.test.ts:359-390` depend on vitest per-file module isolation and in-order execution; a future `isolate: false` or `--sequence.shuffle` config change would fail them confusingly. Make order-independent (reset+re-register in beforeAll, or `>=`/membership assertions).
- CR-003: [Suggestion] `src/data/extended-chords.test.ts:544` asserts `names.length > EXTENDED_CHORD_SHAPES.length` after dynamically importing four data files — holds even if 3 of 4 side-effect imports silently fail. Assert the known contribution or a specific non-extended name.

No Critical findings. Registry wiring, registration block, ChordShape field usage, and data.test.ts parameterization confirmed correct.

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
