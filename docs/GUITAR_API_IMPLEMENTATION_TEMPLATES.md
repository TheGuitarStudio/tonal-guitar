# Guitar Shapes API - Implementation Templates

Ready-to-use code patterns for each approach. Copy-paste and adapt!

---

## Template 1: Simple Functions (Approach 5)

### Structure
```typescript
// Core building blocks
export function buildScale(shape: Shape, scaleName: string, tuning?: Tuning): Notes
export function applyPattern(notes: Notes, pattern: PatternName): Notes
export function filterOctaveRange(notes: Notes, min: number, max: number): Notes
export function getFretPositions(notes: Notes, tuning?: Tuning): FretPosition[]

// Output renderers
export function renderAlphaTeX(notes: Notes): string
export function renderAsciiTab(notes: Notes, tuning?: Tuning): string
export function renderHtmlTab(notes: Notes, tuning?: Tuning): string
```

### Usage Templates

**1. Basic scale:**
```typescript
const notes = buildScale(Shapes.E, "A4 major");
```

**2. Scale with pattern:**
```typescript
const notes = buildScale(Shapes.E, "A4 major");
const pattern = applyPattern(notes, "thirds");
```

**3. With custom tuning:**
```typescript
const notes = buildScale(Shapes.E, "A4 major", DROP_D_TUNING);
const pattern = applyPattern(notes, "thirds");
```

**4. Get fret positions:**
```typescript
const notes = buildScale(Shapes.E, "A4 major");
const positions = getFretPositions(notes);
positions.forEach(({ string, fret, note }) => {
  console.log(`String ${string}: fret ${fret} = ${note}`);
});
```

**5. Render to different formats:**
```typescript
const notes = buildScale(Shapes.E, "A4 major");
const pattern = applyPattern(notes, "thirds");

const alphaTeX = renderAlphaTeX(pattern);
const ascii = renderAsciiTab(pattern);
const html = renderHtmlTab(pattern);
```

### Full Implementation Template

```typescript
/**
 * Core guitar shapes functions
 */
import * as Scale from "@tonaljs/scale";
import * as Note from "@tonaljs/note";

export type Fret = number | null;
export type Shape = Fret[][];
export type Tuning = string[];
export type Notes = string[];
export type PatternName = "unison" | "thirds" | "fourths" | "fifths" | "sixths";

export const STANDARD_TUNING: Tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];

export function buildScale(
  shape: Shape,
  scaleName: string,
  tuning: Tuning = STANDARD_TUNING,
): Notes {
  const scaleObj = Scale.get(scaleName);
  if (scaleObj.empty || !scaleObj.tonic) return [];

  const notes: Notes = [];
  const scaleNotes = scaleObj.notes;

  shape.forEach((frets, stringIdx) => {
    const stringNote = tuning[stringIdx];
    if (!stringNote) return;

    frets.forEach((fret) => {
      const pitchedNote = Note.transpose(stringNote, [0, fret]);
      const noteChroma = Note.get(pitchedNote).chroma;

      for (const scalNote of scaleNotes) {
        if (Note.get(scalNote).chroma === noteChroma) {
          notes.push(scalNote);
          break;
        }
      }
    });
  });

  return notes;
}

export function applyPattern(
  notes: Notes,
  pattern: PatternName = "unison",
): Notes {
  const steps = {
    unison: 1,
    thirds: 3,
    fourths: 4,
    fifths: 5,
    sixths: 6,
  };

  const step = steps[pattern] || 1;
  return notes.filter((_, i) => i % step === 0);
}

export function renderAlphaTeX(notes: Notes): string {
  return notes.map(n => Note.get(n).pc + Note.get(n).oct).join(" | ");
}

export function renderAsciiTab(notes: Notes, tuning: Tuning = STANDARD_TUNING): string {
  // Simplified ASCII tab rendering
  return notes.map(n => `[${n}]`).join("");
}
```

---

## Template 2: Pipe/Compose (Approach 2)

### Structure
```typescript
// Generic composition utilities
export function pipe<T>(initial: T): (...fns: ((x: any) => any)[]) => any
export function compose<T>(...fns: ((x: any) => any)[]): (x: T) => any

// Transform functions (for piping)
export const applyShape = (shape: Shape, scaleName: string, tuning?: Tuning) =>
  (input: Notes) => buildScale(shape, scaleName, tuning)

export const applyPattern = (pattern: PatternName) =>
  (notes: Notes) => applyPattern(notes, pattern)

export const formatOutput = (format: "alphaTeX" | "ascii" | "html") =>
  (notes: Notes) => format === "alphaTeX" ? renderAlphaTeX(notes) : renderAsciiTab(notes)
```

