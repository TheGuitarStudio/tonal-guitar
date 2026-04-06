# Guitar Shapes API - Decision Tree & Visual Guide

## Choose Your API Approach

### Decision Tree

```
START: Which matters most?
│
├─ Bundle size & tree-shaking
│  └─ Avoid classes ──→ Eliminate Approach 1
│
├─ IDE discoverability (autocomplete)
│  ├─ Very important ──→ Consider Approach 1
│  └─ Secondary ──→ Continue
│
├─ Users unfamiliar with FP
│  ├─ Mostly musicians ──→ Use Simple (5)
│  └─ Mixed audience ──→ Use Hybrid (2+5)
│
└─ Users love FP composition
   └─ Developers ──→ Use Pipe (2)
```

---

## Audience Segmentation

### 👨‍🎓 Music Teachers & Self-Taught Guitarists
**Primary Need:** Clear, step-by-step instructions

**Recommended:** Approach 5 (Simple)
```typescript
// "Here's what we're doing, step by step"
const scale = buildScale(Shapes.E, "A4 major");
const pattern = applyPattern(scale, "thirds");
const tab = renderAsciiTab(pattern);
```

**Why:** Each line shows exactly what's happening. No magic.

---

### 👨‍💻 JavaScript/TypeScript Developers
**Primary Need:** Composable, elegant abstractions

**Recommended:** Approach 2 (Pipe) OR Hybrid (2+5)
```typescript
// Advanced developers understand this pattern
pipe(
  "A4 major",
  scaleToNotes,
  applyShape("E"),
  applyPattern("thirds"),
  renderTab("alphaTeX")
)
```

**Why:** Similar to RxJS, Ramda, functional libraries they already know.

---

### 🎸 Music App Developers
**Primary Need:** Both clarity AND composition

**Recommended:** Hybrid (2+5)
```typescript
// Simple for quick prototyping
const notes = buildScale(Shapes.E, "A4 major");

// Pipe for complex features
const advancedWorkflow = pipe(
  STANDARD_TUNING,
  selectTuning,
  selectShape("E"),
  selectPattern("thirds"),
  renderForUI
);
```

**Why:** Serves both use cases without forcing a choice.

---

### 🤖 Data Scientists / Musicians Learning Programming
**Primary Need:** Intuitive metaphors from music

**Recommended:** Simple (5) → then introduce Pipe (2)
```typescript
// Start with step-by-step
const s1 = buildScale(Shapes.E, "A4 major");
const s2 = applyPattern(s1, "thirds");

// Graduate to composition
const combined = compose(
  applyPattern(__, "thirds"),
  (shape) => buildScale(shape, "A4 major")
);
```

**Why:** Learning ladder from explicit to abstract.

---

## Data Flow Comparison

### Approach 5: Simple Functions

```
User Input
    ↓
buildScale(shape, scaleName, tuning)
    ↓ [Notes[]]
applyPattern(notes, pattern)
    ↓ [Notes[]]
renderAlphaTeX(notes)
    ↓ [string]
Output
```

**Pros:**
- Clear intermediate values
- Easy to debug (inspect each step)
- Simple to understand
- Good for teaching

**Cons:**
- Verbose for chains
- Requires intermediate variables
- Less elegant

---

### Approach 2: Pipe/Compose

```
pipe(
  input,
  transform1 ──→ transform2 ──→ transform3 ──→ output
)

or

compose(
  transform3(
    transform2(
      transform1(input)
    )
  )
)
```

**Pros:**
- Highly composable
- Reusable transforms
- Elegant, terse
- Functional programming style

**Cons:**
- Less obvious intermediate values
- Requires FP familiarity
- Debugging harder (no intermediate variables)

---

## Side-by-Side: Same Use Case, Different Approaches

### Scenario: Build A major scale in 3 different CAGED shapes, output as tabs

#### Approach 5 (Simple)
```typescript
const shapes = [Shapes.C, Shapes.A, Shapes.G];
const results = shapes.map(shape => {
  const notes = buildScale(shape, "A4 major");
  const pattern = applyPattern(notes, "thirds");
  return renderAsciiTab(pattern);
});
```

#### Approach 2 (Pipe)
```typescript
const shapes = [Shapes.C, Shapes.A, Shapes.G];
const results = shapes.map(shape =>
  pipe(
    shape,
    (s) => buildScale(s, "A4 major"),
    (notes) => applyPattern(notes, "thirds"),
    renderAsciiTab
  )
);
```

