# Spec Review: Arpeggio & Chord Shapes Detection and Fingerings

## Summary

The scope cut is mostly right-sized for the decision log: chord-tone derivation, registry-driven inference, minimal curated data, and grouped rendering are coherent without pulling in the deferred voicing engine. The spec is unusually testable, which is good.

I would not implement it as written. Two issues can poison the feature: the arpeggio builder conflates chord-root intervals with parent-scale intervals, and several committed fixtures/rank expectations are wrong against the current `buildFrettedScale` anchoring rules. Because those fixtures become assertions, these are blockers.

## BLOCKER

### 1. `arpeggioFromShape` cannot produce the canonical relative arpeggio story

**Spec sections:** Goal, User Stories, §A.1, §A.2, Fixture (a), Fixture (e)

`filterChordTones(scale, intervals)` matches `FrettedNote.interval`, which is relative to the parent scale root. `Chord.get("m7").intervals` returns intervals relative to the chord root. Those are the same only for tonic chords whose chord root equals the built shape root.

That means `arpeggioFromShape(shape, "m7", "A")` builds A major in the selected shape and filters for `1P,3m,5P,7m`; major CAGED/3NPS shapes do not contain `3m` or `7m`, so the result becomes a partial root/fifth skeleton. This contradicts the feature's core guitarist story: "Am7 lives in the G-shape of C major." The spec itself handles Fixture (a) correctly only by manually filtering C major by `{6M,1P,3M,5P}`.

The API needs to distinguish:

- parent scale/root/shape context, e.g. C major G-shape
- target chord symbol/root, e.g. Am7
- comparison basis, preferably pitch-class/chroma for chord membership, not parent interval equality

One fix: keep `filterChordTones` as a low-level interval filter, but make the integration builder operate on a parent `FrettedScale` and chord pitch classes:

```ts
arpeggioFromScale(parent: FrettedScale, chordName: string): FrettedScale
arpeggioFromShape(shape, parentScaleName, chordName, tuning?): FrettedScale
```

Then `arpeggioFromShape(CAGED_G, "C major", "Am7")` can retain A/C/E/G by chroma while preserving parent-scale interval metadata.

### 2. Fixture (d) has the wrong Gmaj7 E-shape note count and omissions

**Spec sections:** Test Fixtures, Fixture (d)

Against `src/data/caged-scales.ts`, CAGED_E contains these `1P/3M/5P/7M` slots:

- low E: `7M`, `1P`
- A: `3M`, `5P`
- D: `7M`, `1P`
- G: `3M`
- B: `5P`
- high E: `7M`, `1P`

That is **10 notes**, not 9. The spec also omits the A-string `3M` and D-string `7M` in its count explanation. For G major E-shape, the retained notes are F#, G, B, D, F#, G, B, D, F#, G.

### 3. Fixture (c) expects `position: 1`, but current build semantics produce anchor `0`

**Spec sections:** §B.2, §B.3(c), Fixture (c)

The spec defines `position` as the built scale's anchor fret. For CAGED_E, the root string intervals are `["7M","1P","2M"]`; `buildFrettedScale` anchors on the first interval, not the root. For F major E-shape, the first interval is E natural on low-E open string, so the built anchor is `0`. The F root is at fret 1, but that is not the current anchor.

So Fixture (c)'s expected `position: 1` is inconsistent with `build.ts`. Either change the fixture to `position: 0`, or change the candidate type to expose both values:

```ts
anchorFret: number; // build engine anchor
rootFret?: number;  // fret of a 1P on the rootString, if present
displayPosition: number;
```

For guitarists and the Lab, `displayPosition: 1` is probably the useful value for an F barre chord.

### 4. Fixture (g) ranking is false under the proposed scoring and current CAGED shapes

**Spec sections:** §B.3, Fixture (g)

The spec says open A `"x02220"` should rank A-shape of A major first, with E-shape of A at position 5 lower. With the current CAGED scale data and the spec's own scoring rules, that does not happen.

Because CAGED_A's root string interval array is `["7M","1P","2M"]`, `buildFrettedScale(CAGED_A, "A")` anchors around fret 11, not open position. CAGED_C of A also gets `anchorHit` on string 1 and scores higher than CAGED_A due to the deterministic scoring terms. E-shape of A anchors at fret 4 under current semantics, not 5.

This fixture should not be committed until the intended "position" model is fixed. If the goal is chord-grip classification, infer against `ChordShape`/curated chord shapes or add a chord-shape-aware scoring path. Scale-shape inference alone does not identify open A as the A CAGED chord form with the current data.

