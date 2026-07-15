---
title: Audit
description: Automated correctness and quality checks for chord and scale shapes
---

```js
import * as Guitar from "tonal-guitar";

const shape = Guitar.chordShapes.get("G Augmented Open");
const issues = Guitar.auditChordShape(shape);
// => [{ id: "fret-span", severity: "error", ... }, { id: "geometry-mismatch", severity: "warning", ... }]
```

`audit.ts` is a required-peer-deps-tier module (alongside `build.ts`) that runs static and build-engine checks over `ChordShape`/`ScaleShape` entries, surfacing regressions that would otherwise only show up as a broken diagram or a silently-dropped note. Every check follows the project's empty-result convention: `[]` when the shape is clean or the check doesn't apply, never an exception.

## Core Types

### AuditSeverity

```ts
type AuditSeverity = "error" | "warning";
```

`"error"` marks a playability/correctness defect (excessive fret span, an impossible fingering, a note the build engine silently dropped). `"warning"` marks a metadata/consistency gap that doesn't affect playability (missing harmonic metadata, a geometry mismatch between the source diagram and the build engine's own reconstruction).

### ShapeAuditIssue

```ts
interface ShapeAuditIssue {
  id: string; // one of the CHECK_* constants
  severity: AuditSeverity;
  message: string; // human-readable, for tooltips only
  details?: Record<string, unknown>; // structured data (frets, strings, span, etc.)
}
```

`message` is prose meant for a UI tooltip -- don't pattern-match on it. Program against `id` and `details`.

### ShapeAuditOptions

```ts
interface ShapeAuditOptions {
  root?: string; // default: displayRootFor(shape) for chords, "C" for scales
  tuning?: string[]; // default: STANDARD
  maxFretSpan?: number; // default: 4, forwarded to checkFretSpan
}
```

Consumed by the three aggregate functions below (`auditChordShape`, `auditScaleShape`, `auditAllShapes`); the individual `check*` functions take their root/tuning/maxSpan as plain positional arguments instead.

## displayRootFor

`displayRootFor(shape: { canonicalRoot?: string }) => string`

Returns `shape.canonicalRoot ?? "C"`. This is the default-root policy used by `auditChordShape` -- pass it explicitly when you want the "documented" root of an open-position shape without hardcoding a literal:

```js
displayRootFor(chordShapes.get("G Augmented Open")); // => "G" (its canonicalRoot)
displayRootFor(chordShapes.get("Shell maj7 R37 012")); // => "C" (no canonicalRoot)
```

## Checks

Each check is exported individually so it can be run standalone (e.g. in a single `data.test.ts` assertion) or composed via the aggregate functions below.

### checkFretSpan

`checkFretSpan(shape: ChordShape, root: string, tuning?: string[], maxSpan?: number) => ShapeAuditIssue[]`

- `id`: `CHECK_FRET_SPAN` (`"fret-span"`)
- Severity: `"error"`
- Defaults: `tuning = STANDARD`, `maxSpan = 4`

Applies `shape` to `root` (via `applyChordShape`), then computes `span = max(frets) - min(frets)` over the **fretted** positions only -- muted strings (`null`) and **open strings (`fret === 0`)** are excluded before taking the span, so an open-string drone never inflates it. The boundary is strict: `span === maxSpan` does **not** flag, only `span > maxSpan`.

