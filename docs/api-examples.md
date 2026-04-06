# API Examples — TDD Style

These examples define how we expect the API to behave. They will drive the
implementation. Each section shows input → expected output.

---

## 1. Tuning

```typescript
import { Guitar } from "@tonaljs/guitar";

// Built-in tunings
Guitar.tunings.standard
// → ["E2", "A2", "D3", "G3", "B3", "E4"]

Guitar.tunings.standard7
// → ["B1", "E2", "A2", "D3", "G3", "B3", "E4"]

Guitar.tunings.dropD
// → ["D2", "A2", "D3", "G3", "B3", "E4"]

Guitar.tunings.openG
// → ["D2", "G2", "D3", "G3", "B3", "D4"]

Guitar.tunings.dadgad
// → ["D2", "A2", "D3", "G3", "A3", "D4"]

// Custom tuning — just an array of note names
const myTuning = ["C2", "G2", "D3", "A3", "E4", "B4"];
```

## 2. Fretboard Basics

```typescript
// What note is at string 0 (low E), fret 5 in standard tuning?
Guitar.noteAt(0, 5)
// → "A2"

Guitar.noteAt(0, 5, Guitar.tunings.dropD)
// → "G2"

// What fret(s) is "A3" on each string? (standard tuning)
Guitar.fretsFor("A3")
// → [null, null, null, null, 10, 5]
//    (not reachable on low strings in practical range, fret 10 on B, fret 5 on high E)

// All positions for note "A" (any octave) within frets 0-12
Guitar.findNote("A", { frets: [0, 12] })
// → [
//   { string: 0, fret: 5, note: "A2" },
//   { string: 1, fret: 0, note: "A2" },  // open A string
//   { string: 2, fret: 7, note: "A3" },
//   { string: 3, fret: 2, note: "A3" },
//   { string: 4, fret: 10, note: "A4" },
//   { string: 5, fret: 5, note: "A4" },
// ]
```

## 3. Chord Notation Parsing

```typescript
// Parse string notation
Guitar.parseChord("x32010")
// → { frets: [null, 3, 2, 0, 1, 0], notes: ["C3", "E3", "G3", "C4", "E4"] }

Guitar.parseChord("355433")
// → { frets: [3, 5, 5, 4, 3, 3], notes: ["G2", "C3", "F3", "Ab3", "C4", "Eb4"] }

// Parse array notation
Guitar.parseChord([null, 3, 2, 0, 1, 0])
// → same as "x32010"

// Format back to string
Guitar.formatChord([null, 3, 2, 0, 1, 0])
// → "x32010"

Guitar.formatChord([null, null, 0, 2, 3, 2])
// → "xx0232"

// With custom tuning
Guitar.parseChord("000000", { tuning: Guitar.tunings.openG })
// → { frets: [0,0,0,0,0,0], notes: ["D2","G2","D3","G3","B3","D4"] }
```

## 4. Shape Definition & Application

```typescript
// A shape is intervals from root, per string
// E-shape major barre chord
const eShapeMajor = Guitar.shape({
  name: "E Shape Major",
  system: "caged",
  // Each string gets one or more intervals from root
  // For a chord shape: one interval per string
  intervals: [["1P"], ["5P"], ["1P"], ["3M"], ["5P"], ["1P"]],
  rootStringIndex: 0,  // Root is on the lowest string
  rootFretOffset: 0,
});

// Apply to a specific root
Guitar.applyShape(eShapeMajor, "A")
// → {
//   frets: [5, 7, 7, 6, 5, 5],
//   notes: ["A2", "E3", "A3", "C#4", "E4", "A4"],
//   intervals: ["1P", "5P", "1P", "3M", "5P", "1P"],
//   position: 5,
//   root: "A",
// }

Guitar.applyShape(eShapeMajor, "G")
// → {
//   frets: [3, 5, 5, 4, 3, 3],
//   notes: ["G2", "D3", "G3", "B3", "D4", "G4"],
//   intervals: ["1P", "5P", "1P", "3M", "5P", "1P"],
//   position: 3,
//   root: "G",
// }

// Same shape with 7-string tuning
Guitar.applyShape(eShapeMajor, "A", { tuning: Guitar.tunings.standard7 })
// → root lands on string index 1 (the E string in 7-string)
// → frets: [null, 5, 7, 7, 6, 5, 5]
```

## 5. CAGED Shapes (Built-in, Overridable)

