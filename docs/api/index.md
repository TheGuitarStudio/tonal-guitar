---
title: Guitar
description: Guitar fretboard, shapes, patterns, and sequences
package: guitar
---

```js
import * as Guitar from "tonal-guitar";

const shape = Guitar.get("CAGED E Shape");
const scale = Guitar.buildFrettedScale(shape, "A");
const notes = Guitar.walkPattern(scale, Guitar.thirds(7));
console.log(Guitar.toAsciiTab(notes));
```

The `tonal-guitar` package provides pure functions for working with guitar fretboard geometry, scale/chord shapes, melodic patterns, and output formatting. It integrates deeply with Tonal's Scale, Chord, Mode, and Key modules.

## Core Workflow

The typical workflow is:

1. **Choose a shape** from the built-in registry (CAGED, 3NPS, pentatonic) or define your own
2. **Build** a fretted scale by applying the shape to a root note and tuning
3. **Generate a pattern** (thirds, fourths, groupings, custom sequences)
4. **Walk** the pattern through the fretted scale to get concrete notes
5. **Output** as ASCII tab or AlphaTeX notation

```js
import {
  get,
  buildFrettedScale,
  walkPattern,
  thirds,
  applySequence,
  flattenSequence,
  toAlphaTeX,
  toAsciiTab,
  STANDARD,
  SEQ_1235,
} from "tonal-guitar";

// Build A major in CAGED E Shape
const scale = buildFrettedScale(get("CAGED E Shape"), "A");

// Walk ascending thirds
const thirdNotes = walkPattern(scale, thirds(7));
console.log(toAsciiTab(thirdNotes));

// Or apply an incremental sequence
const passes = applySequence(scale, SEQ_1235, { incremental: true });
const allNotes = flattenSequence(passes);
console.log(toAlphaTeX(allNotes, { tempo: 100, key: "A" }));
```

## Built-in Shape Systems

The package ships with 22 shapes registered at import time:

| System | Count | Shapes |
|--------|-------|--------|
| CAGED Scales | 5 | E, D, C, A, G shapes |
| CAGED Chords | 5 | E, D, C, A, G shapes (with fingerings and barres) |
| 3NPS | 7 | Patterns 1-7 (one per mode) |
| Pentatonic | 5 | Boxes 1-5 |

## Package Sections

- [Fretboard](/docs/guitar/fretboard) -- Fretboard math and note lookups
- [Shapes](/docs/guitar/shapes) -- Scale and chord shape registry
- [Patterns](/docs/guitar/patterns) -- Melodic pattern generators and walker
- [Sequences](/docs/guitar/sequences) -- Sequence engine for incremental exercises
- [Output](/docs/guitar/output) -- AlphaTeX and ASCII tab formatters
- [Integration](/docs/guitar/integration) -- Tonal.js Scale, Chord, Mode, and Key integration
