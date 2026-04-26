---
title: Patterns
description: Melodic pattern generators and walker
---

```js
import * as Guitar from "tonal-guitar";

const pattern = Guitar.thirds(7);
const notes = Guitar.walkPattern(scale, pattern);
```

Pattern generators produce degree sequences (`number[]` arrays) that describe melodic exercises. The pattern walker resolves these abstract degrees into concrete fretted notes on the guitar.

## Pattern Generators

All generators are pure functions that return `number[]` degree sequences. These sequences can be passed to `walkPattern` or `applySequence`.

### `ascendingIntervals`

`ascendingIntervals(scaleLength: number, interval: number, octaves?: number) => number[]`

Generate ascending interval pairs across a scale:

```js
// Ascending 3rds over a 7-note scale
ascendingIntervals(7, 2);
// => [1,3, 2,4, 3,5, 4,6, 5,7, 6,8]

// Ascending 4ths
ascendingIntervals(7, 3);
// => [1,4, 2,5, 3,6, 4,7, 5,8]

// Ascending 6ths
ascendingIntervals(7, 5);
// => [1,6, 2,7, 3,8]

// Two octaves of 3rds
ascendingIntervals(7, 2, 2);
// => [1,3, 2,4, ..., 13,15]

// Pentatonic 3rds (5-note scale)
ascendingIntervals(5, 2);
// => [1,3, 2,4, 3,5, 4,6]
```

### `descendingIntervals`

`descendingIntervals(scaleLength: number, interval: number, startDegree?: number) => number[]`

Generate descending interval pairs:

```js
descendingIntervals(7, 2);
// => [8,6, 7,5, 6,4, 5,3, 4,2, 3,1]

descendingIntervals(7, 3);
// => [8,5, 7,4, 6,3, 5,2, 4,1]
```

### `ascendingLinear`

`ascendingLinear(from: number, to: number) => number[]`

Simple ascending degree sequence:

```js
ascendingLinear(1, 8); // => [1, 2, 3, 4, 5, 6, 7, 8]
ascendingLinear(3, 7); // => [3, 4, 5, 6, 7]
```

### `descendingLinear`

`descendingLinear(from: number, to: number) => number[]`

Simple descending degree sequence:

```js
descendingLinear(8, 1); // => [8, 7, 6, 5, 4, 3, 2, 1]
```

### `grouping`

`grouping(scaleLength: number, groupSize: number, step?: number) => number[]`

Generate overlapping groups where each group starts one step higher:

```js
grouping(7, 4);
// => [1,2,3,4, 2,3,4,5, 3,4,5,6, 4,5,6,7]

grouping(7, 3);
// => [1,2,3, 2,3,4, 3,4,5, 4,5,6, 5,6,7]

grouping(7, 4, 2); // step by 2
// => [1,2,3,4, 3,4,5,6, 5,6,7,8]
```

### Convenience Wrappers

```js
thirds(7);  // same as ascendingIntervals(7, 2)
fourths(7); // same as ascendingIntervals(7, 3)
sixths(7);  // same as ascendingIntervals(7, 5)

// For pentatonic:
thirds(5);  // ascending 3rds over 5-note scale
```

## Pattern Walker

### `walkPattern`

`walkPattern(scale: FrettedScale, pattern: number[], options?: WalkOptions) => FrettedNote[]`

Walk a degree pattern through a fretted scale, picking concrete notes from the available positions. The walker intelligently selects notes in the correct octave and direction.

```js
const shape = get("CAGED E Shape");
const scale = buildFrettedScale(shape, "A");

// Simple ascending scale
walkPattern(scale, [1, 2, 3, 4, 5, 6, 7, 8]);

// Ascending thirds
walkPattern(scale, thirds(7));

// Mixed direction (auto-detected)
walkPattern(scale, [1, 3, 5, 7, 6, 5, 4, 3, 2, 1]);
```

### Direction Options

```ts
interface WalkOptions {
  direction?: "auto" | "up" | "down" | "nearest";
}
```

- **`"auto"`** (default) -- Detects direction from consecutive degrees in the pattern. When `current > prev`, picks ascending; when `current < prev`, picks descending. Handles mixed patterns like `[1,3,5,7,6,5,4,3,2,1]` which ascends then descends.

- **`"up"`** -- Always pick the next higher note for each degree.

- **`"down"`** -- Always pick the next lower note for each degree.

- **`"nearest"`** -- Pick the closest note by MIDI number regardless of direction.

```js
// Force ascending
walkPattern(scale, [1, 2, 3, 4], { direction: "up" });

// Force descending
walkPattern(scale, [8, 7, 6, 5], { direction: "down" });
```

### How Auto-Direction Works

The walker compares each degree to the previous one:

```
Pattern: [1, 3, 5, 7, 6, 5, 4, 3, 2, 1]
          ↑  ↑  ↑  ↑  ↓  ↓  ↓  ↓  ↓  ↓
Step:     up up up up dn dn dn dn dn dn
```

The first step defaults to ascending unless the first degree is greater than the second. This lets you write a single pattern that naturally ascends and descends without manually specifying directions.

Negative and out-of-range degrees are normalized: `((deg - 1) % scaleLen + scaleLen) % scaleLen + 1`.
