---
title: Output
description: AlphaTeX and ASCII tab formatters
---

```js
import * as Guitar from "tonal-guitar";

console.log(Guitar.toAsciiTab(notes));
console.log(Guitar.toAlphaTeX(notes, { tempo: 120, duration: 8 }));
```

Output formatters convert `FrettedNote[]` arrays into human-readable or machine-readable notation. Rhythm is an output concern -- `FrettedNote` has no duration field, so duration is specified at render time.

## toAlphaTeX

`toAlphaTeX(notes: FrettedNote[], options?: AlphaTexOptions) => string`

Format notes as [AlphaTeX](https://www.alphatab.net/docs/alphatex/) notation, suitable for rendering with [alphaTab](https://www.alphatab.net/).

```js
toAlphaTeX(notes, {
  title: "A Major Thirds",
  tempo: 120,
  duration: 8,
  key: "A",
});
// => \title "A Major Thirds"
//    \tempo 120
//    \track "Guitar" "Gtr"
//    \staff {tabs}
//    \tuning E4 B3 G3 D3 A2 E2
//    \ts 4 4 \ks A
//    | :8 5.6 7.5 5.5 7.4 ...
```

### Options

```ts
interface AlphaTexOptions {
  title?: string;              // piece title (default: "Exercise")
  tempo?: number;              // BPM (default: 120)
  duration?: number;           // default note duration: 4, 8, 16 (default: 8)
  tuning?: string[];           // override tuning (default: STANDARD)
  key?: string;                // key signature (default: "C")
  timeSignature?: [number, number]; // e.g. [4, 4]
  notesPerBar?: number;        // notes per bar (default: derived from duration)
  noteDurations?: number[];    // per-note duration override
  rhythmPattern?: number[];    // repeating duration cycle
}
```

### Rhythm Control

Three ways to control note durations:

**Uniform duration** -- All notes get the same duration:
```js
toAlphaTeX(notes, { duration: 16 }); // all sixteenth notes
```

**Rhythm pattern** -- Repeating cycle of durations:
```js
toAlphaTeX(notes, {
  rhythmPattern: [8, 8, 16, 16], // eighth, eighth, sixteenth, sixteenth
});
// Produces: :8 5.6 7.5 :16 5.5 7.4 :8 5.4 7.3 :16 ...
```

**Per-note durations** -- Explicit duration for each note:
```js
toAlphaTeX(notes, {
  noteDurations: [8, 8, 8, 8, 16, 16, 16, 16, 4, 4],
});
```

## toAsciiTab

`toAsciiTab(notes: FrettedNote[], options?: AsciiTabOptions) => string`

Format notes as ASCII guitar tablature:

```js
toAsciiTab(notes);
// => e|---5------|
//    B|-----5----|
//    G|---6------|
//    D|-----7----|
//    A|---7------|
//    E|-5--------|
```

String labels are derived from the tuning (highest string is lowercased per tab convention). Works with any tuning:

```js
toAsciiTab(notes, { tuning: STANDARD_7 });
// => e|...|
//    B|...|
//    G|...|
//    D|...|
//    A|...|
//    E|...|
//    B|...|
```

### Options

```ts
interface AsciiTabOptions {
  tuning?: string[];  // override tuning (default: STANDARD)
}
```

## Notation Parsing

Utility functions for parsing and formatting chord/scale notation strings.

### `parseChordFrets`

`parseChordFrets(input: string | (number | null)[]) => (number | null)[]`

Parse chord fret notation into a structured array:

```js
// Compact format (single-digit frets)
parseChordFrets("x32010");        // => [null, 3, 2, 0, 1, 0]

// Delimited format (high frets)
parseChordFrets("8-10-10-9-8-8"); // => [8, 10, 10, 9, 8, 8]
parseChordFrets("x-3-2-0-1-0");   // => [null, 3, 2, 0, 1, 0]

// Array passthrough (normalizes sentinels)
parseChordFrets([null, 3, 2, 0, 1, 0]); // => [null, 3, 2, 0, 1, 0]
parseChordFrets([-1, 3, 2, 0, 1, 0]);   // => [null, 3, 2, 0, 1, 0]
```

### `formatChordFrets`

`formatChordFrets(frets: (number | null)[]) => string`

Format a fret array back to notation. Uses compact format when all frets are single-digit:

```js
formatChordFrets([null, 3, 2, 0, 1, 0]); // => "x32010"
formatChordFrets([8, 10, 10, 9, 8, 8]);  // => "8-10-10-9-8-8"
```

### `parseScalePattern`

`parseScalePattern(input: string) => number[][]`

Parse a scale pattern shorthand string into a 2D array of fret groups per string:

```js
parseScalePattern("5-8,5-7,5-7,5-7,5-8,5-8");
// => [[5,8], [5,7], [5,7], [5,7], [5,8], [5,8]]
```
