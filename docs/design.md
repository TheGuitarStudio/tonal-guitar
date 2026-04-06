# Guitar Shapes — Design Plan

## Goals

1. Provide a functional, composable API for guitar shapes (chords, scales, arpeggios)
2. Support CAGED, 3NPS, and arbitrary custom shape systems
3. Shapes are interval-based (key-independent) by default
4. Tuning is a first-class parameter (6-string, 7-string, alt tunings)
5. Users can override/customize built-in shape dictionaries
6. Compose with Tonal — use its primitives, don't modify its internals
7. Analyze shapes in context (key, mode, function, intervals, note names)

## Module Layout

```
packages/guitar/
├── index.ts           # Public API surface
├── tuning.ts          # Tuning definitions, string→note math
├── fretboard.ts       # Fret→note, note→fret[], position math
├── shape.ts           # Shape type: interval-based templates
├── fingering.ts       # Shape + tuning + key → concrete fret positions
├── notation.ts        # Parse/format "x32010", arrays, scale patterns
├── analyze.ts         # Chord/scale function analysis in a key context
├── data/
│   ├── caged.ts       # Built-in CAGED shapes (overridable)
│   ├── three-nps.ts   # Built-in 3NPS patterns
│   ├── arpeggios.ts   # Common arpeggio shapes
│   └── tunings.ts     # Standard, drop, open tunings
├── test.ts            # Main test file
└── docs/
    ├── research.md
    ├── design.md
    └── api-examples.md
```

## Core Types

### Tuning
```typescript
type Tuning = NoteName[];
// ["E2", "A2", "D3", "G3", "B3", "E4"]  — standard 6-string
// ["B1", "E2", "A2", "D3", "G3", "B3", "E4"]  — 7-string
```

Strings are indexed 0 = lowest pitch string (low E on standard).

### Shape
A Shape is a key-independent template described by intervals.

```typescript
interface Shape {
  name: string;               // "E Shape Major Barre"
  system: string;             // "caged" | "3nps" | "pentatonic" | "arpeggio" | "custom"
  intervals: (IntervalName | null)[][];  
    // Per-string array of intervals from the shape's root
    // null = string not played
    // e.g., for an E-shape major barre:
    // [["1P","5P","1P","3M","5P","1P"]]  (one note per string = chord)
    // or for scale: [["1P","2M"], ["4P","5P"], ...]  (multiple per string)
  rootStringIndex: number;    // Which string contains the root (0-indexed from low)
  rootFretOffset: number;     // How many frets above the position marker the root sits
  span: number;               // How many frets wide (e.g. 4 for most shapes, 5 for stretches)
}
```

### Fingering (concrete realization)
```typescript
interface Fingering {
  shape: string;              // Shape name reference
  root: NoteName;             // "A4", "C#3", etc.
  tuning: Tuning;
  frets: (number | null)[];   // Per-string fret number, null = muted
  notes: NoteName[];          // Actual note names at each position
  intervals: IntervalName[];  // Interval from root at each position
  position: number;           // Starting fret of the shape
  strings: number;            // Number of strings
}
```

### ScalePattern (for multi-note-per-string shapes)
```typescript
interface ScalePattern {
  name: string;
  system: string;             // "3nps" | "caged-scale" | "pentatonic-box" | "custom"
  // Per-string: array of intervals from root (ordered low to high fret)
  intervals: (IntervalName[])[];
  rootStringIndex: number;
  modeIndex: number;          // 0 = ionian, 1 = dorian, etc. (for modal systems)
}
```

### ScaleFingering (concrete scale on fretboard)
```typescript
interface ScaleFingering {
  pattern: string;            // ScalePattern name reference
  root: NoteName;
  tuning: Tuning;
  // Per-string: array of {fret, note, interval}
  strings: {
    fret: number;
    note: NoteName;
    interval: IntervalName;
  }[][];
  position: number;           // Starting fret
}
```

## Key Design Decisions

### 1. Shapes are interval-based, not fret-based
Fret numbers are computed from intervals + tuning + root. This makes shapes
inherently transposable and tuning-independent.

### 2. Shape vs Fingering separation
- Shape = abstract template (like a chord type)
- Fingering = concrete realization (like a chord with a tonic)
This mirrors Tonal's ChordType/Chord separation.

### 3. Dictionaries are data, not code
Built-in shapes (CAGED, 3NPS) are plain data objects. Users override by
providing their own dictionary or merging with defaults:
```typescript
const myShapes = { ...Guitar.caged, "A Shape Major": myCustomAShape };
```

### 4. Analysis is context-dependent
The same fingering has different meaning depending on key context:
- D major barre in key of G = V chord
- D major barre in key of D = I chord
- Same physical shape, different harmonic function

### 5. Notation parsing is bidirectional
- Parse: `"x32010"` → `[null, 3, 2, 0, 1, 0]`
- Format: `[null, 3, 2, 0, 1, 0]` → `"x32010"`
- Also support scale notation: `"5-8 5-7 5-7 5-7 5-8 5-8"` ↔ per-string arrays

## Open Questions

1. Should Shape and ScalePattern be unified into one type? Chords are just
   single-note-per-string shapes. Could simplify the API.
2. How to handle open strings in movable shapes? An E-shape barre uses no open
   strings, but the open E chord does. Are these the same "shape"?
3. How to represent barre indicators? (which fret is barred, which finger)
4. Should we include left-hand fingering (1-2-3-4) in the data model?
5. How to handle partial shapes? (playing only strings 1-4 of a 6-string shape)