```typescript
// Get all CAGED shapes for a chord type
Guitar.caged("major")
// → { C: Shape, A: Shape, G: Shape, E: Shape, D: Shape }

// Get the A-shape for major
Guitar.caged("major", "A")
// → Shape { name: "A Shape Major", system: "caged", intervals: [...] }

// Apply CAGED A-shape as D chord
const aShapeD = Guitar.applyShape(Guitar.caged("major", "A"), "D")
// → { frets: [null, 5, 7, 7, 7, 5], notes: [...], position: 5 }

// Override a built-in shape
const myCaged = Guitar.caged("major", {
  overrides: {
    A: Guitar.shape({
      name: "A Shape Major (alt)",
      system: "caged",
      intervals: [["1P"], ["5P"], ["1P"], ["3M"], ["5P"], ["1P"]],
      rootStringIndex: 1,
      rootFretOffset: 0,
    })
  }
});

// Get all 5 positions of C major using CAGED
Guitar.cagedPositions("C", "major")
// → [
//   { shape: "C", fingering: { frets: [null,3,2,0,1,0], ... }, position: 0 },
//   { shape: "A", fingering: { frets: [null,3,5,5,5,3], ... }, position: 3 },
//   { shape: "G", fingering: { frets: [3,5,5,5,3,3], ... }, position: 3 },
//   { shape: "E", fingering: { frets: [8,10,10,9,8,8], ... }, position: 8 },
//   { shape: "D", fingering: { frets: [null,null,10,12,13,12], ... }, position: 10 },
// ]
```

## 6. Scale Patterns

```typescript
// 3NPS A major scale, pattern 1 (Ionian)
const threeNps1 = Guitar.threeNps("major", 1);
Guitar.applyScalePattern(threeNps1, "A")
// → {
//   strings: [
//     [{ fret: 5, note: "A2", interval: "1P" }, { fret: 7, note: "B2", interval: "2M" }, { fret: 9, note: "C#3", interval: "3M" }],
//     [{ fret: 5, note: "D3", interval: "4P" }, { fret: 7, note: "E3", interval: "5P" }, { fret: 9, note: "F#3", interval: "6M" }],
//     [{ fret: 6, note: "G#3", interval: "7M" }, { fret: 7, note: "A3", interval: "1P" }, { fret: 9, note: "B3", interval: "2M" }],
//     ...
//   ],
//   position: 5,
//   root: "A",
// }

// Same shape but starting on degree 2 = Dorian
const threeNps2 = Guitar.threeNps("major", 2);  // Dorian pattern
Guitar.applyScalePattern(threeNps2, "B")  // B Dorian
// → intervals labeled relative to B as root: 1P, 2M, 3m, 4P, 5P, 6M, 7m

// Pentatonic box shapes
Guitar.pentatonicBox(1)  // Box 1 (minor pentatonic root position)
Guitar.applyScalePattern(Guitar.pentatonicBox(1), "A")
// → {
//   strings: [
//     [{ fret: 5, note: "A2", interval: "1P" }, { fret: 8, note: "C3", interval: "3m" }],
//     [{ fret: 5, note: "D3", interval: "4P" }, { fret: 7, note: "E3", interval: "5P" }],
//     [{ fret: 5, note: "G3", interval: "7m" }, { fret: 7, note: "A3", interval: "1P" }],
//     [{ fret: 5, note: "C4", interval: "3m" }, { fret: 7, note: "D4", interval: "4P" }],
//     [{ fret: 5, note: "E4", interval: "5P" }, { fret: 8, note: "G4", interval: "7m" }],
//     [{ fret: 5, note: "A4", interval: "1P" }, { fret: 8, note: "C5", interval: "3m" }],
//   ],
//   position: 5,
// }

// Parse scale pattern from shorthand notation
Guitar.parseScalePattern("5-8,5-7,5-7,5-7,5-8,5-8")
// → { frets: [[5,8],[5,7],[5,7],[5,7],[5,8],[5,8]] }
// (This is positional — you'd need to associate with a tuning to get notes)
```

## 7. Analysis — Function in a Key

```typescript
// What chord is this fingering?
Guitar.identify([null, 3, 2, 0, 1, 0])
// → { name: "C", type: "major", notes: ["C3","E3","G3","C4","E4"] }

Guitar.identify("355433")
// → { name: "Cm", type: "minor", notes: [...] }

// Analyze a chord's function in a key
Guitar.analyze([null, 3, 2, 0, 1, 0], { key: "C major" })
// → {
//   chord: "C",
//   type: "major",
//   function: "I",
//   degree: 1,
//   mode: "ionian",
// }

Guitar.analyze([null, 3, 2, 0, 1, 0], { key: "G major" })
// → {
//   chord: "C",
//   type: "major",
//   function: "IV",
//   degree: 4,
//   mode: "lydian",
// }

Guitar.analyze([null, 3, 2, 0, 1, 0], { key: "F major" })
// → {
//   chord: "C",
//   type: "major",
//   function: "V",
//   degree: 5,
//   mode: "mixolydian",
// }

// Analyze a scale pattern
Guitar.analyzeScale(
  Guitar.applyScalePattern(Guitar.pentatonicBox(1), "A"),
  { key: "C major" }
)
// → {
//   scale: "A minor pentatonic",
//   relativeToKey: "vi pentatonic",
//   mode: "aeolian",
//   notes: ["A", "C", "D", "E", "G"],
// }
```