### Usage Templates

**1. Basic pipe:**
```typescript
const result = pipe(
  Shapes.E,
  (shape) => buildScale(shape, "A4 major")
);
```

**2. Multiple transforms:**
```typescript
const result = pipe(
  "A4 major",
  scaleToNotes,
  applyShape("E"),
  applyPattern("thirds"),
  formatOutput("alphaTeX")
);
```

**3. Reusable composition:**
```typescript
const processScale = (shape: Shape) =>
  pipe(
    shape,
    (s) => buildScale(s, "A4 major"),
    (notes) => applyPattern(notes, "thirds")
  );

const result1 = processScale(Shapes.E);
const result2 = processScale(Shapes.A);
```

**4. Using compose (right-to-left):**
```typescript
const scalesToTab = compose(
  renderAlphaTeX,
  (notes: Notes) => applyPattern(notes, "thirds"),
  (shape: Shape) => buildScale(shape, "A4 major")
);

const result = scalesToTab(Shapes.E);
```

**5. Building a reusable pipeline:**
```typescript
// Define transforms separately
const getScale = (shape: Shape) => buildScale(shape, "A4 major");
const getPattern = (notes: Notes) => applyPattern(notes, "thirds");
const formatTab = renderAlphaTeX;

// Compose them
const pipeline = compose(formatTab, getPattern, getScale);

// Use multiple times
[Shapes.C, Shapes.A, Shapes.G].map(pipeline);
```

### Full Implementation Template

```typescript
/**
 * Pipe and compose utilities for functional composition
 */

export function pipe<T>(initial: T): (...fns: ((x: any) => any)[]) => any {
  return (...fns) => fns.reduce((acc, fn) => fn(acc), initial);
}

export function compose<T>(...fns: ((x: any) => any)[]): (x: T) => any {
  return (input: T) => fns.reduceRight((acc, fn) => fn(acc), input);
}

// Transform factory functions (for use in pipes)
export const scaleToNotes = (scaleName: string): Notes => {
  const scaleObj = Scale.get(scaleName);
  return scaleObj.notes || [];
};

export const shapeToFretted =
  (scaleName: string, tuning?: Tuning) =>
  (shape: Shape): Notes =>
    buildScale(shape, scaleName, tuning);

export const withPattern =
  (pattern: PatternName) =>
  (notes: Notes): Notes =>
    applyPattern(notes, pattern);

export const toFormat =
  (format: "alphaTeX" | "ascii") =>
  (notes: Notes): string =>
    format === "alphaTeX" ? renderAlphaTeX(notes) : renderAsciiTab(notes);

export const withOctaveRange =
  (min: number, max: number) =>
  (notes: Notes): Notes =>
    notes.filter(n => {
      const obj = Note.get(n);
      return obj.oct !== undefined && obj.oct >= min && obj.oct <= max;
    });

// Higher-order helper for common scenarios
export const buildAndProcess = (shape: Shape, scaleName: string) => ({
  withPattern: (pattern: PatternName) => pipe(
    shape,
    (s) => buildScale(s, scaleName),
    (notes) => applyPattern(notes, pattern)
  ),
  toAlphaTeX: () => pipe(
    shape,
    (s) => buildScale(s, scaleName),
    renderAlphaTeX
  ),
});
```

---

## Template 3: Hybrid Implementation (Recommended)

### File Structure
```
guitar-shapes/
├── core.ts           # Approach 5 (simple functions)
├── compose.ts        # Approach 2 (pipe/compose)
├── shapes.ts         # Constant definitions
├── index.ts          # Export both
└── examples.ts       # Usage examples
```

### core.ts (Simple Functions)
```typescript
import * as Scale from "@tonaljs/scale";
import * as Note from "@tonaljs/note";

export type Fret = number | null;
export type Shape = Fret[][];
export type Tuning = string[];
export type Notes = string[];
export type PatternName = "unison" | "thirds" | "fourths" | "fifths" | "sixths";

export const STANDARD_TUNING: Tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];

// Core functions - simple, explicit
export function buildScale(
  shape: Shape,
  scaleName: string,
  tuning: Tuning = STANDARD_TUNING,
): Notes {
  // Implementation here
}

export function applyPattern(notes: Notes, pattern: PatternName = "unison"): Notes {
  // Implementation here
}

export function renderAlphaTeX(notes: Notes): string {
  // Implementation here
}

export function renderAsciiTab(notes: Notes, tuning?: Tuning): string {
  // Implementation here
}
```

