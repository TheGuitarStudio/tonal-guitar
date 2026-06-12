# Feature: Arpeggio & Chord Shapes — Detection and Fingerings

**Issue:** #16 | **Started:** 2026-06-12

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** /idea #16
- **Branch:** feat/arpeggio-chord-shapes-detection-and-fingerings
- **Priority:** P1
- **Size:** XL

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | complete | 1     | no       |
| Shape     | spec.md     | complete | 1     | yes      |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Loop History

### Phase 1 · Loop 1 — 2026-06-12

Three parallel research agents (sonnet): codebase, product, and an external domain survey
(added beyond the standard two because the issue is explicitly research-first).

**Codebase:** the one missing core primitive is a chord-tone filter
(`FrettedScale` + chord intervals → chord-tone `FrettedScale`) — walker, sequences,
connector, and formatters all compose with it unchanged. `Chord.get()` is unused but
already available for interval lookup. `ChordShape` can't express voicing families /
inversions; formatters can't render simultaneous notes; the registry already supports
teacher-custom systems via open `system` strings.

**Domain survey:** drop-2/3/2+4/shells and CAGED/3NPS arpeggios are fully derivable from
interval formulas + fretboard math; curation is needed only for open-position chords
(selective chords-db import, MIT), sweep-picking shapes, and canonical jazz-shell
selections. No open-source precedent exists for CAGED shape inference — novel algorithm.
chord-fingering (GPL-3.0) is reference-only.

**Product:** strong alignment (completes the original design's chord/scale/arpeggio
triad). Recommended decomposition of the XL: A arpeggio derivation (MVP) / B voicing
engine / C shape inference / D curated data / E Lab integration (always separate, per
connector precedent). Connector dependency is met — both connector features functionally
complete.

8 open questions carried into the Shape phase (scope cut, voicing architecture, type
design, inference formal model, data plan, naming, chord rendering, Lab forward-compat).

### Phase 2 · Loop 1 — 2026-06-12

Three interactive Q&A rounds resolved all 8 research questions into decisions D-001..D-010:
scope cut **A + C + minimal D** (voicing engine B and Lab E deferred as own features);
Hybrid voicing architecture (guitar-native math, voicing-dictionary FORMAT, no new deps);
curated data = 7th-chord CAGED + selective chords-db import + jazz shells (sweep deferred);
chord rendering IN scope for both formatters; inference = ranked candidates, both grip and
arpeggio inputs, registry-driven scale-agnostic; deferral tracking via deferred.md + issues
at Plan; **Tonal-aligned types** (user direction: "we are a tonal extension essentially");
B forward-compat = extension points only.

Synthesis agent (opus) produced the spec; lead corrected 4 issues pre-review (pentatonic
tightness ranking → system-filtered fixtures, chroma-based PC comparison, stringSet
convention unification, fixture (e) artifact cleanup).

**External review via Codex CLI** — user direction mid-phase: ported guitar-studio's
`/codex` skill into this repo (`.claude/skills/codex/`) and ran the review in a herdr tab
(`codex exec --sandbox workspace-write`, ~92k tokens). Review found 4 real blockers (see
Review History). Spec rev 2 resolves all 20 findings; D-011/D-012 capture the two design
changes; deferred items 9-10 added.

## Review History

### Phase 2 spec review — 2026-06-12 (Codex, external)

Reviewer: OpenAI Codex CLI 0.139.0 via the newly-ported `/codex` skill; persisted to
`reviews/spec-review.md` (prompt in `reviews/spec-review-prompt.md`). Verdict: "would not
implement as written" — 4 BLOCKER, 8 SHOULD-FIX, 5 CONSIDER, 3 NITPICK. Blockers, all
verified against source before fixing: (1) arpeggio API conflated chord-frame vs
parent-frame intervals — canonical Am7-in-C story impossible; (2) fixture (d) count wrong
(10 not 9 — missed A-string 3M, D-string 7M in CAGED_E); (3) `position` contradicted
`findShapeAnchorFret` semantics (E-shape of F anchors at 0); (4) fixture (g) ranking false
under linear position distance (CAGED_A of A anchors at fret 11). Resolutions in spec
rev 2 Review Changelog: API split with chroma membership (D-011), anchorFret/rootFret +
mod-12 circular distance (D-012), corrected fixtures with probe-script gate, score
breakdowns, min-evidence gate, omittedIntervals/canonicalRoot fields.