**Worked example (issue #96):** `checkFretSpan(OPEN_G_AUG, "G")` builds frets `[3, null, 1, 0, 0, 11]`. Excluding the muted string and the two opens leaves `[3, 1, 11]`, giving `span = 11 - 1 = 10`, which exceeds the default `maxSpan` of `4`:

```js
checkFretSpan(chordShapes.get("G Augmented Open"), "G");
// => [{
//   id: "fret-span",
//   severity: "error",
//   message: "Fret span of 10 exceeds the maximum playable span of 4",
//   details: { span: 10, frets: [3, null, 1, 0, 0, 11], maxSpan: 4 },
// }]
```

### checkFingerZeroOnMovable

`checkFingerZeroOnMovable(shape: ChordShape) => ShapeAuditIssue[]`

- `id`: `CHECK_FINGER_ZERO_ON_MOVABLE` (`"finger-zero-on-movable"`)
- Severity: `"error"`

Static check (no `applyChordShape` call). Applies only to **movable** shapes (`shape.canonicalRoot === undefined`) -- a movable shape is by definition never played with an open string, so any `0` in `shape.fingers` is a defect. Fixed-position shapes (`canonicalRoot` set) are skipped entirely, since open strings are legitimate there.

### checkRepeatedFingerNoBarre

`checkRepeatedFingerNoBarre(shape: ChordShape) => ShapeAuditIssue[]`

- `id`: `CHECK_REPEATED_FINGER_NO_BARRE` (`"repeated-finger-no-barre"`)
- Severity: `"error"`

Static check. Walks adjacent string pairs `(i, i+1)`; when both carry the same non-null, non-zero finger and no entry in `shape.barres` covers that finger across both strings (`b.finger === finger && i >= b.fromString && i + 1 <= b.toString`), emits one issue for that pair. A shape with several uncovered adjacent pairs gets one issue per pair, not one issue total.

### checkChordBuildLoss / checkScaleBuildLoss

Both share:

- `id`: `CHECK_BUILD_LOSS` (`"build-loss"`)
- Severity: `"error"`

`checkChordBuildLoss(shape: ChordShape, root: string, tuning?: string[]) => ShapeAuditIssue[]` (default `tuning = STANDARD`) applies the shape and compares `playedCount` (non-null entries in `shape.strings`) against `builtCount` (non-null entries in the built `frets`). Flags when `builtCount < playedCount` -- the fret-window logic in `buildFrettedScale` (invoked via `applyChordShape`) couldn't resolve one of the shape's own intervals and silently dropped the note instead of placing it.

`checkScaleBuildLoss(shape: ScaleShape, root: string, tuning?: string[]) => ShapeAuditIssue[]` (default `tuning = STANDARD`) has two failure modes:

1. `buildFrettedScale` returns the `NoFrettedScale` sentinel (`empty: true`) -- nothing could be placed at all.
2. The build succeeds but `result.notes.length` (`builtCount`) is less than `slotCount` (the sum of `shape.strings[i].length` over non-null entries) -- some individual interval was dropped.

### checkChordMetadataCompleteness / checkScaleMetadataCompleteness

Both share:

- `id`: `CHECK_METADATA_COMPLETENESS` (`"metadata-completeness"`)
- Severity: `"warning"`

`checkChordMetadataCompleteness(shape: ChordShape) => ShapeAuditIssue[]` flags a shape missing `chordType` and/or `voicingFamily` -- the two harmonic-metadata fields every meaningfully-cataloged chord shape should carry. `stringSet`, `canonicalRoot`, and `baseFret` are intentionally **not** required, since many valid shapes (movable CAGED forms, jazz shells) omit them by design. The 5 base CAGED majors in `caged-chords.ts` predate these metadata fields and are expected to surface here -- that's a legitimate warning, not a bug in the check.

`checkScaleMetadataCompleteness(shape: ScaleShape) => ShapeAuditIssue[]` enforces the derived-shape both-or-neither invariant: `quality` and `parentShape` are set together by `relabelShape` (see [Transform](/docs/guitar/transform)) or not at all on hand-authored base shapes. Exactly one being present means a broken or partial relabel.

### checkGeometryMismatch

`checkGeometryMismatch(shape: ChordShape, tuning?: string[]) => ShapeAuditIssue[]` (default `tuning = STANDARD`)

- `id`: `CHECK_GEOMETRY_MISMATCH` (`"geometry-mismatch"`)
- Severity: `"warning"`

Applies **only** when both hold:

1. `shape.baseFret != null`.
2. The shape has a resolvable **grip root** -- the root its source diagram (`baseFret`/`fingers`) was authored against. This is `shape.canonicalRoot` when present, else a root parsed from a `"<Root> ... Open"` name (e.g. `"G Augmented Open"` -> `"G"`), matching the `open-chords.ts` naming convention. The movable **"E/A Form ... Barre"** shapes are skipped: their leading letter names the CAGED form family, not an authored root, and their nut-position barre grips are structurally indistinguishable from genuine off-by-octave defects.

Shell, extended, and CAGED-7th shapes have no `baseFret` and are skipped outright; the check returns `[]` for all of them.

When applicable, it reconstructs a **source-diagram** fret per string (lifting each interval's chroma distance from the open string by octaves until it lands at or above `baseFret` -- i.e. where the authored diagram places it) and compares that against the **build-engine** frets from `applyChordShape` (which ignores `baseFret`/`fingers`/`barres` entirely). Muted strings are never compared. Any divergent strings are reported as a single issue listing all of them.

**Worked example (issue #96):** `"G Augmented Open"` (`OPEN_G_AUG`) has `baseFret: 1` and `canonicalRoot: "G"`, so its grip root is `"G"`. The build engine produces `[3, null, 1, 0, 0, 11]`, but the source diagram (`baseFret`-anchored) implies `[3, null, 1, 12, 12, 11]` -- the build engine collapses the 4th and 5th strings (0-indexed 3 and 4, i.e. the G and B strings) to their open-string equivalents instead of the diagram's fretted 12th-fret voicing:

```js
checkGeometryMismatch(chordShapes.get("G Augmented Open"));
// => [{
//   id: "geometry-mismatch",
//   severity: "warning",
//   message: "Built geometry diverges from the source diagram on string(s) 3, 4",
//   details: {
//     gripRoot: "G",
//     builtFrets: [3, null, 1, 0, 0, 11],
//     sourceFrets: [3, null, 1, 12, 12, 11],
//     mismatchedStrings: [3, 4],
//   },
// }]
```

## Aggregate Functions

### auditChordShape

`auditChordShape(shape: ChordShape, options?: ShapeAuditOptions) => ShapeAuditIssue[]`

Runs all six chord checks -- fret-span, finger-zero-on-movable, repeated-finger-no-barre, chord build-loss, chord metadata-completeness, geometry-mismatch -- and returns the combined issue list. `root` defaults to `displayRootFor(shape)`, `tuning` defaults to `STANDARD`, and `options.maxFretSpan` (if provided) is forwarded to `checkFretSpan`.

**Worked example (issue #96):** `auditChordShape(OPEN_G_AUG)` combines the two issues shown above -- `fret-span` (error, span 10) and `geometry-mismatch` (warning, strings 3/4) -- and no other check fires for this shape (its `fingers`/`barres` are internally consistent, the build engine drops no notes, and both `chordType`/`voicingFamily` are set):

```js
auditChordShape(chordShapes.get("G Augmented Open"));
// => [
//   { id: "fret-span", severity: "error", ... },
//   { id: "geometry-mismatch", severity: "warning", ... },
// ]
```

### auditScaleShape

`auditScaleShape(shape: ScaleShape, options?: ShapeAuditOptions) => ShapeAuditIssue[]`

Runs only the two checks that apply to scale shapes -- build-loss and metadata-completeness -- never fret-span/finger/geometry, which are chord-only. `root` defaults to `"C"` (`ScaleShape` has no `canonicalRoot` field, so `displayRootFor` doesn't apply here); `tuning` defaults to `STANDARD`.

### auditAllShapes

`auditAllShapes(options?: ShapeAuditOptions) => { chord: Map<string, ShapeAuditIssue[]>, scale: Map<string, ShapeAuditIssue[]> }`

Audits every currently-registered chord and scale shape, keyed by `shape.name`:

```js
import * as Guitar from "tonal-guitar"; // side-effect imports populate the registries

const { chord, scale } = Guitar.auditAllShapes();
chord.get("G Augmented Open"); // => [fret-span error, geometry-mismatch warning]
[...chord.entries()].filter(([, issues]) => issues.some((i) => i.severity === "error"));
```

The registries are populated by side-effect imports in `index.ts`, so this only returns full results once the data modules have been imported -- import `./index` (or the relevant `data/*` modules) first if calling it standalone.

## VERSION

`VERSION: string`

Exported from `src/version.ts` (re-exported alongside the audit functions from `index.ts`). A plain library version string, bumped alongside `package.json`'s `"version"` field at release time -- not itself an audit primitive, but useful for tagging audit output (e.g. a report generated by `auditAllShapes`) with the library version it was produced by.

## Single Source of Truth

`src/data/data.test.ts` consumes these exact exported checks -- it does not reimplement fret-span, finger/barre, or build-loss logic separately. Registry-wide regressions (e.g. the issue #94 `maxSpan` helper and the issue #39 fingering/barre invariants) are asserted by calling `checkFretSpan`/`checkFingerZeroOnMovable`/`checkRepeatedFingerNoBarre` directly against every registered shape, so a fix or regression in `audit.ts` is immediately visible in the data-layer test suite rather than silently diverging from a parallel copy of the same logic.

The Guitar Lab site's `/shapes` page is the primary runtime consumer: it renders `auditAllShapes()`'s output per shape so authors can see fret-span, geometry, and metadata issues while browsing the registry, instead of only catching them in CI.
