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

```js
const scale = buildFromScale(get("CAGED E Shape"), "A major");
scale.scaleType; // => "major"
scale.scaleName; // => "A major"

// Works with any scale Tonal knows:
buildFromScale(get("Pentatonic Box 1"), "A minor pentatonic");
buildFromScale(get("3NPS Pattern 1"), "C dorian");
buildFromScale(get("CAGED E Shape"), "G mixolydian");
```

Returns `{ empty: true }` if the scale name is invalid or the tonic is missing.

### Difference from buildFrettedScale

`buildFrettedScale(shape, root)` takes a raw root note and doesn't validate against a scale -- `scaleType` and `scaleName` will be empty strings. Use `buildFromScale` when you want full integration with Tonal's scale system.

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

Check whether a shape's intervals are all present in a given scale. A shape is compatible if its interval set is a subset of the scale's intervals.

```js
isShapeCompatible(get("CAGED E Shape"), "A major");        // => true
isShapeCompatible(get("Pentatonic Box 1"), "A major");     // => true (subset)
isShapeCompatible(get("CAGED E Shape"), "A minor pentatonic"); // => false (7-note shape doesn't fit 5-note scale)
```

## modeShapes

`modeShapes(modeName: string, shapeSystem?: string) => ScaleShape[]`

Get all registered shapes compatible with a mode/scale. Optionally filter by system.

```js
// All CAGED shapes that fit A major
modeShapes("A major", "caged");

// All shapes (any system) that fit A dorian
modeShapes("A dorian");

// All pentatonic shapes that fit A minor pentatonic
modeShapes("A minor pentatonic", "pentatonic");
```
