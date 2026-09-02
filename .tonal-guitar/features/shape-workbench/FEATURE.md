# Feature: Shape Workbench

**Issue:** #161 | **Started:** 2026-08-30

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** manual (design canvas session 2026-08-30 — https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd)
- **Branch:** feat/shape-workbench
- **Priority:** unset
- **Size:** L

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | done    | 1     | yes      |
| Shape     | spec.md     | done    | 1     | no       |
| Plan      | tasks.md    | done    | 1     | yes      |
| Implement | FEATURE.md  | pending | 0     | no       |

## Phase 4: Implement

| Layer | Task Group | Status | Agent | Notes |
| ----- | ---------- | ------ | ----- | ----- |
| 0 | TG1: Vitest Include Globs & Lint Globs Expansion | pending | - | - |
| 0 | TG2: Shape Data Model — Additive Fields & New Interfaces | pending | - | - |
| 0 | TG6: Chord-Scale Rule Module | pending | - | - |
| 0 | TG7: Changeset Schema Types | pending | - | - |
| 0 | TG14: Jazz Shells 16 → 8 Correction (D-012) | pending | - | - |
| 0 | TG20: packages/fretboard-ui — Editing Extensions | pending | - | - |
| 1 | TG3: Registry Mechanics — Replace-on-Add, remove(), arpeggioShapes Registry | pending | - | - |
| 1 | TG5: Shape Identity & Geometry Helpers | pending | - | - |
| 1 | TG16: Single TS Printer — scripts/lib/render-shape.mjs | pending | - | - |
| 2 | TG4: Arpeggio Resolver Layer | pending | - | - |
| 2 | TG8: Fingering Carries Fingers/Barres + autoFingering | pending | - | - |
| 3 | TG9: Required-Tier Audit Checks | pending | - | - |
| 3 | TG11: Parent-Box Selection & Arpeggio Derivation | pending | - | - |
| 4 | TG10: Optional-Tier Audit Integration (D-006) | pending | - | - |
| 5 | TG12: Public API Exports | pending | - | - |
| 6 | TG13: Barre-Fret Offset Migration (D-010) | pending | - | - |
| 6 | TG15: Generator-Owned-Block Prep — Markers & Count Annotations | pending | - | - |
| 6 | TG21: packages/shape-catalog — Move-Only Extraction | pending | - | - |
| 7 | TG17: Merge Script Core — scripts/shapes-merge.mjs | pending | - | - |
| 7 | TG22: packages/shape-catalog — New Pure Models | pending | - | - |
| 8 | TG18: Merge Script Fixtures & Tests | pending | - | - |
| 8 | TG23: packages/shape-library-ui — Components & Capability Contract | pending | - | - |
| 9 | TG24: packages/shape-workbench — App Skeleton, Store & Dev-Server Plugin | pending | - | - |
| 10 | TG25: packages/shape-workbench — Board Screen | pending | - | - |
| 11 | TG26: packages/shape-workbench — Editor Screen (closes #66) | pending | - | - |
| 12 | TG27: packages/shape-workbench — Export Screen | pending | - | - |
| 13 | TG19: CAGED Data Changeset — Minor Triads + Major Metadata Backfill (closes #57) | pending | - | - |
| 13 | TG28: Site — Vertical Slice Integration (D-003 gate) | pending | - | - |
| 14 | TG29: Site — Incremental Migration & /admin Retirement | pending | - | - |
| 15 | TG30: Full Regression, CI Pipeline & Gap Analysis | pending | - | - |

### Oversight Reports

### Spec Compliance

## Loop History

## Review History

- 2026-08-30 — Plan review of tasks.md by feature-plan reviewer agent (reviews/plan-review.md). Verdict NEEDS REVISION → both findings resolved in tasks.md: Group 19 now depends on Groups 26/27 and requires the workbench-authored changeset (spec §4.3 dogfooding); all six `EditCapabilities` handlers wired via 22.4/24.6/26.8/27.6 with add-vs-update draft-origin tracking. 30 task groups; sub-issues #162–#191.
- 2026-08-30 — External review of research.md by Codex CLI (reviews/research-review.md). Highlights: shared-UI needs a dedicated React package (proposed `packages/shape-library-ui`), merge script needs AST/generator strategy + fixtures, Barre.fret migration riskier than display-only (audit.ts:147 uses barre ranges), override mechanism needs an explicit resolver layer; corrections: open-chords is 70 shapes/35 barres, ScaleShape.parentShape already exists (ChordShape lacks it). Recommendations accepted into Phase 2 inputs.
