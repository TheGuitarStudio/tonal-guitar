# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

