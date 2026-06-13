# Code Review: feat/arpeggio-chord-shapes-detection-and-fingerings

**Date:** 2026-06-13 | **Base:** main | **Scope:** full
**Commits:** 28 | **Files Changed:** 18 | **Loop:** 1/2

## Affected Packages

`tonal-guitar` (single-package library) — 18 files changed:
- Core/pure tier: `src/shape.ts`, `src/arpeggio.ts`, `src/build.ts`
- Integration tier: `src/integration.ts`, `src/index.ts`
- Data: `src/data/caged-chords-7th.ts`, `src/data/open-chords.ts`, `src/data/jazz-shells.ts`
- Output: `src/output/alphatex.ts`, `src/output/ascii-tab.ts`
- Tests: `src/*.test.ts`, `src/data/data.test.ts`, `src/output/output.test.ts`
- Docs: `README.md`, `docs/QUESTIONS.md`, `docs/api/arpeggios.md`

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

- Critical: 1 fixed (CR-016), 0 remaining | Important: 4 fixed (CR-003/007/008/012), 5 deferred
- GitHub Issues Created: #38 (perf), #39 (fingering metadata)
- Total Commits: (running) | Total Fixes: 5 | Final Status: IN PROGRESS

## Phase 2: Lint/Test Results

All green — 0 issues. `npm run lint` pass · `npm run build` pass · `npx vitest run` 602 passed.

## Phase 3: Architecture Review

### Core / Integration (opus code-architect)

No Critical. Dependency-layer invariant (arpeggio.ts zero-Tonal), no-throw/sentinel convention, purity, registry usage, and frame-safety all confirmed correct.

