# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-09-10

### Added

- `CHORD_TYPE_TABLE` — a canonical, side-effect-free `as const` table (`src/chord-types.ts`) with one row per `chordType` key the chord-shape registry indexes (25 rows). Each row carries `id` (the registry key, verbatim), `tonalCanonical` (`ChordType.get(id).aliases[0]`), `label` (human label for pickers), `glyph` (lead-sheet suffix) and `intervals` (Tonal's compound-interval vocabulary). Exported from the root barrel alongside `CHORD_TYPE_KEYS` (the same keys as a literal tuple) and the `ChordTypeEntry` / `ChordTypeRow` / `ChordTypeKey` types.
- `tonal-guitar/chord-types` — a new **pure** package subpath (`exports["./chord-types"]`, its own tsup entry) exposing only the table. Importing it registers **zero** shapes and pulls in neither Tonal nor `src/data/*`, so a consumer that wants the chord vocabulary does not pay for the 132-shape registry or drag it into its own module graph. `src/chord-types.test.ts` enforces the purity contract both statically (the module's source has no imports at all) and at runtime (importing it leaves `chordShapes.all()` empty).
  - `aug7` deliberately has no row: it is the same Tonal chord as `7#5` (`1P 3M 5A 7m`), and the registry — an exact-string index with no alias resolution — registers `7#5` only. Callers holding `aug7` should map it onto the `7#5` row.
  - Three rows have a `tonalCanonical` that differs from their `id`, which is why a consumer that canonicalises through Tonal before querying the registry finds nothing for them without a bridge: `add9` → `Madd9`, `6/9` → `6add9`, `mMaj7` → `m/ma7`.

### Changed

- **Jazz shell voicings — reduced and renamed (breaking).** `src/data/jazz-shells.ts` now registers 8 `chordShapes` entries (one **E-root** and one **A-root** shell per chord type — `maj7`, `m7`, `7`, `m7b5`) instead of the previous 16 (every combination of 2 string sets × 2 voice orderings per chord type). Shape names are public `chordShapes` lookup keys, so this is a breaking rename/removal for any consumer keying off the old names:
  - Old `"Shell <type> R37 123"` (string set `[1,2,3]`, R-3-7 ordering) → new `"Shell <type> A-root"` (same voicing, renamed).
  - Old `"Shell <type> R37 012"`, `"Shell <type> R73 012"`, and `"Shell <type> R73 123"` are removed — no longer registered.
  - New `"Shell <type> E-root"` is a new voicing (string set `[0,2,3]`, R-7-3 ordering — skips the A string), not a rename of any previously-registered shell.
  - Applies to all four chord types, e.g. `"Shell maj7 R37 012"` → removed, `"Shell maj7 R37 123"` → `"Shell maj7 A-root"`, `"Shell maj7 R73 012"`/`"Shell maj7 R73 123"` → removed, `"Shell maj7 E-root"` → new.
- **Built-in chord data is typed against the table.** Every `ChordShape` constant in `src/data/open-chords.ts`, `caged-chords.ts`, `caged-chords-minor.ts`, `caged-chords-7th.ts` and `extended-chords.ts` is now declared as a file-local `RegisteredChordShape = ChordShape & { chordType: ChordTypeKey }`, and `src/data/jazz-shells.ts` pins its shell dictionary to the same key union — so a typo or an unvoiceable quality in the shipped data is a compile error. `ChordShape.chordType` in `src/shape.ts` is unchanged (`string | undefined`), so external `chordShapes.add()` callers are unaffected.
- `scripts/shapes-merge.mjs` accepts either the base `ChordShape`/`ScaleShape`/`ArpeggioShape` annotation or a `Registered*` narrowing alias when parsing `src/data/*.ts` declarations. Generated blocks are still emitted with the base annotation.
- `scripts/check-dts.mjs` verifies the `chord-types` declaration output alongside the root barrel's, with the same stub-emit guard.

## [0.2.0] — 2026-08-02

### Added

- `relabelShape(shape: ScaleShape, targetIntervals: string[], options?: RelabelOptions) => ScaleShape | undefined` — new pure-tier primitive (`src/transform.ts`) that rewrites a `ScaleShape`'s per-string interval labels into a different, rotation-compatible interval frame (e.g. relabeling a major-frame CAGED shape into its natural-minor labeling). Geometry is unchanged; returns a new shape (no mutation) or `undefined` when no valid relabeling exists.
- `relabelShapeToScale(shape: ScaleShape, scaleName: string, options?: RelabelOptions) => ScaleShape | undefined` — integration-tier wrapper that resolves `scaleName` via Tonal's `Scale.get()` and delegates to `relabelShape`.
- `RelabelOptions` type (`name?`, `quality?`, `parentShape?`) exported alongside `relabelShape`.
- `ScaleShape.quality?: string` and `ScaleShape.parentShape?: string` — new optional fields. `quality` tags a shape's interval-frame quality (e.g. `"minor"`, `"minor-pentatonic"`); `parentShape` names the source shape a relabeled entry was derived from. Both are `undefined` on hand-authored major-frame source shapes.
- 10 new registered `ScaleShape` entries, derived via `relabelShape` at import time (`src/data/caged-scales-minor.ts`, `src/data/pentatonic-minor.ts`):
  - Minor CAGED: `"Dm Shape"` (from `"E Shape"`), `"Cm Shape"` (from `"D Shape"`), `"Am Shape"` (from `"C Shape"`), `"Gm Shape"` (from `"A Shape"`), `"Em Shape"` (from `"G Shape"`).
  - Minor pentatonic: `"Pentatonic Box 1 Minor"` through `"Pentatonic Box 5 Minor"` (from the corresponding major `"Pentatonic Box N"`).
  - Each derived entry shares its parent's fretboard geometry; only interval labels, `rootString`, and `quality`/`parentShape` metadata differ.
- `scalesContainingChord(chord: string, options?: ScalesContainingChordOptions) => ScalesContainingChordResult` — new integration-tier function (`src/integration.ts`) that finds scales containing a chord's tones. Resolves `chord` via Tonal's `Chord.get()`, sweeps 12 chromatic roots x `DEFAULT_SCALE_CORPUS`, and keeps candidates whose pitch-class set is a (tolerant) superset of the chord's, partitioned into `rootAnchored` and `otherRoots` and ranked by fit. Never throws — an unresolvable or empty chord returns empty groups.
- `DEFAULT_SCALE_CORPUS: readonly string[]` — the fixed 11-entry scale-type corpus swept by `scalesContainingChord` (major, dorian, phrygian, lydian, mixolydian, aeolian, locrian, harmonic minor, melodic minor, major pentatonic, minor pentatonic).
- `ContainingScale`, `ScalesContainingChordResult`, `ScalesContainingChordOptions` types exported alongside `scalesContainingChord`.
- `ScaleShape.featured?: boolean` and `ChordShape.featured?: boolean` — new optional fields marking the curated, canonical/representative shape per group (e.g. per `(system, quality)` for scales, per `chordType` for chords) for catalog/UI display purposes. Curated registry data only — not audit-derived, and intentionally not required or checked by `checkScaleMetadataCompleteness`/`checkChordMetadataCompleteness`.

### Changed

- **`buildFromScale` — pitch-correctness fix (behavior change).** `buildFromScale` now relabels `shape` into the requested scale's interval frame (via `relabelShape`) before building. Previously, `buildFromScale(shape, scaleName)` applied the shape's original (usually major) interval frame directly at the scale's tonic, so e.g. `buildFromScale(get("E Shape"), "A minor")` silently produced **A-major pitch classes** mislabeled `scaleType: "aeolian"` — wrong notes, not merely wrong labels. As of this release the same call produces correct A-natural-minor pitch classes (`A=1P`, `C=3m`, `E=5P`). If a shape is not rotation-compatible with the requested scale, `relabelShape` returns `undefined` and `buildFromScale` falls back to building the original shape as-is (its pre-fix behavior), so no previously-working call regresses to an empty result. Calls where the shape already matches the scale's frame (e.g. `buildFromScale(get("E Shape"), "C major")`) are unaffected.
- **`scalesContainingChord` — sweep performance.** The default-corpus sweep now reads from a lazily-precomputed module-scope table of resolved scale candidates (chroma sets and root chromas computed once) instead of re-resolving 12 roots × 11 scale types per call, and the ranking comparator no longer re-derives root chromas per comparison. ~8.5× faster per call; behavior, ranking order, and the public API are unchanged.
- **`isShapeCompatible` — chroma-set semantics (behavior change).** Compatibility is now computed by reducing both the shape's and the scale's interval frames to pitch-class chroma sets (0–11) and checking subset coverage, instead of comparing raw interval strings. This is an enharmonic-robustness fix (e.g. `4A` vs `5d` spellings across Tonal scale types), **not** a relative-major/minor loosening — a major-frame shape remains incompatible with a minor scale name, since anchoring it at the minor tonic would still produce the wrong pitch classes. `modeShapes` (built on `isShapeCompatible`) inherits this change; minor-tonic queries (e.g. `modeShapes("A minor")`, unfiltered) now return the 10 new registered minor-quality entries where they previously returned none.

