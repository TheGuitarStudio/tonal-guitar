# tonal-guitar [![npm version](https://img.shields.io/npm/v/tonal-guitar.svg?style=flat-square)](https://www.npmjs.com/package/tonal-guitar)

> Guitar fretboard, shapes, patterns, and sequences — built on Tonal.js

## Install

```bash
npm install tonal-guitar @tonaljs/note @tonaljs/interval
```

Optional peer dependencies for scale/chord/key integration:

```bash
npm install @tonaljs/scale @tonaljs/chord @tonaljs/key
```

## Usage

```js
import {
  buildFrettedScale,
  get,
  walkPattern,
  thirds,
  toAsciiTab,
  toAlphaTeX,
} from "tonal-guitar";
```

## Quick Start

```js
import {
  buildFrettedScale,
  get,
  walkPattern,
  thirds,
  toAsciiTab,
  toAlphaTeX,
} from "tonal-guitar";

// 1. Get a shape and build a scale on the fretboard
const shape = get("CAGED E Shape");
const scale = buildFrettedScale(shape, "A");

// 2. Generate a pattern and walk it
const pattern = thirds(7); // ascending thirds over 7-note scale
const notes = walkPattern(scale, pattern);

// 3. Output as ASCII tab or AlphaTeX
console.log(toAsciiTab(notes));
console.log(toAlphaTeX(notes, { tempo: 100, duration: 8 }));
```

## API

### Tuning Constants

Pre-defined tunings as `string[]` arrays (low string to high string):

```js
import { STANDARD, DROP_D, DADGAD, OPEN_G, STANDARD_7, STANDARD_8 } from "tonal-guitar";

STANDARD;   // => ["E2", "A2", "D3", "G3", "B3", "E4"]
DROP_D;     // => ["D2", "A2", "D3", "G3", "B3", "E4"]
DADGAD;     // => ["D2", "A2", "D3", "G3", "A3", "D4"]
OPEN_G;     // => ["D2", "G2", "D3", "G3", "B3", "D4"]
STANDARD_7; // => ["B1", "E2", "A2", "D3", "G3", "B3", "E4"]
STANDARD_8; // => ["F#1", "B1", "E2", "A2", "D3", "G3", "B3", "E4"]
```

### Fretboard Math

#### `noteAt(tuning: string[], stringIndex: number, fret: number) => string`

Get the note name at a string/fret position:

```js
noteAt(STANDARD, 0, 5); // => "A2" (5th fret, low E string)
noteAt(STANDARD, 1, 3); // => "C3" (3rd fret, A string)
```

#### `fretFor(tuning: string[], stringIndex: number, targetNote: string) => number | null`

Reverse lookup — find which fret a note is on a given string:

```js
fretFor(STANDARD, 0, "A2"); // => 5
fretFor(STANDARD, 1, "C3"); // => 3
```

#### `findNearestFret(tuning: string[], stringIndex: number, pitchClass: string) => number | null`

Find the lowest fret where a pitch class appears on a string:

```js
findNearestFret(STANDARD, 0, "A"); // => 5
findNearestFret(STANDARD, 1, "A"); // => 0
```

#### `findFretInPosition(tuning: string[], stringIndex: number, pitchClass: string, referenceFret: number, span?: number) => number | null`

Find a pitch class within a position window centered on a reference fret:

```js
findFretInPosition(STANDARD, 0, "A", 5, 5); // => 5
```

#### `findNote(pitchClass: string, tuning?: string[], fretRange?: [number, number]) => FretboardPosition[]`

Find all positions of a pitch class across the fretboard:

```js
findNote("A"); // => [{string: 0, fret: 5, note: "A2", midi: 45}, ...]
findNote("A", STANDARD, [0, 12]); // limit to first 12 frets
```

#### `fretboard(tuning?: string[], fretRange?: [number, number]) => FretboardPosition[]`

Generate the complete fretboard grid:

```js
fretboard(STANDARD, [0, 4]); // every note on strings 0-5, frets 0-4
```

### Shape Registry

Built-in shapes are registered at import time: CAGED scale shapes (5), CAGED chord shapes (5), 3NPS patterns (7), and pentatonic boxes (5).

