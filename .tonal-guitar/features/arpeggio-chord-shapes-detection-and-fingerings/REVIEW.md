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
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [x] Phase 7: Specialized Reviews
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

## Phase 5: Code Simplification Review

### Core logic (arpeggio.ts, integration.ts, shape.ts, build.ts)

- CR-017: [Important] `src/integration.ts:377` inline `import("./arpeggio").ScoreBreakdown` type — add to the existing named import on line 19 instead.
- CR-018: [Suggestion] `src/arpeggio.ts:114` stale banner comment "Exported stubs (implemented in later task groups)" — functions are implemented now.
- CR-019: [Suggestion] `src/arpeggio.ts:82` `!pc || pc.length === 0` — `!pc` already covers empty string.
- CR-020: [Suggestion] `src/arpeggio.ts:291-292` `(anchorHit ? 1 : 0)` → `+anchorHit` (booleans). Style churn — skip.
- CR-021: [Suggestion] `src/arpeggio.ts:260-263` repeated `pcChroma(n.pc)` calls — minor.
- CR-022: [Suggestion] `src/integration.ts:406` redundant alias `const scale = input` after narrowing.
- CR-023: [Suggestion] `src/integration.ts:73,414,449,487,498` five `c !== null && c !== undefined` guards → extract `isValidChroma(c): c is number` (`c != null`).
- CR-024: [Suggestion] `src/integration.ts` inconsistent dedup-set naming (`seen`/`seenRoots`/`seenChromas`). Churn — skip.
- CR-025: [Suggestion] `src/integration.ts:538-540` `options?.system ? s.system === options.system : true` → `!options?.system || s.system === options.system`.
- CR-026: [Suggestion] `src/integration.ts:589-594` two-var limit computation — current form is readable; skip.
- CR-027: [Won't Fix] `src/shape.ts:160-163` `JSON.stringify` stringSet comparison — spec R-1.4 EXPLICITLY mandates `JSON.stringify` order-sensitive equality. Keep as-is.
- CR-028: [Won't Fix] `src/shape.ts:40` `VoicingPatternDictionary` alias — public exported type per spec R-1.3. Keep.

### Formatters (alphatex.ts, ascii-tab.ts)

- CR-010: [Important] Duplicated `normalizeGroups` block in both formatters — extract a shared helper into `src/output/util.ts`.
- CR-029: [Suggestion] `src/output/alphatex.ts:125-165` duration-prefix logic triplicated across the three group-size branches — extract an `applyDuration(content, dur)` closure. Best-effort (must keep flat-path byte-identical).
- CR-030: [Won't Fix] `src/output/ascii-tab.ts` two-loop consolidation — reviewer concluded the restructure isn't worth the line savings.

## Phase 6: Code Simplification Fixes

### Fixed (all verified, 606 tests pass)

- CR-010: Extracted `normalizeGroups` into new `src/output/util.ts`; both formatters now import it.
- CR-017: `ScoreBreakdown` added to the named `./arpeggio` import; inline `import()` type removed.
- CR-018: Stale "Exported stubs" banner → "Exported functions".
- CR-019: `pcChroma` empty-check simplified to `if (!pc)`.
- CR-022: Removed redundant `const scale = input` alias.
- CR-023: Added `isValidChroma(c): c is number` helper; replaced 7 null/undefined chroma guards.
- CR-025: `system` filter simplified to `!options?.system || s.system === options.system`.
- CR-029: Extracted `applyDuration` closure in `alphatex.ts`; collapsed the triplicated duration-prefix logic; output verified byte-identical.

### Won't Fix / Skipped

- CR-020, CR-024, CR-026: style churn, no clear improvement — skipped.
- CR-027, CR-028, CR-030: see Phase 5 (spec-mandated / public type / not worth restructure).

## Phase 7: Specialized Reviews

Accessibility: N/A (no UI in the library `src`). No `any`, no unguarded non-null assertions, all exported functions have explicit return types.

### Type Safety

- CR-031: [Important] `src/integration.ts:70-74` `arpeggioFromScale` — `@tonaljs` `chroma` returns `number` (NaN on failure, never `null`); `chordChromas.delete(null)` is a no-op and `Set<number|null>` mis-models it. Filter `NaN` instead. (Latent — valid chords never produce NaN — but the null-model is wrong.) FIX.
- CR-032: [Important] `src/integration.ts:34-36` `isValidChroma` uses `c != null`, which accepts `NaN`. Should be `c != null && !Number.isNaN(c)`. Compounds CR-031. FIX.
- CR-033: [Deferred] `src/build.ts:59-60` dead `== null` checks on `chroma` results (NaN is the real sentinel, already handled). PRE-EXISTING code (not feature-introduced).
- CR-034: [Important] `src/data/jazz-shells.ts:105-106` `findRootString` returns `stringSet[-1]` → `undefined` (typed `number`) if `"1P"` absent. Safe today; add a guard. FIX. (Same as CR-014.)
- CR-035: [Suggestion] `src/integration.ts:458` redundant `as` cast after `isFrettedScale` narrowing. FIX (trivial, fold in).

### Security / Input-Robustness

No Critical. No `eval`/`Function`/dynamic require/fs/network.

- CR-036: [Important] `src/integration.ts:451` `extractProbe` does `Math.min(...input.notes.map(...))` on a caller-supplied `FrettedScale` — a crafted oversized `notes` array (100k+) throws `RangeError` (stack overflow), violating the "never throws" contract. Use `.reduce()`. FIX (feature code).
- CR-040: [Important→fold] `extractProbe` grip path / `parseChordFrets` iterate the full parsed array before the `tuning.length` guard — low-grade O(n) DoS on huge grip strings. Add an input cap in `extractProbe`. FIX (fold with CR-036).
- CR-037: [Deferred] `src/connect.ts:102-105` identical `Math.max/min(...)` spread DoS — PRE-EXISTING connector feature, NOT on this branch's diff.
- CR-038: [Deferred] `src/shape.ts:108,136` registry `add()` keys a plain `{}` by untrusted `shape.name`; `"__proto__"`/`"constructor"` corrupt the registry (not global pollution). PRE-EXISTING registry pattern; harden with `Object.create(null)`.
- CR-039: [Deferred] `src/output/alphatex.ts:80` `title`/`tempo`/`key` options interpolated unsanitized → output corruption (not execution). PRE-EXISTING formatter options.

## Pre-seeded findings (from /implement oversight, to validate during review)

- OBS-1: `src/data/open-chords.ts` `OPEN_G_DIM`/`OPEN_G_M7B5` use `baseFret:5` but tagged `voicingFamily:"open"` (semantically barre).
- OBS-2: Pre-existing non-arpeggio `README.md` sections use broken `get("CAGED X Shape")` lookups (returns undefined). Out of feature scope but same systemic naming error.

---
