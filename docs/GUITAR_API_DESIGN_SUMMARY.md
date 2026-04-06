# Guitar Shapes API Design - Executive Summary

## The Challenge

Design an API for a guitar shapes library that:
- Composes naturally with Tonal.js (pure functions)
- Feels natural to guitarists AND developers
- Supports deep composition without becoming verbose
- Works well with TypeScript's type system
- Is tree-shakeable and performant

## Five Design Approaches Evaluated

### 1. Builder/Fluent Pattern
```typescript
new GuitarScaleBuilder("A4 major")
  .shape("E")
  .pattern("thirds")
  .toAlphaTeX()
```
- **Best for:** IDE autocomplete devotees, Java/C# developers
- **Worst for:** Bundle size, pure functional consistency

### 2. Pipe/Compose Pattern ⭐⭐⭐⭐⭐
```typescript
pipe(
  "A4 major",
  scaleToNotes,
  applyShape("E"),
  applyPattern("thirds"),
  formatOutput("alphaTeX")
)
```
- **Best for:** Functional programmers, composition-heavy workflows
- **Worst for:** Musicians unfamiliar with function composition

### 3. Functional Map Chain
```typescript
Scale.degrees("A4 major")
  .map(Shape.caged("E"))
  .map(Pattern.interval("thirds"))
```
- **Best for:** Proof-of-concept demos
- **Worst for:** Production use (semantically confusing)

### 4. Curried Functions
```typescript
pipe({},
  withScale("A4 major"),
  withShape("E"),
  withPattern("thirds")
)(build)
```
- **Best for:** Expert functional programmers
- **Worst for:** Learning curve (too steep)

### 5. Simple Function Composition ⭐⭐⭐⭐⭐
```typescript
const notes = buildScale(CAGED_E, "A4 major");
const pattern = applyPattern(notes, "thirds");
const tab = renderAlphaTeX(pattern);
```
- **Best for:** Musicians, clarity, performance
- **Worst for:** Deep composition chains

---

## Quick Comparison

| Aspect | 1: Builder | 2: Pipe | 3: Map | 4: Curried | 5: Simple |
|--------|-----------|--------|-------|-----------|-----------|
| **Guitarist-friendly** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Developer-friendly** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Composable** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Tree-shakeable** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Tonal.js consistent** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Learning curve** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Type safety** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Final Recommendation: Hybrid Approach 2+5

**Implement BOTH approaches in a single library:**

### Primary API (Approach 5 - Simple Functions)
Perfect for musicians and clarity:
```typescript
const notes = buildScale(Shapes.E, "A4 major");
const pattern = applyPattern(notes, "thirds");
const tab = renderAlphaTeX(pattern);
```

### Advanced API (Approach 2 - Pipe/Compose)
Perfect for power users and composition:
```typescript
const tab = pipe(
  "A4 major",
  scaleToNotes,
  applyShape("E"),
  applyPattern("thirds"),
  formatOutput("alphaTeX")
);
```

**Why this works:**
✅ Beginners use simple functions immediately  
✅ Advanced users have composition tools  
✅ Single codebase, no duplication  
✅ 100% pure functions (Tonal.js aligned)  
✅ Perfect tree-shaking and performance  
✅ Both patterns coexist without conflict  

---

## Why Not the Others?

| Approach | Why Not |
|----------|---------|
| **Builder (1)** | Violates Tonal's pure function philosophy; poor tree-shaking; all methods pulled into bundle |
| **Map (3)** | Semantically confusing (not really mapping scale degrees); poor fit with JS type system; architectural dead-end |
| **Curried (4)** | Way too steep learning curve for target audience; currying requires expert FP knowledge |

---

## Implementation Checklist

- [ ] Implement core functions (Approach 5):
  - `buildScale(shape, scaleName, tuning?)`
  - `applyPattern(notes, pattern)`
  - `filterOctaveRange(notes, min, max)`
  - `getFretPositions(notes, tuning?)`

- [ ] Implement output formats:
  - `renderAlphaTeX(notes)`
  - `renderAsciiTab(notes, tuning?)`
  - `renderHtmlTab(notes, tuning?)`

- [ ] Add composition utilities (Approach 2):
  - `pipe(initial)(...fns)`
  - `compose(...fns)`
  - Higher-order helpers like `withShape()`, `withPattern()`

- [ ] Documentation:
  - Show simple examples first
  - Advanced composition examples after
  - Real-world use cases for both patterns
  - Performance benchmarks

---

## Code Files Provided

1. **guitar-shapes-api-design.ts**
   - All 5 approaches with full examples
   - Evaluation matrix
   - Detailed pros/cons for each

2. **guitar-shapes-design-analysis.md**
   - Deep-dive analysis
   - Architecture considerations
   - Bundle size impacts
   - Extension scenarios

3. **guitar-shapes-implementation.ts**
   - Production-ready implementation
   - Hybrid approach (Simple + Pipe)
   - Fully typed, documented
   - Real shape definitions (CAGED system)
   - Multiple output formats
   - Practical examples

4. **GUITAR_API_DESIGN_SUMMARY.md** (this file)
   - Executive summary
   - Quick reference
   - Decision matrix

---

## Key Insights

### 1. The User's Original Vision Was On The Right Track
Your `.map()` idea is intuitive but architecturally unsound for this use case. However, the desire for chainable, composable operations is exactly right.

### 2. Tonal.js Philosophy Is Your Best Guide
Tonal uses pure functions, not classes. Following this pattern ensures:
- Consistency with the broader ecosystem
- Better tree-shaking
- Easier testing and composition
- More predictable behavior

### 3. Simple ≠ Less Powerful
Approach 5 (simple functions) isn't limiting. It's the foundation. Approach 2 (pipe) adds composition on top without overcomplicating the base API.

### 4. Bundle Size Matters
Tree-shaking is critical for web libraries. Approach 2+5 loses almost nothing (users import only what they use), while Builder (Approach 1) pulls in all methods.

### 5. Musicians Are Your Primary Users
Even if developers use this library, guitarists care most about clarity. Simple, explicit steps beat clever abstractions.

---

## Next Steps

1. **Review the three code files** provided for implementation details
2. **Choose hybrid approach (2+5)** as baseline
3. **Implement core functions first** (Approach 5 base)
4. **Add pipe/compose utilities** (Approach 2 advanced)
5. **Write documentation** showing both patterns
6. **Gather user feedback** on which pattern resonates

---

## Questions to Consider

- Are your users primarily musicians, developers, or mixed?
- Will this library be used in constrained environments (mobile, web) where bundle size matters?
- Do you want to support very complex, deeply nested compositions?
- Is IDE autocomplete discoverability critical for your audience?

Your answers should reinforce the hybrid (2+5) approach but might push slightly toward one or the other depending on context.