## SHOULD-FIX

### 5. `root` in `InferenceCandidate` is ambiguous

**Spec sections:** D-005, §B, Exact API surface

For Fixture (a), the top candidate reports `root: "C"` even though the played arpeggio is Am7. That is musically valid if `root` means "parent scale/shape root," but it is not valid if users read it as chord root. The user stories use both meanings.

Rename or split the field:

```ts
parentRoot: string;
shapeRoot: string; // if preferred naming
probeRoot?: string;
```

For grip inputs, a detected chord root/name from `identifyChord` may be useful but should be separate from parent-shape root.

### 6. The inference result lacks enough detail for users to understand the ranking

**Spec sections:** §B.3, Exact API surface

Only returning `score` hides the terms that matter: coverage, tightness, anchor hit, root rank, and position agreement. This will make Lab explanations and test failures opaque. Include either a `breakdown` object or export a structured score type:

```ts
score: number;
coverage: number;
matchedIntervals: string[];
breakdown?: {
  tightness: number;
  anchorHit: boolean;
  rootOnAnchorString: boolean;
  positionAgreement: number;
  rootPreference: number;
};
```

### 7. The scoring gate is too permissive for tiny probes and will rank absurd matches

**Spec sections:** §B.2, §B.3, §B.4

Any one- or two-pitch-class probe that is a subset of a scale will produce many high-confidence candidates. Even triads produce many parent-scale interpretations because major-scale pitch-class containment is broad. This is acceptable for an exploratory "ranked candidates" API, but not if top result is presented as "the answer."

Add minimum evidence controls:

- default minimum distinct pitch classes, probably 3
- optional `minCoverage`/`minScore` or `includeWeak` flag
- maybe `inputKind: "grip" | "arpeggio"` internally, so a full arpeggio with many positions can score differently from a cowboy-chord grip

### 8. `matchedIntervals` is underspecified when multiple built notes share a pitch class

**Spec sections:** §B.3, Exact API surface

`builtIntervalsByPc = map chroma -> interval` is safe for seven-note major shapes because each pitch class has one interval. It is not guaranteed for custom systems, chromatic/symmetric scales, or future altered spellings where two intervals can share a chroma. A map overwrites data nondeterministically unless insertion order is explicitly pinned.

Use `Map<number, string[]>` and return unique matched intervals in built note order, or define first-match semantics.

### 9. Shell `m7b5` metadata contradicts the chord-type equality rule

**Spec sections:** Tonal Alignment R-2.4, Data file specs §3

The shell dictionary defines `m7b5` as `["1P 3m 7m", "1P 7m 10m"]`, omitting the flat fifth. That is a standard shell choice, but it violates the earlier rule that a stored `chordType` should round-trip through `Chord.get(chordType).intervals` and equal the shape's chord-tone set.

Clarify that `chordType` can name the intended harmonic function even when the voicing omits tones, and add an `omittedIntervals?: string[]` or `requiredIntervals?: string[]` field if this matters for future voicing lookup.

### 10. Chords-db import is underspecified for concrete open shapes

**Spec sections:** R-4.2, Data file specs §2, R-4.5

`ChordShape` is root-relative geometry, and `applyChordShape(shape, root)` always re-anchors by interval. The spec says open shapes are "stored as concrete (anchored) shapes for the documented key," but the type has no field for the documented key/root, and side-effect registered shapes are not keyed by root except in their name.

Add `root?: string` or `canonicalRoot?: string` for non-movable open shapes, and specify whether applying an open C shape to D is supported, rejected by convention, or simply undefined.

### 11. `scoreShapeMatch`'s pure-tier type contract is incomplete

**Spec sections:** R-2.4, Exact API surface

The exact API exports `scoreShapeMatch(probe: InferenceProbe, ...)`, but `InferenceProbe` is not defined in the public API list. Either export it for tests or keep `scoreShapeMatch` internal and test via `inferShapeContext`. Since R-2.4 explicitly says exported for unit testing, define and export the type from `arpeggio.ts`.

### 12. Formatter grouped input is source-compatible, but not entirely semantic-compatible

**Spec sections:** R-5.2, Formatter changes §1-§2

The flat `FrettedNote[]` path can be byte-identical if implemented carefully. The grouped path changes `notesPerBar`, `noteDurations`, and `rhythmPattern` indexing from notes to groups. That is correct for chord beats, but it should be documented in the option comments and tests.

