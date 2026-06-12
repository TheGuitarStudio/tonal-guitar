# Feature: Arpeggio & Chord Shapes — Detection and Fingerings

**Issue:** #16 | **Started:** 2026-06-12

## Pipeline Progress

- [x] Phase 1: Research
- [ ] Phase 2: Shape
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
| Shape     | spec.md     | pending | 0     | no       |
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

## Review History
