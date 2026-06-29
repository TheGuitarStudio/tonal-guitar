# Deferred Items: Arpeggio & Chord Shapes — Detection and Fingerings

Running register of everything consciously deferred during this feature (per D-008).
**At Phase 3 (Plan), each open item below gets filed as a GitHub issue** (idea/Spark or
follow-up label) so it lands on the project board. Check items off as they're filed.

| # | Item | Why deferred | Origin | Filed |
| - | ---- | ------------ | ------ | ----- |
| 1 | **Voicing lookup/generation engine (sub-feature B)** — `voicings('Cmaj7', {near, family})`-style API; guitar-native prune-while-building search; drop-2/3/2+4 derivation by formal rule; playability scoring | Own feature with own research mandate (D-001); this feature ships its extension points (D-010) | Scope cut Q1 | [x] #28 |
| 2 | **Lab integration (sub-feature E)** — chord-type step in PipelineRecipe, arpeggio mode, voicing display. Includes UI for newly settable parameters (today the Lab only sets root; chord type / inversion / string set etc. need UI exploration) | Always a separate follow-up feature (connector precedent); user: library-first, "figure out a UI later" | Scope cut Q1 + Q9 user note | [x] #29 |
| 3 | **Sweep-picking arpeggio shapes** — curated 1-note-per-string forms (`system: "sweep"`); the one arpeggio family not derivable from scale positions. Scope question: 3/5/6-string forms, triads vs 7ths (no authoritative canon) | Technique-specific niche, separable from engine | Curated data Q3 | [x] #30 |
| 4 | **Full chords-db import** — remaining ~79 suffixes beyond the selective core-type import | Bloat; extended types should come from the future derivation engine | Domain research | [x] #31 |
| 5 | **@tonaljs/voicing / voicing-dictionary / voice-leading dependency evaluation** — revisit if the curated dictionary format (D-002) proves insufficient | Hybrid decision took the format, not the dependency | Voicing arch Q2 | [x] #32 |
| 6 | **Voice-leading / "nearest voicing" navigation** — minimize-movement selection between successive voicings (à la @tonaljs/voice-leading, fretboard-js position transitions) | Depends on B | Domain research | [x] #33 |
| 7 | **CAGED classification for non-standard voicings** — inference scoring will rank canonical shapes reliably; algorithmically-generated voicings on unusual string sets remain inherently ambiguous and may need dedicated heuristics/labeling | Unsolvable ambiguity acknowledged in research OQ5; ranked-candidates contract (D-005) leaves room | Domain research | [x] #34 |
| 8 | **Upper-structure arpeggio helpers** — arpeggios of substitute/related chords over a base chord (V7 over IIm etc.) | Advanced pedagogy; expressible later via existing shape+walker once A lands | Domain research §3 | [x] #35 |
| 9 | **Grip → ChordShape classification (`inferChordShape`)** — match a grip against the curated chord-shape registry ("is this the A-form barre?"); different query than parent-scale-position inference. Registry `.query()` + metadata groundwork ships in this feature | Separate query model; curated data must exist first | Codex review C-13 | [x] #36 |
| 10 | **Diatonic-degree arpeggio sugar** — `diatonicArpeggioFromShape(shape, scaleName, degree, …)` for "give me the ii7 arpeggio in this shape" without naming the chord | Thin layer over `arpeggioFromScale` + Tonal Key/Scale helpers | Codex review C-14 | [x] #37 |

## Existing debt that interacts (already tracked elsewhere — do not re-file)

- ASCII tab column alignment for multi-digit frets (QUESTIONS.md Q2 / CLAUDE.md remaining
  work) — interacts with D-004 chord-column rendering; spec must address the interaction
- Task 2.5: 7/8-string rootString auto-adjustment (CLAUDE.md remaining work) — affects
  inference root-anchor scoring on extended-range tunings eventually