Also specify empty outer input. Current formatters produce headers/no tab columns naturally; grouped detection via `Array.isArray(notes[0])` treats `[]` as flat. That is fine, but make it explicit.

## CONSIDER

### 13. Add chord-shape inference as a separate or secondary path

**Spec sections:** Goal, User Stories, R-4.x, §B

The product story "holding a chord, what shape is this?" is better served by matching against `ChordShape`s first, especially once open/barre/shell data exists. Scale-shape inference answers "which parent scale position contains these pitch classes?", which is useful but different.

Consider:

```ts
inferChordShape(input, options?): ChordShapeCandidate[]
inferShapeContext(input, options?): ScaleShapeCandidate[]
```

or one API with `target: "scale-shape" | "chord-shape" | "both"`.

### 14. Add an API for diatonic arpeggios by scale degree

**Spec sections:** User Stories, §A

Teachers and Guitar Lab users will expect "give me the ii7/vi7 arpeggio in this shape" as much as "give me Cmaj7 from a C scale." A degree-based helper would avoid forcing users to manually translate Am7 in C major to `{6M,1P,3M,5P}`.

Possible API:

```ts
diatonicArpeggioFromShape(shape, scaleName, degree, chordType?, tuning?)
```

### 15. Add candidate `matchedNotes` or `matchedPositions`

**Spec sections:** Exact API surface

For a teaching/library API, intervals alone are thin. Returning the specific built notes/positions that matched the probe would help display overlays, debug rankings, and compare equivalent pitch-class matches in different neck positions.

### 16. Be stricter about `limit`

**Spec sections:** InferenceOptions

Specify behavior for `limit <= 0`, fractional limits, and `NaN`. Given the library's sentinel style, normalize invalid limits to "no limit" or return `[]`; do not rely on `Array.slice` quirks.

### 17. Consider preserving `scaleType`/`scaleName` differently for arpeggios

**Spec sections:** R-2.3, §A.2

Using `FrettedScale.scaleType = "minor seventh"` works structurally, but an arpeggio is not a scale. This may be acceptable for v0.1, but docs should call it "source/type label" behavior. A future `kind?: "scale" | "arpeggio"` is probably too much for this feature, but the ambiguity is real.

## NITPICK

### 18. Fixture (d) says "count equals ... 9 notes" but its listed slots do not add to 9

**Spec sections:** Fixture (d)

Even within the text's own omitted slot list, the arithmetic is inconsistent. This is covered by Blocker 2, but worth fixing in prose too.

### 19. Fixture (h) should mention that the no-match claim depends on registered systems

**Spec sections:** Fixture (h)

The fixture says no registered shape across all systems matches. That is true for the current built-ins, but future side-effect imports may change "all registered systems." Pin this test by isolating the registry to known built-ins or passing explicit systems.

### 20. `stringSet` should specify whether muted strings inside a set are allowed

**Spec sections:** R-1.1, Data file specs §3

For shell sets this is obvious, but for imported open/barre shapes it matters. Define `stringSet` as "played strings only" and exclude muted strings.

## Music-Theory Verification Notes

- Fixture (a) is correct note-by-note: C major G-shape at anchor 5 filtered to A/C/E/G yields 10 notes: A2, C3, E3, G3, A3, C4, E4, G4, A4, C5 with intervals `6M,1P,3M,5P,6M,1P,3M,5P,6M,1P`.
- Fixture (b) note spelling and pitch classes are correct for `x32010`: C/E/G with C bass.
- Fixture (c) note spelling is correct for `133211`: F/C/F/A/C/F. The expected display position is musically fret 1, but the spec's defined built anchor is 0.
- Fixture (d) count is wrong: Gmaj7 in CAGED_E has 10 retained notes, not 9.
- Fixture (e) 3NPS Pattern 1 maj7 count is correct at 10 notes.
- Fixture (g) open A note spelling is correct, but the expected ranking is wrong under the current build/scoring model.
- Shell dictionary compound `10M`/`10m` usage for R-7-3 orderings is musically correct: the 3rd is voiced above the 7th. The `m7b5` shell omission needs metadata clarification, not interval renaming.

## Biggest Risk

The biggest risk is shipping a feature whose top-level arpeggio API only works for tonic-compatible arpeggios while the product promise is relative/diatonic arpeggios inside parent scale positions. If implemented as specified, the canonical Am7-in-C G-shape example will require a manual low-level interval set, while the friendly `arpeggioFromShape(..., "m7", "A")` path returns a musically misleading partial arpeggio.
