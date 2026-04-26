---
title: Fretboard
description: Fretboard math and note lookups
---

```js
import * as Guitar from "tonal-guitar";

Guitar.noteAt(Guitar.STANDARD, 0, 5); // => "A2"
Guitar.findNote("A"); // => [{string: 0, fret: 5, note: "A2", midi: 45}, ...]
```

## Tuning Constants

Pre-defined tunings as `string[]` arrays ordered low to high string:

```js
import { STANDARD, DROP_D, DADGAD, OPEN_G, STANDARD_7, STANDARD_8 } from "tonal-guitar";

STANDARD;   // ["E2", "A2", "D3", "G3", "B3", "E4"]
DROP_D;     // ["D2", "A2", "D3", "G3", "B3", "E4"]
DADGAD;     // ["D2", "A2", "D3", "G3", "A3", "D4"]
OPEN_G;     // ["D2", "G2", "D3", "G3", "B3", "D4"]
STANDARD_7; // ["B1", "E2", "A2", "D3", "G3", "B3", "E4"]
STANDARD_8; // ["F#1", "B1", "E2", "A2", "D3", "G3", "B3", "E4"]
```

Custom tunings are just `string[]` arrays -- pass them to any function that accepts a `tuning` parameter.

## noteAt

`noteAt(tuning: string[], stringIndex: number, fret: number) => string`

Get the note name at a string/fret position. String index 0 is the lowest string.

```js
noteAt(STANDARD, 0, 5);  // => "A2"  (5th fret, low E)
noteAt(STANDARD, 1, 3);  // => "C3"  (3rd fret, A string)
noteAt(STANDARD, 5, 0);  // => "E4"  (open high E)
noteAt(DROP_D, 0, 0);    // => "D2"  (open low string in Drop D)
```

## fretFor

`fretFor(tuning: string[], stringIndex: number, targetNote: string) => number | null`

Reverse lookup: find which fret a specific note (with octave) is on a given string. Returns `null` if unreachable (would require a negative fret).

```js
fretFor(STANDARD, 0, "A2"); // => 5
fretFor(STANDARD, 1, "C3"); // => 3
fretFor(STANDARD, 0, "D2"); // => null (below open E2)
```

## findNearestFret

`findNearestFret(tuning: string[], stringIndex: number, pitchClass: string) => number | null`

Find the lowest fret (>= 0) where a pitch class appears on a string. Does not consider position context.

```js
findNearestFret(STANDARD, 0, "A"); // => 5
findNearestFret(STANDARD, 1, "A"); // => 0 (open A string)
findNearestFret(STANDARD, 0, "F"); // => 1
```

## findFretInPosition

`findFretInPosition(tuning: string[], stringIndex: number, pitchClass: string, referenceFret: number, span?: number) => number | null`

Find a pitch class within a position window. The window is `[ref - ceil(span/2), ref + span]` where `span` defaults to 5.

```js
findFretInPosition(STANDARD, 0, "A", 5);    // => 5
findFretInPosition(STANDARD, 0, "A", 12);   // => 17
findFretInPosition(STANDARD, 0, "A", 5, 3); // => 5 (narrower window)
```

## findNote

`findNote(pitchClass: string, tuning?: string[], fretRange?: [number, number]) => FretboardPosition[]`

Find all positions of a pitch class across the entire fretboard:

```js
findNote("A");
// => [
//   { string: 0, fret: 5, note: "A2", midi: 45 },
//   { string: 1, fret: 0, note: "A2", midi: 45 },
//   { string: 2, fret: 7, note: "A3", midi: 57 },
//   ...
// ]

findNote("A", STANDARD, [0, 12]); // limit to first 12 frets
findNote("E", DROP_D);            // works with any tuning
```

## fretboard

`fretboard(tuning?: string[], fretRange?: [number, number]) => FretboardPosition[]`

Generate the complete fretboard grid -- every note at every string/fret combination in range:

```js
const grid = fretboard(STANDARD, [0, 4]);
// 6 strings x 5 frets = 30 FretboardPosition entries

// Filter by string:
grid.filter((n) => n.string === 0);
// => [{ string: 0, fret: 0, note: "E2", midi: 40 }, ...]
```

## FretboardPosition Type

```ts
interface FretboardPosition {
  string: number; // 0 = lowest string
  fret: number;
  note: string;   // note with octave, e.g. "A2"
  midi: number;
}
```
