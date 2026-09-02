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
| 0 | TG1: Vitest Include Globs & Lint Globs Expansion | complete | sonnet | - |
| 0 | TG2: Shape Data Model — Additive Fields & New Interfaces | complete | sonnet | - |
| 0 | TG6: Chord-Scale Rule Module | complete | sonnet | - |
| 0 | TG7: Changeset Schema Types | complete | sonnet | - |
| 0 | TG14: Jazz Shells 16 → 8 Correction (D-012) | complete | sonnet | - |
| 0 | TG20: packages/fretboard-ui — Editing Extensions | complete | sonnet | - |
| 1 | TG3: Registry Mechanics — Replace-on-Add, remove(), arpeggioShapes Registry | complete | sonnet | - |
| 1 | TG5: Shape Identity & Geometry Helpers | complete | sonnet | - |
| 1 | TG16: Single TS Printer — scripts/lib/render-shape.mjs | complete | sonnet | - |
| 2 | TG4: Arpeggio Resolver Layer | complete | sonnet | - |
| 2 | TG8: Fingering Carries Fingers/Barres + autoFingering | complete | sonnet | - |
| 3 | TG9: Required-Tier Audit Checks | complete | sonnet | - |
| 3 | TG11: Parent-Box Selection & Arpeggio Derivation | complete | sonnet | - |
| 4 | TG10: Optional-Tier Audit Integration (D-006) | complete | sonnet | - |
| 5 | TG12: Public API Exports | complete | sonnet | - |
| 6 | TG13: Barre-Fret Offset Migration (D-010) | complete | sonnet | - |
| 6 | TG15: Generator-Owned-Block Prep — Markers & Count Annotations | complete | sonnet | - |
| 6 | TG21: packages/shape-catalog — Move-Only Extraction | complete | sonnet | - |
| 7 | TG17: Merge Script Core — scripts/shapes-merge.mjs | complete | sonnet | - |
| 7 | TG22: packages/shape-catalog — New Pure Models | complete | sonnet | - |
| 8 | TG18: Merge Script Fixtures & Tests | complete | sonnet | - |
| 8 | TG23: packages/shape-library-ui — Components & Capability Contract | complete | sonnet | - |
| 9 | TG24: packages/shape-workbench — App Skeleton, Store & Dev-Server Plugin | complete | sonnet | - |
| 10 | TG25: packages/shape-workbench — Board Screen | complete | sonnet | - |
| 11 | TG26: packages/shape-workbench — Editor Screen (closes #66) | complete | sonnet | - |
| 12 | TG27: packages/shape-workbench — Export Screen | pending | - | - |
| 13 | TG19: CAGED Data Changeset — Minor Triads + Major Metadata Backfill (closes #57) | pending | - | - |
| 13 | TG28: Site — Vertical Slice Integration (D-003 gate) | pending | - | - |
| 14 | TG29: Site — Incremental Migration & /admin Retirement | pending | - | - |
| 15 | TG30: Full Regression, CI Pipeline & Gap Analysis | pending | - | - |

### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: Aligned; one latent concern (printer identifier naming diverged from exportIdentifierFor on apostrophes/diacritics) — reconciled by lead before Layer 2. Continued.
- **Layer 2**: No concerns. Continued.
- **Layer 3**: No concerns. Continued.
- **Layer 4**: No concerns. Continued.
- **Layer 5**: No concerns. Continued.
- **Layer 6**: Aligned; one docstring accuracy fix applied by lead (checkBarreFretOrigin scope claim). Pre-existing EXT_CHORD_A_9 barre-origin issue in extended-chords.ts noted for separate tracking (spec §4.5 no-silent-autofix). Continued.
- **Layer 11**: Aligned; Layer-10 concerns fixed and verified. One medium concern (spurious name-unique error in Checks card for existing-shape edits) fixed by lead: runChordChecks now filters CHECK_NAME_UNIQUE for origin:"existing" drafts, mirroring the merge script's update filter. Continued.
- **Layer 10**: Aligned with 2 concerns (dead voicing-family/root/scale filter controls on Board; BoardCellCard gap-button wording vs spec). Lead dispatched a parallel fix agent alongside Layer 11. Continued.
- **Layer 9**: No concerns. Continued.
- **Layer 8**: Aligned; TG18 resolved all three Layer-7 script concerns. Lead added vitest react/react-dom dedupe (duplicate-React hook errors from file:-linked packages). Two quality follow-ups for /review: shape-library-ui tsconfig reaches into shape-catalog's render-shape-mjs.d.ts shim; reactGlobal.ts ships a vitest-only JSX workaround in production source. Continued.
- **Layer 7**: Aligned with 5 non-blocking concerns (counts-on-remove under-reporting, rename-update --check idempotence, draftToChange drops cleared fields, documented rule-order deviation, one missing refusal test). First two + missing test folded into TG18; draftToChange field-clearing deferred to spec-compliance loop (schema cannot express deletion — design question). Continued.

### Spec Compliance

## Loop History

## Review History

- 2026-08-30 — Plan review of tasks.md by feature-plan reviewer agent (reviews/plan-review.md). Verdict NEEDS REVISION → both findings resolved in tasks.md: Group 19 now depends on Groups 26/27 and requires the workbench-authored changeset (spec §4.3 dogfooding); all six `EditCapabilities` handlers wired via 22.4/24.6/26.8/27.6 with add-vs-update draft-origin tracking. 30 task groups; sub-issues #162–#191.
- 2026-08-30 — External review of research.md by Codex CLI (reviews/research-review.md). Highlights: shared-UI needs a dedicated React package (proposed `packages/shape-library-ui`), merge script needs AST/generator strategy + fixtures, Barre.fret migration riskier than display-only (audit.ts:147 uses barre ranges), override mechanism needs an explicit resolver layer; corrections: open-chords is 70 shapes/35 barres, ScaleShape.parentShape already exists (ChordShape lacks it). Recommendations accepted into Phase 2 inputs.