- CR-001: [Important] `inferShapeContext` recomputes the anchor twice per candidate in `src/integration.ts:544-578` — `buildFrettedScale` already calls `findShapeAnchorFret` internally (`build.ts:171`), then it's called again at `:549`. Pure waste; correctness fine.
- CR-002: [Important] Coverage gate applied AFTER full `scoreShapeMatch` in `src/integration.ts:552-555` — most (shape,root) pairs fail coverage but the full scoring (allocations, sub-scores) runs first. A cheap chroma-subset pre-check would avoid wasted work. Correctness fine.
- CR-015: [Suggestion] Dead `null` branch at `src/integration.ts:550` (anchor can't be null after the `built.empty` guard). Unused `_shape` param in `scoreShapeMatch` (intentional, matches spec signature).

### Data / Output (opus code-architect)

- CR-003: [Important] `OPEN_G_DIM`/`OPEN_G_M7B5` tagged `voicingFamily:"open"`/`system:"open"` but use `baseFret:5` (no open strings) in `src/data/open-chords.ts:527-540,617-630` — semantically barre/movable, not open. Breaks `query({voicingFamily:"open"})` semantics (OBS-1). FIX. (Architect rated Critical; downgraded to Important — metadata-contract issue, not broken core functionality.)
- CR-004: [Won't Fix] CAGED-7th shapes use a finger-1 barre + interior fingers (`caged-chords-7th.ts:53,111,169`). Architect flagged as contradictory, but this MIRRORS the established `caged-chords.ts` convention (`CAGED_CHORD_E` major is identical) for movable barre forms; `strings`/frets are verified correct by `data.test.ts`; `fingers`/`barres` are non-functional annotation. Not a feature-introduced defect.
- CR-005: [Deferred] Movable CAGED-7th shapes use finger `0` (open string) in fingers arrays (`caged-chords-7th.ts:70,128,186,227,245`). Pre-existing codebase pattern (`CAGED_CHORD_C`/`G` do the same). Legitimate metadata cleanup but codebase-wide, not feature-specific.
- CR-006: [Deferred] `CAGED_CHORD_D_MAJ7` / `OPEN_D_MAJ7` fingers `[null,null,0,2,2,2]` place three "2" fingers with no barre (`caged-chords-7th.ts:88`, `open-chords.ts:907`). Playability metadata; frets verified correct.
- CR-007: [Important] Scratch/exploratory comments left in `src/data/open-chords.ts` (`OPEN_G_AUG:543-563`, `OPEN_E_AUG:752-760`, `OPEN_E_SUS2:777-781`, `OPEN_G_M7B5:604-616`) — stream-of-consciousness derivations, some questioning correctness. Maintainability/drift risk. FIX (clean up).
- CR-008: [Important] `omittedIntervals` never set on open/barre shapes that genuinely omit tones — `OPEN_G_M7B5` omits `3m` (admitted in its own comment) yet declares `chordType:"m7b5"` with no `omittedIntervals`, breaking the R-2.5 round-trip invariant. FIX (set `omittedIntervals` where omitted; verify the voicing or correct it).
- CR-009: [Deferred] `OPEN_C_MINOR:60`/`OPEN_C_M7:117` tagged `open` with `baseFret:3` (barre grips) — same class as CR-003, lower severity (C-family placement is conventional).
- CR-010: [Suggestion→Phase 6] Duplicated input-normalization between `alphatex.ts:90-92` and `ascii-tab.ts:46-48` — extract a shared `normalizeGroups`/string-label helper. Route to simplification.
- CR-011: [Suggestion] Formatter `Array.isArray(notes[0])` detection assumes homogeneous input; add an inline note.
- CR-012: [Important] Shell `m7b5` pattern is byte-identical to `m7` (differ only by `omittedIntervals:["5d"]`) in `jazz-shells.ts:40-45` — intentional but looks like a copy-paste bug; add a clarifying comment. FIX (comment).
- CR-013: [Suggestion] `toSimpleInterval` (`jazz-shells.ts:83-97`) carries unused compound-interval breadth.
- CR-014: [Suggestion] `findRootString` (`jazz-shells.ts:103-106`) assumes `"1P"` present; guard for future rootless voicings.

Positives confirmed: registration pattern consistent + wired into `index.ts`; movable shapes correctly omit `canonicalRoot`; `SHELL_DICTIONARY` 16-shape generation coherent; chords-db MIT attribution present; formatter overload seam clean + flat-path backward-compat byte-identical; no `any`.

### CR-016 (new finding, surfaced by Phase 4 fix agent)

- CR-016: [Critical] `OPEN_E_DIM`/`BARRE_E_DIM` declared `chordType:"dim"` but their `strings` contained `7m` → actually m7b5 voicings (E/Bb/D/G), duplicating the separate `OPEN_E_M7B5`/`BARRE_E_M7B5` and leaving NO true E dim. `query({chordType:"dim"})` would return wrong shapes. FIXED.

## Phase 4: Architecture Fixes

### Fixed

- CR-003: Fixed in Phase 4 — `OPEN_G_DIM`/`OPEN_G_M7B5` retagged `voicingFamily:"barre"`/`system:"barre"`, `canonicalRoot` removed (barre convention).
- CR-007: Fixed — removed scratch/exploratory comments from `open-chords.ts`, replaced with concise factual one-liners.
- CR-008: Fixed — audited all 70 open/barre shapes; `OPEN_C_DOM7` was the only one genuinely missing a tone (`5P`) → set `omittedIntervals:["5P"]`. (The flagged `OPEN_G_M7B5` actually had all four m7b5 tones after the CR-003 cleanup, so no omission needed.)
- CR-012: Fixed — added clarifying comment on the intentional `m7b5`≡`m7` shell pattern in `jazz-shells.ts`.
- CR-016: Fixed — `OPEN_E_DIM`/`BARRE_E_DIM` converted to true diminished triads ({1P,3m,5d}); verified by building (E dim → E/G/Bb, no D; F barre → F/Ab/Cb). Added 4 build-equivalence assertions in `data.test.ts` (now 606 tests).

### Deferred

- CR-001, CR-002, CR-015: GitHub issue #38 (inferShapeContext perf — double anchor computation + post-hoc coverage gate).
- CR-005, CR-006, CR-009: GitHub issue #39 (fingering/voicingFamily metadata cleanup, codebase-wide).
- CR-010: routed to Phase 6 (formatter normalization DRY).
- CR-011, CR-013, CR-014: minor robustness/comment suggestions — noted, not individually filed.

### Won't Fix

- CR-004: CAGED-7th barre+fingers pattern mirrors the established `caged-chords.ts` convention for movable barre forms; `strings`/frets verified correct; `fingers`/`barres` are non-functional annotation.

## Pre-seeded findings (from /implement oversight, to validate during review)

- OBS-1: `src/data/open-chords.ts` `OPEN_G_DIM`/`OPEN_G_M7B5` use `baseFret:5` but tagged `voicingFamily:"open"` (semantically barre).
- OBS-2: Pre-existing non-arpeggio `README.md` sections use broken `get("CAGED X Shape")` lookups (returns undefined). Out of feature scope but same systemic naming error.

---
