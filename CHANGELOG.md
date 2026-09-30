# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `auditAllShapes` now also returns `arpeggio: Map<string, ShapeAuditIssue[]>`, the `auditArpeggioShape` result for every registered arpeggio shape, alongside `chord` and `scale`.
- The `NameUniqueKind` type (`"chord" | "scale" | "arpeggio"`, the `kind` parameter of `checkNameUnique`) is exported from the root barrel.

### Changed

- `auditScaleShape` and `auditArpeggioShape` now run `checkNameUnique` (`name-unique`) against the live scale/arpeggio registry, as `auditChordShape` already did for chords. A shape that is not the registered object but reuses a registered name, or derives the same export identifier, now gets an error. No registered shape is affected. To audit an edited copy of a registered shape, filter out `CHECK_NAME_UNIQUE` issues, as the workbench and `shapes:merge` do for updates, or call `checkNameUnique` yourself with `selfName`.

### Deprecated

- `sourceGripBaseFret(shape, sourceFrets)`: its `shape` parameter was never used and the result is exactly `gripBaseFret(sourceFrets)`, so call `gripBaseFret` directly. The function still works and will be removed in a future breaking release.

### Fixed

- `scaleTypeForChordType` no longer returns `Object.prototype` members for chord types like `"toString"`, `"constructor"` or `"__proto__"`; it only matches `CHORD_SCALE_RULE`'s own keys and returns `undefined` otherwise. `CHORD_SCALE_RULE` itself is unchanged and still mutable.
- `applyChordShape` no longer returns a degenerate barre on a tuning with fewer strings than the shape. A barre that lies entirely on strings the tuning doesn't have is now dropped, where before it was clamped to a one-string `{ fromString: last, toString: last }` barre on the tuning's last string. Barres that only partly overhang are still clamped (#204).

## [0.4.0] — 2026-09-30

### Added

- **Built-in CAGED arpeggio seeds** (#58). `src/data/caged-arpeggios.ts` (generator-managed: `shapes-merge` owned blocks, so later edits go through `npm run shapes:merge` changesets) registers the first 20 `arpeggioShapes` entries: one arpeggio per (quality, CAGED letter) pair, for Major, Minor, maj7 and m7 across all five positions (C, A, G, E, D). They are named `"<Letter> Shape <Quality> Arpeggio"`, e.g. `"E Shape Minor Arpeggio"` or `"C Shape maj7 Arpeggio"`.
  - Each seed is the chord tones of its parent CAGED box: the major box for Major and maj7, the minor box for Minor and m7. The seed records that box in `parentShape`.
  - Each seed carries `cagedPosition`, `chordType` and `tags` (`["caged", "triad"]` or `["caged", "seventh"]`), so `arpeggioShapes.query({ cagedPosition: "E" })` returns that position's Major, Minor, maj7 and m7 arpeggios.
  - Where a matching grip exists, `chordShape` links the seed to it, and `arpeggioFor`/`resolveArpeggioForSlot` resolve it at tier `"core"` instead of `"derived"`. The C/G 7th seeds have no `chordShape` because no C/G 7th grips are registered.
  - Every seed passes `auditArpeggioShape` and `auditArpeggioShapeIntegration` cleanly.
- `scripts/shapes-merge.mjs` count marker `arpeggio-shape-total`, which tracks the registered arpeggio total in `src/data/data.test.ts`.
- **Blues scale boxes (#56).** 10 new registered `ScaleShape`s in `src/data/blues.ts`, all `system: "pentatonic"`: `"Blues Box 1 Minor"` … `"Blues Box 5 Minor"` (`quality: "minor-blues"`, the minor pentatonic boxes plus the b5) and `"Blues Box 1 Major"` … `"Blues Box 5 Major"` (`quality: "major-blues"`, the same geometry relabeled via `relabelShape` so the passing tone reads as the b3). Box 1 of each quality is `featured`. They work with Tonal's `"blues"` / `"minor blues"` / `"major blues"` scale names in `buildFromScale`, `modeShapes`, `isShapeCompatible` and `relatedScales`, and pass `auditScaleShape` at every root. The scale-shape registry grows from 27 to 37 entries.
- `addPassingTone(shape, tone, options?)` (`src/transform.ts`) — adds a chromatic passing tone to any scale shape. The tone goes on the same string one fret above every note a semitone below it; tones inside the shape's pitch range are always kept (even with a one-fret stretch), while a tone that would become a new edge note is kept only if it fits in the existing fret span. `PassingToneOptions` extends `RelabelOptions` with `tuning` (default `STANDARD`). The registered blues boxes are derived with it, so registered and generated blues boxes always agree.
- `packages/shape-catalog`: `relatedScaleNameFor` maps the `minor-blues` / `major-blues` qualities to Tonal scale names.

### Changed

- The 7th-chord CAGED grips in `src/data/caged-chords-7th.ts` (E/A/D × `maj7`/`m7`/`7`, E/A × `m7b5`) now set `cagedPosition`, taken from the letter in the shape name. As a result, `chordShapes.query({ cagedPosition })` now also returns these 11 grips, where before it returned only the triad grips.
- `arpeggioShapes` is no longer empty after importing the root barrel. Code that assumed an empty registry, such as tests that add fixtures to a slot, should call `arpeggioShapes.removeAll()` first or use a slot the seeds don't occupy.
- `src/transform.ts` now imports `./build` (for `addPassingTone`'s fret geometry), so it — and `src/data/blues.ts` / the other data files that call it at import time — depend on the required `@tonaljs/note` peer as well as `@tonaljs/interval`. Still no optional-peer imports.
- `scripts/shapes-merge.mjs`: `blues` is on the computed-file deny list (its shapes are derived, not authored).
- **`Barre.fret` offsets are now root-invariant (breaking for `gripBaseFret`; #192).** `gripBaseFret` — and therefore `sourceGripBaseFret`, `applyChordShape`'s resolved `barres`, and `autoFingering`'s seeded `barres` — now takes the minimum over **all played** frets, open strings (`0`) included, instead of excluding open strings. Built grips transpose rigidly, so the base now moves by exactly the transposition interval and a stored offset resolves to the same finger position at every root. Previously every registered chord shape with barres resolved to the wrong fret at one or more roots: movable shapes at the root where part of the grip lands on the nut (e.g. `"G Shape Minor"` at G, `"A Shape m6"` at A, every E/A form at E/A), open shapes at every root other than their `canonicalRoot`.
  - No data change for movable shapes — their offsets were already correct under the new base.
  - The 20 `src/data/open-chords.ts` open shapes with barres were re-expressed against the nut-inclusive base (e.g. `"A Major Open"` `x02220`: offset `0` → `2`; `"C Sus2 Open"`: `0` → `3`). Custom shapes authored with offsets measured from the old base need the same adjustment wherever their grip includes an open string; `checkBarreFretOrigin` now reports them with the corrected offset.
  - `checkBarreFretOrigin` (`barre-fret-origin`) gains a rule that the resolved barre fret matches the grip: strings under the barre carrying the barre's finger must sit at that fret, and no played string under it may sit lower. Its `span` is now measured from the new base (highest played fret − `gripBaseFret`).

## [0.3.0] — 2026-09-10

### Added

- `CHORD_TYPE_TABLE` — a canonical, side-effect-free `as const` table (`src/chord-types.ts`) with one row per `chordType` key the chord-shape registry indexes (25 rows). Each row carries `id` (the registry key, verbatim), `tonalCanonical` (`ChordType.get(id).aliases[0]`), `label` (human label for pickers), `glyph` (lead-sheet suffix) and `intervals` (Tonal's compound-interval vocabulary). Exported from the root barrel alongside `CHORD_TYPE_KEYS` (the same keys as a literal tuple) and the `ChordTypeEntry` / `ChordTypeRow` / `ChordTypeKey` types.
- `tonal-guitar/chord-types` — a new **pure** package subpath (`exports["./chord-types"]`, its own tsup entry) exposing only the table. Importing it registers **zero** shapes and pulls in neither Tonal nor `src/data/*`, so a consumer that wants the chord vocabulary does not pay for the 132-shape registry or drag it into its own module graph. `src/chord-types.test.ts` enforces the purity contract both statically (the module's source has no imports at all) and at runtime (importing it leaves `chordShapes.all()` empty). A `typesVersions` entry accompanies the `exports` entry so the subpath's types also resolve for consumers on TypeScript's node10 resolver (`"moduleResolution": "node"`), which ignores `exports`; `scripts/check-dts.mjs` runs TypeScript's own resolver against a throwaway consumer after every build and fails if the subpath stops resolving under node10, nodenext or bundler.
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

