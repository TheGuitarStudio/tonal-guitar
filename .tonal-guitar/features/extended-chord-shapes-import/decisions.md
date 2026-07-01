# Decisions: Curated Extended Chord Shapes Import

Technical decisions made during the Shape phase. Each is numbered sequentially and captures
context, options, and rationale.

---

## D-001: Voicing family — E/A-form (CAGED), not drop2/drop3

**Context:** Extended chords (6ths, 9ths, 13ths, altered dom) are canonically voiced as drop2/drop3
on the guitar, and the `VoicingFamily` type already reserves `"drop2" | "drop3" | "drop2+4" |
"sweep"` — but **zero** registered shapes use them (only `caged`/`barre`/`open`/`shell` exist). Which
family should #31's data use?

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| E/A-form (CAGED) | Continues `caged-chords-7th.ts`; stays "additive curation"; one query path; simplest verify | 6-string barre extensions are partial/awkward; not how jazz players voice these |
| drop2/drop3 | Authentic jazz voicings; activates dormant enum; clean 4-string sets | New family conventions; broader scope; overlaps #28's generative territory |
| Both | Most complete vocabulary | ~50+ shapes; stretches #31 far beyond curation |

**Decision:** **E/A-form (CAGED).** `system: "caged"`, `voicingFamily: "caged"`.

**Rationale:** Keeps #31 a clean, low-risk additive-data feature on shipped infrastructure, matching
the issue's explicit framing. A drop2/drop3 set is real future value but belongs in its own effort
(nearer #28). Reversible: adding a drop voicing family later is purely additive.

---

## D-002: Tonal fidelity — `chordType` = `Chord.get` symbol, compound intervals

**Context:** Tonal interop is a hard acceptance criterion. The library has **no** translation table
between our `chordType` and Tonal symbols — the relationship is by convention. Should our naming
track Tonal exactly, or use guitar-friendly names?

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Match `Chord.get` symbol + compound intervals (`9M`,`13M`) | Clean cross-library round-trip; honest degree metadata; no translation layer needed downstream | A few names less guitarist-familiar (`7#5` vs `aug7`); detect still diverges in 4 cases |
| Guitar-friendly names + simple intervals (`2M`,`6M`) | Familiar to players | Breaks the "one shared vocabulary" user story; needs a translator for Tonal joins |

**Decision:** **Match `Chord.get` symbol; write extensions as compound intervals.** Register `7#5`
(not `aug7`) since `Chord.get("Caug7").symbol === "C7#5"`.

**Rationale:** The whole point of user story 3 is one vocabulary across both libraries with no
translation layer. Compound intervals match `Chord.get(symbol).intervals` and keep `degree`/
`intervalNumber` metadata correct. Build engine handles compound intervals (chroma-based).

---

## D-003: Document detect-divergences instead of renaming to chase them

**Context:** For 4 suffixes, Tonal's `detect(notes)` returns a different string than `Chord.get`'s
`symbol`: `add9`→`CMadd9`, `mMaj7`→`Cm/ma7`, `6/9`→`C6add9`, and `aug7` normalizes to `7#5`.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Keep `chordType` = `Chord.get` symbol; document divergence | Stable, canonical key; query-friendly; one source of truth | `identifyChord` on a built grip won't string-equal `chordType` in these 4 cases |
| Rename `chordType` to the `detect` alias | `identifyChord` round-trips by string equality | `detect` output varies with inversion/notes; aliases are inconsistent; pollutes the key |

**Decision:** **Keep `Chord.get` symbol as `chordType`; publish a divergence catalog** in the spec
and in the data file's header JSDoc.

**Rationale:** `detect` output is context-dependent and alias-y; `Chord.get` symbols are stable and
make the best registry key. Tests assert chord-tone **chroma membership** (robust) rather than exact
`detect` string equality where the two diverge.

---

## D-004: Partial voicings are first-class — require `omittedIntervals`

**Context:** A `13` chord has 6 tones (1 3 5 ♭7 9 13); `9`/`maj9`/`m9`/`6/9` have 5. An E/A movable
grip on 4–5 strings must drop tones. The issue explicitly wants omitted-tone relationships to stay
*visible and queryable*.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Always set `omittedIntervals` + reduced `stringSet` | Relationship stays derivable; honest metadata; query layer can reason about completeness | Slightly more authoring per shape |
| Leave omitted tones implicit | Less metadata to author | Breaks queryability; downstream can't tell a partial voicing from a complete one |

**Decision:** **Every voicing that omits a chord tone sets `omittedIntervals`.** Omission priority:
**5th first**, then (for `13`) the **9th**; never omit the 3rd or the characteristic extension/7th.

**Rationale:** Directly serves the "visible and queryable relationships" requirement and the
arpeggio-source user story. Mirrors how `jazz-shells.ts` already uses `omittedIntervals` for shells.

---

## D-005: Suffix scope — all 3 tiers (~16), 11ths deferred

**Context:** The issue proposes 3 tiers totalling ~16 suffixes and defers 11ths. All 16 were verified
to resolve cleanly in `@tonaljs/chord`.

**Decision:** **Ship all 3 tiers** (Tier 1 `6 m6 9 maj9 m9 add9`; Tier 2 `13 dim7 mMaj7 7sus4 6/9`;
Tier 3 `7b9 7#9 7#5 7b5`). Defer `11`/`m11`/`maj11`.

**Rationale:** Every suffix is high-value, resolves in Tonal, and is a real guitar voicing. The full
set delivers a credible publish-ready vocabulary in one pass. 11ths voice poorly and are usually
implied — correctly deferred to #28. Note: `7#5` and `aug7` collapse to one Tonal chord, so the
altered tier yields 4 distinct `chordType`s (15–16 types total).

---

## D-006: New file + new test file; one side-effect import; no new public exports

**Context:** Where does the code live and what's the public surface?

**Decision:** New `src/data/extended-chords.ts` (registers via `chordShapes.add`); new
`src/data/extended-chords.test.ts`; add `import "./data/extended-chords";` to `src/index.ts` after
the existing data imports. **No** new re-exports — consumers use existing `chordShapes`,
`applyChordShape`, `arpeggioFromShape`, `identifyChord`.

**Rationale:** Mirrors `caged-chords-7th.ts` exactly (which also adds no re-exports). Keeps the
public API stable; the feature is purely additive data. Separate test file keeps the already-large
`data.test.ts` focused.
