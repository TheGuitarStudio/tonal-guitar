---
title: Integration
description: Integration with Tonal.js scales, chords, modes, and keys
---

```js
import * as Guitar from "tonal-guitar";

const scale = Guitar.buildFromScale(Guitar.get("CAGED E Shape"), "A major");
const related = Guitar.relatedScales(scale);
Guitar.identifyChord([null, 3, 2, 0, 1, 0]); // => ["C"]
```

These functions connect guitar shapes to Tonal's Scale, Chord, Mode, and Key modules for deeper music theory integration.

## buildFromScale

`buildFromScale(shape: ScaleShape, scaleName: string, tuning?: string[]) => FrettedScale`

Build a fretted scale using Tonal's `Scale.get()` for validation. This populates the `scaleType` and `scaleName` fields on the returned `FrettedScale`, enabling features like `relatedScales`.

> **v0.2.0 behavior change (pitch-correctness fix).** Before building, `shape` is now relabeled into the requested scale's interval frame via [`relabelShape`](/docs/guitar/transform) (see `src/integration.ts`). Previously, `buildFromScale` applied the shape's raw (usually major-frame) intervals directly at the scale's tonic, so e.g. `buildFromScale(get("E Shape"), "A minor")` silently produced **A-major pitch classes** tagged `scaleType: "aeolian"` -- wrong notes, not merely mislabeled ones. As of v0.2.0, the shape is relabeled into the requested frame first, so the same call now produces correct A-natural-minor notes (`A=1P`, `C=3m`, `E=5P`) in the relabeled (Dm-form) geometry anchored at A. If the shape is not rotation-compatible with the requested scale, `relabelShape` returns `undefined` and `buildFromScale` falls back to building the original shape as-is (its pre-fix behavior) -- so no previously-working call regresses to an empty result. When the shape already matches the scale's frame (e.g. `buildFromScale(get("E Shape"), "C major")`, or `buildFromScale(get("Em Shape"), "A minor")`), the identity rotation applies and output is unchanged.

```js
const scale = buildFromScale(get("CAGED E Shape"), "A major");
scale.scaleType; // => "major"
scale.scaleName; // => "A major"

// Works with any scale Tonal knows:
buildFromScale(get("Pentatonic Box 1"), "A minor pentatonic");
buildFromScale(get("3NPS Pattern 1"), "C dorian");
buildFromScale(get("CAGED E Shape"), "G mixolydian");

// v0.2.0: minor-tonic scale names now produce correct pitch content --
// the shape is relabeled into the minor frame before building.
const aMinor = buildFromScale(get("E Shape"), "A minor");
aMinor.notes.find((n) => n.pc === "A")?.interval; // => "1P"
aMinor.notes.find((n) => n.pc === "C")?.interval; // => "3m"

// Or build the pre-registered minor entry directly -- same result, no relabel needed:
buildFromScale(get("Dm Shape"), "A minor");
```

Returns `{ empty: true }` if the scale name is invalid or the tonic is missing.

### Difference from buildFrettedScale

`buildFrettedScale(shape, root)` takes a raw root note and doesn't validate against a scale -- `scaleType` and `scaleName` will be empty strings, and no relabeling occurs (the shape is applied at `root` as-is). Use `buildFromScale` when you want full integration with Tonal's scale system, including the automatic relabel pass.

## relabelShapeToScale

`relabelShapeToScale(shape: ScaleShape, scaleName: string, options?: RelabelOptions) => ScaleShape | undefined`

Integration-tier wrapper over the pure [`relabelShape`](/docs/guitar/transform) primitive: resolves `scaleName` via Tonal's `Scale.get()` and relabels `shape` into that scale's interval frame. Enharmonic spelling is inherited from the target scale's own `scale.intervals` (never a raw semitone-to-interval lookup).

```js
const em = relabelShapeToScale(get("G Shape"), "A minor", {
  name: "Em Shape",
  quality: "minor",
  parentShape: "G Shape",
});
// equals the pre-registered get("Em Shape") entry

relabelShapeToScale(get("E Shape"), "not a real scale"); // => undefined (unknown scale name)
```

Returns `undefined` for an unknown scale name, or when the underlying `relabelShape` call finds no valid rotation (e.g. relabeling a 7-note shape into a 5-note pentatonic frame).

## relatedScales

`relatedScales(frettedScale: FrettedScale) => Array<{ root: string, scale: string }>`

Find all modal relatives -- scales that share the same pitch classes. This answers questions like "what other scales can I play over these same frets?"

```js
const scale = buildFromScale(get("Pentatonic Box 1"), "A minor pentatonic");
relatedScales(scale);
// => [
//   { root: "C", scale: "major pentatonic" },
//   { root: "D", scale: "egyptian" },
//   { root: "E", scale: "malkos raga" },
//   { root: "G", scale: "ritusen" },
//   { root: "A", scale: "minor pentatonic" }
// ]

const major = buildFromScale(get("CAGED E Shape"), "C major");
relatedScales(major);
// => [
//   { root: "C", scale: "major" },
//   { root: "D", scale: "dorian" },
//   { root: "E", scale: "phrygian" },
//   { root: "F", scale: "lydian" },
//   { root: "G", scale: "mixolydian" },
//   { root: "A", scale: "aeolian" },
//   { root: "B", scale: "locrian" }
// ]
```

