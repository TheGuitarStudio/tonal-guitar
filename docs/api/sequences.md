---
title: Sequences
description: Apply sequences across scale positions
---

```js
import * as Guitar from "tonal-guitar";

const passes = Guitar.applySequence(scale, Guitar.SEQ_1235, { incremental: true });
const allNotes = Guitar.flattenSequence(passes);
```

The sequence engine builds on the pattern walker to create exercises that shift incrementally across scale degrees -- the bread and butter of guitar practice routines.

## applySequence

`applySequence(scale: FrettedScale, sequence: number[], options?: SequenceOptions) => FrettedNote[][]`

Apply a degree sequence to a fretted scale. Returns one `FrettedNote[]` array per pass.

```js
const scale = buildFromScale(get("CAGED E Shape"), "A major");

// Single pass (default)
const [notes] = applySequence(scale, [1, 2, 3, 5]);

// Incremental: shift pattern across each degree
const passes = applySequence(scale, [1, 2, 3, 5], { incremental: true });
// Pass 1: degrees [1,2,3,5]
// Pass 2: degrees [2,3,4,6]
// Pass 3: degrees [3,4,5,7]
// ...continues until bounded by shape
```

### Options

```ts
interface SequenceOptions {
  incremental?: boolean;   // shift pattern across degrees (default: false)
  boundToShape?: boolean;  // stop when notes exceed shape range (default: true)
  startDegree?: number;    // starting degree offset (default: 1)
  passes?: number;         // max number of passes (default: all that fit)
}
```

**`incremental`** -- When `true`, each pass shifts all degrees by +1. Pass 1 uses the pattern as-is, pass 2 adds 1 to each degree, pass 3 adds 2, etc.

**`boundToShape`** -- When `true` (default), stops generating passes when a note would fall outside the fretted scale's available notes. This keeps exercises within a single position.

**`startDegree`** -- Offset applied to the first pass. Use `startDegree: 3` to begin the exercise from the 3rd degree.

**`passes`** -- Limit the number of passes. Without this, incremental mode generates passes until bounded by the shape.

### Incremental Example

```js
const scale = buildFromScale(get("CAGED E Shape"), "A major");

// 4-note ascending groups, shifting through the scale
const passes = applySequence(scale, SEQ_1234_GROUP, {
  incremental: true,
  passes: 4,
});
// Pass 1: [1,2,3,4] → A B C# D
// Pass 2: [2,3,4,5] → B C# D E
// Pass 3: [3,4,5,6] → C# D E F#
// Pass 4: [4,5,6,7] → D E F# G#
```

## flattenSequence

`flattenSequence(passes: FrettedNote[][]) => FrettedNote[]`

Flatten multi-pass results into a single note array for output:

```js
const passes = applySequence(scale, SEQ_1235, { incremental: true });
const allNotes = flattenSequence(passes);

// Chain directly to output
console.log(toAsciiTab(allNotes));
console.log(toAlphaTeX(allNotes, { tempo: 100, duration: 8, key: "A" }));
```

## Built-in Sequences

The package includes common practice sequences:

```js
import {
  ASCENDING_THIRDS,   // [1,3, 2,4, 3,5, 4,6, 5,7, 6,8]
  DESCENDING_THIRDS,  // [8,6, 7,5, 6,4, 5,3, 4,2, 3,1]
  SEQ_1235,           // [1,2,3,5]  -- arpeggio run
  SEQ_1234_GROUP,     // [1,2,3,4]  -- 4-note ascending group
  SEQ_UP_DOWN,        // [1,2,3,4,3,2]  -- wave
  SEQ_TRIAD_CLIMB,    // [1,3,5,3]  -- triad arpeggio
  SEQ_1357_DESC,      // [1,3,5,7,6,5,4,3,2,1]  -- up arpeggio, descend linear
} from "tonal-guitar";
```

These are just `number[]` arrays -- you can define your own:

```js
const mySequence = [1, 3, 5, 8, 5, 3]; // custom arpeggio
const passes = applySequence(scale, mySequence, { incremental: true });
```

## Full Chaining Example

```js
import {
  get,
  buildFromScale,
  applySequence,
  flattenSequence,
  toAlphaTeX,
  SEQ_TRIAD_CLIMB,
} from "tonal-guitar";

// Build A major in CAGED E position
const scale = buildFromScale(get("CAGED E Shape"), "A major");

// Apply triad climb incrementally
const passes = applySequence(scale, SEQ_TRIAD_CLIMB, {
  incremental: true,
  boundToShape: true,
});

// Flatten and render
const allNotes = flattenSequence(passes);
const tab = toAlphaTeX(allNotes, {
  title: "Triad Climb - A Major",
  tempo: 100,
  duration: 8,
  key: "A",
});

console.log(tab);
```