#### Approach 2 (Compose)
```typescript
const scalesToTab = compose(
  renderAsciiTab,
  (notes) => applyPattern(notes, "thirds"),
  (shape) => buildScale(shape, "A4 major")
);

const results = [Shapes.C, Shapes.A, Shapes.G].map(scalesToTab);
```

**Readability:** Simple > Pipe > Compose  
**Elegance:** Compose > Pipe > Simple  
**Debuggability:** Simple > Pipe > Compose

---

## Architecture Diagram

### Current Tonal.js Style

```
┌─────────────────────────────────────────────────────┐
│                 Tonal.js Library                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Pure Functions (no classes)                        │
│  ├─ Note functions                                  │
│  ├─ Scale functions                                 │
│  ├─ Chord functions                                 │
│  └─ Higher-level abstractions built on top          │
│                                                     │
│  All composable with pipe/map/compose              │
└─────────────────────────────────────────────────────┘

Guitar Shapes Library (Recommended: Align with this)

┌─────────────────────────────────────────────────────┐
│           Guitar Shapes Library                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Core Functions (Pure, Simple)                      │
│  ├─ buildScale()                                    │
│  ├─ applyPattern()                                  │
│  ├─ filterOctaveRange()                             │
│  └─ getFretPositions()                              │
│                                                     │
│  Output Renderers (Pure)                            │
│  ├─ renderAlphaTeX()                                │
│  ├─ renderAsciiTab()                                │
│  └─ renderHtmlTab()                                 │
│                                                     │
│  Composition Utilities (Optional, for power users) │
│  ├─ pipe()                                          │
│  ├─ compose()                                       │
│  └─ Higher-order helpers                            │
│                                                     │
│  Works seamlessly with Tonal.js ✓                   │
└─────────────────────────────────────────────────────┘
```

---

## Bundle Size Impact

### Webpack Bundle Analysis (Simulated)

```
Approach 1: Builder Pattern
┌─────────────────────────────────┐
│ Core Functions        │ 4KB      │
│ Builder Class Methods │ 8KB 🔴   │ ← Always included
│ Shape Data           │ 3KB      │
│ Total: ~15KB         │          │
└─────────────────────────────────┘
  └─→ If you import one method, all get bundled

Approach 2+5: Hybrid (Simple + Pipe)
┌─────────────────────────────────┐
│ Core Functions      │ 4KB ✓      │ Only what you import
│ Pipe Utility        │ 0.5KB ✓    │ Only if used
│ Output Renderers    │ 1KB ✓      │ Only what you import
│ Shape Data          │ 3KB ✓      │ Only what you import
│ Total: ~3-8.5KB    │            │ Depends on usage
└─────────────────────────────────┘
  └─→ Tree-shaking removes unused code
```

**Real-world example:**
- Using only `buildScale()` with Shapes.E: ~3KB
- Using `buildScale()` + `applyPattern()`: ~3.5KB
- Using full Approach 2+5: ~8.5KB
- Using Approach 1 (Builder): ~15KB

**Savings: ~45-60% smaller bundles**

---

## TypeScript Type Inference Comparison

### Approach 5: Simple Functions

```typescript
const notes = buildScale(Shapes.E, "A4 major");
//    ↑
//    type: string[] ✓ CLEAR

const pattern = applyPattern(notes, "thirds");
//     ↑
//     type: string[] ✓ CLEAR

const tab = renderAlphaTeX(pattern);
//   ↑
//   type: string ✓ CLEAR
```

**Inference: Perfect** ✓  
**IDE Tooltips: Excellent** ✓  
**Autocomplete: Good** ✓

---

### Approach 2: Pipe/Compose

```typescript
pipe(
  "A4 major",
  scaleToNotes,        // (string) → string[]
  applyShape("E"),     // (string[]) → string[]
  applyPattern("thirds") // (string[]) → string[]
)
// Return type: any (generic pipe can't infer)

// Solution: Explicit return type annotation needed
const tab: string = pipe(/* ... */);
```

**Inference: Requires Type Annotations** ⚠️  
**IDE Tooltips: Good** ✓  
**Autocomplete: Okay** ⚠️

---

### Approach 4: Curried Functions

```typescript
withScale("A4 major")(config)
//        ↑
//        Generic, less clear which config fields are set

pipe({},
  withScale("A4 major"),
  withShape("E"),
  withPattern("thirds")
)
// config accumulates, but intermediate types unclear
```