#### `get(name: string) => ScaleShape | undefined`

Retrieve a scale shape by name:

```js
get("CAGED E Shape"); // => { name: "CAGED E Shape", system: "caged", strings: [...], ... }
get("3NPS Pattern 1"); // => { name: "3NPS Pattern 1", system: "3nps", ... }
```

#### `all() => ScaleShape[]`

Get all registered scale shapes.

#### `names() => string[]`

Get all registered scale shape names:

```js
names(); // => ["CAGED E Shape", "CAGED D Shape", "CAGED C Shape", ...]
```

#### `add(shape: ScaleShape) => ScaleShape`

Register a custom shape:

```js
add({
  name: "My Custom Shape",
  system: "custom",
  strings: [["1P", "2M"], ["4P", "5P"], null, null, null, null],
  rootString: 0,
});
```

#### `removeAll() => void`

Clear all registered shapes.

#### `chordShapes`

Separate registry for chord shapes with the same API: `chordShapes.get()`, `chordShapes.all()`, `chordShapes.names()`, `chordShapes.add()`, `chordShapes.removeAll()`.

### Build Engine

#### `buildFrettedScale(shape: ScaleShape, root: string, tuning?: string[]) => FrettedScale`

Apply a scale shape to a root note and tuning, returning all fretted positions:

```js
const scale = buildFrettedScale(get("CAGED E Shape"), "A");
// => {
//   empty: false,
//   root: "A",
//   scaleType: "",
//   scaleName: "",
//   shapeName: "CAGED E Shape",
//   tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
//   notes: [
//     { string: 0, fret: 5, note: "A2", pc: "A", interval: "1P", degree: 1, midi: 45, ... },
//     { string: 0, fret: 7, note: "B2", pc: "B", interval: "2M", degree: 2, midi: 47, ... },
//     ...
//   ]
// }
```

Each `FrettedNote` contains:
- `string` — 0-indexed string (0 = lowest)
- `fret` — fret number
- `note` — full note name with octave (e.g. `"A2"`)
- `pc` — pitch class (e.g. `"A"`)
- `interval` — interval from root (e.g. `"1P"`, `"3M"`)
- `scaleIndex` — 0-based position in scale
- `degree` — 1-based degree (scaleIndex + 1)
- `intervalNumber` — numeric part of interval (e.g. 3 for `"3M"`)
- `midi` — MIDI number

Returns a `FrettedScale` with `empty: true` for invalid inputs.

#### `applyChordShape(shape: ChordShape, root: string, tuning?: string[]) => Fingering`

Apply a chord shape to a root, returning a `Fingering` with per-string fret numbers:

```js
const chord = applyChordShape(chordShapes.get("E Shape"), "A");
// => {
//   positions: [...FrettedNote[]],
//   frets: [5, 7, 7, 6, 5, 5],
//   root: "A",
//   shapeName: "E Shape",
//   startFret: 5
// }
```

### Pattern Generators

All generators return `number[]` degree sequences.

#### `ascendingIntervals(scaleLength: number, interval: number, octaves?: number) => number[]`

Generate ascending interval pattern:

```js
ascendingIntervals(7, 2); // 3rds: [1,3, 2,4, 3,5, 4,6, 5,7, 6,8]
ascendingIntervals(7, 3); // 4ths: [1,4, 2,5, 3,6, 4,7, 5,8]
```

#### `descendingIntervals(scaleLength: number, interval: number, startDegree?: number) => number[]`

Generate descending interval pattern:

```js
descendingIntervals(7, 2); // 3rds: [8,6, 7,5, 6,4, 5,3, 4,2, 3,1]
```

#### `ascendingLinear(from: number, to: number) => number[]`

```js
ascendingLinear(1, 8); // => [1, 2, 3, 4, 5, 6, 7, 8]
```

#### `descendingLinear(from: number, to: number) => number[]`

```js
descendingLinear(8, 1); // => [8, 7, 6, 5, 4, 3, 2, 1]
```

#### `grouping(scaleLength: number, groupSize: number, step?: number) => number[]`

Generate overlapping groups:

```js
grouping(7, 4); // => [1,2,3,4, 2,3,4,5, 3,4,5,6, 4,5,6,7]
```

