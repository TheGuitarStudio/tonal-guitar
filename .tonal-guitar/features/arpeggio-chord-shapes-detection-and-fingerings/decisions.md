# Decisions: Arpeggio & Chord Shapes — Detection and Fingerings

Technical decisions made during the Shape phase.

---

## D-001: Scope cut — A + C + minimal D

**Context:** Research decomposed the XL issue into sub-features: A (arpeggio derivation),
B (voicing lookup engine), C (shape inference), D (curated data), E (Lab integration).

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| A + C + minimal D | Matches issue title "Detection and Fingerings"; bounded; B gets its own research-backed spec | Voicing user story deferred |
| Full engine (A+B+C+D) | One coherent spec | Very large spec; B has unresolved architecture questions |
| A only | Leanest | Detection (the issue's "critical" capability) deferred |
| A + B | Generation features together | Defers the novel-algorithm work the issue emphasizes |

**Decision:** A + C + minimal D. B and E are separate follow-up features.

**Rationale:** Highest-leverage core plus the issue's named "critical" capability
(inference), with curated data scoped to what detection and fingering lookup need.
Reversible — B composes on top of this feature's extension points (D-010).

---

## D-002: Voicing architecture direction — Hybrid

**Context:** Future voicing generation (B) and this feature's curated dictionary layer need
an architectural direction; affects whether new Tonal peer deps are added now.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Guitar-native search | No new deps; span/playability-aware | Reimplements dictionary curation |
| Adapt @tonaljs/voicing | Maintained dictionary | Piano-centric; no string/fret/span model; new optional peer deps |
| Hybrid | Native math + proven dictionary FORMAT, no dependency | Format kept in sync manually |

**Decision:** Hybrid — guitar-native generation math; adopt the voicing-dictionary
interval-pattern format (e.g. `m7: ["3m 5P 7m"]`) for curated layers; no new peer deps.

**Rationale:** The dictionary format is the valuable, stable part; the generation pipeline
is piano-centric and would need replacement anyway.

---

## D-003: Curated data sets — 7th CAGED + selective chords-db + jazz shells

**Context:** Research's derive-vs-curate boundary: curate only open-string-dependent,
technique-specific, or pedagogically canonical shapes.

**Decision:** Ship (1) 7th-chord CAGED shapes (maj7, m7, dom7, m7b5 per position),
(2) selective chords-db import (MIT) of open-position + standard barre core types,
(3) jazz shell grips (`system: "shell"`, strings 654/543). **Sweep arpeggio shapes
deferred** (tracked in deferred.md).

**Rationale:** These three directly support detection fixtures and the "fingerings" user
stories; sweep shapes serve a technique niche separable from the engine. User direction:
every deferral must be tracked so nothing is forgotten.

---

## D-004: Simultaneous-note rendering — in scope, both formatters

**Context:** Arpeggio sequences render today, but neither formatter can render strummed
chord voicings (every `FrettedNote` is a sequential event).

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Out of scope | Keeps XL bounded | Voicings unrenderable — weak demo/test story |
| In scope, both | Voicings fully usable end-to-end | Formatter interface change |
| AlphaTeX only | Native chord support there | ASCII tab gap remains |

**Decision:** In scope for both `toAlphaTeX` and `toAsciiTab` — accept grouped
simultaneous notes (e.g. `FrettedNote[][]` per beat or equivalent).

**Rationale:** User chose full support; curated chord data without rendering would be
hard to verify and demo. Interacts with ASCII tab multi-digit alignment debt
(QUESTIONS.md Q2) — spec must address.

---

## D-005: Inference output — ranked candidates

**Context:** No open-source precedent for CAGED classification; non-canonical voicings are
inherently ambiguous between positions.

**Decision:** Return a scored, ranked candidate list ({shape, system, root, position,
matched intervals, score}); empty array when nothing matches (empty-result convention).

**Rationale:** Ambiguity is real and should be first-class; a single-best API would bake a
tie-break policy into the library and hide information the Lab can usefully display.

---

## D-006: Inference inputs — both grips and arpeggios

**Context:** Detection user stories cover both "what shape is this chord I'm holding"
(fret-array grip) and "which shape does this arpeggio/note collection live in".

**Decision:** Accept both a fret-array grip (compatible with `parseChordFrets` output) and
a `FrettedScale`/arpeggio note collection.

**Rationale:** Covers student/teacher detection stories; grip path reuses existing
notation primitives.

---

## D-007: Systems rule — registry-driven, scale-agnostic

**Context:** Issue open question: how does inference behave for non-major-based scales and
teacher-custom systems? "Needs a defined algorithm, not heuristics."

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Registry-driven, scale-agnostic | No major-scale assumption; custom systems work automatically | Scoring must be robust across heterogeneous shape data |
| Major-based MVP | Smaller test matrix | Documented limitation; custom-system story weakened |

**Decision:** Registry-driven, scale-agnostic: interval-subset + root-anchor scoring
against all registered `ScaleShape`s, optionally filtered by `system`.

**Rationale:** The registry's open `system` string already makes pattern systems pluggable;
inference inherits that for free. CAGED/3NPS become test data, not special cases.

---

## D-008: Deferral tracking — deferred.md register + issues at Plan

**Context:** User: "track any things we don't do as tasks or further ideas... I don't want
to forget anything we may be deferring."

**Decision:** Maintain `deferred.md` in the feature directory during shaping; at Phase 3
(Plan), file each item as a GitHub issue (idea/Spark or follow-up label) on the project
board.

**Rationale:** Avoids issue churn while scope is still moving; guarantees board visibility
before implementation starts.

---

## D-009: Type strategy — Tonal-aligned extension of ChordShape

**Context:** Curated 7th shapes, chords-db imports, and shells need harmonic metadata
(chord type, inversion, voicing family, string set); `ChordShape` is purely geometric.

**Decision (user's own direction):** Explore Tonal.js structures first — "we are a tonal
extension essentially." Align field names/values with Tonal conventions (chord-type
aliases from `@tonaljs/chord-type`, interval strings, dictionary format per D-002). Extend
`ChordShape` if needed, provided the original intent of `ChordShape` remains usable.
Library-first: API correctness and Tonal alignment now; Lab UI later — but new settable
parameters (beyond root) must be expressible as plain data so a future Lab UI can set them.

**Rationale:** Consistency with the peer-dependency ecosystem beats inventing a parallel
vocabulary; unpublished v0.1.0 makes extension cheap, and keeping one type/registry avoids
API surface growth.

---

## D-010: B forward-compatibility — extension points only

**Context:** The deferred voicing engine (B) will build on this feature's types and data
formats.

**Decision:** This spec defines the curated-dictionary interval-pattern format, the
voicingFamily vocabulary, and registry query needs — but does NOT design the `voicings()`
API. B's own feature spec owns its API.

**Rationale:** Freezes only what's cheap to get right now (formats/vocabulary) and leaves
API design to the feature with the research mandate for it.

---

## D-011: Arpeggio API separates parent context from target chord (chroma-based)

**Context:** External review (Codex, Blocker 1) caught that the drafted
`arpeggioFromShape(shape, chordName, root)` conflated two interval frames:
`FrettedNote.interval` is parent-scale-relative while `Chord.get().intervals` is
chord-tonic-relative. As drafted, the canonical "Am7 in the G-shape of C" story was
impossible through the friendly API — it would return a misleading partial.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Split: pure parent-frame filter + chroma-based builders with explicit parentRoot | Canonical story works; non-major parents supported via arpeggioFromScale | Two-function surface |
| Translate chord intervals to parent frame internally | Single function | Requires scale-context inference inside the builder; fails off-scale chords |
| Document tonic-only limitation | No change | Breaks the feature's core user story |

**Decision:** `filterChordTones(scale, intervals)` stays pure and parent-frame;
`arpeggioFromScale(parent, chordName)` and
`arpeggioFromShape(shape, chordName, parentRoot, tuning?)` match chord membership by
chroma (tonic from the chord symbol, falling back to parentRoot for bare types). Result
`root` = chord tonic.

**Rationale:** The frame distinction is real music theory, not API taste; chroma
membership is frame-safe and enharmonic-safe, and `arpeggioFromScale` works for any
parent scale (harmonic minor etc.), not just major.

---

## D-012: Inference position model — anchorFret + rootFret, circular mod-12 distance

**Context:** External review (Blockers 3/4) showed the drafted `position` field and
linear position-distance term contradicted `build.ts` anchor semantics:
`findShapeAnchorFret` anchors on the FIRST rootString interval (E-shape of F anchors at
fret 0, not 1) and snaps to the nearest natural fret (CAGED_A of A anchors at fret 11),
which made the committed fixture rankings false.

**Decision:** `InferenceCandidate` exposes raw `anchorFret` (build anchor) and
`rootFret` (lowest 1P fret on the rootString, if present) instead of an ambiguous
`position`; display naming belongs to callers. The positionAgreement score term uses
**circular mod-12 fret distance**, since shapes repeat every octave.

**Rationale:** Reporting both raw values keeps the library honest about build semantics
while giving UIs the guitarist-friendly number (rootFret). Mod-12 distance removes the
octave-anchoring artifact and was hand-verified to restore the intended rankings in
fixtures (b), (c), (g). Exact rankings remain gated on a Phase 4 probe script before
test assertions land (connector probe-first precedent).
