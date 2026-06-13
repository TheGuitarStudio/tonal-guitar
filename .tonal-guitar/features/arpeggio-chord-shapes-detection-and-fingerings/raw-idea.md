## Problem

tonal-guitar can build scale shapes and walk patterns over them, but has no first-class support for **chords and arpeggios as fretboard objects**. The chord layer is minimal (5 CAGED major shapes, basic `identifyChord`), and there's no way to: generate arpeggio exercises from positions, look up playable voicings for an arbitrary chord type (drop 2, inversions, shells), or — critically — infer which pattern-system shape a given chord/arpeggio belongs to. A library whose purpose is auto-generating guitar exercises is incomplete without the harmonic half of the fretboard.

## Proposed Solution

Build a full voicing + arpeggio engine with **derivation from shapes as the core**: arpeggios are chord-tone subsets of scale shapes; voicings are generated from interval formulas + fretboard math, with Tonal supplying chord/scale theory. A **curated shape layer** supplements the engine wherever ergonomic/canonical fingerings can't be derived (research will determine how much is needed). The engine must support **shape inference across pattern systems** — e.g. an Am7 arpeggio rooted at 6th string/5th fret resolves to the G-shape of C major (relative/modal reasoning), not a literal A-major shape. Pattern systems (CAGED, 3NPS, one-string, teacher-custom) are pluggable contexts, not hard-coded assumptions.

**Research-first:** the spec phase begins with a survey of existing guitar voicing libraries/resources, analysis of beginner→advanced fingering conventions, and validation that derivation covers advanced voicing families (drop 2/3, inversions across string sets) — deciding the derive/curate boundary before architecture commits.

## User Stories

- As a **practicing guitarist**, I want arpeggio sequences generated from any position/shape so the Lab can produce chord-tone exercises like it does scale exercises
- As a **developer using the API**, I want `voicings('Cmaj7', { near: 5, family: 'drop2' })`-style lookup so any Tonal chord type yields playable fingerings
- As a **student**, I want to see which chords/arpeggios live inside a shape I'm learning so harmony connects to positions
- As a **teacher**, I want chord/arpeggio shapes tied to *my* pattern system (custom CAGED variants, one-string scales) so generated material matches my curriculum
- As an **advanced player**, I want voicing-family study material (drop 2 across string sets, inversion cycles) that moves beyond CAGED/3NPS forms

## Context

- **Roadmap alignment:** New major direction — the harmonic counterpart to the existing melodic/sequence engine
- **Related features:** `connector-algorithm`, `connector-lab-integration` (in flight; this runs research in parallel, implementation after)
- **Existing infrastructure:** `ChordShape` type + registry (`shape.ts`), `applyChordShape` (`build.ts`), `identifyChord` (`integration.ts`), CAGED chord data, walker/sequence engine (arpeggios can ride the existing sequencing machinery), Tonal chord/scale integration

## Open Questions

- Can derivation from scale shapes cover advanced voicing families (drop 2, drop 3, shells, wide-interval), or where exactly does the curated library take over?
- How do CAGED/3NPS-style systems behave for non-major-based scales (harmonic/melodic minor, symmetric scales)? What's the inference rule there?
- What's the formal model for shape inference (chord/arpeggio → parent shape via relative/modal reasoning)? Needs a defined algorithm, not heuristics
- How do teacher-custom pattern systems plug in — extension of the existing registry pattern?
- Which external libraries/datasets (chord databases, voicing dictionaries) are worth analyzing or importing?
- Does the API need refactoring to make this feel first-class (per raw idea: "if we need to refactor so be it")?

## Rough Assessment

- **Size:** XL
- **Priority:** P1 — research starts now (parallel with connector work); implementation after connectors land
- **Depends on:** None hard; sequencing-wise follows connector-algorithm/connector-lab-integration for implementation

---

_Captured via `/idea` brainstorming session on 2026-06-12_