#### `thirds(scaleLength) / fourths(scaleLength) / sixths(scaleLength)`

Convenience wrappers:

```js
thirds(7);  // same as ascendingIntervals(7, 2)
fourths(7); // same as ascendingIntervals(7, 3)
sixths(7);  // same as ascendingIntervals(7, 5)
```

### Pattern Walker

#### `walkPattern(scale: FrettedScale, pattern: number[], options?: WalkOptions) => FrettedNote[]`

Walk a degree pattern through a fretted scale, picking concrete notes:

```js
const scale = buildFrettedScale(get("CAGED E Shape"), "A");
const notes = walkPattern(scale, [1, 3, 5, 7, 6, 5, 4, 3, 2, 1]);
```

Options:
- `direction`: `"auto"` (default) — auto-detects ascending/descending from consecutive degrees. `"up"`, `"down"`, `"nearest"` for fixed direction.

Auto-direction compares consecutive pattern degrees: `[1,3,5,7]` ascends, then `[7,6,5,4,3,2,1]` descends. The walker picks the right octave at each step.

### Sequences

#### `applySequence(scale: FrettedScale, sequence: number[], options?: SequenceOptions) => FrettedNote[][]`

Apply a degree sequence to a fretted scale, optionally shifting incrementally across degrees:

```js
const passes = applySequence(scale, SEQ_1235, {
  incremental: true, // shift pattern across each degree
  boundToShape: true, // stop when notes go outside the shape
});
// Pass 1: [1,2,3,5], Pass 2: [2,3,4,6], Pass 3: [3,4,5,7], ...
```

Options:
- `incremental` — shift pattern by +1 each pass (default: `false`)
- `boundToShape` — stop passes when notes exceed shape range (default: `true`)
- `startDegree` — starting degree (default: `1`)
- `passes` — max number of passes (default: all that fit)

#### `flattenSequence(passes: FrettedNote[][]) => FrettedNote[]`

Flatten multi-pass results into a single array:

```js
const allNotes = flattenSequence(passes);
```

#### Built-in Sequences

```js
import {
  ASCENDING_THIRDS,  // [1,3, 2,4, 3,5, 4,6, 5,7, 6,8]
  DESCENDING_THIRDS, // [8,6, 7,5, 6,4, 5,3, 4,2, 3,1]
  SEQ_1235,          // [1,2,3,5]
  SEQ_1234_GROUP,    // [1,2,3,4]
  SEQ_UP_DOWN,       // [1,2,3,4,3,2]
  SEQ_TRIAD_CLIMB,   // [1,3,5,3]
  SEQ_1357_DESC,     // [1,3,5,7,6,5,4,3,2,1]
} from "tonal-guitar";
```

### Notation

#### `parseChordFrets(input: string | (number | null)[]) => (number | null)[]`

Parse chord fret notation:

```js
parseChordFrets("x32010");       // => [null, 3, 2, 0, 1, 0]
parseChordFrets("8-10-10-9-8-8"); // => [8, 10, 10, 9, 8, 8]
parseChordFrets("x-3-2-0-1-0");  // => [null, 3, 2, 0, 1, 0]
```

#### `formatChordFrets(frets: (number | null)[]) => string`

Format fret array back to notation:

```js
formatChordFrets([null, 3, 2, 0, 1, 0]); // => "x32010"
formatChordFrets([8, 10, 10, 9, 8, 8]);  // => "8-10-10-9-8-8"
```

#### `parseScalePattern(input: string) => number[][]`

Parse scale pattern shorthand:

```js
parseScalePattern("5-8,5-7,5-7,5-7,5-8,5-8");
// => [[5,8],[5,7],[5,7],[5,7],[5,8],[5,8]]
```

### Output Formatters

#### `toAlphaTeX(notes: FrettedNote[], options?: AlphaTexOptions) => string`

