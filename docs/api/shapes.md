---
title: Shapes
description: Scale and chord shape registry
---

```js
import * as Guitar from "tonal-guitar";

const shape = Guitar.get("E Shape");
const scale = Guitar.buildFrettedScale(shape, "A");
```

Shapes define the geometry of how notes are laid out on the fretboard. A shape is a template of intervals per string -- applying it to a root note produces concrete fretted positions.

## Shape Types

### ScaleShape

```ts
interface ScaleShape {
  name: string;                    // e.g. "E Shape"
  system: string;                  // "caged" | "3nps" | "pentatonic" | "custom"
  strings: (string[] | null)[];    // intervals per string, low to high
  rootString: number;              // which string anchors the root
  span?: number;                   // optional fret span hint
  quality?: string;                // interval-frame quality tag, e.g. "major" | "minor" | "minor-pentatonic"
  parentShape?: string;            // name of the source shape a relabeled entry was derived from, e.g. "G Shape"
}
```

Each entry in `strings` is either an array of interval names (e.g. `["1P", "2M", "3M"]`) or `null` for unused strings.

`quality` and `parentShape` are populated on shapes derived via [`relabelShape`](/docs/guitar/transform) (see the 10 registered minor-quality entries below); hand-authored source shapes leave both `undefined`.

### ChordShape

```ts
interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[];      // one interval per string
  fingers: (number | null)[];      // finger assignments (1-4)
  barres: Barre[];                 // barre positions
  rootString: number;
}

interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
}
```

## Scale Shape Registry

### `get`

`get(name: string) => ScaleShape | undefined`

Retrieve a shape by name:

```js
get("E Shape");   // => { name: "E Shape", system: "caged", ... }
get("3NPS Pattern 1 (Ionian)");  // => { name: "3NPS Pattern 1 (Ionian)", system: "3nps", ... }
get("Pentatonic Box 1"); // => { name: "Pentatonic Box 1", system: "pentatonic", ... }
get("nonexistent");      // => undefined
```

### `all`

`all() => ScaleShape[]`

Returns a copy of all registered scale shapes.

### `names`

`names() => string[]`

Returns all registered shape names:

```js
names();
// => ["E Shape", "D Shape", "C Shape", "A Shape", "G Shape",
//     "Dm Shape", "Cm Shape", "Am Shape", "Gm Shape", "Em Shape",
//     "3NPS Pattern 1 (Ionian)", ..., "Pentatonic Box 5 Minor"]
```

### Minor-quality entries

10 additional entries are registered at import time, derived from the major-frame CAGED and pentatonic shapes via [`relabelShape`](/docs/guitar/transform) -- same fretboard geometry as their `parentShape`, only interval labels/`rootString`/`quality` differ:

```js
names().filter((n) => get(n)?.quality === "minor");
// => ["Dm Shape", "Cm Shape", "Am Shape", "Gm Shape", "Em Shape"]

names().filter((n) => get(n)?.quality === "minor-pentatonic");
// => ["Pentatonic Box 1 Minor", "Pentatonic Box 2 Minor", "Pentatonic Box 3 Minor",
//     "Pentatonic Box 4 Minor", "Pentatonic Box 5 Minor"]

get("Em Shape"); // => { name: "Em Shape", quality: "minor", parentShape: "G Shape", rootString: 0, ... }
```

See the project [README](https://github.com/TheGuitarStudio/tonal-guitar#minor-quality-entries) for the full parent-to-minor mapping tables.

### `add`

`add(shape: ScaleShape) => ScaleShape`

Register a custom shape:

```js
add({
  name: "Blues Box",
  system: "custom",
  strings: [["1P", "4P"], ["5P", "7m"], null, null, null, null],
  rootString: 0,
  span: 3,
});
```

### `removeAll`

`removeAll() => void`

Clear all registered scale shapes. Useful for testing or replacing the default set.

## Chord Shape Registry

The `chordShapes` object provides the same API for chord shapes:

```js
import { chordShapes } from "tonal-guitar";

chordShapes.get("E Shape");  // => ChordShape
chordShapes.all();            // => ChordShape[]
chordShapes.names();          // => string[]
chordShapes.add(myShape);     // register custom chord shape
chordShapes.removeAll();      // clear all
```

## Build Engine

### `buildFrettedScale`

`buildFrettedScale(shape: ScaleShape, root: string, tuning?: string[]) => FrettedScale`

Apply a scale shape to a root note, returning all fretted positions:

```js
const scale = buildFrettedScale(get("E Shape"), "A");
// => {
//   empty: false,
//   root: "A",
//   shapeName: "E Shape",
//   tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
//   notes: [FrettedNote, FrettedNote, ...]
// }

// Each note contains position, pitch, and interval info:
scale.notes[0];
// => { string: 0, fret: 5, note: "A2", pc: "A",
//      interval: "1P", scaleIndex: 0, degree: 1,
//      intervalNumber: 1, midi: 45 }
```

Returns `{ empty: true }` for invalid inputs (bad root, missing shape, etc.).

Works with any tuning:

```js
import { DROP_D, STANDARD_7 } from "tonal-guitar";

buildFrettedScale(get("E Shape"), "A", DROP_D);
buildFrettedScale(get("E Shape"), "A", STANDARD_7);
```

### `applyChordShape`

`applyChordShape(shape: ChordShape, root: string, tuning?: string[]) => Fingering`

Apply a chord shape to a root, returning per-string fret numbers:

```js
const chord = applyChordShape(chordShapes.get("E Shape"), "A");
// => {
//   positions: [FrettedNote, ...],
//   frets: [5, 7, 7, 6, 5, 5],
//   root: "A",
//   shapeName: "E Shape",
//   startFret: 5
// }
```

## FrettedScale and FrettedNote Types

```ts
interface FrettedScale {
  empty: boolean;       // false for valid results, true for errors
  root: string;         // pitch class of root
  scaleType: string;    // e.g. "major" (populated by buildFromScale)
  scaleName: string;    // e.g. "A major" (populated by buildFromScale)
  shapeName: string;    // e.g. "E Shape"
  tuning: string[];
  notes: FrettedNote[];
}

interface FrettedNote {
  string: number;         // 0 = lowest string
  fret: number;
  note: string;           // "A2" -- full note with octave
  pc: string;             // "A" -- pitch class
  interval: string;       // "1P", "3M" -- from root
  scaleIndex: number;     // 0-based position in scale
  degree: number;         // 1-based = scaleIndex + 1
  intervalNumber: number; // numeric part of interval
  midi: number;
}
```