Requires `scaleType` to be populated -- use `buildFromScale` (not `buildFrettedScale`).

## identifyChord

`identifyChord(frets: (number | null)[], tuning?: string[]) => string[]`

Identify chord names from fret positions. Uses Tonal's `Chord.detect` internally.

```js
identifyChord([null, 3, 2, 0, 1, 0]); // => ["C"]      (x32010)
identifyChord([0, 2, 2, 1, 0, 0]);    // => ["E"]      (022100)
identifyChord([null, 0, 2, 2, 2, 0]); // => ["A"]      (x02220)
identifyChord([3, 2, 0, 0, 0, 3]);    // => ["G"]      (320003)
```

`null` entries represent muted/unplayed strings. Returns an empty array if no chord is detected.

Works with any tuning:

```js
import { DROP_D } from "tonal-guitar";
identifyChord([0, 0, 0, 2, 3, 2], DROP_D); // Drop D power chord
```

## analyzeInKey

`analyzeInKey(frets: (number | null)[], keyName: string, tuning?: string[]) => KeyAnalysis`

Analyze a chord voicing in the context of a major key. Returns the detected chord, its roman numeral, and scale degree.

```js
analyzeInKey([null, 3, 2, 0, 1, 0], "C");
// => { empty: false, chord: "Cmaj7", numeral: "I", degree: 1 }

analyzeInKey([null, 3, 2, 0, 1, 0], "G");
// => { empty: false, chord: "Cmaj7", numeral: "IV", degree: 4 }

analyzeInKey([0, 2, 2, 1, 0, 0], "C");
// => { empty: false, chord: "Em7", numeral: "III", degree: 3 }
```

Returns `{ empty: true }` if the chord is not found in the key's diatonic harmony.

```ts
interface KeyAnalysis {
  empty: boolean;
  chord: string;    // detected chord name
  numeral: string;  // roman numeral (e.g. "I", "IV", "V")
  degree: number;   // 1-based scale degree
}
```

## isShapeCompatible

`isShapeCompatible(shape: ScaleShape, scaleName: string) => boolean`

Check whether a shape is compatible with a scale by **interval-chroma coverage**: both the shape's and the scale's interval frames are reduced to their pitch-class chroma sets (0-11), so differently-spelled-but-enharmonically-equal intervals compare correctly. A shape is compatible iff its chroma set is non-empty and a subset of the scale's chroma set.

> **v0.2.0 behavior change.** The previous implementation compared raw interval strings. As of v0.2.0 the comparison is chroma-based (enharmonic-safe) but remains **root-relative** -- this is NOT a relative-major/minor loosening. A major-frame shape is still NOT compatible with a minor scale name: anchoring a major-interval-frame shape at the minor tonic would produce the wrong pitch classes. The relative-major/minor geometric identity is expressed through the registered minor-quality entries (`"Dm Shape"`, `"Pentatonic Box 1 Minor"`, etc. -- same geometry, minor-frame labels) and through `relabelShape`, not by loosening this check.

```js
isShapeCompatible(get("E Shape"), "C major");             // => true (unchanged)
isShapeCompatible(get("E Shape"), "A minor");              // => false -- major frame is not a subset of the minor frame (root-relative)
isShapeCompatible(get("Em Shape"), "A minor");              // => true -- minor frame ⊆ minor frame
isShapeCompatible(get("Em Shape"), "A dorian");              // => false -- Em Shape's "6m" (chroma 8) is not in dorian
isShapeCompatible(get("Pentatonic Box 1"), "A minor pentatonic"); // => false -- major-pent frame ⊄ minor-pent frame
isShapeCompatible(get("Pentatonic Box 1 Minor"), "A minor pentatonic"); // => true
isShapeCompatible(get("Pentatonic Box 1 Minor"), "A minor"); // => true -- minor-pent chromas ⊆ natural-minor chromas
isShapeCompatible(get("E Shape"), "A minor pentatonic");    // => false (7-note frame doesn't fit the 5-note frame)
```

## modeShapes

`modeShapes(modeName: string, shapeSystem?: string) => ScaleShape[]`

Get all registered shapes compatible with a mode/scale (via `isShapeCompatible`). Optionally filter by system.

```js
// All CAGED shapes that fit A major
modeShapes("C major", "caged"); // => 5 (the major-frame CAGED shapes)

// The 10 new minor-quality entries make minor tonics work out of the box:
modeShapes("A minor", "caged");
// => 5 registered minor CAGED shapes: "Em Shape", "Am Shape", "Dm Shape", "Gm Shape", "Cm Shape"

modeShapes("A minor pentatonic", "pentatonic");
// => the 5 "Pentatonic Box N Minor" entries

// No system filter -- both minor CAGED and minor-pentatonic entries qualify,
// because the minor-pentatonic chroma set is a subset of the natural-minor one:
modeShapes("A minor").length; // => 10

// Chroma-subset coverage is transitive across any superset frame, not just
// natural minor: minor-pentatonic chromas {0,3,5,7,10} are also a subset of
// dorian's chromas {0,2,3,5,7,9,10}, so the 5 minor-pentatonic entries match
// "A dorian" too (there is no first-class dorian-frame registered entry --
// this is the minor-pentatonic entries' chroma set happening to fit dorian
// as well as natural minor).
modeShapes("A dorian");
// => the 5 "Pentatonic Box N Minor" entries (length 5, not 0)
```
