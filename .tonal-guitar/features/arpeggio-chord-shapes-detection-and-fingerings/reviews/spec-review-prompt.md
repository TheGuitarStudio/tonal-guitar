Review the following feature specification for tonal-guitar, a standalone TypeScript library for guitar fretboard math, shapes, patterns, and sequences, built on Tonal.js primitives (peer dependencies). Pure functions only, named exports, empty-result sentinels instead of exceptions.

Read these files (relative to the repo root):

- Specification: .tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/spec.md
- Decisions: .tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/decisions.md
- Research (context): .tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/research.md
- Project conventions: CLAUDE.md

Also consult the actual source where useful: src/shape.ts, src/build.ts, src/integration.ts, src/walker.ts, src/notation.ts, src/data/caged-scales.ts, src/data/three-nps.ts, src/output/alphatex.ts, src/output/ascii-tab.ts.

Evaluate from product, technical, and music-theory perspectives:

**Product lens:**
- Are there obvious requirements missing? Things library users (guitarists, teachers, the Guitar Lab site) would expect but aren't specified?
- Is the scope right-sized given the decision log (D-001 cut: arpeggio derivation + shape inference + minimal curated data; voicing engine deferred)?

**Technical lens:**
- Do the technical decisions make sense? Are there better approaches?
- Is the type design complete (ChordShape extension, InferenceCandidate, VoicingFamily)? Missing fields, wrong optionality?
- Are the API signatures complete and consistent with the library's conventions (pure functions, sentinels, dependency tiers per CLAUDE.md)?
- Is the shape-inference algorithm (spec §B) sound? Scrutinize the scoring weights, the coverage gate, root-candidate enumeration, chroma comparison, and the deterministic tie-break. Any inputs that would rank absurdly?
- Formatter changes (§Formatter changes): is the FrettedNote[][] grouped-input design backward-compatible as claimed?

**Music-theory lens (important):**
- Verify the worked fixtures (spec §Test Fixtures) note-by-note: the Am7→G-shape-of-C-major fixture table (frets/pcs/intervals), the Gmaj7 E-shape count (9 notes), the 3NPS maj7 count (10 notes), the open-C and F-barre detections. Flag ANY wrong fret, pitch class, interval, or count — these become test assertions and wrong fixtures poison implementation.
- Is the shell-dictionary interval-pattern usage (compound 10M/10m for R-7-3 orderings) correct?

**General:**
- What would you challenge or push back on?
- What's the biggest risk in this spec?

Write your review as structured markdown and SAVE IT to: .tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/reviews/spec-review.md
Also print the full review as your final message. Use verdict categories: BLOCKER / SHOULD-FIX / CONSIDER / NITPICK, each finding with a spec section reference.