**Inference: Requires Helper Types** ⚠️⚠️  
**IDE Tooltips: Hard to read** ⚠️⚠️  
**Autocomplete: Confusing** ⚠️⚠️

---

## When Each Approach Wins

### Approach 1: Builder/Fluent
✓ Developers want method chaining  
✓ IDE autocomplete is critical  
✓ Users come from Java/C#/C++ world  
✗ Bundle size not a concern  
✗ Willing to sacrifice pure functions  

**Verdict:** Only if IDE UX is your #1 priority

---

### Approach 2: Pipe/Compose ⭐⭐⭐⭐⭐
✓ Developers comfortable with FP  
✓ Building composition-heavy library  
✓ Tree-shaking important  
✓ Tonal.js consistency desired  
✓ Extending with new transforms is common  

**Verdict:** Best for developers, perfect for ecosystems

---

### Approach 3: Map Chain ❌
✗ Semantically confusing  
✗ Type system fights you  
✗ Limited composition  
✓ Intuitive .map() syntax  

**Verdict:** Avoid for production

---

### Approach 4: Curried Functions
✓ Expert FP practitioners only  
✓ Building complex configuration  
✓ Need maximum composition  
✗ Steep learning curve  
✗ Type annotations heavy  

**Verdict:** Niche use case, avoid as primary API

---

### Approach 5: Simple Functions ⭐⭐⭐⭐⭐
✓ Musicians and beginners  
✓ Clear, explicit flow  
✓ Easy to debug  
✓ Best tree-shaking  
✓ Clearest types  
✓ Works great with Tonal.js  
✗ Verbose for deep chains  

**Verdict:** Best for primary API, pair with Approach 2 for power users

---

## The Winning Strategy: Hybrid (2+5)

```
User Journey
│
├─ Musician/Beginner
│  └─ Discovers simple examples
│     └─ buildScale() + applyPattern() + render
│        └─ "Oh, this is how it works" ✓
│
├─ Wants to explore more
│  └─ Reads advanced docs
│     └─ Learns about pipe/compose
│        └─ "Now I can build anything" ✓
│
└─ Power User
   └─ Uses both patterns together
      └─ Simple for clarity + Pipe for composition
         └─ Best of both worlds ✓
```

---

## Making the Final Decision

### Ask yourself:

1. **Who will use this?**
   - Mostly musicians? → Simple (5)
   - Mostly developers? → Pipe (2)
   - Both? → Hybrid (2+5) ⭐

2. **How important is bundle size?**
   - Critical (web/mobile)? → Avoid Builder (1)
   - Not important? → Builder okay
   - Default assumption? → Pipe/Simple (2+5)

3. **Will users compose transformations deeply?**
   - Rarely? → Simple (5) is fine
   - Frequently? → Hybrid (2+5)
   - Constantly? → Pipe (2) + Compose

4. **Is IDE autocomplete critical?**
   - Yes? → Builder (1)
   - No? → Keep it simple (5)

5. **Must align with Tonal.js philosophy?**
   - Yes? → Pipe (2) or Hybrid (2+5)
   - No? → Any approach works

---

## Recommended Path Forward

### Phase 1: MVP (Simple Functions Only)
- Implement core: `buildScale()`, `applyPattern()`, renderers
- Document with beginner-friendly examples
- Release and gather feedback

### Phase 2: Power User Features (Add Pipe)
- Add `pipe()` and `compose()` utilities
- Show advanced composition examples
- Add real-world complex scenarios

### Phase 3: Optional Enhancement (Builder)
- Only if user demand justifies it
- Deprecate in favor of Approach 5+2
- Keep it optional (separate import)

---

## Bottom Line

**Recommended: Hybrid Approach (2+5)**

- Start with simple functions for 80% of users
- Add pipe/compose for 20% who want power
- 100% pure functions (Tonal.js aligned)
- Perfect tree-shaking (no bundle bloat)
- Clear learning path (simple → advanced)
- Best of both worlds

Implement it as:
```typescript
// Primary API (Approach 5)
export { buildScale, applyPattern, renderAlphaTeX, renderAsciiTab }

// Advanced API (Approach 2)
export { pipe, compose, withShape, withPattern }

// Users choose what fits their need
```

This is the safest, most flexible design that serves the broadest audience without sacrificing performance or code quality.