### compose.ts (Pipe/Compose Utilities)
```typescript
import { buildScale, applyPattern, renderAlphaTeX, Notes, Tuning, Shape } from "./core";

// Generic utilities
export function pipe<T>(initial: T) {
  return (...fns: ((x: any) => any)[]) => fns.reduce((acc, fn) => fn(acc), initial);
}

export function compose<T>(...fns: ((x: any) => any)[]) {
  return (input: T) => fns.reduceRight((acc, fn) => fn(acc), input);
}

// Transform factories for composition
export const withShape =
  (shape: Shape, scaleName: string, tuning?: Tuning) =>
  (_input: any): Notes =>
    buildScale(shape, scaleName, tuning);

export const withPattern =
  (pattern: string) =>
  (notes: Notes): Notes =>
    applyPattern(notes, pattern as any);

export const toAlphaTeX = (notes: Notes): string => renderAlphaTeX(notes);
export const toAsciiTab = (notes: Notes): string => renderAsciiTab(notes);
```

### index.ts (Export Both APIs)
```typescript
// Simple API (Approach 5)
export {
  buildScale,
  applyPattern,
  renderAlphaTeX,
  renderAsciiTab,
  STANDARD_TUNING,
  DROP_D_TUNING,
  // Types
  type Shape,
  type Tuning,
  type Notes,
  type PatternName,
} from "./core";

// Advanced API (Approach 2)
export {
  pipe,
  compose,
  withShape,
  withPattern,
  toAlphaTeX,
  toAsciiTab,
} from "./compose";

// Constants
export { Shapes } from "./shapes";
```

### examples.ts (Usage Documentation)
```typescript
import {
  // Simple API
  buildScale,
  applyPattern,
  renderAlphaTeX,
  renderAsciiTab,
  STANDARD_TUNING,
  DROP_D_TUNING,
  // Advanced API
  pipe,
  compose,
  // Constants
  Shapes,
} from "./index";

// SIMPLE APPROACH (Beginners)
export const simpleExample = () => {
  const notes = buildScale(Shapes.E, "A4 major");
  const pattern = applyPattern(notes, "thirds");
  const tab = renderAlphaTeX(pattern);
  console.log(tab);
};

// PIPE APPROACH (Advanced)
export const advancedExample = () => {
  const tab = pipe(
    Shapes.E,
    (shape) => buildScale(shape, "A4 major"),
    (notes) => applyPattern(notes, "thirds"),
    renderAlphaTeX
  );
  console.log(tab);
};

// MIXED APPROACH (Best of both)
export const mixedExample = () => {
  // Use simple for basic setup
  const scale = buildScale(Shapes.E, "A4 major", DROP_D_TUNING);
  
  // Use pipe for transformation
  const processed = pipe(
    scale,
    (notes) => applyPattern(notes, "thirds"),
    renderAsciiTab
  );
  
  console.log(processed);
};
```

---

## Template 4: Adding New Features (Extensibility Test)

### Scenario: Add "seventh notes" pattern

**Approach 5 (Simple):**
```typescript
// Just add a new function - no modification needed
export function applyPatternWithSevenths(
  notes: Notes,
  seventhInterval: "major" | "minor"
): Notes {
  const step = 7; // every 7th note
  const filtered = notes.filter((_, i) => i % step === 0);
  return filtered.map(note => {
    // Apply seventh logic
    return note;
  });
}

// Usage
const notes = buildScale(Shapes.E, "A4 major");
const sevenths = applyPatternWithSevenths(notes, "major");
```

**Approach 2 (Pipe):**
```typescript
// Add transform, plug into pipe
export const withSevenths =
  (type: "major" | "minor") =>
  (notes: Notes): Notes => {
    // Implementation
    return notes;
  };

// Usage
const result = pipe(
  Shapes.E,
  (s) => buildScale(s, "A4 major"),
  withSevenths("major"),
  renderAlphaTeX
);
```

**Verdict:** Both equally extensible! ✓

---

## Template 5: Unit Test Templates

