# Feature: Arpeggio & Chord Shapes — Detection and Fingerings

**Issue:** #16 | **Started:** 2026-06-12

## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [x] Phase 4: Implement

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
| Plan      | tasks.md    | complete | 1     | no       |
| Implement | FEATURE.md  | complete | 1     | no       |

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

### Phase 3 · Loop 1 — 2026-06-12

Task-planner agent (sonnet, feature-dev:code-architect) produced a 10-task-group breakdown
from spec rev 2: Types (1) → Scaffold (2) → filterChordTones (3) ∥ Formatters (7) →
scoreShapeMatch (4) → arpeggio builders (5) ∥ Curated data (8) → inferShapeContext (6) →
Docs (9) → Test review (10). Plan-reviewer agent (sonnet, feature-dev:code-reviewer)
verdict: NEEDS REVISION — 4 tracking-precision items, no architectural gaps (23/24
requirements covered, all 9 fixtures, all edge cases). Lead fixed all 4 directly in
tasks.md: `src/build.ts` added to Files to Modify (export `findShapeAnchorFret`, made the
definitive approach over inlining); `src/integration.test.ts` moved to Files to Create
("extend existing" was wrong — file doesn't exist); explicit stub-signature update step in
Group 4 (`scoreShapeMatch` gains 5th param `builtAnchorFret`, deliberate spec-signature
extension); barre-shape build-equivalence tests added to Group 8 (no `canonicalRoot` —
hardcoded verification roots). Plus reviewer minors: probe script in Files to Create
(temporary), caged-7th verification-root phrasing.

Sub-issues #18–#27 created (one per task group, `task-group` label, parent #16). All 10
deferred.md items filed as issues #28–#37 (enhancement label, Spark status on the project
board) per D-008.

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

## Phase 4: Implement

| Layer | Task Group                          | Status  | Agent | Notes |
| ----- | ----------------------------------- | ------- | ----- | ----- |
| 0     | TG1: Type Extensions & Registry Query | complete | sonnet | 360 tests pass |
| 1     | TG2: arpeggio.ts Module Scaffold    | complete | sonnet | stubs throw; types exported |
| 1     | TG7: Grouped Formatter Rendering    | complete | sonnet | byte-identical flat path kept |
| 1     | TG8: Curated Chord-Shape Data       | complete | sonnet | 16 shells; see oversight note |
| 2     | TG3: filterChordTones               | complete | sonnet | fixtures a/d = 10 notes |
| 3     | TG4: pcChroma & scoreShapeMatch     | complete | sonnet | 5th param builtAnchorFret |
| 3     | TG5: arpeggio Builders              | complete | sonnet | chroma-membership, frame-safe |
| 4     | TG6: inferShapeContext              | complete | sonnet | probe-confirmed rankings; 42 tests |
| 5     | TG9: API Docs & README              | complete | sonnet | examples re-verified by running |
| 6     | TG10: Test Review & Gap Analysis    | complete | sonnet | +13 tests; all 9 fixtures audited |

### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: Minor concern — `OPEN_G_DIM`/`OPEN_G_M7B5` in `open-chords.ts` use `baseFret:5` but are tagged `voicingFamily:"open"` (semantically barre, not open). Non-blocking; flagged for `/review`. Continued.
- **Layer 2**: No concerns. Continued.
- **Layer 3**: No concerns. Continued.
- **Layer 4**: No concerns (the `scoreShapeMatch` 5th-param `builtAnchorFret` is the intended documented spec extension per tasks.md). Also: spec fixture `"x033xx"` was wrong (3 PCs, not 2); implementer substituted a valid 2-PC grip for the min-evidence test. Continued.
- **Layer 5**: Concerns found in docs (wrong `get("CAGED G Shape")` lookups → `"G Shape"`; `SHELL_DICTIONARY` not re-exported; wrong `toAsciiTab`/`toAlphaTeX` example outputs). Fixed via a follow-up fix agent that re-verified every example by running it; `SHELL_DICTIONARY` now re-exported from `index.ts`. NOTE: pre-existing non-arpeggio README sections still use the broken `get("CAGED X Shape")` pattern (out of scope; flag for `/review`).

### Spec Compliance

- **Loop 1**: 0 gaps. 53 requirements reviewed (all R-1.1..R-7.3, all 9 fixtures (a)–(i), full edge-case table, all task-group ACs) — 0 Missing, 3 non-actionable Partials: (1) Fixture (h) test uses `"x00xxx"` (genuine 2-PC) instead of the spec's `"x033xx"` — but `"x033xx"` is actually A/F/Bb = 3 PCs, so the spec fixture text was wrong, not the impl (verified by MIDI math; added clarifying test comment); (2) probe script absent — by design, deleted post-use per tasks.md; (3) `tasks.md` TG8 AC said "4" shells but spec §3 defines both orderings → 16 total / 8 per string set (test asserts 8 correctly) — a tasks.md text error, no code change. **Converged at loop 1 (no actionable gaps); loop 2 not needed.**
