# Feature: Minor-Quality Shape Relabeling API

**Issue:** #54 | **Started:** 2026-07-12

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** --from #54
- **Branch:** feat/minor-quality-shape-relabeling
- **Priority:** unset
- **Size:** unset

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | done    | 1     | no       |
| Shape     | spec.md     | done    | 1     | no       |
| Plan      | tasks.md    | done    | 1     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Phase 4: Implement

| Layer | Task Group                                                              | Status  | Agent | Notes |
| ----- | ----------------------------------------------------------------------- | ------- | ----- | ----- |
| 0     | TG1: ScaleShape Type Extension + transform.ts Shell + Re-exports        | complete | sonnet | 848 tests pass |
| 1     | TG2: relabelShape Algorithm Implementation                              | complete | sonnet | 859 tests pass |
| 2     | TG3: Minor CAGED Entries (caged-scales-minor.ts)                        | complete | sonnet | ran sequentially before TG4 (shared files) |
| 2     | TG4: Minor Pentatonic Entries (pentatonic-minor.ts)                     | complete | sonnet | 891 tests pass; lead updated index.test.ts counts |
| 3     | TG5: isShapeCompatible Rewrite + relabelShapeToScale + buildFromScale   | complete | sonnet | 918 tests; accepted deviation: modeShapes("A dorian") returns 5 minor-pent boxes (spec R3.2 row inconsistent with R3.1 chroma math) |
| 4     | TG6: API Docs, README, PLAN.md, CLAUDE.md                               | in-progress | sonnet | -     |
| 5     | TG7: Final Test Review and Gap Analysis                                 | pending | -     | -     |

### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: No concerns. Continued.
- **Layer 2**: No concerns. Continued.
- **Layer 3**: No concerns. Dorian-deviation chroma math independently verified by oversight. Continued.

### Spec Compliance

_(none yet)_

## Loop History

_(none yet)_

## Review History

_(none yet)_