### Approach 5 (Simple Functions - Easiest to Test)
```typescript
import { describe, it, expect } from "vitest";
import { buildScale, applyPattern, renderAlphaTeX } from "./core";
import { Shapes, STANDARD_TUNING } from "./constants";

describe("Guitar Shapes - Simple API", () => {
  it("builds a scale from shape and name", () => {
    const notes = buildScale(Shapes.E, "A4 major");
    expect(notes).toContain("A4");
    expect(notes).toContain("B4");
    expect(notes).toContain("C#5");
  });

  it("applies pattern to notes", () => {
    const notes = ["A4", "B4", "C#5", "D5", "E5", "F#5", "G#5"];
    const thirds = applyPattern(notes, "thirds");
    expect(thirds).toEqual(["A4", "C#5", "E5", "G#5"]);
  });

  it("renders to AlphaTeX format", () => {
    const notes = ["A4", "B4", "C#5"];
    const tex = renderAlphaTeX(notes);
    expect(tex).toContain("|");
  });

  it("handles custom tuning", () => {
    const dropD = ["E4", "B3", "G3", "D3", "A2", "D2"];
    const notes = buildScale(Shapes.E, "D4 major", dropD);
    expect(notes.length).toBeGreaterThan(0);
  });
});
```

### Approach 2 (Pipe - More Compositional Tests)
```typescript
import { describe, it, expect } from "vitest";
import { pipe, compose, withPattern, toAlphaTeX } from "./compose";
import { buildScale } from "./core";
import { Shapes } from "./constants";

describe("Guitar Shapes - Pipe API", () => {
  it("pipes shapes through transformations", () => {
    const result = pipe(
      Shapes.E,
      (s) => buildScale(s, "A4 major"),
      (notes) => notes.slice(0, 4)
    );
    expect(result).toHaveLength(4);
  });

  it("composes transforms right-to-left", () => {
    const processor = compose(
      (notes: string[]) => notes.slice(0, 3),
      (shape: any) => buildScale(shape, "A4 major")
    );
    const result = processor(Shapes.E);
    expect(result).toHaveLength(3);
  });

  it("chains multiple transforms", () => {
    const result = pipe(
      Shapes.E,
      (s) => buildScale(s, "A4 major"),
      (notes) => notes.filter((_, i) => i % 3 === 0)
    );
    expect(result).toBeDefined();
  });
});
```

---

## Template 6: Documentation Examples

### For Musicians
```typescript
// 1️⃣ Build the scale
const scale = buildScale(Shapes.E, "A4 major");
// Result: ["A4", "B4", "C#5", "A4", "B4", "C#5", ...]

// 2️⃣ Get every 3rd note (thirds)
const pattern = applyPattern(scale, "thirds");
// Result: ["A4", "C#5", "E5", "G#5", "B5", ...]

// 3️⃣ Show it as tab notation
const tab = renderAsciiTab(pattern);
console.log(tab);
// --|--|--|--
// --|--|--|--
```

### For Developers
```typescript
// Functional composition with pipe
const guitarTab = pipe(
  "A4 major",
  (scaleName) => Scale.get(scaleName).notes,
  (notes) => buildScale(Shapes.E, "A4 major"),
  (notes) => applyPattern(notes, "thirds"),
  renderAlphaTeX
);

// Or use compose for reusable pipelines
const scalesToTab = compose(
  renderAlphaTeX,
  (notes: string[]) => applyPattern(notes, "thirds"),
  (shape: Shape) => buildScale(shape, "A4 major")
);

[Shapes.C, Shapes.A, Shapes.G]
  .map(scalesToTab)
  .forEach(console.log);
```

---

## Quick Copy-Paste Checklist

### Starting a New Project with This Template

- [ ] Copy `core.ts` template (Approach 5)
- [ ] Implement core functions:
  - [ ] `buildScale()`
  - [ ] `applyPattern()`
  - [ ] Output renderers (`renderAlphaTeX()`, `renderAsciiTab()`)
- [ ] Test simple API thoroughly
- [ ] Release v1.0 with simple API only

### Later: Adding Power User Features

- [ ] Copy `compose.ts` template (Approach 2)
- [ ] Implement `pipe()` and `compose()` utilities
- [ ] Add transform factories (`withShape()`, `withPattern()`)
- [ ] Document advanced examples
- [ ] Release v1.1 with optional advanced API

### Never:

- Don't use Builder (Approach 1) unless there's massive user demand
- Don't use Map chain (Approach 3) for production code
- Don't start with Curried (Approach 4) unless you know your users are FP experts
- Don't combine OOP classes with pure functions (mixing paradigms is confusing)

---

## Summary

Use this structure:

```
Version 1.0: Simple Functions (Approach 5)
│
Version 1.1: Add Pipe/Compose (Approach 2)
│
Version 2.0: (Optional) Builder if demand exists
```

This is the safest, most flexible path that serves both beginners and advanced users without compromise.
