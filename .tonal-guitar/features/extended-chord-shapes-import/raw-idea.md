## Problem

The chord registry currently carries only 10 core types (M, m, 7, maj7, m7, dim, aug, sus2, sus4, m7b5). Common, harmonically rich chords learners actually pick — sixths, ninths, altered dominants — have **no shapes at all**. This limits the Lab's chord palette (#29), starves `arpeggioFromShape` of useful sources, and leaves the library looking incomplete for publishing. Just as important: any new chord type must stay **relationally coherent with Tonal.js** — a user combining `tonal` + `tonal-guitar` should be able to resolve chord ↔ scale ↔ arpeggio relationships, and that only works if our `chordType` symbols and interval naming round-trip cleanly through Tonal's core theory primitives.

## Proposed Solution

Curate a **high-value extended subset** (~16 suffixes) from tombatossals/chords-db into a new `src/data/extended-chords.ts`, following the established `ChordShape` metadata format. Ship **1–2 movable forms per type** (E-form / A-form, the way guitarists actually voice extensions) rather than full CAGED — keeping it lean and avoiding the "bloat" that got the full ~79-suffix import deferred. The rare long tail stays deferred to the derivation engine (#28).

**Tonal interop is a first-class acceptance criterion, not an afterthought.** For every suffix we add, verify the round-trip and relationships hold using the existing `integration.ts` bridge and Tonal patterns:
- `chordType` symbol resolves via `@tonaljs/chord` (`Chord.get`) and matches what `identifyChord` produces — naming and inference agree.
- The chord's tones map to its scale context (`arpeggioFromScale`, `analyzeInKey`, `relatedScales`) so "which scales contain / relate to this chord" and "arpeggio of this chord in this position" stay derivable.
- Input/output schemas (chord symbol strings, interval names, degree fields) are **compatible across both libraries** — same vocabulary in, same vocabulary out — so downstream query layers can join them without translation.

These relationships don't always line up perfectly (guitar voicings omit/double tones), but the schemas should make the relationships *visible and queryable* where they exist.

**Proposed suffix tiers** (adjust during implementation):

| Tier | Suffixes | Rationale |
|------|----------|-----------|
| 1 — Essential | `6`, `m6`, `9`, `maj9`, `m9`, `add9` | Ubiquitous; great arpeggio sources |
| 2 — Jazz core | `13`, `dim7`, `mMaj7`, `7sus4`, `6/9` | Standard jazz/blues vocabulary |
| 3 — Altered dom | `7b9`, `7#9`, `7#5` (aug7), `7b5` | Dominant color; high arpeggio value |

~16 types × ~2 shapes ≈ **30–35 new shapes**. 11ths (`11`, `m11`, `maj11`) deferred — they voice poorly on guitar and are usually implied.

## User Stories

- As a Lab user, I want to pick `Cmaj9` or `A7b9` and see a real fingering, so the chord step covers more than triads and basic 7ths.
- As an exercise generator, I want `arpeggioFromShape` to accept sixth/ninth/altered chords, so I can drill jazz and blues arpeggios.
- As a developer using `tonal` + `tonal-guitar` together, I want chord symbols, intervals, and degrees to share one vocabulary, so I can resolve chord ↔ scale ↔ arpeggio relationships across both libraries without writing a translation layer.
- As a library evaluator, I want a credible chord vocabulary out of the box, so tonal-guitar reads as publish-ready.

## Context

- **Related features:** #28 (derivation engine — long-tail home), #29 (Lab palette — primary consumer), #16 (shipped the `ChordShape` format + registry)
- **Existing infrastructure:** `ChordShape` metadata format, `chordShapes` registry + `.query()`, `applyChordShape`, `caged-chords-7th.ts` as the file/format precedent. `integration.ts` already bridges Tonal Scale/Chord/Key (`identifyChord`, `arpeggioFromScale`, `analyzeInKey`, `relatedScales`) — the place to validate relational coherence. Not greenfield — purely additive data + interop verification.
- **Future exploration (explicitly out of scope for this issue):** a CLI / MCP server / convenience query helpers for "give me everything about this chord/scale/arpeggio across both libraries." Not built here, but the schemas added in this issue should be designed so such a layer can sit on top later without reshaping data.

## Open Questions

- **Naming round-trip** — do the chosen suffixes resolve cleanly through `identifyChord` / `@tonaljs/chord`, and does our `chordType` string match Tonal's symbol? Spot-check the ambiguous ones (`6/9`, `aug7` vs `7#5`, `dim7` vs `dim`).
- **Schema compatibility** — are there any fields (interval naming, degree, inversion) where tonal-guitar and Tonal disagree in vocabulary? Catalog mismatches so a future query layer doesn't have to translate.
- **Scale/arpeggio relationships** — for each new chord, which scales/modes should it relate to, and do `arpeggioFromScale` / `relatedScales` surface those correctly? Where a voicing omits tones, is the relationship still derivable?
- **Shapes per type** — is E-form + A-form enough, or do sixths/ninths warrant a C/D open form too for the Lab?

## Rough Assessment

- **Size:** M (curation + per-suffix Tonal interop verification; additive only, no engine)
- **Priority:** P2 — unblocks richer #29, but #29 itself can start on core types
- **Depends on:** None (independent of #28; builds on shipped #16 infrastructure)

---

_Refined via `/idea` brainstorming session on 2026-06-30_

