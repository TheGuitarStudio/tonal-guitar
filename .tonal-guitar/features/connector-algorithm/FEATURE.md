# Feature: Connector algorithm — bridge chained sequences

**Issue:** [#2](https://github.com/TheGuitarStudio/tonal-guitar/issues/2) | **Started:** 2026-05-16

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** `/idea` → graduated 2026-05-16 (project item `PVTI_lADOEFcb-s4BX5t_zgs8ILM`)
- **Branch:** `feat/connector-algorithm`
- **Priority:** P1
- **Size:** M

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | draft   | 1     | no       |
| Shape     | spec.md     | draft   | 1     | no       |
| Plan      | tasks.md    | draft   | 1     | yes      |
| Implement | FEATURE.md  | pending | 0     | no       |

## Deferred GitHub steps

All resolved on 2026-05-17:

- [x] Promoted draft to issue [#2](https://github.com/TheGuitarStudio/tonal-guitar/issues/2) with `feature-spec` label
- [x] Project item moved `Spark` → `In progress` (skipped `Backlog` since Phase 1 & 2 already shipped)
- [x] `git push -u origin feat/connector-algorithm`

## Loop History

### Phase 1 · Loop 1 — 2026-05-16

Read library primitives (`walker.ts`, `sequence.ts`, `build.ts`, `fretboard.ts`,
`output/alphatex.ts`), CAGED shape data, and the lab's `ChainSection` /
`PipelineBuilder` / `codeGen` chain wiring. Built `dist/` and ran
`scratch/connector-probe.mjs` to validate the four MVP cases against concrete
A-major data.

Findings: re-framed V1–V4 in pitch terms (H+ / H- × direction) since "CAGED
order" doesn't always match pitch order for a given key. Concluded the
algorithm collapses to **extend (linear bridge)** vs. **reach-back (re-walk
next over combined scale)**. Picked linear-bridge over motif-extend for
predictability and musicality.

Identified API shape: `connectSequences(prev, next, opts) → { connector,
nextOverride }`. All existing primitives suffice — no new library plumbing
needed. AlphaTeX and lab integration are non-blocking.

8 open questions remaining (1 needs explicit pick in Shape phase, rest are
scoping or post-MVP).

### Phase 2 · Loop 1 — 2026-05-16

Resolved all 8 research questions. User direction mid-phase: **same-direction
chains do NOT get a bridge** — they express a beginner "restart in another
position" exercise, distinct from the intermediate "ascend-then-descend"
arc that bridging serves. Spec collapses the strategy taxonomy to three
cases (`none` / `extend` / `reach-back`) with a deterministic classifier
based on direction-pair × pitch-side.

API locked: `connectSequences({prev, next}, options?) → {connector,
nextNotes, strategy}`. Pure midi logic, no new dependencies. ~150-line
new file `src/connect.ts`. AlphaTeX and lab integration are post-library
follow-ups, plan-scoped separately.

Worked expected-output fingerprints for all 8 test scenarios committed in
spec §3.4 — these become Phase 4 test assertions.

### Phase 3 · Loop 1 — 2026-05-17

Resumed the pipeline via `/feature` after the rebase brought in the planning
skills from main. First-run discovery exposed two tooling gaps:

1. **GitHub config missing.** Set up `.tonal-guitar/project-config.json`
   (auto-detected `TheGuitarStudio/tonal-guitar` org project #2 "Tonal Guitar",
   captured Status/Priority/Size field IDs). Promoted the project draft to
   real issue [#2](https://github.com/TheGuitarStudio/tonal-guitar/issues/2)
   with `feature-spec` label, set status `Spark → In progress`, priority P1,
   size M. Pushed `feat/connector-algorithm` with `--force-with-lease`.

2. **Skill task template assumed Prisma/tRPC/React.** Rewrote
   `.claude/skills/feature/templates/tasks-template.md` and
   `.claude/skills/feature/references/agent-prompts.md` to fit this stack:
   pure-TS library (`src/`) + optional Next.js docs/lab site (`site/`).
   Layered breakdown is now Module/Types → Core Logic → Integration →
   (optional Output / Lab / Docs) → Testing. Optional layers explicitly
   opt-in so library-only features don't fabricate UI groups.

Then dispatched the planner (`feature-dev:code-architect`, sonnet) and
reviewer (`feature-dev:code-reviewer`, sonnet). Planner produced 6 task
groups with Groups 3 (extend) and 4 (reach-back) parallelizable. Reviewer
returned **PASS** with three minor gaps; all addressed inline in `tasks.md`.
Plan review persisted to `reviews/plan-review.md`.

Spec coverage: 43/44 requirements; all 8 scenario fingerprints have explicit
test assertions. Ready for Phase 4 (`/implement`).

## Review History

### Phase 3 plan review — 2026-05-17

Reviewer: `feature-dev:code-reviewer` (sonnet). Verdict: **PASS** (43/44 requirements
covered, all 8 §3.4 scenario fingerprints present, dependency chain correct, Groups 3
and 4 parallelizable). Three minor gaps addressed inline; review persisted to
`reviews/plan-review.md`.
