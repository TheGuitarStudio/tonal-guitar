# Requirements: Arpeggio & Chord Shapes — Detection and Fingerings

## Initial Description

tonal-guitar has no first-class support for chords and arpeggios as fretboard objects. Build
a voicing + arpeggio engine with **derivation from shapes as the core** (arpeggios are
chord-tone subsets of scale shapes), a **curated shape layer** where canonical fingerings
can't be derived, and **shape inference across pluggable pattern systems** (an Am7 arpeggio
rooted at 6th string/5th fret resolves to the G-shape of C major via relative/modal
reasoning). See `raw-idea.md` and issue #16.

## Requirements Discussion

### Round 1 Questions

**Q1: Scope cut** — research decomposed the XL into: A (arpeggio derivation), B (voicing
lookup engine), C (shape inference), D (curated data), E (Lab integration).
**Answer:** **A + C + minimal D.** Arpeggio derivation + shape inference + foundational
curated data. The voicing engine (B) becomes its own follow-up feature; Lab integration (E)
is always separate (connector precedent). Matches the issue title "Detection and Fingerings".

**Q2: Voicing generation architecture** (direction-setting for B, affects this spec's types):
**Answer:** **Hybrid.** Guitar-native string-by-string search (prune-while-building, existing
`fretboard.ts` math) for any future generation; adopt the `@tonaljs/voicing-dictionary`
interval-pattern FORMAT (e.g. `m7: ["3m 5P 7m"]`) for curated dictionary layers — without
taking the dependency.

**Q3: Curated data sets to ship:**
**Answer:** **7th-chord CAGED shapes** (maj7, m7, dom7, m7b5 per CAGED position), **selective
chords-db import** (open-position + standard barre shapes for core types; MIT), and **jazz
shell grips** (strings 654/543, `system: "shell"`). Sweep arpeggio shapes deferred.
**User direction:** track every deferred item as a task/idea — nothing forgotten.

**Q4: Simultaneous-note (strummed chord) rendering in formatters:**
**Answer:** **In scope** — extend both `toAlphaTeX` and `toAsciiTab` to accept grouped notes
(simultaneous-note groups per beat).

### Round 2 Questions

**Q5: Shape inference result contract:**
**Answer:** **Ranked candidates** — scored, ranked list of matches ({shape, system, root,
position, matched intervals, score}); empty array when nothing matches. Ambiguity is
first-class; callers/Lab can show alternatives.

**Q6: Shape inference inputs:**
**Answer:** **Both chord grips and arpeggios** — accepts a fret-array grip (à la
`parseChordFrets` output) AND an arpeggio/`FrettedScale`.

**Q7: Behavior across scales/systems beyond major-based CAGED:**
**Answer:** **Registry-driven, scale-agnostic.** Inference matches against whatever
`ScaleShape`s are registered, by interval-subset + root-anchor scoring — no major-scale
assumption. Teacher-custom systems work automatically; CAGED/3NPS are just registered data.

**Q8: Deferral tracking mechanism:**
**Answer:** **`deferred.md` register now + GitHub issues at Phase 3 (Plan).**

### Round 3 Questions

**Q9: Type strategy for harmonic metadata on curated shapes:**
**Answer (user's own direction):** Explore Tonal.js first — "we are a tonal extension
essentially." Align with Tonal's chord-type/voicing structures and naming standards; extend
`ChordShape` if needed, as long as the intent of `ChordShape` remains usable. Library-first:
make the API make sense and follow Tonal.js standards; the Lab UI can be figured out later —
but note that new settable parameters (beyond root) will eventually need Lab UI support
(today the Lab only sets a root).

**Q10: Forward-compatibility for the deferred voicing engine (B):**
**Answer:** **Extension points only.** Define the curated-dictionary interval-pattern format,
the voicingFamily vocabulary, and registry query needs — but no `voicings()` API design; B's
feature spec owns its own API.

### Existing Code to Reference

- `src/build.ts:160-234` (`buildFrettedScale`) — build engine works for any interval set
- `src/walker.ts` / `src/sequence.ts` — arpeggio exercises ride this machinery unchanged
- `src/integration.ts:79-99` (`identifyChord`), `:167` (`isShapeCompatible` — subset logic
  to invert for inference), `:26` (`buildFromScale`)
- `src/shape.ts:70-123` — registry pattern to follow for new data; `system` is an open string
- `src/data/caged-chords.ts` — format for new curated chord data
- `src/connect.ts` — shape-source-agnostic; works with arpeggio FrettedScales unchanged
- `docs/chord-formats-research.md` — chords-db format mapping
- Connector feature (`.tonal-guitar/features/connector-algorithm/`) — probe-first precedent:
  worked test fixtures committed in spec before implementation

## Visual Assets

No visual assets provided. Library-first feature; Lab UI is a deferred follow-up.

## Requirements Summary

### Functional Requirements

- **Arpeggio derivation (A):**
  - Pure chord-tone filter: `FrettedScale` + interval set → chord-tone `FrettedScale`
    (zero-Tonal-deps tier)
  - Integration-tier builder: shape + chord name + root → arpeggio `FrettedScale`
    (uses `Chord.get()` for intervals)
  - Derived arpeggios work with existing walker/sequence/connector machinery unchanged

- **Shape inference / detection (C):**
  - Accepts chord grips (fret arrays) and arpeggios/`FrettedScale`s
  - Returns ranked, scored candidates; empty array when no match
  - Registry-driven and scale-agnostic: interval-subset + root-anchor scoring against all
    registered shapes (optionally filtered by system)
  - Formal algorithm with worked fixtures committed in the spec (connector precedent)

- **Curated data (minimal D):**
  - 7th-chord CAGED `ChordShape`s: maj7, m7, dom7, m7b5 per applicable CAGED position
  - Selective chords-db import: open-position + standard barre shapes, core types only
  - Jazz shell grips on string sets 654/543, dictionary format per the Hybrid decision
  - Types extended Tonal-aligned (explore Tonal.js structures first)

- **Output (chord rendering):**
  - `toAlphaTeX` and `toAsciiTab` render simultaneous-note groups (strummed voicings)

### Reusability Opportunities

- Walker/sequence/connector engines: zero changes needed for arpeggio sequences
- `isShapeCompatible` subset logic as the seed of inference scoring
- Registry `add()` side-effect pattern for all new data files
- `parseChordFrets`/`formatChordFrets` notation for grip input

### Scope Boundaries

**In Scope:** chord-tone filtering + arpeggio building; shape inference (grips + arpeggios,
ranked output, registry-driven); curated 7th CAGED shapes, selective chords-db import, jazz
shells; Tonal-aligned `ChordShape` extension; simultaneous-note rendering in both formatters;
deferred-items register.

**Out of Scope (tracked in deferred.md):** voicing lookup/generation engine (B); Lab
integration (E) including UI for new settable parameters; sweep arpeggio shapes; full
chords-db import; `@tonaljs/voicing` dependency; voice-leading navigation.

### Technical Considerations

- No new peer dependencies (Hybrid decision); `@tonaljs/chord` usage stays in the
  optional-peer-dep tier (`integration.ts` boundary)
- Library is unpublished (v0.1.0) — breaking changes acceptable, but `ChordShape` intent
  must remain
- Dependency layering per CLAUDE.md: pure filter in zero-deps tier; `Chord.get()` usage in
  integration tier
- `buildFrettedScale` pitch-order assumption needs probe-testing for any out-of-register
  curated voicings (chords-db imports, shells)
- Lab `PipelineRecipe` forward-compat: new parameters should be settable via plain data so a
  future chord-type step doesn't require API rework