## 8. Shape Relationships

```typescript
// "This A minor pentatonic box 1 is the same notes as C major pentatonic box 6"
Guitar.relatedShapes(Guitar.pentatonicBox(1), "A", "minor pentatonic")
// → [
//   { root: "C", scale: "major pentatonic", box: 6 },
//   { root: "D", scale: "dorian pentatonic", box: 4 },
//   ...
// ]

// Find which CAGED shape a given fingering belongs to
Guitar.identifyShape([5, 7, 7, 6, 5, 5])
// → { shape: "E Shape", type: "major", root: "A", system: "caged" }

Guitar.identifyShape([null, 5, 7, 7, 7, 5])
// → { shape: "A Shape", type: "major", root: "D", system: "caged" }
```

## 9. Arpeggios

```typescript
// Major arpeggio, E shape
Guitar.arpeggio("major", "E")
// → Shape with intervals: [["1P"], ["5P"], ["1P"], ["3M"], ["5P"], ["1P"]]

// Apply to a key
Guitar.applyShape(Guitar.arpeggio("major", "E"), "C")
// → { frets: [8, 10, 10, 9, 8, 8], notes: [...], intervals: [...] }

// Minor 7th arpeggio, A shape  
Guitar.arpeggio("m7", "A")
// → Shape with intervals: [null, ["1P"], ["3m","7m"], ["5P","1P"], ["3m"], ["7m"]]

// All arpeggio shapes for Cmaj7 across the neck
Guitar.arpeggioPositions("C", "maj7")
// → array of all CAGED-based arpeggio positions
```

## 10. Custom Shapes

```typescript
// Teacher A teaches the A-shape differently than Teacher B
const teacherAShape = Guitar.shape({
  name: "A Shape Major (Teacher A)",
  system: "caged",
  intervals: [null, ["1P"], ["5P"], ["1P"], ["3M"], ["5P"]],
  rootStringIndex: 1,
  rootFretOffset: 0,
});

// Register it globally
Guitar.shapes.add(teacherAShape);

// Or use it inline
Guitar.applyShape(teacherAShape, "D")
// → { frets: [null, 5, 7, 7, 7, 5], ... }

// Create a completely custom shape system
const myScaleSystem = Guitar.createShapeSystem({
  name: "My Scale System",
  shapes: {
    "Position 1": Guitar.scalePattern({ intervals: [...], rootStringIndex: 0 }),
    "Position 2": Guitar.scalePattern({ intervals: [...], rootStringIndex: 1 }),
  }
});

// Use it
Guitar.applyScalePattern(myScaleSystem.shapes["Position 1"], "G")
```

## 11. Inversions & Voicings

```typescript
// Get all inversions of C major on strings 2-5
Guitar.voicings("C", { strings: [1, 2, 3, 4], type: "drop2" })
// → [
//   { frets: [...], notes: ["C","E","G","C"], inversion: "root" },
//   { frets: [...], notes: ["E","G","C","E"], inversion: "1st" },
//   { frets: [...], notes: ["G","C","E","G"], inversion: "2nd" },
// ]

// Drop 3 voicings
Guitar.voicings("Cmaj7", { strings: [0, 2, 3, 4], type: "drop3" })
// → array of drop-3 voicings with string skip
```

## 12. Combining with Tonal

```typescript
import { Chord, Scale, Key } from "tonal";
import { Guitar } from "@tonaljs/guitar";

// Get a Tonal chord, then find guitar shapes for it
const chord = Chord.get("Cmaj7");
const shapes = Guitar.shapesFor(chord.intervals);
// → all shapes that contain these intervals

// Get a Tonal scale, find all positions
const scale = Scale.get("A dorian");
const positions = Guitar.scalePositions(scale.notes, { system: "3nps" });

// Walk through a progression
const key = Key.majorKey("G");
key.chords.forEach(chordName => {
  const fingering = Guitar.applyShape(Guitar.caged("major", "E"), chordName);
  console.log(`${chordName}: ${Guitar.formatChord(fingering.frets)}`);
});
```
