/**
 * Extended chord shapes: sixths, ninths, jazz core, and altered dominants.
 *
 * Fifteen canonical chord types — `6`, `m6`, `9`, `maj9`, `m9`, `add9`, `13`,
 * `dim7`, `mMaj7`, `7sus4`, `6/9`, `7b9`, `7#9`, `7#5`, `7b5` — each shipping
 * a movable **E-form** (`rootString: 0`) and/or **A-form** (`rootString: 1`)
 * voicing in the established `ChordShape` format. This mirrors
 * `caged-chords-7th.ts` exactly: one interval per string (or `null` for
 * muted/unplayed strings), a per-shape JSDoc deriving the interval row from
 * a concrete six-string prototype grip, and a single bottom
 * `.forEach(chordShapes.add.bind(chordShapes))` registration block.
 *
 * ## Tonal-first naming contract
 *
 * Every `chordType` string here equals the symbol suffix `@tonaljs/chord`'s
 * `Chord.get` accepts (e.g. `Chord.get("Cmaj9").symbol === "Cmaj9"`), so the
 * chord ↔ scale ↔ arpeggio vocabulary in `arpeggioFromShape` /
 * `arpeggioFromScale` / `identifyChord` (`src/integration.ts`) needs no
 * translation layer. Interval rows use Tonal's compound-interval vocabulary
 * (`9M`, `13M`, not `2M`/`6M`) and are a chroma-subset of
 * `Chord.get("<root><chordType>").intervals` — a voicing may omit tones (see
 * `omittedIntervals`) but MUST NOT add a tone outside the chord.
 *
 * ## Interop divergence catalog
 *
 * Tonal's `detect(notes)` does not always echo the `Chord.get` symbol back
 * verbatim. Where the two diverge, this file keeps the `Chord.get` symbol as
 * `chordType` and documents the alias `detect` prefers instead — tests
 * assert chroma membership / the documented alias, never a mismatched exact
 * string:
 *
 * | `chordType` (= `Chord.get` symbol) | `detect(notes)` returns   | Handling                                                        |
 * | ----------------------------------- | ------------------------- | --------------------------------------------------------------- |
 * | `add9`                              | `Madd9` (e.g. `CMadd9`)   | key stays `add9`; tests assert chroma membership, not `detect` equality |
 * | `mMaj7`                              | `m/ma7` (e.g. `Cm/ma7`)   | key stays `mMaj7`; documented alias                              |
 * | `6/9`                                | `6add9` (e.g. `C6add9`)   | key stays `6/9`; documented alias                                |
 * | `7#5`                                | `7#5` first, `7b13` also  | first `detect` entry IS the exact symbol; `7b13` is a secondary, non-divergent alias |
 *
 * `aug7` and `7#5` are **the same Tonal chord** — identical intervals
 * (`1P 3M 5A 7m`) and overlapping `detect` aliases.
 * `Chord.get("Caug7").symbol` is `"Caug7"` (Tonal does NOT normalize it to
 * `7#5`), but `detect(notes)` for that pitch-class set prefers `C7#5`. We
 * register **`7#5` only** — `aug7` is not a separate registry key.
 * `chordShapes.query({ chordType: "aug7" })` intentionally returns nothing:
 * the registry is an exact-string index with no alias resolution at query
 * time.
 *
 * ## Standard-tuning scope (D-008)
 *
 * These are **standard six-string** shapes — `strings`/`fingers` arrays are
 * six slots wide, matching `STANDARD` tuning. Alternate tunings and 7/8-string
 * tunings are best-effort only: `applyChordShape` maps a six-slot shape onto
 * the *lowest* six strings of a longer tuning, which is not where a
 * guitarist would actually place the grip on a 7/8-string instrument. This
 * is not guaranteed or tested for extended shapes here (see
 * `docs/PLAN.md` / CLAUDE.md "Remaining work" — 7/8-string rootString
 * auto-adjustment is tracked separately).
 *
 * ## Registration
 *
 * Shapes are registered into the chord shape registry at import time via
 * `EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes))`. See
 * `src/index.ts` for the side-effect import that wires this file in. This
 * file adds data only — no new engine, no `ChordShape`/registry changes, no
 * public re-exports (consumers use the existing `chordShapes`,
 * `applyChordShape`, `arpeggioFromShape` / `arpeggioFromScale`, and
 * `identifyChord` APIs).
 */

import { chordShapes, ChordShape } from "../shape";

// ============================================================
// Shape definitions
//
// Populated tier-by-tier by subsequent task groups per
// .tonal-guitar/features/extended-chord-shapes-import/tasks.md:
//   Tier 1 — 6, m6, 9, maj9, m9, add9
//   Tier 2 — 13, dim7, mMaj7, 7sus4, 6/9
//   Tier 3 — 7b9, 7#9, 7#5, 7b5
// ============================================================

export const EXTENDED_CHORD_SHAPES: ChordShape[] = [];

// Register all extended chord shapes
EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes));
