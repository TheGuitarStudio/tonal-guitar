# Feature: Curated Extended Chord Shapes Import

**Issue:** #31 | **Started:** 2026-06-30

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [x] Phase 4: Implement

## Context

- **Origin:** /idea #31
- **Branch:** feat/extended-chord-shapes-import
- **Priority:** P2
- **Size:** M

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | complete | 1     | no       |
| Shape     | spec.md     | complete | 1     | yes      |
| Plan      | tasks.md    | complete | 1     | no       |
| Implement | FEATURE.md  | complete | 1     | no       |

## Loop History

{Appended per loop iteration — what changed and why}

## Review History

### Shape · External review (Codex) — 2026-07-01

Codex reviewed `spec.md` + `decisions.md` + `research.md` against the live codebase and Tonal
package (`reviews/spec-review.md`). Six findings, all incorporated:

1. **Count 16→15** — `aug7` is an alias of `7#5`, not a separate registry key. Fixed across spec.
2. **False `aug7` normalization** — `Chord.get("Caug7").symbol` is `"Caug7"`, NOT `"C7#5"` (verified
   pkg 6.1.2). Same chord, `detect` prefers `C7#5`. Rationale corrected in decisions/research/spec.
3. **A Shape 13 example unplayable** (`x 3 8 9 10 x`) — replaced with the standard C13 grip
   `x 3 2 3 3 5` (omits only 5th). Clarified example fingerings are illustrative, interval row normative.
4. **E Shape 6 fingering mismatch** — examples relabeled; shapes must derive from a concrete
   six-string prototype and be tested for playability, not just interval build.
5. **Identification tests split (D-007)** — full voicings → exact/alias `detect`; partials →
   chroma-subset only (omitted-tone grips don't `detect` as the full chord).
6. **Tuning scope (D-008)** — standard six-string; alternate/7-8-string best-effort, documented.

Added decisions D-007, D-008. Added risks (partial-voicing detect, math-valid-but-unplayable rows).

## Phase 4: Implement

| Layer | Task Group                                          | Status  | Agent | Notes |
| ----- | --------------------------------------------------- | ------- | ----- | ----- |
| 0     | TG1: Scaffold + parametrized test harness           | complete | sonnet | -     |
| 1     | TG2: Tier 1 — Essential shapes                      | complete | sonnet | Lead fixed hardcoded registry counts in data.test.ts |
| 2     | TG3: Tier 2 — Jazz core shapes                      | complete | sonnet | Agent stalled once; resumed and completed |
| 3     | TG4: Tier 3 — Altered dominant shapes               | complete | sonnet | -     |
| 4     | TG5: Cross-cutting interop + final verification     | complete | sonnet | Docs listing updated in docs/api/arpeggios.md |

### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: No concerns. Continued. (Post-merge fix: data.test.ts registry counts parameterized over EXTENDED_CHORD_SHAPES.length.)
- **Layer 2**: No concerns. Continued.
- **Layer 3**: No concerns. Continued.
- **Layer 4**: No concerns. Continued.

### Spec Compliance

- **Loop 1**: 1 gap found (EXT_CHORD_E_6 diverged from the spec's normative worked-example interval row), 1 fixed.
- **Loop 2**: 0 gaps remaining.
