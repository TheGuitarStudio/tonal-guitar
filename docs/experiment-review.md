# Experiment Review — Tonal Compatibility Audit

## Overview

Reviewed all 6 experiment files (126 tests) against Tonal.js's API patterns,
naming conventions, type system, and functional style. This document calls out
issues, incompatibilities, and design gaps.

---

## Issue 1: CRITICAL — `degree` field is semantically wrong for non-diatonic scales

**Where:** All files — `FrettedNote.degree` parsed via `parseInt(ivl.match(/(\d+)/)`

**Problem:** For a pentatonic minor scale with intervals `["1P", "3m", "4P", "5P", "7m"]`,
we parse degree as `1, 3, 4, 5, 7`. But the *scale degree* within a pentatonic is
1st through 5th — not 1, 3, 4, 5, 7. Our degree field conflates "interval number"
with "scale degree."

The pattern walker uses `degree` to match pattern steps like `[1,3,2,4]`.
For a pentatonic, `walkPattern(scale, [1,2,3,4,5])` would try to find degrees
1, 2, 3, 4, 5 — but the pentatonic only has degrees 1, 3, 4, 5, 7. Degrees 2
and 6 don't exist. **The walker silently skips missing degrees.**

**Fix:** Add a `scaleIndex` field (0-based position within the shape's interval list)
separate from `intervalNumber`. Pattern walking should use `scaleIndex`, not
interval number. This matches how `Scale.degrees()` works — degree 1 = first
note, degree 2 = second note, regardless of the interval.

**Tonal alignment:** `Scale.degrees("A minor pentatonic")` maps `1→A, 2→C, 3→D, 4→E, 5→G`.
It doesn't skip degrees. Our system should match this.

---

## Issue 2: HIGH — Interval strings are major-scale-only

**Where:** All shape definitions use `"1P", "2M", "3M", "4P", "5P", "6M", "7M"`

**Problem:** These intervals are the major scale intervals. For a minor scale
shape (natural minor, harmonic minor, melodic minor), you'd need `"3m", "6m", "7m"`.
For Dorian, `"3m", "7m"`. Our shape system currently only defines shapes for
major scales.

This isn't a bug per se — the shapes ARE major scale shapes — but it means:
- We can't define a "harmonic minor E shape" without different intervals
- The 3NPS "Dorian" pattern (pattern2_dorian) uses MAJOR intervals labeled
  as starting from the 2nd degree — it's not actually a Dorian shape with
  Dorian intervals

**Design question:** Should shapes encode the actual modal intervals
(`"1P", "2M", "3m", "4P", "5P", "6M", "7m"` for Dorian), or should they
always be "position within the parent major scale"?

**Recommendation:** Support both. A shape's `intervals` could reference
the parent scale (as we do now), but we should also be able to derive the
modal intervals by combining shape + scale type. Tonal's `Mode.notes()` and
`Scale.get()` already handle this.

---

## Issue 3: HIGH — No integration with Tonal's `Scale.get()` or `Mode`

**Where:** `buildFrettedScale` takes a raw `root` string, not a scale name

**Problem:** We pass `"A"` as root but never specify what *kind* of scale.
The shape encodes the intervals, so the scale type is implicit in the shape.
But this means:
- We can't ask "lay out A dorian in E shape" — only "lay out this E-shape-major on root A"
- We can't validate that the shape's intervals match the requested scale
- We can't use `Scale.get("A dorian").intervals` to derive or verify shapes
- We can't integrate with `Key.majorKey("G")` to find what shapes fit

**How Tonal does it:** `Scale.get("A dorian")` returns `{ tonic: "A", type: "dorian",
intervals: ["1P","2M","3m","4P","5P","6M","7m"], notes: ["A","B","C","D","E","F#","G"] }`.
Our system should be able to consume this.

**Fix:** `buildFrettedScale` should accept either:
- `(shape, root)` — current behavior, shape dictates intervals
- `(shape, scaleName)` — where scaleName = "A dorian", and we validate/use
  `Scale.get()` to ensure compatibility

---

## Issue 4: MEDIUM — `FrettedScale` has different fields across files

**Where:** `pattern-walker.test.ts` has `scaleName` field, others don't

**Problem:** The `FrettedScale` interface drifted between experiments:
- `pattern-walker.test.ts`: `{ root, scaleName, shapeName, tuning, notes }`
- `all-shapes.test.ts`: `{ root, shapeName, tuning, notes }` (no `scaleName`)
- `api-comparison.test.ts`: same as `all-shapes`

This is expected in experiments but needs consolidation. The final type should
include both scale name and shape name.

---

## Issue 5: MEDIUM — `Note.transpose(root, ivl)` is used on pitch classes, not notes

**Where:** `buildFrettedScale` — `Note.transpose(root, ivl)` where root = `"A"` (no octave)

**Problem:** `Note.transpose("A", "3M")` returns `"C#"` (pitch class → pitch class).
This works, but it's undocumented behavior — Tonal's `transpose` is designed for
full notes like `Note.transpose("A4", "3M")` → `"C#5"`. We rely on the pitch-class
fallback consistently, but it's fragile.

**Tonal's actual behavior:** When given a pitch class (no octave), `transpose`
returns a pitch class. When given a note with octave, it returns with octave.
This is actually fine and stable, but we should document the assumption.

---

## Issue 6: MEDIUM — Octave calculation is hand-rolled and fragile

**Where:** `buildFrettedScale` — the octave calculation block:
```typescript
const chroma = Note.chroma(targetPc);
const octave = chroma != null ? Math.floor((midi - chroma) / 12) - 1 : null;
const fullNote = octave != null ? `${targetPc}${octave}` : targetPc;
```

**Problem:** This manually constructs note names by computing octaves from MIDI.
Tonal has `Note.fromMidi(midi)` which does this correctly, but it uses its own
enharmonic spelling (may give Db instead of C#). We avoid `fromMidi` for
enharmonic reasons, but our hand-rolled calculation could break for edge cases
(e.g., Cb, B#, double sharps/flats).

**Better approach:** Use `Note.fromMidi(midi)` then `Note.enharmonic(result, targetPc + "0")`
to force the correct spelling. Or construct via Tonal's pitch-note internals.

---

## Issue 7: MEDIUM — `findFretInPosition` has inconsistent range windows

**Where:** Different files use different range constraints:
- `shapes.test.ts`: `referenceFret - 4` to `referenceFret + 8`
- `pattern-walker.test.ts`: `refFret - 4` to `refFret + 8`
- `all-shapes.test.ts`: `ref - 5` to `ref + 9`

**Problem:** The range window (how far from the reference fret we'll search)
varies between files, leading to different shapes being generated from the
same inputs. The wider window in `all-shapes.test.ts` was needed to fix the
D-shape, but it's a band-aid.

**Fix:** The range should be derived from the shape's data, not hardcoded.
A shape could specify its `span` (e.g., 4 frets for CAGED, 5-6 for 3NPS),
and `findFretInPosition` would use that.

---

## Issue 8: MEDIUM — `walkPattern` is ascending-only by default

**Where:** `pattern-walker.test.ts` has separate `walkPattern` (ascending) and
`walkPatternDescending` — two separate functions with duplicated logic.

**Problem:** A real exercise often mixes ascending and descending within one
pattern (e.g., `[1,3,2,4]` — up, down, up, up). Having two functions forces
the user to split their exercise and concatenate.

**Fix:** A single `walkPattern` that infers direction from the degree sequence,
or takes an explicit `direction` parameter per step. The pattern `[1,3,2,4]`
should naturally ascend from 1→3, descend from 3→2, then ascend from 2→4 —
picking the nearest note in the right direction each time.

---

## Issue 9: MEDIUM — Pipe API loses type safety

**Where:** `api-comparison.test.ts` — `pipe<T>(initial: T, ...fns: ((arg: any) => any)[]): any`

**Problem:** The `pipe` function uses `any` for intermediate types, so
TypeScript can't catch errors like piping a string into a function that
expects `FrettedScale`. This is exactly the kind of thing that makes the
pipe pattern frustrating in practice.

**Fix:** Use a properly typed pipe (overloads for 2-6 args) or use a library
like `fp-ts`. Alternatively, stay with the simple functions approach and skip
pipe — Tonal itself doesn't use pipe.

---

## Issue 10: LOW — Naming inconsistency with Tonal conventions

**Where:** Various

Tonal uses these patterns:
- Functions: `get(name)` → object with `empty: boolean` for invalid input
- Named exports: `export function get(...)`, `export function all()`, `export function names()`
- Default export: deprecated, still exists as `{ get, all, names, ... }`
- Types: `ChordType`, `ScaleType`, `Note` (PascalCase for interfaces)
- Falsy returns: empty objects with `empty: true`, not `null`

Our experiments use:
- `buildFrettedScale` — Tonal would call this `get` or `frettedScale`
- Returns `null` for errors — Tonal returns empty objects
- `FrettedNote`, `FrettedScale` — fine, follows Tonal convention
- `ScaleShape` — fine
- `toAsciiTab`, `toAlphaTeX` — fine (output formatters, Tonal doesn't have these)

**Recommendation for final API:**
```typescript
// Following Tonal's naming:
export function get(shape: ScaleShape, root: string, tuning?: Tuning): FrettedScale
export function all(): ScaleShape[]  // all built-in shapes
export function names(): string[]    // all shape names
export function add(shape: ScaleShape): void  // register custom shape
```

---

## Issue 11: LOW — No `empty` pattern for invalid inputs

**Where:** `buildFrettedScale` returns `{ notes: [] }` for invalid inputs

**Problem:** Tonal consistently uses an `empty: boolean` field on return types.
`Chord.get("xyz")` returns `{ empty: true, name: "", ... }`. Our functions
return objects with empty arrays but no `empty` flag.

**Fix:** Add `empty: boolean` to `FrettedScale`:
```typescript
const NoFrettedScale: FrettedScale = { empty: true, root: "", ... };
```

---

## Issue 12: LOW — No connection to Tonal's `Chord.detect()`

**Where:** `api-sketch.test.ts` mentions `Guitar.identify()` but it's unimplemented

**Problem:** Tonal's `Chord.detect(notes)` takes an array of note names and
returns matching chord names. Our `Guitar.identify(frets)` would need to:
1. Convert frets → notes (using tuning)
2. Call `Chord.detect(notes)`
3. Return the result

This is straightforward but untested. The gap is that `Chord.detect` works with
pitch classes, while our fretboard gives full notes with octaves. We'd need to
extract pitch classes first.

---

## Issue 13: LOW — 3NPS mode test is misleading

**Where:** `all-shapes.test.ts` — "pattern 2 from B = B Dorian (same notes)"

**Problem:** The test title says "from B" but the code passes `"A"` as root
for both patterns. It tests that both patterns produce the same pitch classes
when applied to the same root — which is correct (they're all rearrangements
of the same major scale intervals). But it doesn't actually test B Dorian.

To test the real mode relationship, you'd need:
- Pattern 1 applied to root "A" = A Ionian (A B C# D E F# G#)
- Pattern 2 applied to root "B" = B Dorian (B C# D E F# G# A)
- Both should have the same pitch classes

---

## Issue 14: DESIGN GAP — No support for non-standard scale lengths

**Where:** Pattern generators hardcode `7` as scale length

**Problem:** `ascendingIntervals(7, 2)` assumes 7-note scales. Pentatonic (5),
whole-tone (6), octatonic (8), chromatic (12) would need different values.
The scale length should come from the shape or scale, not be hardcoded.

**Fix:** Derive from `shape.strings` — count unique intervals, or accept
scale length as a parameter with sensible default.

---

## Issue 15: DESIGN GAP — No chord-to-shape relationship

**Where:** `shapes.test.ts` has separate `ChordShape` and `ScaleShape` types

**Problem:** There's no connection between a chord shape and its corresponding
scale shape. In CAGED, every chord shape has a matching scale shape. You should
be able to go from "E Shape Major chord" to "E Shape Major scale" and back.

**Fix:** Either unify them (a chord shape IS a scale shape with one note per
string), or link them via the shape name/system.

---

## Issue 16: DESIGN GAP — Missing Tonal integrations for future features

These Tonal modules have no connection to our guitar system yet:

| Module | Integration needed |
|--------|-------------------|
| `Mode.get()` | Map modes to shapes, derive modal intervals |
| `Key.majorKey()` | Get diatonic chords → find CAGED shapes for each |
| `Chord.detect()` | Identify chord from fret positions |
| `Progression` | Apply shapes to chord progressions |
| `RomanNumeral` | Analyze fret patterns as Roman numeral functions |
| `Scale.scaleChords()` | Find what chords fit a scale shape |
| `Scale.rangeOf()` | Generate note sequences within a range |
| `Note.enharmonic()` | Proper enharmonic spelling in all contexts |
| `Pcset.isSubsetOf()` | Check if a chord shape is a subset of a scale shape |

---

## Duplication Across Experiments

The engine code (`buildFrettedScale`, `findNearestFret`, `findFretInPosition`,
`toAsciiTab`) is copy-pasted across 4 files with slight variations. When we
extract to real modules, this all consolidates. But the variations (different
range windows, different return types) need to be reconciled first.

**Files containing engine code:**
- `shapes.test.ts` — original, uses `FretPosition` (no midi field)
- `pattern-walker.test.ts` — adds `midi`, `pc` fields, different range
- `all-shapes.test.ts` — same as pattern-walker
- `api-comparison.test.ts` — compressed copy of all-shapes

---

## Summary: Priority Order for Fixes

1. **Fix degree/scaleIndex confusion** (Issue 1) — blocks correct pentatonic/modal patterns
2. **Add Scale.get() integration** (Issue 3) — enables modal shapes and validation
3. **Unify findFretInPosition range** (Issue 7) — prevents shape bugs
4. **Single bidirectional walkPattern** (Issue 8) — API ergonomics
5. **Add empty pattern** (Issue 11) — Tonal consistency
6. **Consolidate engine code** (Duplication) — prerequisite for module extraction
7. **Non-diatonic scale support** (Issue 14) — pentatonic patterns need this
8. **Typed pipe or drop it** (Issue 9) — API decision