Format notes as [AlphaTeX](https://www.alphatab.net/docs/alphatex/) notation:

```js
toAlphaTeX(notes, {
  title: "A Major Thirds",
  tempo: 120,
  duration: 8,
  key: "A",
});
```

Options:
- `title` — piece title (default: `"Exercise"`)
- `tempo` — BPM (default: `120`)
- `duration` — default note duration: `4`, `8`, `16` (default: `8`)
- `tuning` — override tuning (default: `STANDARD`)
- `key` — key signature (default: `"C"`)
- `timeSignature` — e.g. `[4, 4]`
- `notesPerBar` — notes per bar (default: derived from duration)
- `noteDurations` — per-note duration array
- `rhythmPattern` — repeating duration cycle, e.g. `[8, 8, 16, 16]`

#### `toAsciiTab(notes: FrettedNote[], options?: AsciiTabOptions) => string`

Format notes as ASCII tablature:

```js
toAsciiTab(notes);
// e|---5----|
// B|-----5--|
// G|---6----|
// D|-----7--|
// A|---7----|
// E|-5------|
```

### Tonal.js Integration

These functions require optional peer dependencies (`@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`).

#### `buildFromScale(shape: ScaleShape, scaleName: string, tuning?: string[]) => FrettedScale`

Build a fretted scale using Tonal's `Scale.get()` for validation. Populates `scaleType` and `scaleName`:

```js
const scale = buildFromScale(get("CAGED E Shape"), "A major");
scale.scaleType; // => "major"
scale.scaleName; // => "A major"

buildFromScale(get("Pentatonic Box 1"), "A minor pentatonic");
```

#### `relatedScales(frettedScale: FrettedScale) => Array<{ root: string, scale: string }>`

Find all modal relatives (scales sharing the same pitch classes):

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
```

#### `identifyChord(frets: (number | null)[], tuning?: string[]) => string[]`

Identify chord names from fret positions:

```js
identifyChord([null, 3, 2, 0, 1, 0]); // => ["C"]
identifyChord([0, 2, 2, 1, 0, 0]);    // => ["E"]
```

#### `analyzeInKey(frets: (number | null)[], keyName: string, tuning?: string[]) => KeyAnalysis`

Analyze a chord voicing in the context of a major key:

```js
analyzeInKey([null, 3, 2, 0, 1, 0], "C");
// => { empty: false, chord: "C", numeral: "I", degree: 1 }

analyzeInKey([null, 3, 2, 0, 1, 0], "G");
// => { empty: false, chord: "C", numeral: "IV", degree: 4 }
```

Returns `{ empty: true }` if the chord is not found in the key.

#### `isShapeCompatible(shape: ScaleShape, scaleName: string) => boolean`

Check if a shape's intervals are all present in a given scale:

```js
isShapeCompatible(get("CAGED E Shape"), "A major"); // => true
isShapeCompatible(get("Pentatonic Box 1"), "A major"); // => true (subset)
```

#### `modeShapes(modeName: string, shapeSystem?: string) => ScaleShape[]`

Get all registered shapes compatible with a mode/scale:

```js
modeShapes("A major", "caged"); // all CAGED shapes that fit A major
modeShapes("A dorian"); // all shapes (any system) that fit A dorian
```

## Types

The package exports these TypeScript interfaces:

- `FrettedNote` — a note on the fretboard with position, pitch, and interval info
- `FrettedScale` — a scale applied to the fretboard (with `empty` sentinel pattern)
- `ScaleShape` — a scale shape definition (intervals per string)
- `ChordShape` — a chord voicing definition (one interval per string + fingerings)
- `Barre` — barre chord finger placement
- `Fingering` — chord shape applied to a specific root
- `FretboardPosition` — absolute position on the fretboard (string, fret, note, midi)
- `WalkOptions` — options for `walkPattern`
- `SequenceOptions` — options for `applySequence`
- `AlphaTexOptions` — options for `toAlphaTeX`
- `AsciiTabOptions` — options for `toAsciiTab`
- `KeyAnalysis` — result of `analyzeInKey`

## Related

- [@tonaljs/scale](https://github.com/tonaljs/tonal/tree/main/packages/scale) — scale definitions and lookups
- [@tonaljs/chord](https://github.com/tonaljs/tonal/tree/main/packages/chord) — chord detection and properties
- [@tonaljs/mode](https://github.com/tonaljs/tonal/tree/main/packages/mode) — modal scale relationships
- [@tonaljs/key](https://github.com/tonaljs/tonal/tree/main/packages/key) — key signatures and analysis

## License

MIT
