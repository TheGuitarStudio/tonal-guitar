# Code Review: feat/connector-lab-integration

**Date:** 2026-05-28 | **Base:** main | **Scope:** full
**Commits:** 17 | **Files Changed:** 13 | **Loop:** 1/1

## Affected Packages

This project is a single-package npm library (`src/`) plus a Next.js site (`site/`). No turborepo.

- `src/` (3 files: `connect.ts`, `connect.test.ts`, `connect.examples.test.ts`) — library algorithm change
- `site/app/experiments/components/` (4 files: `PipelineBuilder.tsx`, `ChainSection.tsx`, `codeGen.ts`, `chainUtils.ts`) — Guitar Lab integration
- `.tonal-guitar/features/connector-lab-integration/` (6 docs) — feature spec/plan/decisions

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix (clean — 0 findings)
- [x] Phase 3: Architecture Review
- [ ] Phase 4: Architecture Fix
- [ ] Phase 4: Architecture Fix
- [ ] Phase 5: Code Simplification Review
- [ ] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 4 open | Suggestions: 6 open
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS

## Phase 3: Architecture Review

### Critical

(none)

### Important

- **CR-001**: `connectSequences` semantic contract changed but `connector-algorithm/spec.md` §3.3/§3.4 was not updated to reflect the same-string bridge model. (`src/connect.ts:347-414` vs spec)
- **CR-002**: Public API observably breaking for external consumers of reach-back. `connectSequences` JSDoc (line 420-430) does not mention that both `extend` and `reach-back` now emit a same-string bridge. Pre-publish only; v0.1.0 unreleased.
- **CR-003**: Every example test passes `{ dedupSeam: false }`; the library default (`dedupSeam: true`) is essentially untested against the new algorithm — particularly the new pair-level overlap dedup vs the legacy single-note dedup interaction. (`src/connect.examples.test.ts:96`)
- **CR-004**: `tasks.md:7` claims "No library code changes" but the diff rewrites `src/connect.ts` and updates `src/connect.test.ts`. Doc lags behind shipped scope.

### Suggestions

- **CR-005**: `ConnectorSlot` fallback `"no connector (TODO)"` is misleading now — fires for legitimate `strategy === "none"`. Should read `"no bridge"` or `"(same direction)"`. (`ChainSection.tsx:249`)
- **CR-006**: `eslint-disable react-hooks/exhaustive-deps` on `connectorsAndNextNotes` memo is unnecessary (only references `chain` + module-level constants). Future footgun. (`PipelineBuilder.tsx:255-256`)
- **CR-007**: `rebuildScale` is called 2*(N-1) times across seams for an N-entry chain. Cost is invisible at N ≤ 5 and D-002 accepts it; defer. (`PipelineBuilder.tsx:218-219`)
- **CR-008**: `buildExtend`/`buildReachBack` are `export`ed for tests but not in `index.ts` barrel. JSDoc `@internal` is advisory only. Defer — matches existing comment block at `connect.ts:73-78`.
- **CR-009**: `dedupAndSortCombined` is dead code under the new algorithm (replaced by `sameStringCombined`). Delete or document the retention reason. (`src/connect.ts:174-195`)
- **CR-010**: Test `Descending reach-back: nextNotes[0].midi <= prev.lastNote.midi` (`connect.test.ts:627-632`) now passes trivially under the new model — the invariant it claims to test has moved to the connector. Rename or strengthen.

### Triage decisions

| ID     | Priority   | Action   | Notes |
| ------ | ---------- | -------- | ----- |
| CR-001 | Important  | **Fix**  | Update spec.md with supersession note |
| CR-002 | Important  | **Fix**  | Improve `connectSequences` JSDoc |
| CR-003 | Important  | **Fix**  | Add `dedupSeam: true` examples test |
| CR-004 | Important  | **Fix**  | Update tasks.md scope claim |
| CR-005 | Suggestion | **Fix**  | Trivial label change |
| CR-006 | Suggestion | **Fix**  | Remove eslint-disable comment |
| CR-007 | Suggestion | Defer    | D-002 accepts cost |
| CR-008 | Suggestion | Defer    | Existing @internal JSDoc is the project convention |
| CR-009 | Suggestion | **Fix**  | Delete dead code |
| CR-010 | Suggestion | **Fix**  | Rename test for clarity |

## Commands adapted for this project

| Skill default (turbo/pnpm) | Project equivalent |
| -------------------------- | ------------------ |
| `turbo run lint --affected` | `npm run lint` (src only — no lint in site/) |
| `turbo run typecheck --affected` | `cd site && npx tsc --noEmit` |
| `turbo run test --affected` | `npm test` (src only — no tests in site/) |
| `turbo run build` | `npm run build && cd site && npm run build` |
