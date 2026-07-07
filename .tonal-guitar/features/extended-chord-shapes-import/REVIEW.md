# Code Review: feat/extended-chord-shapes-import

**Date:** 2026-07-06 | **Base:** main | **Scope:** full
**Commits:** 19 | **Files Changed:** 13 (5 implementation) | **Loop:** 1/3

## Affected Packages

- `tonal-guitar` (single-package library) — `src/data/extended-chords.ts`, `src/data/extended-chords.test.ts`, `src/data/data.test.ts`, `src/index.ts`, `docs/api/arpeggios.md`

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix
- [x] Phase 3: Architecture Review
- [x] Phase 4: Architecture Fix
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
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

## Phase 4: Architecture Fixes

### Fixed

- (none — no fixable findings)

### Deferred

- CR-001: GitHub issue #47 — VoicingFamily design question; conflicts with documented spec decision (D-002)
- CR-002: GitHub issue #48 — test order/isolation robustness
- CR-003: GitHub issue #49 — stronger cross-registry import assertion

### Won't Fix

- (none)

## Phase 5: Code Simplification Review

### tonal-guitar

- CR-004: [Important] Three near-identical tier-coverage `it` blocks in `src/data/extended-chords.test.ts:370-388` (Tier 1/2/3 each loop a chordType array asserting query count === 2) — collapse into one parametrized test.
- CR-005: [Important] Duplicated assertions in `src/data/extended-chords.test.ts` — aug7 registry-emptiness asserted at :392-398 AND :479-494; `detected[0] === "C7#5"` duplicated between the divergence-catalog test and the per-shape harness. Keep one home (divergence catalog), drop redundant copies.
- CR-006: [Suggestion] Divergence-catalog tests assert third-party `Chord.get` behavior (`.symbol`/`.intervals`/`.empty`) — flagged as testing library-not-repo behavior.
- CR-007: [Important] New test code fails `prettier --check` — `src/data/extended-chords.test.ts` (several lines) and `src/data/data.test.ts:623-625` weren't run through `npm run format`.

## Phase 6: Code Simplification Fixes

### Fixed

- CR-004: Fixed — three tier-coverage tests collapsed into one `it.each` over all 15 chordTypes (coverage preserved; test count 803→815 from parametrization)
- CR-005: Fixed — aug7 registry-emptiness kept only in the divergence-catalog test; redundant 7#5 build/detect duplication removed
- CR-007: Fixed — prettier applied to changed test files; `prettier --check` now passes

### Deferred

- (none)

### Won't Fix

- CR-006: Divergence-catalog assertions on `Chord.get`/`detect` behavior are spec-mandated (task 5.1) regression canaries — they pin the peer-dependency behaviors the naming contract depends on, so a Tonal upgrade that changes them fails loudly.

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS
