# Code Review: feat/connector-algorithm

**Date:** 2026-05-18 | **Base:** main | **Scope:** full
**Commits:** 14 | **Files Changed:** 14 | **Loop:** 1/1

## Notes on Scope

This project is a **single-package TypeScript library** (not the monorepo the
`/review` skill template assumes). The review treats `src/` as the sole
"package" and uses `npm run lint && npm run build && npm test` for
verification. Multi-package criteria (Prisma, tRPC, React, packages/api, etc.)
do not apply.

Code under review (production):

- `src/connect.ts` (new, 363 lines)
- `src/connect.test.ts` (new, 884 lines)
- `src/index.ts` (10 lines added — re-exports)

Non-code artifacts not under review:

- `.tonal-guitar/features/connector-algorithm/*` (planning/spec/research docs)
- `.claude/skills/feature/*`, `.claude/skills/implement/*` (skill template
  patches made during this branch's discovery phase)
- `.gitignore` (added `scratch/`)

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Build/Test verification
- [x] Phase 3: Architecture Review
- [x] Phase 4: Architecture Fix
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [x] Phase 7: Specialized Review (type safety)
- [x] Phase 8: Specialized Fixes
- [x] Phase 9: Final Verification

## Phase 2: Lint/Build/Test Results

All checks passed on first run — no fixes needed.

- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — ESM + CJS + .d.ts emitted clean (62 KB / 65 KB)
- `npm test` — 337 tests passed (65 new in `connect.test.ts`, 272 pre-existing)

## Phase 3: Architecture Review

### src/

- CR-001: [Important] `connectSequences` silently ignores `options.strategy` values `"linear"` and `"motif-extend"` in `src/connect.ts:335` — input enum advertises three values but two are no-ops; callers have no way to detect they were dropped. Tighten the input type to just `"auto"` (reserving the others in a code comment) or document the no-op in JSDoc. Half-formed API surface is hard to reverse after publish.
- CR-002: [Important] The five internal helpers (`nextSide`, `classifyStrategy`, `dedupAndSortCombined`, `buildExtend`, `buildReachBack`) are all `export`ed from `connect.ts` while peer files (`sequence.ts`, `walker.ts`) keep their internal helpers unexported. Since `index.ts` doesn't re-export them, they're only reachable via deep import — acceptable if tests need direct access, but worth confirming and documenting (or unexporting).
- CR-003: [Important] The `"none"` strategy is returned from two distinct code paths in `src/connect.ts:323-330` and `src/connect.ts:347-355` — the first (degenerate inputs) returns `nextNotes: []`, the second (same-direction) returns the natural walk of `next`. Both match spec, but the shared `strategy: "none"` label is ambiguous to consumers. Add a one-line comment distinguishing the two `"none"` return sites.
- CR-004: [Suggestion] Synthetic `FrettedScale` in `buildReachBack` at `src/connect.ts:263` hardcodes `empty: false`, which is wrong if `combinedNotes` is empty. No crash today (walker handles empty), but the sentinel becomes inconsistent. Use `empty: combinedNotes.length === 0`.
- Verified clean: `classifyStrategy` truth table matches spec §3.1 + §3.2 conjunction rule; module placement in "zero Tonal deps" tier is correct; `index.ts` re-export block respects the existing ordering.

## Phase 7: Type-Safety Review

### src/

- CR-005: [Important] `buildExtend` lacks an empty-notes guard at `src/connect.ts:188-192` — `Math.max(...nextMidis)` returns `-Infinity` and `Math.min(...)` returns `+Infinity` for empty arrays, producing silently wrong `target` and empty connector. `connectSequences` guards against empty notes upstream, but `buildExtend` is exported, so a caller invoking it directly is unprotected.
- CR-006: [Important] Strategy dispatch in `connectSequences` at `src/connect.ts:347-362` uses sequential if-chains instead of an exhaustive switch. Adding a fourth `ConnectorStrategy` value (e.g. `"pivot"`) would silently fall through to `buildReachBack`. A `switch` with `default: strategy satisfies never` would force compile-time coverage.
- CR-007: [Important] (duplicate of CR-001) `ConnectorOptions.strategy` advertises `"linear" | "motif-extend"` but they're treated as `"auto"` — the type lies about the runtime contract. Already captured in CR-001; tracking here as confirmation from a second reviewer.
- CR-008: [Suggestion] `connect.test.ts:858` accesses `result.connector[result.connector.length - 1].midi` without a length guard — a regression would surface as a cryptic `undefined.midi` error rather than a clear assertion failure.
- Verified clean: zero `any` / `as any` / `@ts-ignore` / `@ts-expect-error` anywhere; all `FrettedNote` fields accessed are non-optional; synthetic `combinedScale` in `buildReachBack` has all seven required `FrettedScale` fields; `nextSide` correctly guards empty arrays at `connect.ts:88`; `connector[length-1]` access at `connect.ts:214` is guarded by the length check at `connect.ts:213`.

## Phase 5: Code Simplification Review

### src/connect.ts

- CR-009: [Important] (overlaps CR-002) Five helpers tagged `@internal` in JSDoc are still `export`ed at `src/connect.ts:84, 118, 144, 177, 254` so tests can call them. The file contradicts itself — pick one direction. (Tests do reach them directly; recommended fix is to keep the export but make the test-only intent explicit in a comment, not drop the `@internal` tag.)
- CR-010: [Important] `buildExtend` (`src/connect.ts:196-204`) and `buildReachBack` (`src/connect.ts:281-285`) both branch on `direction === "ascending"` to flip a midi-comparison sign. A small `trimBySeam` helper would collapse the symmetry. (Borderline — keeping each strategy readable end-to-end is also valid.)
- CR-011: [Important] Dedup-seam logic asks "does `nextNotes[0]` occupy the same `(string, fret)` as some reference note?" in two places (`src/connect.ts:212-233` and `src/connect.ts:288-296`). A `samePosition(a, b)` helper removes ~15 lines of near-identical structure. The midi-equality check in extend (`connect.ts:217`) is also redundant — `(string, fret)` uniquely determines midi for a given tuning.
- CR-012: [Important] `buildReachBack` constructs a synthetic `FrettedScale` (`src/connect.ts:263-271`) by listing all 7 fields. A spread (`{ ...next.scale, notes: combinedNotes }`) reads cleaner and makes the "inherit metadata from next" intent obvious. (Combines with CR-004's `empty` fix.)

### src/connect.test.ts

- CR-013: [Suggestion] `nextMidis` in `src/connect.ts:188` is recomputed only to feed `Math.max`/`Math.min`. Minor.
- CR-014: [Suggestion] No-op narration comment at `src/connect.ts:335-337` describes nothing happening. Delete or fold into the JSDoc on `ConnectorOptions.strategy`.
- CR-015: [Suggestion] TG1 module-scaffolding tests (`connect.test.ts:49-111`, 4 tests) duplicate type-system guarantees with runtime `typeof === "function"` smoke tests. Could collapse to one.
- CR-016: [Suggestion] Scenario 7 test (`connect.test.ts:559-576`) re-implements `dedupAndSortCombined` inline via an IIFE — the helper is already imported. Call it directly.
- CR-017: [Suggestion] Scenarios 1 & 4 (`connect.test.ts:293-346`) split a single fingerprint across 4 separate tests asserting strategy + note names + (string,fret) + dedup. One test asserting the full fingerprint object is the right specificity for §3.4.
- CR-018: [Suggestion] TG6 rebuilds `eShapeA` / `dShapeA` / `prevAscWalk` (`connect.test.ts:825-870`) when identical fixtures already exist at module scope. Promote to shared fixtures.
- CR-019: [Suggestion] Test names like `"Scenario 2: dedupSeam true — nextNotes[0] does NOT occupy (string:5, fret:7) (B4 deduped)"` encode coordinates. Behavior-focused naming reads better.
- CR-020: [Suggestion] `// GAP FILL §6.x` markers (`connect.test.ts:530, 536, 553, 862`) are commit-archaeology — useful in PR body, noise in the merged file.

Verified clean in `connect.ts`: no dead code, no commented-out scaffolding, no stale block comments; `@internal` JSDoc algorithm summaries match the implementations.

## Phase 4: Architecture Fixes

### Fixed

- CR-001 / CR-007: Narrowed `ConnectorOptions.strategy` to `"auto"` only. Updated JSDoc to reserve `"linear"` / `"motif-extend"` for future releases. Also dropped the now-dead "normalize reserved values" comment block (covers CR-014).
- CR-002 / CR-009: Added an explicit section comment above the internal helpers explaining the intentional export-for-testing tension with the `@internal` JSDoc tag.
- CR-003: Clarified the degenerate-input guard comment to distinguish it from the same-direction `strategy === "none"` return path.
- CR-004 / CR-012: Replaced the 7-field explicit synthetic `FrettedScale` literal in `buildReachBack` with `{ ...next.scale, notes: combinedNotes, empty: combinedNotes.length === 0 }`. Inherits metadata + fixes the `empty` sentinel for the all-empty edge case.
- CR-005: Added defensive empty-notes guard at the top of `buildExtend` to protect against direct-caller misuse (returns `{ connector: [], nextNotes: [], strategy: "extend" }`).
- CR-006: Converted the if-chain dispatch to an exhaustive `switch` with a `default` branch that assigns `strategy` to `never` — future additions to `ConnectorStrategy` now cause a compile error.

### Test follow-up

- Consolidated the two "reserved strategy treated as auto" runtime tests into one combined test that asserts compile-time rejection (via `@ts-expect-error`) AND defensive runtime tolerance for JS callers bypassing TypeScript. Test count: 65 → 64 (337 → 336 total).

### Verification

- `npm run lint` clean
- `npm run build` clean
- `npm test` — 336 tests pass

## Phase 6: Code Simplification Fixes

### Fixed

- CR-011: Extracted `samePosition(a, b)` private helper. Replaced 14 lines of nested if-blocks in `buildExtend` and 5 lines in `buildReachBack`. The redundant midi-equality check in `buildExtend` is also dropped — `(string, fret)` uniquely determines midi for a given tuning, as noted in the helper's JSDoc.
- CR-014: Already fixed in Phase 4 (dead "normalize reserved strategy values" comment block removed alongside CR-001's type narrowing).

### Deferred (rolled into Phase 8 roll-up issue)

- CR-010: Extract `trimBySeam` helper for the asc/desc filter branches in `buildExtend` and `buildReachBack`. Reviewer flagged this as "borderline — keeping each strategy readable end-to-end is also valid." Semantics differ (bracket vs. half-plane filter); a shared helper would need a mode parameter and obscure intent. Won't Fix.
- CR-013, CR-015, CR-016, CR-017, CR-018, CR-019, CR-020: All Suggestion-severity test-quality nitpicks. Bundled into a single roll-up GitHub issue in Phase 8.

### Verification

- `npm run lint` clean
- `npm test` — 336 tests pass

## Phase 8: Specialized Fixes

### Fixed

All Important Phase 7 findings were rolled into the Phase 4 architecture-fix
commit (they overlapped substantively with the API-shape work):

- CR-005 (`buildExtend` empty-notes guard) — fixed in Phase 4
- CR-006 (exhaustive switch dispatch) — fixed in Phase 4
- CR-007 (duplicate of CR-001 type narrowing) — fixed in Phase 4

### Deferred

Per user's preference for a single roll-up issue, all 8 Suggestion-severity
findings (CR-008, CR-013, CR-015, CR-016, CR-017, CR-018, CR-019, CR-020)
are tracked in [issue #3](https://github.com/TheGuitarStudio/tonal-guitar/issues/3)
with the `code-review` label.

### Won't Fix

- CR-010: Extract `trimBySeam` for the asc/desc filter branches. Reviewer
  flagged as borderline; semantics differ across the two callsites (bracket
  filter in `buildExtend` vs. half-plane filter in `buildReachBack`) and a
  shared helper would obscure intent. Kept inline.

## Statistics

### Findings by severity

| Severity     | Found | Fixed | Deferred | Won't Fix |
| ------------ | ----- | ----- | -------- | --------- |
| Critical     | 0     | 0     | 0        | 0         |
| Important    | 10    | 9     | 0        | 1 (CR-010)|
| Suggestion   | 10    | 2     | 8        | 0         |
| **Total**    | **20**| **11**| **8**    | **1**     |

(Important findings include two duplicates: CR-007 ≡ CR-001 and CR-009 ≡ CR-002.
Both rolled into single fixes.)

### Review activity

- GitHub issues created: [#3](https://github.com/TheGuitarStudio/tonal-guitar/issues/3) — roll-up for 8 deferred Suggestions
- Review commits added: 4 (review findings, Phase 4 fixes, Phase 6 fixes, Phase 8)
- Test count: 337 → 336 (two reserved-strategy runtime tests merged into one `@ts-expect-error` + runtime assertion after type narrowing)

### Final verification (Phase 9)

- `npm run lint` — clean
- `npm run build` — ESM + CJS + .d.ts emitted (62.26 KB / 65.31 KB)
- `npm test` — 336 tests passed

### Final Status: **PASS**

All Critical findings: none. All Important findings either fixed (9) or
documented as Won't Fix with reviewer concurrence (1). Lint, build, and
full test suite all green.
